import type { Request, Response } from 'express';
import { yoloLive } from '../services/yoloLive.instance.js';
import { sendSuccess } from '../utils/response.js';
import type { YoloDetectionPayload } from '../services/yoloLive.service.js';

export async function postYoloDetection(req: Request, res: Response): Promise<void> {
  yoloLive.handleDetection(req.body as YoloDetectionPayload);
  res.sendStatus(200);
}

export async function getYoloStatus(_req: Request, res: Response): Promise<Response> {
  return sendSuccess(res, 200, 'YOLO live status.', yoloLive.getSystemState());
}

export async function getArduinoStatus(_req: Request, res: Response): Promise<Response> {
  const state = yoloLive.getSystemState();
  return sendSuccess(res, 200, 'Arduino status.', { arduino: state.arduino });
}

export async function getSystemStatus(_req: Request, res: Response): Promise<Response> {
  return sendSuccess(res, 200, 'System status.', yoloLive.getSystemState());
}

export async function getApiHealth(_req: Request, res: Response): Promise<Response> {
  return sendSuccess(res, 200, 'API health.', { status: 'ok' });
}
