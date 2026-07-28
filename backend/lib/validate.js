const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function isValidEmail(email) {
  return typeof email === "string" && email.length <= 254 && EMAIL_RE.test(email);
}

function isValidUsername(username) {
  return (
    typeof username === "string" &&
    username.trim().length >= 2 &&
    username.trim().length <= 40
  );
}

function isValidPassword(password) {
  return typeof password === "string" && password.length >= 8 && password.length <= 200;
}

const ALLOWED_PAYMENT_METHODS = ["ABA PayWay", "KHQR", "Credit Card"];

function isValidPayment(payment) {
  return ALLOWED_PAYMENT_METHODS.includes(payment);
}

module.exports = {
  isValidEmail,
  isValidUsername,
  isValidPassword,
  isValidPayment,
  ALLOWED_PAYMENT_METHODS,
};
