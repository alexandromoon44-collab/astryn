// Promote an existing user to the "admin" role.
//
// Usage:
//   node scripts/make-admin.js someone@example.com
const path = require("path");
const { DatabaseSync } = require("node:sqlite");

const email = process.argv[2];

if (!email) {
  console.error("Usage: node scripts/make-admin.js <email>");
  process.exit(1);
}

const db = new DatabaseSync(path.join(__dirname, "..", "database.db"));

const normalizedEmail = email.trim().toLowerCase();
const user = db.prepare("SELECT id, username, role FROM users WHERE email = ?").get(normalizedEmail);

if (!user) {
  console.error(`No user found with email: ${normalizedEmail}`);
  db.close();
  process.exit(1);
}

if (user.role === "admin") {
  console.log(`${normalizedEmail} is already an admin.`);
} else {
  db.prepare("UPDATE users SET role = 'admin' WHERE email = ?").run(normalizedEmail);
  console.log(`${normalizedEmail} (${user.username}) is now an admin.`);
}

db.close();
