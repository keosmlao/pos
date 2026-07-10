#!/bin/bash
# ສຳຮອງຖານຂໍ້ມູນ POS ອັດຕະໂນມັດ — ເກັບໄວ້ 30 ຊຸດຫຼ້າສຸດ
# ແລ່ນເອງ: bash scripts/backup-db.sh
# ກູ້ຄືນ: pg_restore -h HOST -U postgres -d pos_db --clean backup_file.dump

set -euo pipefail

BACKUP_DIR="$HOME/pos-backups"
ENV_FILE="$(cd "$(dirname "$0")/.." && pwd)/.env"
PG_DUMP="/opt/homebrew/bin/pg_dump"

# ອ່ານຄ່າເຊື່ອມຕໍ່ຈາກ .env ຂອງໂປຣເຈັກ
set -a
source "$ENV_FILE"
set +a

mkdir -p "$BACKUP_DIR"
STAMP="$(date +%Y-%m-%d_%H%M)"
OUT="$BACKUP_DIR/pos_db_${STAMP}.dump"

"$PG_DUMP" -h "$PGHOST" -p "${PGPORT:-5432}" -U "$PGUSER" -d "$PGDATABASE" \
  --format=custom --file="$OUT"

# ລຶບ backup ເກົ່າ ເຫຼືອ 30 ໄຟລ໌ຫຼ້າສຸດ
ls -t "$BACKUP_DIR"/pos_db_*.dump 2>/dev/null | tail -n +31 | xargs rm -f 2>/dev/null || true

echo "$(date '+%Y-%m-%d %H:%M:%S') backup OK: $OUT ($(du -h "$OUT" | cut -f1))" >> "$BACKUP_DIR/backup.log"
