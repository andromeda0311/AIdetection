import { existsSync } from 'node:fs';
import type { Request, Response } from 'express';
import mime from 'mime-types';
import * as detectionService from '../services/detection.service.js';
import { sendSuccess } from '../utils/response.js';
import { ApiError } from '../utils/ApiError.js';

export async function uploadDetection(req: Request, res: Response): Promise<Response> {
  if (!req.file) {
    throw ApiError.badRequest('NO_FILE', 'No video file provided. Use a multipart field named "file".');
  }

  const detection = await detectionService.createDetection({
    userId: req.user!.id,
    file: req.file,
  });

  return sendSuccess(res, 202, 'Video received. Detection processing started.', { detection });
}

export async function listDetections(req: Request, res: Response): Promise<Response> {
  const { page, limit } = req.validatedQuery as { page: number; limit: number };
  const result = await detectionService.listDetections(page, limit);
  return sendSuccess(res, 200, 'Detections retrieved.', result);
}

export async function getDetection(req: Request<{ id: string }>, res: Response): Promise<Response> {
  const result = await detectionService.getDetection(req.params.id);
  if (!result) {
    throw ApiError.notFound('Detection not found.');
  }
  return sendSuccess(res, 200, 'Detection retrieved.', result);
}

export async function downloadInput(req: Request<{ id: string }>, res: Response): Promise<void> {
  const result = await detectionService.getDetectionInputPath(req.params.id);
  if (!result) {
    throw ApiError.notFound('Detection not found.');
  }
  if (!existsSync(result.absolutePath)) {
    throw ApiError.notFound('Original file is no longer available.');
  }

  const contentType = result.detection.inputContentType || 'application/octet-stream';
  const downloadName = result.detection.inputFileName;

  res.setHeader('Content-Type', contentType);
  res.setHeader('Content-Disposition', `attachment; filename="${downloadName}"`);
  res.sendFile(result.absolutePath);
}

export async function downloadFrame(req: Request<{ id: string; frameId: string }>, res: Response): Promise<void> {
  const result = await detectionService.getFrameFilePath(req.params.id, req.params.frameId);
  if (!result) {
    throw ApiError.notFound('Detection frame not found.');
  }
  if (!existsSync(result.absolutePath)) {
    throw ApiError.notFound('Frame file is no longer available.');
  }

  const contentType = result.frame.contentType || mime.lookup('bin') || 'application/octet-stream';
  res.setHeader('Content-Type', contentType);
  res.setHeader('Content-Disposition', 'inline');
  res.sendFile(result.absolutePath);
}
