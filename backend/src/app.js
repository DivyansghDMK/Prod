const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const compression = require("compression");
const rateLimit = require("express-rate-limit");
const crypto = require("crypto");

const { loadConfig } = require("./config/env");
const { errorHandler, notFoundHandler } = require("./middleware/error");
const { getPool } = require("./config/db");
const { getAwsConfig } = require("./config/aws");
const logger = require("./utils/logger");

const authRoutes = require("./auth/auth.routes");
const organizationRoutes = require("./organizations/organization.routes");
const userRoutes = require("./users/user.routes");
const roleRoutes = require("./roles/role.routes");
const permissionRoutes = require("./permissions/permission.routes");
const deviceRoutes = require("./devices/device.routes");
const patientRoutes = require("./patients/patient.routes");
const reportRoutes = require("./reports/report.routes");
const dashboardRoutes = require("./dashboard/dashboard.routes");
const licenseRoutes = require("./license/license.routes");
const sessionRoutes = require("./sessions/session.routes");
const desktopRoutes = require("./desktop/desktop.routes");
const ecgRoutes = require("./ecg/session.routes");

function createApp() {
  loadConfig();

  const app = express();
  app.set("trust proxy", 1);

  // Request ID middleware
  app.use((req, res, next) => {
    req.id = req.headers["x-request-id"] || crypto.randomUUID();
    res.setHeader("x-request-id", req.id);
    next();
  });

  // Pino request logging middleware
  app.use((req, res, next) => {
    const startTime = Date.now();
    res.on("finish", () => {
      const duration = Date.now() - startTime;
      logger.info({
        requestId: req.id,
        userId: req.user?.id || null,
        organizationId: req.organization?.id || null,
        deviceId: req.headers["x-device-id"] || req.query?.device_id || null,
        endpoint: req.originalUrl,
        method: req.method,
        statusCode: res.statusCode,
        responseTimeMs: duration
      }, `${req.method} ${req.originalUrl} processed`);
    });
    next();
  });

  // Security Headers, Compression and CORS
  app.use(helmet());
  app.use(compression());
  
  const allowedOrigins = process.env.CORS_ALLOWED_ORIGINS
    ? process.env.CORS_ALLOWED_ORIGINS.split(",")
    : ["http://localhost:3000", "http://localhost:5173"];
    
  app.use(cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.indexOf(origin) !== -1 || process.env.NODE_ENV !== "production") {
        callback(null, true);
      } else {
        callback(new Error("Not allowed by CORS"));
      }
    },
    credentials: true
  }));

  app.use(express.json({ limit: "10mb" }));
  app.use(express.urlencoded({ extended: true }));
  app.use("/uploads", express.static(require("path").join(__dirname, "../uploads")));

  app.locals.db = { getPool };
  app.locals.aws = getAwsConfig();

  // Rate Limiting for Authentication Endpoints (10 requests / minute)
  const authRateLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 10,
    message: { message: "Too many authentication requests, please try again later." },
    standardHeaders: true,
    legacyHeaders: false,
  });

  const apiPrefix = `/api/${process.env.API_VERSION || "v1"}`;

  app.use(`${apiPrefix}/auth/login`, authRateLimiter);
  app.use(`${apiPrefix}/auth/send-otp`, authRateLimiter);
  app.use(`${apiPrefix}/auth/verify-otp`, authRateLimiter);
  app.use(`${apiPrefix}/auth/refresh`, authRateLimiter);

  // Health endpoint
  app.get("/health", (_req, res) => {
    res.json({
      ok: true,
      service: "cardiox-backend",
      version: process.env.API_VERSION || "v1",
    });
  });

  app.use(`${apiPrefix}/auth`, authRoutes);
  app.use(`${apiPrefix}/organizations`, organizationRoutes);
  app.use(`${apiPrefix}/users`, userRoutes);
  app.use(`${apiPrefix}/roles`, roleRoutes);
  app.use(`${apiPrefix}/permissions`, permissionRoutes);
  app.use(`${apiPrefix}/devices`, deviceRoutes);
  app.use(`${apiPrefix}/patients`, patientRoutes);
  app.use(`${apiPrefix}/reports`, reportRoutes);
  app.use(`${apiPrefix}/dashboard`, dashboardRoutes);
  app.use(`${apiPrefix}/license`, licenseRoutes);
  app.use(`${apiPrefix}/sessions`, sessionRoutes);
  app.use(`${apiPrefix}/desktop`, desktopRoutes);
  app.use(`${apiPrefix}/ecg`, ecgRoutes);

  app.use(notFoundHandler);
  app.use(errorHandler);

  // Scheduled expired sessions cleanup task (Runs every 6 hours)
  const { createAuthRepository } = require("./auth/auth.repository");
  const { createSessionService } = require("./auth/session.service");
  
  setInterval(async () => {
    try {
      const pool = getPool();
      if (pool) {
        const repo = createAuthRepository(pool);
        const sessionService = createSessionService(repo);
        await sessionService.cleanupExpiredSessions();
        logger.info("Successfully executed scheduled expired sessions purge.");
      }
    } catch (err) {
      logger.error({ err }, "Scheduled sessions cleanup execution failed");
    }
  }, 6 * 60 * 60 * 1000); // 6 hours

  return app;
}

module.exports = { createApp };
