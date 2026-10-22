import type { Request, Response } from 'express';
import { cameraRecording } from '../services/cameraRecording.service.js';
import { sendSuccess } from '../utils/response.js';

export async function startRecording(req: Request, res: Response): Promise<Response> {
  const { cameraIndex } = req.body as { cameraIndex?: number };
  const result = await cameraRecording.startRecording(cameraIndex ?? 0);
  return sendSuccess(res, 200, 'Recording started.', result);
}

export async function stopRecording(_req: Request, res: Response): Promise<Response> {
  const result = await cameraRecording.stopRecording();
  return sendSuccess(res, 200, 'Recording stopped.', result);
}

export async function listRecordings(_req: Request, res: Response): Promise<Response> {
  const recordings = cameraRecording.listRecordings();
  return sendSuccess(res, 200, 'Recordings list.', { recordings });
}

export async function deleteRecording(req: Request, res: Response): Promise<Response> {
  const { id } = req.params as { id: string };
  await cameraRecording.deleteRecording(id);
  return sendSuccess(res, 200, 'Recording deleted.', { id });
}

export async function getRecordingStatus(_req: Request, res: Response): Promise<Response> {
  return sendSuccess(res, 200, 'Recording status.', cameraRecording.getStatus());
}