require("./lib/loadEnv")();

const express = require("express");
const { DatabaseSync } = require("node:sqlite");
const bcrypt = require("bcrypt");
const session = require("express-session");
const path = require("path");
const crypto = require("crypto");

const { securityHeaders, rateLimit } = require("./lib/security");
const {
  isValidEmail,
  isValidUsername,
  isValidPassword,
  isValidPayment,
} = require("./lib/validate");

const app = express();
const PORT = process.env.PORT || 3000;
const NODE_ENV = process.env.NODE_ENV || "development";
const IS_PRODUCTION = NODE_ENV === "production";

// --- Session secret ---------------------------------------------------
// In production this must come from the environment. Falling back to a
// hardcoded string there would let anyone forge session cookies.
let SESSION_SECRET = process.env.SESSION_SECRET;
if (!SESSION_SECRET) {
  if (IS_PRODUCTION) {
    console.error(
      "FATAL: SESSION_SECRET must be set in the environment when NODE_ENV=production."
    );
    process.exit(1);
  }
  SESSION_SECRET = crypto.randomBytes(32).toString("hex");
  console.warn(
    "WARNING: SESSION_SECRET not set — generated a random one for this dev run.\n" +
      "Sessions will not survive a restart. Set SESSION_SECRET in backend/.env."
  );
}

