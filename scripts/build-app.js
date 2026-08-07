#!/usr/bin/env node
// Builds dist/notihub.app out of the Electron runtime we already depend on.
//
// This is not a nicety: macOS refuses to deliver notifications from an
// unpackaged `electron .` run (UNErrorDomain error 1). A notification client
// needs its own bundle id and a code signature, which is exactly what this
// produces — so packaging is what makes the whole app work at all.
//
// ponytail: hand-rolled instead of electron-builder. It is ~60 lines of `ditto`
// and `plutil`, and none of the signing/notarizing/DMG machinery is wanted yet.
// Swap in electron-builder when we actually ship to Homebrew.
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const buildIcns = require('../src/icon');

const ROOT = path.join(__dirname, '..');
const pkg = require(path.join(ROOT, 'package.json'));
const APP = path.join(ROOT, 'dist', `${pkg.name}.app`);
const CONTENTS = path.join(APP, 'Contents');
const BUNDLE_ID = 'io.github.thuong180702.notihub';

const run = (cmd, args) => execFileSync(cmd, args, { stdio: 'inherit' });
const plist = (...args) => run('plutil', [...args, path.join(CONTENTS, 'Info.plist')]);

// 1. copy the Electron runtime. `ditto` because cp mangles framework symlinks.
fs.rmSync(APP, { recursive: true, force: true });
fs.mkdirSync(path.dirname(APP), { recursive: true });
run('ditto', [path.join(path.dirname(require.resolve('electron')), 'dist', 'Electron.app'), APP]);

// 2. our code, in place of the "no app loaded" default
fs.rmSync(path.join(CONTENTS, 'Resources', 'default_app.asar'), { force: true });
const dest = path.join(CONTENTS, 'Resources', 'app');
fs.mkdirSync(dest, { recursive: true });
fs.cpSync(path.join(ROOT, 'src'), path.join(dest, 'src'), { recursive: true });
fs.writeFileSync(
  path.join(dest, 'package.json'),
  // electron is the runtime here, not a dependency to resolve
  JSON.stringify({ name: pkg.name, version: pkg.version, main: pkg.main }, null, 2),
);

// 3. become our own app rather than Electron's
fs.renameSync(path.join(CONTENTS, 'MacOS', 'Electron'), path.join(CONTENTS, 'MacOS', pkg.name));
fs.rmSync(path.join(CONTENTS, 'Resources', 'electron.icns'), { force: true });
buildIcns(path.join(CONTENTS, 'Resources', `${pkg.name}.icns`));

plist('-replace', 'CFBundleExecutable', '-string', pkg.name);
plist('-replace', 'CFBundleName', '-string', pkg.name);
plist('-replace', 'CFBundleDisplayName', '-string', pkg.name);
plist('-replace', 'CFBundleIdentifier', '-string', BUNDLE_ID);
plist('-replace', 'CFBundleIconFile', '-string', `${pkg.name}.icns`);
plist('-replace', 'CFBundleVersion', '-string', pkg.version);
plist('-replace', 'CFBundleShortVersionString', '-string', pkg.version);
plist('-replace', 'LSApplicationCategoryType', '-string', 'public.app-category.social-networking');
// we deleted the asar it hashes, and a stale entry makes the app refuse to launch
plist('-remove', 'ElectronAsarIntegrity');

// 4. sign. Ad-hoc is enough for a local install; macOS only needs a stable
// signature to keep the notification permission attached to the bundle id.
// Helpers first — signing the outer bundle invalidates anything signed after.
for (const helper of fs.readdirSync(path.join(CONTENTS, 'Frameworks'))) {
  run('codesign', ['--force', '--sign', '-', '--deep', path.join(CONTENTS, 'Frameworks', helper)]);
}
run('codesign', ['--force', '--sign', '-', APP]);
run('codesign', ['--verify', '--deep', '--strict', APP]);

// 5. Package DMG installer and Zip archive
const zipName = `${pkg.name}-v${pkg.version}-mac.zip`;
const dmgName = `${pkg.name}-v${pkg.version}-mac.dmg`;
const distDir = path.join(ROOT, 'dist');

fs.rmSync(path.join(distDir, zipName), { force: true });
fs.rmSync(path.join(distDir, dmgName), { force: true });

console.log(`\nPackaging ${zipName}...`);
execFileSync('zip', ['-r', '-y', zipName, `${pkg.name}.app`], { cwd: distDir, stdio: 'inherit' });

console.log(`\nPackaging ${dmgName}...`);
execFileSync('hdiutil', ['create', '-volname', pkg.name, '-srcfolder', `${pkg.name}.app`, '-ov', '-format', 'UDZO', dmgName], { cwd: distDir, stdio: 'inherit' });

console.log(`\n✅ Built ${APP}`);
console.log(`✅ Built ${path.join(distDir, zipName)}`);
console.log(`✅ Built ${path.join(distDir, dmgName)}`);
