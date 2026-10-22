import type { Request, Response } from 'express';
import * as authService from '../services/auth.service.js';
import { sendSuccess } from '../utils/response.js';
import { ApiError } from '../utils/ApiError.js';
import config from '../config/env.js';
import { parseDurationMs } from '../utils/time.js';
import type { RegisterInput } from '../dto/auth.dto.js';

const REFRESH_COOKIE = 'refreshToken';

function refreshCookieOptions(maxAge?: number) {
  return {
    httpOnly: true,
    secure: config.cookie.secure,
    sameSite: config.cookie.sameSite,
    path: '/api/auth',
    ...(maxAge !== undefined ? { maxAge } : {}),
  } as const;
}

export async function login(req: Request, res: Response): Promise<Response> {
  const { email, password } = req.body as { email: string; password: string };

  const result = await authService.login({
    email,
    password,
    ipAddress: req.ip,
    userAgent: req.headers['user-agent'],
  });

  res.cookie(REFRESH_COOKIE, result.refreshToken, refreshCookieOptions(parseDurationMs(config.jwt.refreshTtl)));

  return sendSuccess(res, 200, 'Login successful.', {
    user: result.user,
    accessToken: result.accessToken,
  });
}

export async function register(req: Request, res: Response): Promise<Response> {
  const { firstName, lastName, email, password } = req.body as RegisterInput;

  const result = await authService.register({
    firstName,
    lastName,
    email,
    password,
    ipAddress: req.ip,
    userAgent: req.headers['user-agent'],
  });

  res.cookie(REFRESH_COOKIE, result.refreshToken, refreshCookieOptions(parseDurationMs(config.jwt.refreshTtl)));

  return sendSuccess(res, 201, 'Account created successfully.', {
    user: result.user,
    accessToken: result.accessToken,
  });
}

export async function refresh(req: Request, res: Response): Promise<Response> {
  const token = req.cookies?.[REFRESH_COOKIE] as string | undefined;
  if (!token) {
    throw ApiError.unauthorized('No refresh token provided.');
  }

  const result = await authService.refresh(token);

  res.cookie(REFRESH_COOKIE, result.refreshToken, refreshCookieOptions(parseDurationMs(config.jwt.refreshTtl)));

  return sendSuccess(res, 200, 'Token refreshed.', {
    user: result.user,
    accessToken: result.accessToken,
  });
}

export async function logout(req: Request, res: Response): Promise<Response> {
  const token = req.cookies?.[REFRESH_COOKIE] as string | undefined;
  if (token) {
    await authService.logout(token);
  }

  res.clearCookie(REFRESH_COOKIE, refreshCookieOptions());
  return sendSuccess(res, 200, 'Logged out successfully.');
}

export async function me(req: Request, res: Response): Promise<Response> {
  return sendSuccess(res, 200, 'Authenticated user.', { user: req.user });
}
