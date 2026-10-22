import path from 'node:path';
import { randomUUID } from 'node:crypto';
import multer from 'multer';
import config from '../config/env.js';
import { ApiError } from '../utils/ApiError.js';
import { STORAGE_ROOT, ensureDirSync } from '../services/file.storage.js';

const uploadsDir = path.join(STORAGE_ROOT, 'uploads');
ensureDirSync(uploadsDir);

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadsDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${randomUUID()}${ext}`);
  },
});

const fileFilter: multer.Options['fileFilter'] = (_req, file, cb) => {
  const ext = path.extname(file.originalname).slice(1).toLowerCase();
  if (!config.upload.allowedExtensions.includes(ext)) {
    return cb(
      new ApiError(
        422,
        'INVALID_FILE_TYPE',
        `Unsupported file type ".${ext}". Allowed: ${config.upload.allowedExtensions.join(', ')}.`,
      ),
    );
  }
  cb(null, true);
};

export const videoUpload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: config.upload.maxFileSizeBytes,
    files: config.upload.maxFilesPerRequest,
  },
});
