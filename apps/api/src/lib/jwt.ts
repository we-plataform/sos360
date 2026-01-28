import jwt, { type SignOptions } from "jsonwebtoken";
import type { StringValue } from "ms";
import { env } from "../config/env.js";
import type { JwtPayload, SelectionTokenPayload } from "@lia360/shared";

/**
 * Sign an access token with company and workspace context
 */
export function signAccessToken(
  payload: Omit<JwtPayload, "iat" | "exp">,
): string {
  const options: SignOptions = {
    expiresIn: env.JWT_EXPIRES_IN as StringValue,
  };
  return jwt.sign(payload as object, env.JWT_SECRET as string, options);
}

/**
 * Sign a refresh token (long-lived, used to get new access tokens)
 */
export function signRefreshToken(userId: string): string {
  const options: SignOptions = {
    expiresIn: env.REFRESH_TOKEN_EXPIRES_IN as StringValue,
  };
  return jwt.sign(
    { sub: userId, type: "refresh" } as object,
    env.JWT_SECRET as string,
    options,
  );
}

/**
 * Sign a selection token (short-lived, used after login to select context)
 */
export function signSelectionToken(userId: string): string {
  const options: SignOptions = {
    expiresIn: "5m", // 5 minutes to select context
  };
  return jwt.sign(
    { sub: userId, type: "selection" } as object,
    env.JWT_SECRET as string,
    options,
  );
}

/**
 * Verify an access token and return the payload
 */
export function verifyAccessToken(token: string): JwtPayload {
  return jwt.verify(token, env.JWT_SECRET) as JwtPayload;
}

/**
 * Verify a refresh token and return the payload
 */
export function verifyRefreshToken(token: string): {
  sub: string;
  type: string;
} {
  return jwt.verify(token, env.JWT_SECRET) as { sub: string; type: string };
}

/**
 * Verify a selection token and return the payload
 */
export function verifySelectionToken(token: string): SelectionTokenPayload {
  const payload = jwt.verify(token, env.JWT_SECRET) as SelectionTokenPayload;
  if (payload.type !== "selection") {
    throw new Error("Invalid token type");
  }
  return payload;
}

/**
 * Get token expiration time in seconds
 */
export function getTokenExpiresIn(): number {
  const match = env.JWT_EXPIRES_IN.match(/^(\d+)([smhd])$/);
  if (!match) return 900; // default 15 minutes

  const value = parseInt(match[1], 10);
  const unit = match[2];

  switch (unit) {
    case "s":
      return value;
    case "m":
      return value * 60;
    case "h":
      return value * 3600;
    case "d":
      return value * 86400;
    default:
      return 900;
  }
}

/**
 * Get refresh token TTL (time-to-live) in seconds
 */
export function getRefreshTokenTTL(): number {
  const match = env.REFRESH_TOKEN_EXPIRES_IN.match(/^(\d+)([smhd])$/);
  if (!match) return 259200; // default 3 days

  const value = parseInt(match[1], 10);
  const unit = match[2];

  switch (unit) {
    case "s":
      return value;
    case "m":
      return value * 60;
    case "h":
      return value * 3600;
    case "d":
      return value * 86400;
    default:
      return 259200;
  }
}
