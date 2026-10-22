// Copies the MediaPipe WebAssembly runtime from the pinned npm package into
// public/ so it is served from our own origin and always matches the JS version.
// Runs automatically before `npm run dev` and `npm run build` (predev/prebuild).
import { cpSync, existsSync, mkdirSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const source = join(root, 'node_modules', '@mediapipe', 'tasks-vision', 'wasm');
const target = join(root, 'public', 'mediapipe', 'wasm');

// FilesetResolver picks the SIMD or no-SIMD build; the "module" variant is unused.
const files = [
  'vision_wasm_internal.js',
  'vision_wasm_internal.wasm',
  'vision_wasm_nosimd_internal.js',
  'vision_wasm_nosimd_internal.wasm',
];

if (!existsSync(source)) {
  console.error('[mediapipe] @mediapipe/tasks-vision is not installed; run npm install.');
  process.exit(1);
}

rmSync(target, { recursive: true, force: true });
mkdirSync(target, { recursive: true });
for (const file of files) cpSync(join(source, file), join(target, file));
console.log(`[mediapipe] copied ${files.length} runtime files to public/mediapipe/wasm`);
