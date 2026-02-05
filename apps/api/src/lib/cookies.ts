import type { Response } from 'express';
import { env } from '../config/env.js';
import { getRefreshTokenTTL } from './jwt.js';

/**
 * Cookie names for authentication tokens
 */
export const COOKIE_NAMES = {
  ACCESS_TOKEN: 'accessToken',
  REFRESH_TOKEN: 'refreshToken',
} as const;

/**
 * Standard cookie options for security
 */
const getCookieOptions = () => ({
  httpOnly: true, // Prevents JavaScript access to cookies (XSS protection)
  secure: env.NODE_ENV === 'production', // HTTPS only in production
  sameSite: 'lax' as const, // CSRF protection (allows same-site navigation)
  path: '/', // Available site-wide
  domain: env.NODE_ENV === 'production' ? undefined : undefined, // Can be configured for production
});

/**
 * Set an access token cookie
 */
export function setAccessTokenCookie(res: Response, token: string): void {
  const expiresIn = 30 * 24 * 60 * 60; // 30 days in seconds (default for access tokens)

  res.cookie(COOKIE_NAMES.ACCESS_TOKEN, token, {
    ...getCookieOptions(),
    maxAge: expiresIn * 1000, // Convert to milliseconds
  });
}

/**
 * Set a refresh token cookie
 */
export function setRefreshTokenCookie(res: Response, token: string): void {
  const expiresIn = getRefreshTokenTTL();

  res.cookie(COOKIE_NAMES.REFRESH_TOKEN, token, {
    ...getCookieOptions(),
    maxAge: expiresIn * 1000, // Convert to milliseconds
  });
}

/**
 * Set both access and refresh token cookies
 */
export function setAuthCookies(res: Response, accessToken: string, refreshToken: string): void {
  setAccessTokenCookie(res, accessToken);
  setRefreshTokenCookie(res, refreshToken);
}

/**
 * Clear access token cookie
 */
export function clearAccessTokenCookie(res: Response): void {
  res.clearCookie(COOKIE_NAMES.ACCESS_TOKEN, {
    ...getCookieOptions(),
    maxAge: 0, // Immediately expire
  });
}

/**
 * Clear refresh token cookie
 */
export function clearRefreshTokenCookie(res: Response): void {
  res.clearCookie(COOKIE_NAMES.REFRESH_TOKEN, {
    ...getCookieOptions(),
    maxAge: 0, // Immediately expire
  });
}

/**
 * Clear all authentication cookies
 */
export function clearAuthCookies(res: Response): void {
  clearAccessTokenCookie(res);
  clearRefreshTokenCookie(res);
}
