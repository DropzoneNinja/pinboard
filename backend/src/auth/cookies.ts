import type { Request, Response } from 'express';
import { ACCESS_TOKEN_MAX_AGE_MS, REFRESH_TOKEN_MAX_AGE_MS } from './tokens.js';

const ACCESS_COOKIE = 'access_token';
const REFRESH_COOKIE = 'refresh_token';
const AUTH_PATH = '/api/v1/auth';

export function setAuthCookies(req: Request, res: Response, accessToken: string, refreshToken: string): void {
  const secure = req.secure;
  res.cookie(ACCESS_COOKIE, accessToken, {
    httpOnly: true,
    sameSite: 'lax',
    secure,
    path: '/',
    maxAge: ACCESS_TOKEN_MAX_AGE_MS,
  });
  res.cookie(REFRESH_COOKIE, refreshToken, {
    httpOnly: true,
    sameSite: 'lax',
    secure,
    path: AUTH_PATH,
    maxAge: REFRESH_TOKEN_MAX_AGE_MS(),
  });
}

export function clearAuthCookies(req: Request, res: Response): void {
  const secure = req.secure;
  res.clearCookie(ACCESS_COOKIE, { httpOnly: true, sameSite: 'lax', secure, path: '/' });
  res.clearCookie(REFRESH_COOKIE, { httpOnly: true, sameSite: 'lax', secure, path: AUTH_PATH });
}

export function getAccessTokenCookie(req: Request): string | undefined {
  return req.cookies?.[ACCESS_COOKIE];
}

export function getRefreshTokenCookie(req: Request): string | undefined {
  return req.cookies?.[REFRESH_COOKIE];
}
