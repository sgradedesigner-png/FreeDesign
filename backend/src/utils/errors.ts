/**
 * Custom Error Classes
 * These provide better error handling and clearer error messages
 */

/**
 * Base Application Error
 * All custom errors extend this class
 */
export class AppError extends Error {
  public readonly statusCode: number;
  public readonly isOperational: boolean;

  constructor(message: string, statusCode: number = 500, isOperational: boolean = true) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;

    // Maintains proper stack trace for where error was thrown
    Error.captureStackTrace(this, this.constructor);

    // Set the prototype explicitly (for TypeScript)
    Object.setPrototypeOf(this, AppError.prototype);
  }
}

/**
 * 400 Bad Request Error
 * Used for invalid input or malformed requests
 */
export class BadRequestError extends AppError {
  constructor(message: string = 'Буруу хүсэлт') {
    super(message, 400);
    Object.setPrototypeOf(this, BadRequestError.prototype);
  }
}

/**
 * 401 Unauthorized Error
 * Used when authentication is required but missing/invalid
 */
export class UnauthorizedError extends AppError {
  constructor(message: string = 'Нэвтрэх шаардлагатай') {
    super(message, 401);
    Object.setPrototypeOf(this, UnauthorizedError.prototype);
  }
}

/**
 * 403 Forbidden Error
 * Used when user is authenticated but doesn't have permission
 */
export class ForbiddenError extends AppError {
  constructor(message: string = 'Хандах эрхгүй байна') {
    super(message, 403);
    Object.setPrototypeOf(this, ForbiddenError.prototype);
  }
}

/**
 * 404 Not Found Error
 * Used when requested resource doesn't exist
 */
export class NotFoundError extends AppError {
  constructor(message: string = 'Олдсонгүй') {
    super(message, 404);
    Object.setPrototypeOf(this, NotFoundError.prototype);
  }
}

/**
 * 409 Conflict Error
 * Used for duplicate records or conflicting operations
 */
export class ConflictError extends AppError {
  constructor(message: string = 'Зөрчилдөөн гарлаа') {
    super(message, 409);
    Object.setPrototypeOf(this, ConflictError.prototype);
  }
}

/**
 * 422 Unprocessable Entity Error
 * Used when request is valid but semantically incorrect
 */
export class UnprocessableEntityError extends AppError {
  constructor(message: string = 'Боловсруулах боломжгүй') {
    super(message, 422);
    Object.setPrototypeOf(this, UnprocessableEntityError.prototype);
  }
}

/**
 * 503 Service Unavailable Error
 * Used when external service (QPay, Database) is unavailable
 */
export class ServiceUnavailableError extends AppError {
  constructor(message: string = 'Үйлчилгээ түр ашиглах боломжгүй байна') {
    super(message, 503);
    Object.setPrototypeOf(this, ServiceUnavailableError.prototype);
  }
}

/**
 * Payment Service Error
 * Specific error for QPay/payment issues
 */
export class PaymentServiceError extends ServiceUnavailableError {
  constructor(message: string = 'Төлбөрийн систем түр ашиглах боломжгүй байна') {
    super(message);
    Object.setPrototypeOf(this, PaymentServiceError.prototype);
  }
}

/**
 * Database Connection Error
 * Specific error for database connectivity issues
 */
export class DatabaseConnectionError extends ServiceUnavailableError {
  constructor(message: string = 'Өгөгдлийн санд холбогдож чадсангүй') {
    super(message);
    Object.setPrototypeOf(this, DatabaseConnectionError.prototype);
  }
}

/**
 * Validation Error
 * Used for business logic validation failures
 */
export class ValidationError extends BadRequestError {
  public readonly details?: any;

  constructor(message: string = 'Оруулсан өгөгдөл буруу байна', details?: any) {
    super(message);
    this.details = details;
    Object.setPrototypeOf(this, ValidationError.prototype);
  }
}

/**
 * Check if error is operational (safe to expose to client)
 */
export function isOperationalError(error: Error): boolean {
  if (error instanceof AppError) {
    return error.isOperational;
  }
  return false;
}

/**
 * Format error for logging
 */
export function formatErrorForLog(error: Error): {
  message: string;
  stack?: string;
  statusCode?: number;
  isOperational?: boolean;
} {
  const formatted: any = {
    message: error.message,
    stack: error.stack
  };

  if (error instanceof AppError) {
    formatted.statusCode = error.statusCode;
    formatted.isOperational = error.isOperational;
  }

  return formatted;
}

/**
 * Example Usage:
 *
 * // In routes
 * if (!order) {
 *   throw new NotFoundError('Захиалга олдсонгүй');
 * }
 *
 * if (!user.isAdmin) {
 *   throw new ForbiddenError('Админ эрх шаардлагатай');
 * }
 *
 * if (email.exists) {
 *   throw new ConflictError('И-мэйл аль хэдийн бүртгэгдсэн байна');
 * }
 *
 * // QPay service error
 * if (qpayDown) {
 *   throw new PaymentServiceError('QPay систем түр ашиглах боломжгүй');
 * }
 */
