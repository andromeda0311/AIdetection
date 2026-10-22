import fs from 'node:fs';
import { mkdir, readFile, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileTypeFromBuffer } from 'file-type';
import config from '../config/env.js';
import { ApiError } from '../utils/ApiError.js';

/** Absolute root of all stored files (uploads, detections, frames). */
export const STORAGE_ROOT = path.resolve(config.upload.dir);

export function ensureDirSync(dir: string): void {
  fs.mkdirSync(dir, { recursive: true });
}

export async function ensureDir(dir: string): Promise<void> {
  await mkdir(dir, { recursive: true });
}

/**
 * Resolves a storage-relative path to an absolute path, guaranteeing the result
 * stays inside STORAGE_ROOT (blocks directory traversal).
 */
export function resolveStoragePath(relativePath: string): string {
  const resolved = path.resolve(STORAGE_ROOT, relativePath);
  if (resolved !== STORAGE_ROOT && !resolved.startsWith(STORAGE_ROOT + path.sep)) {
    throw ApiError.badRequest('INVALID_PATH', 'Invalid file path.');
  }
  return resolved;
}

/** Turns an absolute path into a STORAGE_ROOT-relative path with forward slashes. */
export function toRelativePath(absolutePath: string): string {
  return path.relative(STORAGE_ROOT, absolutePath).split(path.sep).join('/');
}

/** Removes path separators, control characters, and trims a user-supplied filename. */
export function sanitizeFilename(name: string): string {
  const base = path.basename(name).replace(/[\x00-\x1f]/g, '').trim();
  return base || 'file';
}

export async function detectFileType(buffer: Buffer): Promise<{ ext: string; mime: string } | undefined> {
  return fileTypeFromBuffer(buffer);
}

export async function readBuffer(relativePath: string): Promise<Buffer> {
  return readFile(resolveStoragePath(relativePath));
}

export async function writeBuffer(relativeDir: string, fileName: string, buffer: Buffer): Promise<string> {
  const dir = resolveStoragePath(relativeDir);
  await ensureDir(dir);
  const absolute = path.join(dir, fileName);
  await writeFile(absolute, buffer);
  return toRelativePath(absolute);
}

export async function removeFile(relativePath: string): Promise<void> {
  try {
    await unlink(resolveStoragePath(relativePath));
  } catch {
    // Ignore missing files during cleanup.
  }
}
