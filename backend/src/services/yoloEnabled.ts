let yoloEnabled = true;

export function setYoloEnabled(enabled: boolean): void {
  yoloEnabled = enabled;
}

export function isYoloEnabled(): boolean {
  return yoloEnabled;
}

export function toggleYolo(): boolean {
  yoloEnabled = !yoloEnabled;
  return yoloEnabled;
}

export function loadFromEnv(): void {
  const envVal = process.env.YOLO_LIVE_ENABLED;
  if (envVal !== undefined) {
    yoloEnabled = envVal.toLowerCase() === 'true';
  } else {
    yoloEnabled = true; // default
  }
}