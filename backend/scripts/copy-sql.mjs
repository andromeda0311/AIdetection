import { copyFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const src = join(root, 'src', 'db', 'schema.sql');
const destDir = join(root, 'dist', 'db');

mkdirSync(destDir, { recursive: true });
copyFileSync(src, join(destDir, 'schema.sql'));
