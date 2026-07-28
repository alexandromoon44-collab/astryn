// Minimal .env loader — no external dependency required.
// Reads KEY=VALUE lines from a .env file (if present) into process.env,
// without overriding variables the environment already provides.
const fs = require("fs");
const path = require("path");

function loadEnv(envPath = path.join(__dirname, "..", ".env")) {
  if (!fs.existsSync(envPath)) return;

  const contents = fs.readFileSync(envPath, "utf8");

  for (const rawLine of contents.split("\n")) {
    const line = rawLine.trim();

    if (!line || line.startsWith("#")) continue;

    const eqIndex = line.indexOf("=");
    if (eqIndex === -1) continue;

    const key = line.slice(0, eqIndex).trim();
    let value = line.slice(eqIndex + 1).trim();

    // Strip matching surrounding quotes, if any.
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    if (!(key in process.env)) {
      process.env[key] = value;
    }
  }
}

module.exports = loadEnv;
