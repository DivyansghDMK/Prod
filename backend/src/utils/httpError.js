class HttpError extends Error {
  constructor(message, statusCode = 500, details = null) {
    super(message);
    this.name = "HttpError";
    this.statusCode = statusCode;
    this.details = details;
  }
}

module.exports = { HttpError };

