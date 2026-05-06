const defaultCodeByStatus = {
  400: "BAD_REQUEST",
  401: "UNAUTHORIZED",
  403: "FORBIDDEN",
  404: "NOT_FOUND",
  409: "CONFLICT",
  422: "UNPROCESSABLE_ENTITY",
  429: "RATE_LIMITED",
  500: "INTERNAL_ERROR",
};

const defaultMessageByStatus = {
  400: "Invalid request",
  401: "Unauthorized",
  403: "Forbidden",
  404: "Endpoint not found",
  409: "Conflict",
  422: "Unprocessable entity",
  429: "Too many requests",
  500: "Internal server error",
};

const getStatusCode = (status) => {
  const numeric = Number(status || 200);
  if (!Number.isFinite(numeric)) return 200;
  return numeric;
};

const normalizeErrorPayload = (status, payload, requestId) => {
  const source = payload && typeof payload === "object" ? payload : {};
  return {
    success: false,
    error:
      typeof source.error === "string"
        ? source.error
        : typeof source.message === "string"
          ? source.message
          : defaultMessageByStatus[status] || "Request failed",
    code:
      typeof source.code === "string"
        ? source.code
        : defaultCodeByStatus[status] || "REQUEST_FAILED",
    requestId: requestId || null,
    ...(Array.isArray(source.details) ? { details: source.details } : {}),
  };
};

const responseContractMiddleware = (req, res, next) => {
  const originalJson = res.json.bind(res);

  res.json = (payload) => {
    const status = getStatusCode(res.statusCode);
    if (status >= 400) {
      return originalJson(normalizeErrorPayload(status, payload, req.requestId));
    }
    return originalJson(payload);
  };

  next();
};

module.exports = { responseContractMiddleware };
