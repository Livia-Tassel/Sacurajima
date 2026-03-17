import { execFileSync } from 'node:child_process';
import { copyFileSync, cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { packager } from '@electron/packager';

const root = process.cwd();
const packageJson = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8'));
const releaseDir = resolve(root, 'release');
const iconPath = resolve(root, 'resources/icons/icon.icns');
const iconBasePath = resolve(root, 'resources/icons/icon');
const shouldOnlyBuildApp = process.argv.includes('--dir');

function resolveElectronZipDir() {
  const cacheRoot = resolve(homedir(), 'Library/Caches/electron');
  const expectedName = `electron-v${packageJson.devDependencies.electron.replace(/^[^\d]*/, '')}-darwin-arm64.zip`;

  if (!existsSync(cacheRoot)) {
    return undefined;
  }

  for (const entry of readdirSync(cacheRoot, { withFileTypes: true })) {
    if (!entry.isDirectory()) {
      continue;
    }

    const candidate = join(cacheRoot, entry.name, expectedName);
    if (existsSync(candidate)) {
      return join(cacheRoot, entry.name);
    }
  }

  return undefined;
}

if (!existsSync(iconPath)) {
  throw new Error(`Missing icon at ${iconPath}. Run npm run build:icons first.`);
}

mkdirSync(releaseDir, { recursive: true });

const packagedApps = await packager({
  arch: 'arm64',
  appBundleId: 'com.tassel.sakurajima',
  appCategoryType: 'public.app-category.lifestyle',
  asar: true,
  dir: root,
  executableName: 'Sakurajima',
  electronZipDir: resolveElectronZipDir(),
  icon: iconBasePath,
  name: 'Sakurajima',
  out: releaseDir,
  overwrite: true,
  platform: 'darwin',
  prune: false,
  ignore: [
    /^\/\.git($|\/)/,
    /^\/docs($|\/)/,
    /^\/node_modules($|\/)/,
    /^\/output($|\/)/,
    /^\/release($|\/)/,
    /^\/src($|\/)/,
    /^\/tests($|\/)/,
    /^\/tmp($|\/)/
  ]
});

if (packagedApps.length === 0) {
  throw new Error('The macOS app bundle was not created.');
}

const appPath = packagedApps[0];
const appBundlePath = join(appPath, 'Sakurajima.app');
const bundledIconPath = join(appBundlePath, 'Contents/Resources/electron.icns');

if (existsSync(bundledIconPath)) {
  copyFileSync(iconPath, bundledIconPath);
}

console.log(`Packaged app at ${appPath}`);

if (shouldOnlyBuildApp) {
  process.exit(0);
}

const zipPath = join(releaseDir, `Sakurajima-${packageJson.version}-arm64.zip`);
const dmgPath = join(releaseDir, `Sakurajima-${packageJson.version}-arm64.dmg`);
const stageDir = mkdtempSync(join(tmpdir(), 'sakurajima-stage-'));

try {
  if (existsSync(zipPath)) {
    rmSync(zipPath, { force: true });
  }
  if (existsSync(dmgPath)) {
    rmSync(dmgPath, { force: true });
  }

  execFileSync('ditto', ['-c', '-k', '--sequesterRsrc', '--keepParent', appPath, zipPath], {
    stdio: 'inherit'
  });

  const stagedAppPath = join(stageDir, 'Sakurajima.app');
  copyFileSync(resolve(root, 'README.md'), join(stageDir, 'README.md'));
  cpSync(appBundlePath, stagedAppPath, { recursive: true });

  execFileSync(
    'hdiutil',
    ['create', '-volname', 'Sakurajima', '-srcfolder', stageDir, '-ov', '-format', 'UDZO', dmgPath],
    {
      stdio: 'inherit'
    }
  );

  console.log(`Created release artifacts:\n- ${zipPath}\n- ${dmgPath}`);
} finally {
  rmSync(stageDir, { recursive: true, force: true });
}
