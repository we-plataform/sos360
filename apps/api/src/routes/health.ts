import { Router } from "express";
import { getDatabaseHealth, testDatabaseConnection } from "@lia360/database";

export const healthRouter = Router();

// GET /health - Basic health check (for load balancers/monitoring)
healthRouter.get("/", async (_req, res) => {
  try {
    const dbHealth = await getDatabaseHealth();

    const status =
      dbHealth.status === "healthy"
        ? 200
        : dbHealth.status === "degraded"
          ? 200
          : 503;

    res.status(status).json({
      status: dbHealth.connected ? "ok" : "error",
      timestamp: new Date().toISOString(),
      services: {
        api: "ok",
        database: dbHealth.connected ? "ok" : "error",
      },
    });
  } catch {
    res.status(503).json({
      status: "error",
      timestamp: new Date().toISOString(),
      services: {
        api: "ok",
        database: "error",
      },
    });
  }
});

// GET /health/detailed - Detailed health check (for debugging)
healthRouter.get("/detailed", async (_req, res) => {
  try {
    const dbHealth = await getDatabaseHealth();

    res.json({
      status: dbHealth.status,
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      services: {
        api: {
          status: "healthy",
          version: process.env.npm_package_version || "0.0.1",
          nodeVersion: process.version,
          environment: process.env.NODE_ENV || "development",
        },
        database: {
          status: dbHealth.status,
          connected: dbHealth.connected,
          latency: dbHealth.latency,
          error: dbHealth.error,
          details: dbHealth.details,
        },
      },
      environment: {
        NODE_ENV: process.env.NODE_ENV || "not set",
        DATABASE_URL_SET: !!process.env.DATABASE_URL,
        DIRECT_URL_SET: !!process.env.DIRECT_URL,
        JWT_SECRET_SET: !!process.env.JWT_SECRET,
        CORS_ORIGINS: process.env.CORS_ORIGINS || "not set",
      },
    });
  } catch (error) {
    res.status(500).json({
      status: "unhealthy",
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

// POST /health/test-db - Test database connection with retries
healthRouter.post("/test-db", async (_req, res) => {
  try {
    const result = await testDatabaseConnection(3, 2000);

    res.status(result.success ? 200 : 503).json({
      success: result.success,
      timestamp: new Date().toISOString(),
      latency: result.latency,
      error: result.error,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
});
