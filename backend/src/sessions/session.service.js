"use strict";

const { HttpError } = require("../utils/httpError");
const { createDeviceRepository } = require("../devices/device.repository");
const logger = require("../utils/logger");

class RecordingSessionService {
  constructor(deviceRepository = null) {
    this.deviceRepository = deviceRepository;
    // Simple in-memory storage for active sessions for offline/live tracking
    this.activeSessions = new Map();
  }

  getDeviceRepo(pool) {
    return this.deviceRepository || createDeviceRepository(pool);
  }

  async startSession(payload, pool) {
    const { device_serial, device_info } = payload;
    if (!device_serial) {
      throw new HttpError("device_serial is required", 400);
    }

    const deviceRepo = this.getDeviceRepo(pool);
    // Find device
    const device = await deviceRepo.findByMachineSerial(device_serial) || 
                   await deviceRepo.findByRhythmUltraSerial(device_serial);

    if (!device) {
      throw new HttpError("Device not registered", 404);
    }

    const sessionId = `session_${device.id.slice(0, 8)}_${Date.now()}`;
    
    // Log or track session start
    logger.info({ sessionId, deviceSerial: device_serial }, "Start recording session");

    // Update device heartbeat state
    await deviceRepo.recordHeartbeat({
      deviceId: device.id,
      status: "ONLINE",
      appVersion: device_info?.app_version || "Desktop 1.0",
    });

    this.activeSessions.set(sessionId, {
      deviceId: device.id,
      deviceSerial: device_serial,
      startedAt: new Date(),
      metricsCount: 0,
      waveformsCount: 0,
    });

    return {
      status: "success",
      session_id: sessionId,
      message: "Session started successfully",
    };
  }

  async uploadMetrics(sessionId, payload, pool) {
    const session = this.activeSessions.get(sessionId) || { deviceId: null };
    
    logger.info({ sessionId }, "Metrics upload for session");

    // If device exists, update its heartbeat
    if (session.deviceId) {
      const deviceRepo = this.getDeviceRepo(pool);
      await deviceRepo.recordHeartbeat({
        deviceId: session.deviceId,
        status: "ONLINE",
      });
      session.metricsCount++;
    }

    return {
      status: "success",
      message: "Metrics uploaded successfully",
    };
  }

  async uploadWaveform(sessionId, payload, pool) {
    const session = this.activeSessions.get(sessionId) || { deviceId: null };
    
    logger.info({ sessionId }, "Waveform upload for session");

    // If device exists, update its heartbeat
    if (session.deviceId) {
      const deviceRepo = this.getDeviceRepo(pool);
      await deviceRepo.recordHeartbeat({
        deviceId: session.deviceId,
        status: "ONLINE",
      });
      session.waveformsCount++;
    }

    return {
      status: "success",
      message: "Waveform uploaded successfully",
    };
  }

  async endSession(sessionId, payload, pool) {
    const session = this.activeSessions.get(sessionId);
    
    logger.info({ sessionId }, "End recording session");

    if (session) {
      this.activeSessions.delete(sessionId);
    }

    return {
      status: "success",
      message: "Session ended successfully",
    };
  }
}

// Global service instance
const recordingSessionService = new RecordingSessionService();

module.exports = { recordingSessionService };
