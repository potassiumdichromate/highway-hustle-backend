const jwt = require("jsonwebtoken");

const normalizeIdentifier = (value) => {
  if (!value || typeof value !== "string") return null;
  return value.toLowerCase().trim();
};

const getJwtSecret = () => {
  const secret = process.env.BROWSER_JWT_SECRET;
  if (!secret) {
    throw new Error("BROWSER_JWT_SECRET is required");
  }
  return secret;
};

const getBearerToken = (req) => {
  const header = req.headers?.authorization;
  if (!header || typeof header !== "string") return null;
  const [scheme, token] = header.split(" ");
  if (!/^Bearer$/i.test(scheme) || !token) return null;
  return token.trim();
};

const verifyJwt = (req, res, next) => {
  const token = getBearerToken(req);
  if (!token) {
    return res.status(401).json({
      success: false,
      error: "Missing bearer token",
    });
  }

  try {
    const secret = getJwtSecret();
    const decoded = jwt.verify(token, secret, { algorithms: ["HS256"] });
    const walletAddress = normalizeIdentifier(decoded?.walletAddress);
    const subject = normalizeIdentifier(decoded?.sub || decoded?.identifier);
    req.auth = {
      ...decoded,
      walletAddress,
      subject,
      role: decoded?.role || "user",
    };
    return next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      error: "Invalid or expired token",
      code: "TOKEN_EXPIRED_OR_INVALID",
    });
  }
};

const enforceAuthIdentity = (req, res, next) => {
  if (req.auth?.role === "admin") return next();

  const authIdentifier = req.auth?.walletAddress || req.auth?.subject;
  if (!authIdentifier) {
    return res.status(401).json({
      success: false,
      error: "Invalid auth identity",
      code: "INVALID_AUTH_IDENTITY",
    });
  }

  const candidate =
    normalizeIdentifier(req.query?.user) ||
    normalizeIdentifier(req.query?.address) ||
    normalizeIdentifier(req.body?.user) ||
    normalizeIdentifier(req.body?.address) ||
    normalizeIdentifier(req.body?.walletAddress) ||
    normalizeIdentifier(req.params?.address);

  if (candidate && candidate !== authIdentifier) {
    return res.status(403).json({
      success: false,
      error: "Forbidden identity scope",
      code: "FORBIDDEN_IDENTITY_SCOPE",
    });
  }

  if (req.query) {
    if (req.query.user !== undefined) req.query.user = authIdentifier;
    if (req.query.address !== undefined) req.query.address = authIdentifier;
  }
  if (req.body) {
    if (req.body.user !== undefined) req.body.user = authIdentifier;
    if (req.body.address !== undefined) req.body.address = authIdentifier;
    if (req.body.walletAddress !== undefined) req.body.walletAddress = authIdentifier;
  }
  if (req.params && req.params.address !== undefined) {
    req.params.address = authIdentifier;
  }

  req.identity = authIdentifier;
  return next();
};

const requireAdmin = (req, res, next) => {
  if (req.auth?.role === "admin") return next();
  return res.status(403).json({
    success: false,
    error: "Admin access required",
    code: "ADMIN_REQUIRED",
  });
};

module.exports = { verifyJwt, enforceAuthIdentity, requireAdmin, getJwtSecret };
