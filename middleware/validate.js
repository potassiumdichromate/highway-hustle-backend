const validate = (schema) => (req, res, next) => {
  try {
    if (schema.body) {
      const { error, value } = schema.body.validate(req.body, {
        abortEarly: false,
        stripUnknown: true,
      });
      if (error) {
        return res.status(400).json({
          success: false,
          error: "Invalid request body",
          code: "VALIDATION_ERROR",
          details: error.details.map((d) => d.message),
        });
      }
      req.body = value;
    }

    if (schema.query) {
      const { error, value } = schema.query.validate(req.query, {
        abortEarly: false,
        stripUnknown: true,
      });
      if (error) {
        return res.status(400).json({
          success: false,
          error: "Invalid query parameters",
          code: "VALIDATION_ERROR",
          details: error.details.map((d) => d.message),
        });
      }
      req.query = value;
    }

    if (schema.params) {
      const { error, value } = schema.params.validate(req.params, {
        abortEarly: false,
        stripUnknown: true,
      });
      if (error) {
        return res.status(400).json({
          success: false,
          error: "Invalid path parameters",
          code: "VALIDATION_ERROR",
          details: error.details.map((d) => d.message),
        });
      }
      req.params = value;
    }

    return next();
  } catch (err) {
    return res.status(500).json({
      success: false,
      error: "Validation middleware failure",
      code: "VALIDATION_MIDDLEWARE_ERROR",
    });
  }
};

module.exports = { validate };
