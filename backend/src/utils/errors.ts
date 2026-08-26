/**
 * Application error hierarchy (nodejs-backend-patterns: "Custom Error Classes").
 * Anything thrown that is not an AppError is treated as unexpected by the global
 * error handler and its detail is withheld from clients in production.
 */
export class AppError extends Error {
  constructor(
    public override message: string,
    public statusCode: number = 500,
    public isOperational: boolean = true,
  ) {
    super(message);
    Object.setPrototypeOf(this, AppError.prototype);
    Error.captureStackTrace(this, this.constructor);
  }
}

export class ValidationError extends AppError {
  constructor(
    message: string,
    public errors?: unknown[],
  ) {
    super(message, 400);
    Object.setPrototypeOf(this, ValidationError.prototype);
  }
}

export class NotFoundError extends AppError {
  constructor(message = "Resource not found") {
    super(message, 404);
    Object.setPrototypeOf(this, NotFoundError.prototype);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = "Unauthorized") {
    super(message, 401);
    Object.setPrototypeOf(this, UnauthorizedError.prototype);
  }
}

export class ForbiddenError extends AppError {
  constructor(message = "Forbidden") {
    super(message, 403);
    Object.setPrototypeOf(this, ForbiddenError.prototype);
  }
}

export class ConflictError extends AppError {
  constructor(message: string) {
    super(message, 409);
    Object.setPrototypeOf(this, ConflictError.prototype);
  }
}

/**
 * A financial document was asked to do something its current state forbids —
 * editing an issued invoice, converting a rejected quotation, and so on.
 */
export class DocumentStateError extends AppError {
  constructor(message: string) {
    super(message, 422);
    Object.setPrototypeOf(this, DocumentStateError.prototype);
  }
}
