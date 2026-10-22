import type { Request, Response } from 'express';
import * as authService from '../services/auth.service.js';
import { sendSuccess } from '../utils/response.js';
import { ApiError } from '../utils/ApiError.js';

export async function listStaff(_req: Request, res: Response): Promise<Response> {
  const users = await authService.listStaff();
  return sendSuccess(res, 200, 'Staff list retrieved.', { users });
}

export async function createStaff(req: Request, res: Response): Promise<Response> {
  const user = await authService.createStaff(req.body);
  return sendSuccess(res, 201, 'Staff account created.', { user });
}

export async function updateStaff(req: Request<{ id: string }>, res: Response): Promise<Response> {
  const user = await authService.updateStaff(req.params.id, req.body);
  return sendSuccess(res, 200, 'Staff account updated.', { user });
}

export async function deactivateStaff(req: Request<{ id: string }>, res: Response): Promise<Response> {
  const { id } = req.params;

  if (req.user?.id === id) {
    throw ApiError.badRequest('INVALID_OPERATION', 'You cannot deactivate your own account.');
  }

  await authService.deactivateStaff(id);
  return sendSuccess(res, 200, 'Staff account deactivated.');
}
