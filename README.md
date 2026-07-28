# Astryn (COFFIG)

A full-stack coffee ordering site: Node.js/Express + SQLite backend, plain
HTML/CSS/JS frontend, served from a single Express server.

## Run it locally

```bash
cd backend
npm install          # only needed if you didn't keep node_modules/
cp .env.example .env # then set SESSION_SECRET (see below)
npm start
```

Open http://localhost:3000

Generate a session secret:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Paste the output into `backend/.env` as `SESSION_SECRET=...`.

## Making an admin account

Either:
- Set `ADMIN_EMAIL=you@example.com` in `backend/.env` **before** registering
  with that address — it's auto-promoted on signup, or
- Promote an existing account:
  ```bash
  cd backend
  node scripts/make-admin.js you@example.com
  ```
  (log out and back in afterwards so the session picks up the new role)

## What's included

**Backend** (`backend/server.js`)
- Auth: register/login/logout with bcrypt-hashed passwords, HttpOnly
  session cookies (`secure` + non-`lax` behavior in production)
- Server-computed order totals — prices always come from the database,
  never trusted from the client, so the cart total can't be tampered with
- Input validation on email/username/password/payment method
- Rate limiting on login & register (protects against brute force)
- Security headers (CSP, X-Frame-Options, etc.)
- Role-gated admin endpoints (`/api/admin/stats`, `/orders`, `/users`)
- Order line items stored per-order (`order_items` table), not just a total
- `/api/health` for uptime checks
- Centralized error handling + graceful shutdown

**Frontend** (`frontend/`)
- Cart with quantities, persisted in `localStorage`
- Order history showing line items, not just a total
- Admin dashboard: stats, recent orders, user list (nav link hidden for
  non-admins)
- Inline validation errors and loading states on auth/checkout actions

## Deploying

Set these environment variables on your host:

| Variable        | Required | Notes                                             |
|-----------------|----------|----------------------------------------------------|
| `SESSION_SECRET`| Yes (prod)| Long random string. Server refuses to start without it when `NODE_ENV=production`. |
| `NODE_ENV`      | Yes      | Set to `production`                                |
| `PORT`          | No       | Defaults to 3000                                   |
| `ADMIN_EMAIL`   | No       | Auto-promotes this email to admin on registration  |

The app runs behind a reverse proxy fine (`trust proxy` is enabled) —
just make sure the proxy forwards `X-Forwarded-Proto` so secure cookies
work correctly.

`database.db` is a SQLite file created automatically on first run and is
gitignored — back it up like any other database file if you care about
the data.

## Known limitations (not included yet)

- No password reset / email verification flow
- No real payment gateway integration — payment method is recorded but
  not actually processed
- Rate limiting is in-memory (per-process); use a shared store (e.g.
  Redis) if you run more than one server instance
