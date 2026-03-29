export class ApiError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly details?: unknown;

  constructor(
    statusCode: number,
    code: string,
    message: string,
    details?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }

  static badRequest(message: string, details?: unknown) {
    return new ApiError(400, 'VALIDATION_ERROR', message, details);
  }

  static unauthorized(message = 'Authentication required') {
    return new ApiError(401, 'UNAUTHORIZED', message);
  }

  static forbidden(message = 'Insufficient permissions') {
    return new ApiError(403, 'FORBIDDEN', message);
  }

  static notFound(message = 'Resource not found') {
    return new ApiError(404, 'NOT_FOUND', message);
  }

  static rateLimited(message = 'Too many requests, please try again later') {
    return new ApiError(429, 'RATE_LIMITED', message);
  }

  static aiServiceError(message = 'AI service temporarily unavailable') {
    return new ApiError(502, 'AI_SERVICE_ERROR', message);
  }

  static internal(message = 'Internal server error') {
    return new ApiError(500, 'INTERNAL_ERROR', message);
  }
}
