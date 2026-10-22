import { logger } from '../utils/logger.js';
import ffmpeg from 'fluent-ffmpeg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { getSignalIo } from './yoloLive.instance.js';
import config from '../config/env.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const RECORDINGS_DIR = path.join(__dirname, '..', '..', 'storage', 'recordings');
const YOLO_VIDEO_URL = `http://localhost:${config.yoloLive?.detectionThresholdMs ? 8000 : 8000}/video`; // Default to 8000

// Ensure recordings directory exists
if (!fs.existsSync(RECORDINGS_DIR)) {
  fs.mkdirSync(RECORDINGS_DIR, { recursive: true });
}

export interface RecordingInfo {
  id: string;
  filename: string;
  path: string;
  size: number;
  duration: number;
  createdAt: string;
}

export type RecordingStatusType = 'idle' | 'recording' | 'saving';

export interface RecordingStatus {
  status: RecordingStatusType;
  startedAt: number | null;
  duration: number;
  fileName: string | null;
}

class CameraRecordingService {
  private ffmpegProcess: ffmpeg.FfmpegCommand | null = null;
  private status: RecordingStatus = {
    status: 'idle',
    startedAt: null,
    duration: 0,
    fileName: null,
  };
  private durationInterval: NodeJS.Timeout | null = null;
  private currentRecordingId: string | null = null;
  private currentOutputPath: string | null = null;

  getStatus(): RecordingStatus {
    return { ...this.status };
  }

  async startRecording(cameraIndex = 0): Promise<{ recordingId: string }> {
    if (this.status.status === 'recording') {
      throw new Error('Recording already in progress');
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    this.currentRecordingId = `rec_${timestamp}`;
    const filename = `${this.currentRecordingId}.webm`;
    this.currentOutputPath = path.join(RECORDINGS_DIR, filename);

    // Build the ffmpeg command to capture MJPEG stream
    const streamUrl = `http://localhost:8000/video`;

    this.ffmpegProcess = ffmpeg(streamUrl)
      .inputOptions([
        '-f', 'mjpeg',
        '-timeout', '5000000', // 5 second timeout
      ])
      .outputOptions([
        '-c:v', 'libvpx-vp9', // VP9 codec for WebM
        '-b:v', '2M', // 2 Mbps bitrate
        '-deadline', 'realtime',
        '-cpu-used', '4',
        '-threads', '2',
        '-f', 'webm',
      ])
      .output(this.currentOutputPath)
      .on('start', (commandLine) => {
        logger.info({ commandLine, outputPath: this.currentOutputPath }, 'FFmpeg recording started');
        this.status = {
          status: 'recording',
          startedAt: Date.now(),
          duration: 0,
          fileName: filename,
        };
        this.broadcastStatus();

        // Start duration counter
        this.durationInterval = setInterval(() => {
          if (this.status.startedAt) {
            this.status.duration = Date.now() - this.status.startedAt;
            this.broadcastStatus();
          }
        }, 1000);
      })
      .on('progress', (progress) => {
        // logger.debug({ progress }, 'FFmpeg progress');
      })
      .on('end', () => {
        logger.info({ outputPath: this.currentOutputPath }, 'FFmpeg recording finished');
        this.cleanup();
      })
      .on('error', (err, stdout, stderr) => {
        logger.error({ err, stderr: stderr?.toString() }, 'FFmpeg recording error');
        this.cleanup();
      });

    this.ffmpegProcess.run();

    return { recordingId: this.currentRecordingId };
  }

  async stopRecording(): Promise<{ path: string; size: number; duration: number }> {
    if (this.status.status !== 'recording' || !this.ffmpegProcess) {
      throw new Error('No recording in progress');
    }

    this.status.status = 'saving';
    this.broadcastStatus();

    // Kill the ffmpeg process gracefully
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.ffmpegProcess?.kill('SIGKILL');
        reject(new Error('FFmpeg stop timeout'));
      }, 10000);

      this.ffmpegProcess!.on('end', () => {
        clearTimeout(timeout);
        this.finalizeRecording()
          .then(resolve)
          .catch(reject);
      });

      this.ffmpegProcess!.on('error', (err) => {
        clearTimeout(timeout);
        reject(err);
      });

      // Send SIGINT to gracefully stop recording
      this.ffmpegProcess!.kill('SIGINT');
    });
  }

  private async finalizeRecording(): Promise<{ path: string; size: number; duration: number }> {
    if (!this.currentOutputPath || !fs.existsSync(this.currentOutputPath)) {
      throw new Error('Recording file not found');
    }

    const stats = fs.statSync(this.currentOutputPath);
    const duration = this.status.duration;

    const result = {
      path: this.currentOutputPath,
      size: stats.size,
      duration,
    };

    this.cleanup();
    return result;
  }

  private cleanup(): void {
    if (this.durationInterval) {
      clearInterval(this.durationInterval);
      this.durationInterval = null;
    }
    this.ffmpegProcess = null;
    this.currentRecordingId = null;
    this.currentOutputPath = null;
    this.status = {
      status: 'idle',
      startedAt: null,
      duration: 0,
      fileName: null,
    };
    this.broadcastStatus();
  }

  listRecordings(): RecordingInfo[] {
    try {
      const files = fs.readdirSync(RECORDINGS_DIR)
        .filter(f => f.endsWith('.webm') || f.endsWith('.mp4'))
        .map(f => {
          const filePath = path.join(RECORDINGS_DIR, f);
          const stats = fs.statSync(filePath);
          return {
            id: f.replace(/\.(webm|mp4)$/, ''),
            filename: f,
            path: filePath,
            size: stats.size,
            duration: 0, // Would need ffprobe to get actual duration
            createdAt: stats.birthtime.toISOString(),
          };
        })
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      return files;
    } catch (err) {
      logger.error({ err }, 'Failed to list recordings');
      return [];
    }
  }

  async deleteRecording(id: string): Promise<void> {
    const files = fs.readdirSync(RECORDINGS_DIR);
    const file = files.find(f => f.startsWith(id));
    if (!file) {
      throw new Error('Recording not found');
    }
    const filePath = path.join(RECORDINGS_DIR, file);
    fs.unlinkSync(filePath);
    logger.info({ file }, 'Recording deleted');
  }

  private broadcastStatus(): void {
    getSignalIo()?.to('dashboard').emit('recording:status', this.getStatus());
  }
}

export const cameraRecording = new CameraRecordingService();