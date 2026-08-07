#!/bin/bash
# Build ແອັບ Windows (.exe) — ແລ່ນໄດ້ຈາກ macOS / Linux / Windows
#   bash windows-app/build.sh            → ຕ້ອງມີ .NET 8 Desktop Runtime ໃນເຄື່ອງປາຍທາງ (~4MB)
#   bash windows-app/build.sh standalone → ໄຟລ໌ດຽວ ບໍ່ຕ້ອງຕິດຕັ້ງຫຍັງເພີ່ມ (~150MB)
set -euo pipefail

cd "$(dirname "$0")"
export DOTNET_NOLOGO=1
DOTNET="$(command -v dotnet || echo "$HOME/.dotnet/dotnet")"

if [ ! -x "$DOTNET" ]; then
  echo "ບໍ່ພົບ .NET SDK — ຕິດຕັ້ງດ້ວຍ:"
  echo "  curl -sSL https://dot.net/v1/dotnet-install.sh | bash -s -- --channel 8.0"
  exit 1
fi

if [ "${1:-}" = "standalone" ]; then
  echo "Build ແບບໄຟລ໌ດຽວ (ບໍ່ຕ້ອງຕິດຕັ້ງ .NET ໃນເຄື່ອງປາຍທາງ)..."
  "$DOTNET" publish -c Release -r win-x64 --self-contained true \
    -p:PublishSingleFile=true -p:IncludeNativeLibrariesForSelfExtract=true \
    -p:EnableCompressionInSingleFile=true -o out-standalone
  echo
  echo "ສຳເລັດ: windows-app/out-standalone/SMLAO POS.exe"
  echo "ເອົາໄຟລ໌ດຽວນີ້ໄປວາງເຄື່ອງ Windows ແລ້ວເປີດໄດ້ເລີຍ"
else
  echo "Build ແບບປົກກະຕິ (ເຄື່ອງປາຍທາງຕ້ອງມີ .NET 8 Desktop Runtime)..."
  "$DOTNET" publish -c Release -r win-x64 --self-contained false -o out
  echo
  echo "ສຳເລັດ: windows-app/out/  (ເອົາທັງໂຟນເດີໄປ)"
fi
