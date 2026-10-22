import mime from 'mime-types';
import config from '../config/env.js';
import { logger } from '../utils/logger.js';
import { ApiError } from '../utils/ApiError.js';
import { detectionClient } from './detection.client.js';
import {
  detectFileType,
  readBuffer,
  removeFile,
  resolveStoragePath,
  sanitizeFilename,
  toRelativePath,
  writeBuffer,
} from './file.storage.js';
import {
  createDetection as createDetectionRow,
  createDetectionFrame,
  findDetectionById,
  findFrameById,
  listDetections as listDetectionRows,
  listFramesByDetectionId,
  toSafeDetection,
  toSafeFrame,
  updateDetection,
  type SafeDetection,
  type SafeDetectionFrame,
} from '../models/Detection.js';
import { appEvents, DETECTION_COMPLETED, type DetectionCompletedEvent } from './events.js';

const UPLOADS_DIR = 'uploads';

export interface CreateDetectionInput {
  userId: string;
  file: Express.Multer.File;
}

/**
 * Validates the uploaded file content, records the detection row, and schedules
 * async processing so the HTTP request returns immediately.
 */
export async function createDetection(input: CreateDetectionInput): Promise<SafeDetection> {
  const { file } = input;
  const relativePath = toRelativePath(file.path);

  const buffer = await readBuffer(relativePath);
  const type = await detectFileType(buffer);

  if (!type || !config.upload.allowedMimeTypes.includes(type.mime.toLowerCase())) {
    await removeFile(relativePath);
    throw new ApiError(
      422,
      'INVALID_FILE_TYPE',
      `File content does not match an allowed video type (detected: ${type ? `${type.ext}/${type.mime}` : 'unknown'}).`,
    );
  }

  const detection = await createDetectionRow({
    staffUserId: input.userId,
    inputFilePath: relativePath,
    inputFilename: sanitizeFilename(file.originalname),
    inputContentType: file.mimetype,
    inputSizeBytes: file.size,
  });

  void processDetection(detection.id).catch((err) => {
    logger.error({ err, detectionId: detection.id }, 'Background detection processing failed');
  });

  logger.info({ detectionId: detection.id }, 'Detection queued for processing');
  return toSafeDetection(detection);
}

/**
 * Runs the detection pipeline: calls the (mock/real) client, stores returned
 * frames, updates the record, and emits an event for the traffic signal.
 */
export async function processDetection(detectionId: string): Promise<void> {
  const detection = await findDetectionById(detectionId);
  if (!detection || detection.status !== 'processing') return;

  try {
    const result = await detectionClient.detectVideo({
      filePath: resolveStoragePath(detection.input_file_path),
      fileName: detection.input_filename,
      contentType: detection.input_content_type,
    });

    const framesDir = `detections/${detection.id}`;
    for (const frame of result.frames) {
      const ext = mime.extension(frame.contentType) ?? 'bin';
      const fileName = `frame_${String(frame.index).padStart(4, '0')}.${ext}`;
      const filePath = await writeBuffer(framesDir, fileName, frame.buffer);
      await createDetectionFrame({
        detectionId: detection.id,
        frameIndex: frame.index,
        filePath,
        contentType: frame.contentType,
        pedestrianCount: frame.pedestrianCount,
        boxes: frame.boxes,
      });
    }

    await updateDetection(detection.id, {
      status: 'completed',
      pedestrianDetected: result.totalPedestrians > 0,
      totalPedestrians: result.totalPedestrians,
      detectionMeta: result.meta,
    });

    const event: DetectionCompletedEvent = {
      detectionId: detection.id,
      pedestrianDetected: result.totalPedestrians > 0,
      totalPedestrians: result.totalPedestrians,
    };
    appEvents.emit(DETECTION_COMPLETED, event);
    logger.info({ detectionId: detection.id, totalPedestrians: result.totalPedestrians }, 'Detection completed');
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    await updateDetection(detection.id, { status: 'failed', errorMessage: message });
    logger.error({ err, detectionId: detection.id }, 'Detection failed');
  }
}

export async function getDetection(id: string): Promise<{ detection: SafeDetection; frames: SafeDetectionFrame[] } | null> {
  const detection = await findDetectionById(id);
  if (!detection) return null;
  const frames = await listFramesByDetectionId(id);
  return { detection: toSafeDetection(detection), frames: frames.map(toSafeFrame) };
}

export async function listDetections(page: number, limit: number) {
  const { items, total } = await listDetectionRows(limit, (page - 1) * limit);
  return { detections: items.map(toSafeDetection), total, page, limit };
}

export async function getDetectionInputPath(id: string): Promise<{ detection: SafeDetection; absolutePath: string } | null> {
  const detection = await findDetectionById(id);
  if (!detection) return null;
  return { detection: toSafeDetection(detection), absolutePath: resolveStoragePath(detection.input_file_path) };
}

export async function getFrameFilePath(detectionId: string, frameId: string): Promise<{ frame: SafeDetectionFrame; absolutePath: string } | null> {
  const detection = await findDetectionById(detectionId);
  if (!detection) return null;
  const frame = await findFrameById(frameId);
  if (!frame || frame.detection_id !== detectionId) return null;
  return { frame: toSafeFrame(frame), absolutePath: resolveStoragePath(frame.file_path) };
}
