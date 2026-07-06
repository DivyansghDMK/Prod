"use strict";

const { getPool } = require("../config/db");

class DesktopRepository {
  constructor(pool = null) {
    this.pool = pool;
  }

  get db() {
    return this.pool || getPool();
  }

  // ─── Desktop Sync Queue Operations ──────────────────────────────────────────

  async createSyncItem(data) {
    const query = `
      INSERT INTO desktop_sync_queue (
        organization_id, device_id, session_id, sync_status, retry_count, last_attempt, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, 0, NULL, NOW(), NOW())
      RETURNING *;
    `;
    const values = [
      data.organization_id,
      data.device_id || null,
      data.session_id || null,
      data.sync_status || "PENDING",
    ];

    const { rows } = await this.db.query(query, values);
    return rows[0];
  }

  async findSyncItemById(id) {
    const query = `SELECT * FROM desktop_sync_queue WHERE id = $1;`;
    const { rows } = await this.db.query(query, [id]);
    return rows[0] || null;
  }

  async updateSyncStatus(id, status, retryCount = null) {
    let retryUpdate = "";
    const values = [id, status];
    let valIndex = 3;

    if (retryCount !== null) {
      retryUpdate = `, retry_count = $${valIndex++}`;
      values.push(retryCount);
    }

    const query = `
      UPDATE desktop_sync_queue
      SET
        sync_status = $2,
        last_attempt = NOW(),
        updated_at = NOW()
        ${retryUpdate}
      WHERE id = $1
      RETURNING *;
    `;

    const { rows } = await this.db.query(query, values);
    return rows[0] || null;
  }

  async getPendingSyncItems(organizationId = null, limit = 50, offset = 0) {
    const conditions = ["sync_status IN ('PENDING', 'FAILED')"];
    const values = [];
    let p = 1;

    if (organizationId) {
      conditions.push(`organization_id = $${p++}`);
      values.push(organizationId);
    }

    values.push(limit, offset);
    const lp = p++;
    const op = p;

    const query = `
      SELECT * FROM desktop_sync_queue
      WHERE ${conditions.join(" AND ")}
      ORDER BY created_at ASC
      LIMIT $${lp} OFFSET $${op};
    `;

    const { rows } = await this.db.query(query, values);
    return rows;
  }

  // ─── Heartbeat & Device Operations ─────────────────────────────────────────

  async updateDeviceHeartbeat(deviceSerial, appVersion, firmwareVersion, syncStatus) {
    const client = await this.db.connect();
    try {
      await client.query("BEGIN");

      // Find the device
      const findQuery = `
        SELECT id, organization_id FROM devices
        WHERE machine_serial = $1 OR rhythmulta_serial = $1
        LIMIT 1;
      `;
      const { rows } = await client.query(findQuery, [deviceSerial]);
      const device = rows[0] || null;

      if (!device) {
        await client.query("COMMIT");
        return null;
      }

      // Update the device
      const updateQuery = `
        UPDATE devices
        SET
          last_heartbeat = NOW(),
          last_sync = NOW(),
          firmware_version = COALESCE($2, firmware_version),
          updated_at = NOW()
        WHERE id = $1
        RETURNING *;
      `;
      const { rows: updatedRows } = await client.query(updateQuery, [device.id, firmwareVersion || null]);

      // Record a heartbeat entry in device_heartbeats
      const heartbeatQuery = `
        INSERT INTO device_heartbeats (device_id, heartbeat_time, app_version, firmware_version, status)
        VALUES ($1, NOW(), $2, $3, $4);
      `;
      await client.query(heartbeatQuery, [
        device.id,
        appVersion || null,
        firmwareVersion || null,
        syncStatus || "ONLINE"
      ]);

      await client.query("COMMIT");
      return updatedRows[0];
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  }
}

function createDesktopRepository(pool) {
  return new DesktopRepository(pool);
}

module.exports = { DesktopRepository, createDesktopRepository };
