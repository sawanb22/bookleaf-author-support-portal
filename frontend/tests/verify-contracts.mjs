import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const tsScript = join(__dirname, 'verify-contracts.ts');

const result = spawnSync('npx.cmd', ['tsx', tsScript], {
  stdio: 'inherit',
  shell: true,
});

process.exit(result.status ?? 0);
