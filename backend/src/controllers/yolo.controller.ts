import type { Request, Response } from 'express';
import { yoloLive } from '../services/yoloLive.instance.js';
import { sendSuccess } from '../utils/response.js';
import type { YoloDetectionPayload } from '../services/yoloLive.service.js';
import type { LiveDetectionBody } from '../dto/detection.dto.js';
import { browserReportToPayload, monitoringStation } from '../services/liveDetection.js';
import { ApiError } from '../utils/ApiError.js';

export async function postYoloDetection(req: Request, res: Response): Promise<void> {
  yoloLive.handleDetection(req.body as YoloDetectionPayload);
  res.sendStatus(200);
}

/** Live detections from a logged-in dashboard's browser webcam (replaces the Python feed). */
export async function postBrowserDetection(req: Request, res: Response): Promise<void> {
  const body = req.body as LiveDetectionBody;
  if (!monitoringStation.claim(body.stationId)) {
    throw ApiError.conflict('STATION_CONFLICT', 'Another computer is already monitoring. Only one station can control the traffic lights.');
  }
  yoloLive.handleDetection(browserReportToPayload(body));
  res.sendStatus(204);
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
