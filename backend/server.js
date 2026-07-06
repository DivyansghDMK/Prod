const { createApp } = require("./src/app");
const logger = require("./src/utils/logger");
const { getPool } = require("./src/config/db");

const PORT = process.env.PORT || 4000;
const app = createApp();

const server = app.listen(PORT, () => {
  logger.info(`CardioX backend listening on port ${PORT}`);
});

// Graceful shutdown handling
function handleShutdown(signal) {
  logger.info(`Received ${signal}. Starting graceful shutdown...`);

  // 1. Stop accepting new connections
  server.close(async () => {
    logger.info("HTTP server closed.");

    try {
      // 2. Close PostgreSQL connection pool
      const pool = getPool();
      if (pool) {
        await pool.end();
        logger.info("PostgreSQL database pool closed.");
      }
    } catch (err) {
      logger.error({ err }, "Error closing database pool during shutdown");
    }

    logger.info("Graceful shutdown completed successfully. Exiting.");
    process.exit(0);
  });

  // Force close after 10 seconds if hanging
  setTimeout(() => {
    logger.error("Graceful shutdown timed out. Force exiting.");
    process.exit(1);
  }, 10000);
}

process.on("SIGTERM", () => handleShutdown("SIGTERM"));
process.on("SIGINT", () => handleShutdown("SIGINT"));
