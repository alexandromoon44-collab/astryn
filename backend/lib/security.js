// Hand-rolled security headers (a small, dependency-free equivalent of
// the common bits of `helmet`) so the app has no unreviewed third-party
// middleware in its request path.
function securityHeaders(req, res, next) {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("X-XSS-Protection", "0"); // modern browsers use CSP instead
  res.setHeader("Cross-Origin-Opener-Policy", "same-origin");
  res.setHeader(
    "Content-Security-Policy",
    [
      "default-src 'self'",
      "img-src 'self' data:",
      "style-src 'self' 'unsafe-inline' https://cdnjs.cloudflare.com",
      "font-src 'self' https://cdnjs.cloudflare.com",
      "script-src 'self'",
      "media-src 'self' https://assets.mixkit.co",
      "connect-src 'self'",
    ].join("; ")
  );

  if (req.secure) {
    res.setHeader(
      "Strict-Transport-Security",
      "max-age=63072000; includeSubDomains"
    );
  }

  next();
}

// Simple in-memory sliding-window rate limiter. Good enough for a
// single-process deployment; swap for a shared store (e.g. Redis) if
// the app ever runs behind multiple instances.
function rateLimit({ windowMs, max, message }) {
  const hits = new Map(); // ip -> [timestamps]

  // Periodically clear out stale entries so this map can't grow forever.
  setInterval(() => {
    const cutoff = Date.now() - windowMs;
    for (const [ip, timestamps] of hits) {
      const fresh = timestamps.filter((t) => t > cutoff);
      if (fresh.length === 0) {
        hits.delete(ip);
      } else {
        hits.set(ip, fresh);
      }
    }
  }, windowMs).unref();

  return (req, res, next) => {
    const ip = req.ip || req.socket.remoteAddress || "unknown";
    const now = Date.now();
    const cutoff = now - windowMs;

    const timestamps = (hits.get(ip) || []).filter((t) => t > cutoff);
    timestamps.push(now);
    hits.set(ip, timestamps);

    if (timestamps.length > max) {
      return res.status(429).json({
        success: false,
        message: message || "Too many requests, please try again later",
      });
    }

    next();
  };
}

module.exports = { securityHeaders, rateLimit };
