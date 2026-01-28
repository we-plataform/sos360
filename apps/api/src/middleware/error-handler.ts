import type { Request, Response, NextFunction } from "express";
import { ZodError } from "zod";
import { Prisma } from "@prisma/client";
import { AppError } from "../lib/errors.js";
import { logger } from "../lib/logger.js";

export function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction,
): void {
  logger.error({ err, path: req.path, method: req.method }, "Error occurred");

  // Zod validation errors
  if (err instanceof ZodError) {
    const errors = err.errors.map((e) => {
      const errorObj: Record<string, unknown> = {
        field: e.path.join(".") || "root",
        message: e.message,
        code: e.code,
      };
      if (e.path.length > 0 && req.body && typeof req.body === "object") {
        const bodyObj = req.body as Record<string, unknown>;
        errorObj.received = bodyObj[e.path[0]];
      }
      return errorObj;
    });

    logger.warn(
      { errors, body: req.body, path: req.path },
      "Validation failed",
    );

    res.status(400).json({
      success: false,
      error: {
        type: "validation_error",
        title: "Validation Failed",
        status: 400,
        errors,
      },
    });
    return;
  }

  // Prisma database errors
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    logger.error({ code: err.code, meta: err.meta }, "Prisma database error");

    // Handle specific Prisma errors
    if (err.code === "P2002") {
      res.status(409).json({
        success: false,
        error: {
          type: "conflict",
          title: "Conflict",
          status: 409,
          detail: "A record with this value already exists",
        },
      });
      return;
    }

    if (err.code === "P2025") {
      res.status(404).json({
        success: false,
        error: {
          type: "not_found",
          title: "Not Found",
          status: 404,
          detail: "Record not found",
        },
      });
      return;
    }

    // Generic Prisma error
    res.status(500).json({
      success: false,
      error: {
        type: "database_error",
        title: "Database Error",
        status: 500,
        detail:
          process.env.NODE_ENV === "development"
            ? err.message
            : "A database error occurred",
      },
    });
    return;
  }

  // Prisma connection/initialization errors
  if (err instanceof Prisma.PrismaClientInitializationError) {
    logger.error(
      {
        err,
        errorCode: err.errorCode,
        clientVersion: err.clientVersion,
      },
      "Prisma initialization error - DATABASE CONNECTION FAILED",
    );

    // Log additional diagnostic info
    if (process.env.NODE_ENV === "development")
      console.error("[ErrorHandler] DATABASE CONNECTION ERROR");
    if (process.env.NODE_ENV === "development")
      console.error("[ErrorHandler] This usually means:");
    if (process.env.NODE_ENV === "development")
      console.error(
        "[ErrorHandler]   1. DATABASE_URL is not configured correctly",
      );
    if (process.env.NODE_ENV === "development")
      console.error("[ErrorHandler]   2. The database server is not reachable");
    if (process.env.NODE_ENV === "development")
      console.error(
        "[ErrorHandler]   3. Network/firewall is blocking the connection",
      );
    if (process.env.NODE_ENV === "development")
      console.error(
        "[ErrorHandler] DATABASE_URL set:",
        !!process.env.DATABASE_URL,
      );

    res.status(503).json({
      success: false,
      error: {
        type: "database_unavailable",
        title: "Database Unavailable",
        status: 503,
        detail:
          "Unable to connect to the database. Please check server configuration.",
        hint:
          process.env.NODE_ENV === "development"
            ? "Check if DATABASE_URL is correctly configured and the database is running"
            : undefined,
      },
    });
    return;
  }

  // Prisma panic/unknown errors
  if (
    err instanceof Prisma.PrismaClientRustPanicError ||
    err instanceof Prisma.PrismaClientUnknownRequestError
  ) {
    logger.error({ err }, "Prisma client error");
    res.status(503).json({
      success: false,
      error: {
        type: "database_unavailable",
        title: "Database Unavailable",
        status: 503,
        detail: "Database connection failed. Please try again later.",
      },
    });
    return;
  }

  // Custom app errors
  if (err instanceof AppError) {
    const errorResponse: Record<string, unknown> = {
      type: err.type,
      title: err.name,
      status: err.statusCode,
      detail: err.message,
    };

    // Only add errors if details exists and is an object or array
    if (
      err.details &&
      (typeof err.details === "object" || Array.isArray(err.details))
    ) {
      errorResponse.errors = err.details;
    }

    res.status(err.statusCode).json({
      success: false,
      error: errorResponse,
    });
    return;
  }

  // Unknown errors - ensure response hasn't been sent
  if (!res.headersSent) {
    res.status(500).json({
      success: false,
      error: {
        type: "internal_error",
        title: "Internal Server Error",
        status: 500,
        detail:
          process.env.NODE_ENV === "development"
            ? err.message
            : "An unexpected error occurred",
      },
    });
  }
}