// --- Database -----------------------------------------------------------
const db = new DatabaseSync(path.join(__dirname, "database.db"));
db.exec("PRAGMA foreign_keys = ON");

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'user',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
)
`);

// CREATE TABLE IF NOT EXISTS won't add columns to a users table that
// already existed before they were introduced, so add them here and
// ignore the error if they're already there.
for (const migration of [
  `ALTER TABLE users ADD COLUMN role TEXT NOT NULL DEFAULT 'user'`,
  `ALTER TABLE users ADD COLUMN created_at DATETIME DEFAULT CURRENT_TIMESTAMP`,
]) {
  try {
    db.exec(migration);
  } catch (err) {
    // column already exists — fine
  }
}

db.exec(`
CREATE TABLE IF NOT EXISTS products (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  price REAL NOT NULL,
  image TEXT
)
`);

db.exec(`
CREATE TABLE IF NOT EXISTS orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_email TEXT NOT NULL,
  total REAL NOT NULL,
  payment TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
)
`);

db.exec(`
CREATE TABLE IF NOT EXISTS order_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id INTEGER NOT NULL REFERENCES orders(id),
  product_id INTEGER NOT NULL REFERENCES products(id),
  name TEXT NOT NULL,
  price REAL NOT NULL,
  quantity INTEGER NOT NULL
)
`);

// Only seed once — without this check the products list would
// duplicate itself every time the server restarts.
const productCount = db.prepare("SELECT COUNT(*) as count FROM products").get();

if (productCount.count === 0) {
  const products = [
    ["Espresso", 2, "images/espresso.jpg"],
    ["Americano", 2, "images/americano.jpg"],
    ["Cappuccino", 2, "images/cappuccino.jpg"],
    ["Latte", 2, "images/latte.jpg"],
    ["Flat White", 2, "images/flat-white.jpg"],
    ["Macchiato", 2, "images/macchiato.jpg"],
    ["Mocha", 2, "images/mocha.jpg"],
    ["Iced Americano", 2, "images/iced-americano.jpg"],
    ["Iced Latte", 2, "images/iced-latte.jpg"],
    ["Cold Brew", 2, "images/cold-brew.jpg"],
    ["Nitro Cold Brew", 2, "images/nitro-cold-brew.jpg"],
    ["Iced Mocha", 2, "images/iced-mocha.jpg"],
    ["Espresso Tonic", 2, "images/espresso-tonic.jpg"],
    ["Caramel Latte", 2, "images/caramel-latte.jpg"],
    ["Vanilla Latte", 2, "images/vanilla-latte.jpg"],
    ["Hazelnut Latte", 2, "images/hazelnut-latte.jpg"],
    ["Brown Sugar Latte", 2, "images/brown-sugar-latte.jpg"],
    ["Honey Cinnamon Latte", 2, "images/honey-cinnamon-latte.jpg"],
    ["Salted Caramel Cold Brew", 2, "images/salted-caramel-cold-brew.jpg"],
    ["Matcha Latte", 2, "images/matcha-latte.jpg"],
    ["Hot Chocolate", 2, "images/hot-chocolate.jpg"],
    ["Strawberry Milk", 2, "images/strawberry-milk.jpg"],
    ["Boba", 2, "images/boba.jpg"],
  ];

  const stmt = db.prepare("INSERT INTO products(name,price,image) VALUES (?,?,?)");
  for (const p of products) {
    stmt.run(...p);
  }
}
app.use('/images', express.static(path.join(__dirname, "../frontend/images")));

// --- Core middleware ------------------------------------------------------
app.use(securityHeaders);
app.use(express.json({ limit: "100kb" }));

// Hosting platforms put the app behind a reverse proxy —
// this is needed for secure cookies to work correctly there.
app.set("trust proxy", 1);

app.use(
  session({
    name: "astryn.sid",
    secret: SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: IS_PRODUCTION,
      sameSite: "lax",
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    },
  })
);

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: "Too many attempts, please try again in a few minutes",
});

function requireAuth(req, res, next) {
  if (!req.session.user) {
    return res.status(401).json({ success: false, message: "Please login first" });
  }
  next();
}

function requireAdmin(req, res, next) {
  if (!req.session.user) {
    return res.status(401).json({ success: false, message: "Please login first" });
  }
  if (req.session.user.role !== "admin") {
    return res.status(403).json({ success: false, message: "Admins only" });
  }
  next();
}

// Wraps an async route handler so rejected promises reach the error
// middleware instead of crashing the process or hanging the request.
function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

// --- Auth routes ------------------------------------------------------
app.post(
  "/api/register",
  authLimiter,
  asyncHandler(async (req, res) => {
    const { username, password } = req.body || {};
    const email = typeof req.body?.email === "string" ? req.body.email.trim().toLowerCase() : "";

    if (!isValidUsername(username)) {
      return res.status(400).json({ success: false, message: "Username must be 2-40 characters" });
    }
    if (!isValidEmail(email)) {
      return res.status(400).json({ success: false, message: "Enter a valid email address" });
    }
    if (!isValidPassword(password)) {
      return res.status(400).json({ success: false, message: "Password must be at least 8 characters" });
    }

    const hashedPassword = await bcrypt.hash(password, 12);
    const role = process.env.ADMIN_EMAIL && email === process.env.ADMIN_EMAIL.toLowerCase()
      ? "admin"
      : "user";

    try {
      db.prepare("INSERT INTO users(username,email,password,role) VALUES(?,?,?,?)").run(
        username.trim(),
        email,
        hashedPassword,
        role
      );

      res.json({ success: true, message: "Account created" });
    } catch (err) {
      res.status(409).json({ success: false, message: "Email already exists" });
    }
  })
);

app.post(
  "/api/login",
  authLimiter,
  asyncHandler(async (req, res) => {
    const email = typeof req.body?.email === "string" ? req.body.email.trim().toLowerCase() : "";
    const { password } = req.body || {};

    if (!isValidEmail(email) || typeof password !== "string" || !password) {
      return res.status(400).json({ success: false, message: "Invalid credentials" });
    }

    const user = db.prepare("SELECT * FROM users WHERE email = ?").get(email);

    // Always run bcrypt.compare, even with a dummy hash, so responses for
    // "no such user" and "wrong password" take the same amount of time.
    const passwordHash = user ? user.password : "$2b$12$invalidsaltinvalidsaltinuseonly0000000000000000000000";
    const match = await bcrypt.compare(password, passwordHash);

    if (!user || !match) {
      return res.status(401).json({ success: false, message: "Invalid credentials" });
    }

    req.session.regenerate((err) => {
      if (err) return res.status(500).json({ success: false, message: "Login failed" });

      req.session.user = {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
      };

      res.json({
        success: true,
        username: user.username,
        email: user.email,
        role: user.role,
      });
    });
  })
);

app.get("/api/me", (req, res) => {
  if (!req.session.user) {
    return res.status(401).json({ success: false });
  }
  res.json({ success: true, ...req.session.user });
});

app.post("/api/logout", (req, res) => {
  req.session.destroy(() => {
    res.clearCookie("astryn.sid");
    res.json({ success: true });
  });
});

// --- Product routes ------------------------------------------------------
app.get("/api/products", (req, res) => {
  const rows = db.prepare("SELECT id, name, price, image FROM products ORDER BY id").all();
  res.json(rows);
});

// --- Order routes ------------------------------------------------------
// The client sends *what* it wants to buy (product ids + quantities);
// prices always come from the database, never from the request body.
// This is what stops someone from tampering with the total in devtools.
app.post(
  "/api/orders",
  requireAuth,
  asyncHandler(async (req, res) => {
    const { items, payment } = req.body || {};

    if (!isValidPayment(payment)) {
      return res.status(400).json({ success: false, message: "Invalid payment method" });
    }
    if (!Array.isArray(items) || items.length === 0 || items.length > 100) {
      return res.status(400).json({ success: false, message: "Cart is empty" });
    }

    const productStmt = db.prepare("SELECT id, name, price FROM products WHERE id = ?");
    const resolvedItems = [];

    for (const item of items) {
      const productId = Number(item?.productId);
      const quantity = Number(item?.quantity);

      if (!Number.isInteger(productId) || !Number.isInteger(quantity) || quantity < 1 || quantity > 50) {
        return res.status(400).json({ success: false, message: "Invalid item in cart" });
      }

      const product = productStmt.get(productId);
      if (!product) {
        return res.status(400).json({ success: false, message: "One of the items no longer exists" });
      }

      resolvedItems.push({ ...product, quantity });
    }

    const total = resolvedItems.reduce((sum, item) => sum + item.price * item.quantity, 0);

    db.exec("BEGIN");
    try {
      const orderResult = db
        .prepare("INSERT INTO orders(user_email,total,payment) VALUES(?,?,?)")
        .run(req.session.user.email, total, payment);

      const orderId = Number(orderResult.lastInsertRowid);
      const itemStmt = db.prepare(
        "INSERT INTO order_items(order_id,product_id,name,price,quantity) VALUES(?,?,?,?,?)"
      );

      for (const item of resolvedItems) {
        itemStmt.run(orderId, item.id, item.name, item.price, item.quantity);
      }

      db.exec("COMMIT");
      res.json({ success: true, orderId, total });
    } catch (err) {
      db.exec("ROLLBACK");
      throw err;
    }
  })
);

app.get("/api/orders", requireAuth, (req, res) => {
  const orders = db
    .prepare("SELECT * FROM orders WHERE user_email=? ORDER BY id DESC")
    .all(req.session.user.email);

  const itemsStmt = db.prepare(
    "SELECT name, price, quantity FROM order_items WHERE order_id = ?"
  );

  const withItems = orders.map((order) => ({
    ...order,
    items: itemsStmt.all(order.id),
  }));

  res.json(withItems);
});

// --- Admin routes ------------------------------------------------------
app.get("/api/admin/stats", requireAdmin, (req, res) => {
  const userData = db.prepare("SELECT COUNT(*) as users FROM users").get();
  const orderData = db.prepare("SELECT COUNT(*) as orders, SUM(total) as revenue FROM orders").get();

  res.json({
    users: userData.users,
    orders: orderData.orders || 0,
    revenue: orderData.revenue || 0,
  });
});

app.get("/api/admin/orders", requireAdmin, (req, res) => {
  const orders = db.prepare("SELECT * FROM orders ORDER BY id DESC LIMIT 100").all();
  res.json(orders);
});

app.get("/api/admin/users", requireAdmin, (req, res) => {
  const users = db.prepare("SELECT id, username, email, role, created_at FROM users ORDER BY id DESC").all();
  res.json(users);
});

// --- Health check (useful for uptime monitors / hosting platforms) -----
app.get("/api/health", (req, res) => {
  res.json({ status: "ok" });
});

// --- Static frontend ------------------------------------------------------
const frontendDir = path.join(__dirname, "frontend");
app.use(express.static(frontendDir));

app.get("/", (req, res) => {
  res.sendFile(path.join(frontendDir, "index.html"));
});

// --- 404 + error handling ------------------------------------------------
app.use("/api", (req, res) => {
  res.status(404).json({ success: false, message: "Not found" });
});

app.use((req, res) => {
  res.status(404).sendFile(path.join(frontendDir, "index.html"));
});

// Express error-handling middleware (4 args is what makes it one).
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ success: false, message: "Something went wrong" });
});

const server = app.listen(PORT, () => {
  console.log(`Server running: http://localhost:${PORT} [${NODE_ENV}]`);
});

// Graceful shutdown: stop accepting new connections and close the DB
// handle cleanly instead of dropping in-flight requests on the floor.
function shutdown() {
  console.log("Shutting down...");
  server.close(() => {
    db.close();
    process.exit(0);
  });
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

module.exports = app;
