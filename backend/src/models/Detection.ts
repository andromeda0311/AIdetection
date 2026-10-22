import { AppDataSource } from '../config/ormconfig.js';
import { Detection, DetectionStatusEnum } from '../entities/Detection.js';
import { DetectionFrame } from '../entities/DetectionFrame.js';
import type { DetectionBox } from '../services/detection.client.js';

export type DetectionStatus = 'processing' | 'completed' | 'failed';

export interface DetectionRecord {
  id: string;
  staff_user_id: string;
  input_file_path: string;
  input_filename: string;
  input_content_type: string;
  input_size_bytes: number;
  status: DetectionStatus;
  pedestrian_detected: boolean;
  total_pedestrians: number;
  detection_meta: Record<string, unknown> | null;
  error_message: string | null;
  created_at: Date;
  completed_at: Date | null;
}

export interface SafeDetection {
  id: string;
  staffUserId: string;
  inputFileName: string;
  inputContentType: string;
  inputSizeBytes: number;
  status: DetectionStatus;
  pedestrianDetected: boolean;
  totalPedestrians: number;
  detectionMeta: Record<string, unknown> | null;
  errorMessage: string | null;
  createdAt: Date;
  completedAt: Date | null;
}

export interface DetectionFrameRecord {
  id: string;
  detection_id: string;
  frame_index: number;
  file_path: string;
  content_type: string | null;
  pedestrian_count: number;
  boxes: DetectionBox[];
  created_at: Date;
}

export interface SafeDetectionFrame {
  id: string;
  detectionId: string;
  frameIndex: number;
  contentType: string | null;
  pedestrianCount: number;
  boxes: DetectionBox[];
  createdAt: Date;
}

export interface CreateDetectionData {
  staffUserId: string;
  inputFilePath: string;
  inputFilename: string;
  inputContentType: string;
  inputSizeBytes: number;
}

export interface UpdateDetectionData {
  status: DetectionStatus;
  pedestrianDetected?: boolean;
  totalPedestrians?: number;
  detectionMeta?: Record<string, unknown>;
  errorMessage?: string | null;
}

export interface CreateDetectionFrameData {
  detectionId: string;
  frameIndex: number;
  filePath: string;
  contentType: string | null;
  pedestrianCount: number;
  boxes: DetectionBox[];
}

const detectionRepo = () => AppDataSource.getRepository(Detection);
const frameRepo = () => AppDataSource.getRepository(DetectionFrame);

function mapDetection(entity: Detection): DetectionRecord {
  return {
    id: entity.id,
    staff_user_id: entity.staffUserId,
    input_file_path: entity.inputFilePath,
    input_filename: entity.inputFilename,
    input_content_type: entity.inputContentType,
    input_size_bytes: entity.inputSizeBytes,
    status: entity.status as DetectionStatus,
    pedestrian_detected: entity.pedestrianDetected,
    total_pedestrians: entity.totalPedestrians,
    detection_meta: entity.detectionMeta,
    error_message: entity.errorMessage,
    created_at: entity.createdAt,
    completed_at: entity.completedAt,
  };
}

function mapFrame(entity: DetectionFrame): DetectionFrameRecord {
  return {
    id: entity.id,
    detection_id: entity.detectionId,
    frame_index: entity.frameIndex,
    file_path: entity.filePath,
    content_type: entity.contentType,
    pedestrian_count: entity.pedestrianCount,
    boxes: entity.boxes,
    created_at: entity.createdAt,
  };
}

export function toSafeDetection(d: DetectionRecord): SafeDetection {
  return {
    id: d.id,
    staffUserId: d.staff_user_id,
    inputFileName: d.input_filename,
    inputContentType: d.input_content_type,
    inputSizeBytes: d.input_size_bytes,
    status: d.status,
    pedestrianDetected: d.pedestrian_detected,
    totalPedestrians: d.total_pedestrians,
    detectionMeta: d.detection_meta,
    errorMessage: d.error_message,
    createdAt: d.created_at,
    completedAt: d.completed_at,
  };
}

export function toSafeFrame(f: DetectionFrameRecord): SafeDetectionFrame {
  return {
    id: f.id,
    detectionId: f.detection_id,
    frameIndex: f.frame_index,
    contentType: f.content_type,
    pedestrianCount: f.pedestrian_count,
    boxes: f.boxes,
    createdAt: f.created_at,
  };
}

export async function createDetection(data: CreateDetectionData): Promise<DetectionRecord> {
  const entity = detectionRepo().create({
    staffUserId: data.staffUserId,
    inputFilePath: data.inputFilePath,
    inputFilename: data.inputFilename,
    inputContentType: data.inputContentType,
    inputSizeBytes: data.inputSizeBytes,
  });
  const saved = await detectionRepo().save(entity);
  return mapDetection(saved);
}

export async function updateDetection(id: string, data: UpdateDetectionData): Promise<void> {
  const updateData: Record<string, unknown> = {
    status: data.status as DetectionStatusEnum,
  };

  if (data.pedestrianDetected !== undefined) updateData.pedestrianDetected = data.pedestrianDetected;
  if (data.totalPedestrians !== undefined) updateData.totalPedestrians = data.totalPedestrians;
  if (data.detectionMeta !== undefined) updateData.detectionMeta = data.detectionMeta ?? null;
  if (data.errorMessage !== undefined) updateData.errorMessage = data.errorMessage ?? null;
  if (data.status === 'completed') updateData.completedAt = new Date();

  await detectionRepo().update(id, updateData);
}

export async function findDetectionById(id: string): Promise<DetectionRecord | null> {
  const entity = await detectionRepo().findOne({ where: { id } });
  return entity ? mapDetection(entity) : null;
}

export async function listDetections(limit: number, offset: number): Promise<{ items: DetectionRecord[]; total: number }> {
  const [entities, total] = await detectionRepo().findAndCount({
    order: { createdAt: 'DESC' },
    take: limit,
    skip: offset,
  });
  return {
    items: entities.map(mapDetection),
    total,
  };
}

export async function createDetectionFrame(data: CreateDetectionFrameData): Promise<DetectionFrameRecord> {
  const entity = frameRepo().create({
    detectionId: data.detectionId,
    frameIndex: data.frameIndex,
    filePath: data.filePath,
    contentType: data.contentType,
    pedestrianCount: data.pedestrianCount,
    boxes: data.boxes,
  });
  const saved = await frameRepo().save(entity);
  return mapFrame(saved);
}

export async function listFramesByDetectionId(detectionId: string): Promise<DetectionFrameRecord[]> {
  const entities = await frameRepo().find({
    where: { detectionId },
    order: { frameIndex: 'ASC' },
  });
  return entities.map(mapFrame);
}

export async function findFrameById(frameId: string): Promise<DetectionFrameRecord | null> {
  const entity = await frameRepo().findOne({ where: { id: frameId } });
  return entity ? mapFrame(entity) : null;
}