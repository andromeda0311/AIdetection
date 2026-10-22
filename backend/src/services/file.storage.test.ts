import { describe, expect, it } from 'vitest';
import { resolveStoragePath, sanitizeFilename, toRelativePath } from './file.storage.js';

describe('file.storage', () => {
  it('sanitizes user-supplied filenames', () => {
    expect(sanitizeFilename('../../etc/passwd')).toBe('passwd');
    expect(sanitizeFilename('clip.mp4')).toBe('clip.mp4');
    expect(sanitizeFilename('a\u0000b.mp4')).toBe('ab.mp4');
    expect(sanitizeFilename('')).toBe('file');
  });

  it('rejects paths that escape the storage root', () => {
    expect(() => resolveStoragePath('..\\..\\secrets.txt')).toThrow();
    expect(() => resolveStoragePath('..\\config')).toThrow();
    expect(() => resolveStoragePath('uploads\\ok.mp4')).not.toThrow();
  });

  it('converts absolute paths to storage-relative paths', () => {
    expect(toRelativePath(`${process.cwd()}\\storage\\uploads\\a.mp4`).replace(/\\/g, '/')).toBe('uploads/a.mp4');
  });
});
