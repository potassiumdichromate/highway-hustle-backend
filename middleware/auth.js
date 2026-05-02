const jwt = require("jsonwebtoken");

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
    next();
    // return res.status(401).json({
    //   success: false,
    //   error: "Missing bearer token",
    // });
  }

  const secret = process.env.BROWSER_JWT_SECRET || "dev-secret-change-me";
  try {
    const decoded = jwt.verify(token, secret, { algorithms: ["HS256"] });
    req.auth = decoded;
    return next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      error: "Invalid or expired token",
    });
  }
};

module.exports = { verifyJwt };
