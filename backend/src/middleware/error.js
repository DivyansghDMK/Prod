const logger = require("../utils/logger");

function notFoundHandler(req, res) {
  res.status(404).json({
    message: "Route not found",
    path: req.originalUrl,
  });
}

function errorHandler(err, req, res, _next) {
  logger.error({ err, requestId: req.id, userId: req.user?.id }, "Unhandled application error");
  res.status(500).json({
    message: "Internal server error",
  });
}

module.exports = { notFoundHandler, errorHandler };
