import { access } from 'node:fs/promises';
import { resolve } from 'node:path';

const requiredFiles = [
  'README.md',
  'docs/vision.md',
  'docs/architecture.md',
  'docs/ipc.md',
  'docs/data-models.md',
  'docs/ui-spec.md',
  'docs/visual-system.md',
  'docs/security.md',
  'docs/testing.md',
  'docs/process.md',
  'docs/quickstart.md',
  'docs/troubleshooting.md',
  'docs/api/openai-compatible.yaml',
  'docs/adr/0001-electron-vite-react.md',
  'docs/features/feature-01-foundation.md',
  'docs/features/feature-02-desktop-shell.md',
  'docs/features/feature-03-newapi-onboarding.md',
  'docs/features/feature-04-chat-history.md',
  'docs/features/feature-05-visual-assets.md',
  'docs/features/feature-06-packaging-docs.md',
  'docs/features/feature-07-companion-interaction-core.md'
];

const missing = [];

for (const file of requiredFiles) {
  try {
    await access(resolve(process.cwd(), file));
  } catch {
    missing.push(file);
  }
}

if (missing.length > 0) {
  console.error('Missing required documentation files:');
  for (const file of missing) {
    console.error(`- ${file}`);
  }
  process.exit(1);
}

console.log(`Documentation consistency check passed for ${requiredFiles.length} files.`);
