const dotenv = require("dotenv");

let loaded = false;

function loadConfig() {
  if (loaded) return process.env;
  dotenv.config();
  loaded = true;
  return process.env;
}

module.exports = { loadConfig };
