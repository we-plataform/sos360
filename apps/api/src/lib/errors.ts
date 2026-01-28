export class AppError extends Error {
  constructor(
    public statusCode: number,
    public type: string,
    message: string,
    public details?: unknown,
  ) {
    super(message);
    this.name = "AppError";
  }
}

export class ValidationError extends AppError {
  constructor(
    message: string,
    errors?: Array<{ field: string; message: string }>,
  ) {
    super(400, "validation_error", message, errors);
    this.name = "ValidationError";
  }
}

export class UnauthorizedError extends AppError {
  constructor(message: string = "Não autorizado") {
    super(401, "unauthorized", message);
    this.name = "UnauthorizedError";
  }
}

export class ForbiddenError extends AppError {
  constructor(message: string = "Acesso negado") {
    super(403, "forbidden", message);
    this.name = "ForbiddenError";
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string = "Recurso") {
    super(404, "not_found", `${resource} não encontrado`);
    this.name = "NotFoundError";
  }
}

export class ConflictError extends AppError {
  constructor(message: string) {
    super(409, "conflict", message);
    this.name = "ConflictError";
  }
}

export class TooManyRequestsError extends AppError {
  constructor(
    message: string = "Muitas requisições. Tente novamente mais tarde.",
  ) {
    super(429, "rate_limited", message);
    this.name = "TooManyRequestsError";
  }
}
