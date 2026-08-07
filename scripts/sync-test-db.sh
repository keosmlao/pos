#!/bin/bash
# Copy ຂໍ້ມູນຈາກຖານຂອງຈິງ (pos_db) ໄປໃສ່ຖານທົດສອບ (pos_test)
# ແລ່ນເອງ: bash scripts/sync-test-db.sh
#
# ຂັ້ນຕອນ: 1) dump pos_test ໄວ້ກັນພາດ  2) dump pos_db  3) restore ທັບ pos_test
# ⚠️  ຂໍ້ມູນເກົ່າໃນ pos_test ຈະຖືກລຶບທັງໝົດ

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
BACKUP_DIR="$HOME/pos-backups"
PG_DUMP="/opt/homebrew/bin/pg_dump"
PG_RESTORE="/opt/homebrew/bin/pg_restore"
PSQL="/opt/homebrew/bin/psql"

# ຄ່າເຊື່ອມຕໍ່ຂອງຈິງ (ຕົ້ນທາງ) — ເອົາ PGPASSWORD ນຳ
set -a
source "$ROOT/.env"
set +a
SRC_DB="$PGDATABASE"

# ຖານປາຍທາງອ່ານຈາກ .env.test
DST_DB="$(grep -E '^PGDATABASE=' "$ROOT/.env.test" | cut -d= -f2 | tr -d '[:space:]')"

if [ -z "$DST_DB" ] || [ "$DST_DB" = "$SRC_DB" ]; then
  echo "ຢຸດ: ຖານປາຍທາງບໍ່ຖືກຕ້ອງ ($DST_DB)" >&2
  exit 1
fi

mkdir -p "$BACKUP_DIR"
STAMP="$(date +%Y-%m-%d_%H%M)"
SAFETY="$BACKUP_DIR/${DST_DB}_before-sync_${STAMP}.dump"
SRC_OUT="$BACKUP_DIR/${SRC_DB}_${STAMP}.dump"

echo "1/3 ສຳຮອງ $DST_DB ໄວ້ກ່ອນ → $SAFETY"
"$PG_DUMP" -h "$PGHOST" -p "${PGPORT:-5432}" -U "$PGUSER" -d "$DST_DB" \
  --format=custom --file="$SAFETY"

echo "2/3 dump $SRC_DB → $SRC_OUT"
"$PG_DUMP" -h "$PGHOST" -p "${PGPORT:-5432}" -U "$PGUSER" -d "$SRC_DB" \
  --format=custom --file="$SRC_OUT"

echo "3/3 restore ທັບ $DST_DB"
"$PG_RESTORE" -h "$PGHOST" -p "${PGPORT:-5432}" -U "$PGUSER" -d "$DST_DB" \
  --clean --if-exists --no-owner --no-acl --single-transaction "$SRC_OUT"

echo "ກວດຜົນ:"
"$PSQL" -h "$PGHOST" -p "${PGPORT:-5432}" -U "$PGUSER" -d "$DST_DB" -c \
  "select 'products' t, count(*) from products union all select 'orders', count(*) from orders union all select 'users', count(*) from users;"

echo "$(date '+%Y-%m-%d %H:%M:%S') sync $SRC_DB → $DST_DB OK" >> "$BACKUP_DIR/backup.log"
echo "ສຳເລັດ. ຖານທົດສອບເກົ່າຢູ່ທີ່: $SAFETY"
