#!/bin/bash
# Build ແອັບ Windows (.exe) — ແລ່ນໄດ້ຈາກ macOS / Linux / Windows
#   bash windows-app/build.sh            → ຕ້ອງມີ .NET 8 Desktop Runtime ໃນເຄື່ອງປາຍທາງ (~4MB)
#   bash windows-app/build.sh standalone → ໄຟລ໌ດຽວ ບໍ່ຕ້ອງຕິດຕັ້ງຫຍັງເພີ່ມ (~150MB)
set -euo pipefail

cd "$(dirname "$0")"
export DOTNET_NOLOGO=1
DOTNET="$(command -v dotnet || echo "$HOME/.dotnet/dotnet")"

if [ ! -x "$DOTNET" ]; then
  echo "ບໍ່ພົບ .NET SDK ໃນເຄື່ອງນີ້"
  read -r -p "ຕິດຕັ້ງໃຫ້ເລີຍບໍ? (ລົງທີ່ ~/.dotnet ບໍ່ຕ້ອງໃຊ້ sudo, ~300MB) [y/N] " answer
  case "$answer" in
    y|Y|yes|YES)
      curl -sSL https://dot.net/v1/dotnet-install.sh | bash -s -- --channel 8.0 --install-dir "$HOME/.dotnet"
      DOTNET="$HOME/.dotnet/dotnet"
      ;;
    *)
      echo "ຍົກເລີກ. ຕິດຕັ້ງເອງດ້ວຍ:"
      echo "  curl -sSL https://dot.net/v1/dotnet-install.sh | bash -s -- --channel 8.0"
      exit 1
      ;;
  esac
fi

# ບອກຜົນລັບໃຫ້ຄົບ: path ເຕັມ + ຂະໜາດ (copy ໄປໃຊ້ໄດ້ເລີຍ)
report() {
  local exe="$1"
  echo
  if [ -f "$exe" ]; then
    echo "ສຳເລັດ ✓  $(du -h "$exe" | cut -f1)"
    echo "$(cd "$(dirname "$exe")" && pwd)/$(basename "$exe")"
  else
    echo "ສຳເລັດ ✓  ຢູ່ໂຟນເດີ: $(cd "$(dirname "$exe")" && pwd)"
  fi
}

if [ "${1:-}" = "standalone" ]; then
  echo "Build ແບບໄຟລ໌ດຽວ (ບໍ່ຕ້ອງຕິດຕັ້ງ .NET ໃນເຄື່ອງປາຍທາງ)..."
  "$DOTNET" publish -c Release -r win-x64 --self-contained true \
    -p:PublishSingleFile=true -p:IncludeNativeLibrariesForSelfExtract=true \
    -p:EnableCompressionInSingleFile=true -o out-standalone
  report "out-standalone/SMLAO POS.exe"
  echo "→ copy ໄຟລ໌ດຽວນີ້ໄປວາງເຄື່ອງ Windows ແລ້ວເປີດໄດ້ເລີຍ ບໍ່ຕ້ອງຕິດຕັ້ງ"
else
  echo "Build ແບບປົກກະຕິ (ເຄື່ອງປາຍທາງຕ້ອງມີ .NET 8 Desktop Runtime)..."
  "$DOTNET" publish -c Release -r win-x64 --self-contained false -o out
  report "out/SMLAO POS.exe"
  echo "→ ເອົາທັງໂຟນເດີ out/ ໄປ (ບໍ່ແມ່ນສະເພາະ .exe)"
fi
