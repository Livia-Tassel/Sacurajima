import { execFileSync } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  rmSync
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const root = process.cwd();
const sourceSvg = resolve(root, 'src/renderer/src/assets/icons/sakura-mark.svg');
const outputDir = resolve(root, 'resources/icons');
const outputIcns = resolve(outputDir, 'icon.icns');
const tempRoot = mkdtempSync(join(tmpdir(), 'sakurajima-icon-'));
const previewDir = join(tempRoot, 'preview');
const iconsetDir = join(tempRoot, 'Sakurajima.iconset');

if (!existsSync(sourceSvg)) {
  throw new Error(`Source SVG not found: ${sourceSvg}`);
}

mkdirSync(previewDir, { recursive: true });
mkdirSync(iconsetDir, { recursive: true });
mkdirSync(outputDir, { recursive: true });

try {
  execFileSync('qlmanage', ['-t', '-s', '1024', '-o', previewDir, sourceSvg], {
    stdio: 'ignore'
  });

  const previewPng = readdirSync(previewDir).find((file) => file.endsWith('.png'));

  if (!previewPng) {
    throw new Error('Quick Look did not generate a PNG preview for the SVG icon.');
  }

  const previewPath = join(previewDir, previewPng);
  const sizes = [16, 32, 128, 256, 512];

  for (const size of sizes) {
    execFileSync('sips', ['-z', `${size}`, `${size}`, previewPath, '--out', join(iconsetDir, `icon_${size}x${size}.png`)], {
      stdio: 'ignore'
    });
    execFileSync(
      'sips',
      ['-z', `${size * 2}`, `${size * 2}`, previewPath, '--out', join(iconsetDir, `icon_${size}x${size}@2x.png`)],
      {
        stdio: 'ignore'
      }
    );
  }

  execFileSync('iconutil', ['-c', 'icns', iconsetDir, '-o', outputIcns], {
    stdio: 'ignore'
  });

  console.log(`Generated macOS icon at ${outputIcns}`);
} finally {
  rmSync(tempRoot, { recursive: true, force: true });
}
