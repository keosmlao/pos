#!/usr/bin/env node
// Build ແອັບ Windows (.exe) — ແລ່ນໄດ້ທຸກ shell: cmd, PowerShell, Git Bash, macOS, Linux
//   node windows-app/build.mjs             → ຕ້ອງມີ .NET 8 Desktop Runtime ໃນເຄື່ອງປາຍທາງ (~4MB)
//   node windows-app/build.mjs standalone  → ໄຟລ໌ດຽວ ບໍ່ຕ້ອງຕິດຕັ້ງຫຍັງເພີ່ມ (~150MB)
//
// ໃຊ້ node ແທນ bash ເພາະ Windows ບໍ່ມີ bash ໃນ PATH ໂດຍຄ່າເລີ່ມຕົ້ນ

import { spawnSync } from 'node:child_process';
import { existsSync, statSync } from 'node:fs';
import { homedir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const isWin = process.platform === 'win32';
const exe = isWin ? 'dotnet.exe' : 'dotnet';

function findDotnet() {
  // 1. ຢູ່ໃນ PATH ບໍ່
  const probe = spawnSync(exe, ['--version'], { stdio: 'ignore', shell: false });
  if (probe.status === 0) return exe;

  // 2. ບ່ອນຕິດຕັ້ງມາດຕະຖານ
  const candidates = isWin
    ? [
        path.join(process.env.ProgramFiles || 'C:\\Program Files', 'dotnet', exe),
        path.join(process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)', 'dotnet', exe),
        path.join(homedir(), '.dotnet', exe),
      ]
    : ['/usr/local/share/dotnet/dotnet', '/usr/bin/dotnet', path.join(homedir(), '.dotnet', 'dotnet')];

  return candidates.find(p => existsSync(p)) || null;
}

function installHelp() {
  console.error('\n❌ ບໍ່ພົບ .NET SDK 8 ໃນເຄື່ອງນີ້ — ຕິດຕັ້ງກ່ອນຈຶ່ງ build ໄດ້\n');
  if (isWin) {
    console.error('ວິທີທີ່ງ່າຍທີ່ສຸດ (ເປີດ PowerShell ແລ້ວແລ່ນ):');
    console.error('    winget install --id Microsoft.DotNet.SDK.8 -e\n');
    console.error('ຫຼື ດາວໂຫຼດຕິດຕັ້ງເອງ:');
    console.error('    https://dotnet.microsoft.com/download/dotnet/8.0  →  SDK 8.0 (x64)\n');
    console.error('ຕິດຕັ້ງແລ້ວ ປິດ terminal ເປີດໃໝ່ ແລ້ວແລ່ນ  npm run build:win  ອີກເທື່ອ');
  } else {
    console.error('    curl -sSL https://dot.net/v1/dotnet-install.sh | bash -s -- --channel 8.0');
  }
  console.error('');
}

const standalone = process.argv[2] === 'standalone';
const dotnet = findDotnet();
if (!dotnet) {
  installHelp();
  process.exit(1);
}

const outDir = standalone ? 'out-standalone' : 'out';
const args = standalone
  ? ['publish', '-c', 'Release', '-r', 'win-x64', '--self-contained', 'true',
     '-p:PublishSingleFile=true', '-p:IncludeNativeLibrariesForSelfExtract=true',
     '-p:EnableCompressionInSingleFile=true', '-o', outDir]
  : ['publish', '-c', 'Release', '-r', 'win-x64', '--self-contained', 'false', '-o', outDir];

console.log(standalone
  ? 'Build ແບບໄຟລ໌ດຽວ (ບໍ່ຕ້ອງຕິດຕັ້ງ .NET ໃນເຄື່ອງປາຍທາງ)...'
  : 'Build ແບບປົກກະຕິ (ເຄື່ອງປາຍທາງຕ້ອງມີ .NET 8 Desktop Runtime)...');

const run = spawnSync(dotnet, args, {
  cwd: HERE,
  stdio: 'inherit',
  env: { ...process.env, DOTNET_NOLOGO: '1' },
});

if (run.status !== 0) {
  console.error('\n❌ Build ບໍ່ສຳເລັດ');
  process.exit(run.status || 1);
}

const exePath = path.join(HERE, outDir, 'SMLAO POS.exe');
console.log('');
if (existsSync(exePath)) {
  const mb = (statSync(exePath).size / 1024 / 1024).toFixed(1);
  console.log(`ສຳເລັດ ✓  ${mb} MB`);
  console.log(exePath);
} else {
  console.log(`ສຳເລັດ ✓  ຢູ່ໂຟນເດີ: ${path.join(HERE, outDir)}`);
}
console.log(standalone
  ? '→ copy ໄຟລ໌ດຽວນີ້ໄປວາງເຄື່ອງ Windows ແລ້ວເປີດໄດ້ເລີຍ ບໍ່ຕ້ອງຕິດຕັ້ງ'
  : '→ ເອົາທັງໂຟນເດີ out/ ໄປ (ບໍ່ແມ່ນສະເພາະ .exe)');
