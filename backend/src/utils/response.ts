import type { Response } from 'express';

export interface ApiSuccess<T> {
  success: true;
  message: string;
  data?: T;
}

export function sendSuccess<T>(res: Response, status: number, message: string, data?: T): Response {
  const body: ApiSuccess<T> = { success: true, message };
  if (data !== undefined) body.data = data;
  return res.status(status).json(body);
}
