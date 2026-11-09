#!/usr/bin/env bash
# backup-db.sh — sao lưu SQLite an toàn (dùng VACUUM INTO để không cần dừng bot).
#
#   ./scripts/backup-db.sh
#   ./scripts/backup-db.sh --dry-run
#
# Giữ tối đa 7 bản; bản cũ được đưa vào trash (không xoá vĩnh viễn).

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DB="${DB_PATH:-$ROOT/data/economy.db}"
DEST="$ROOT/backups/db"
LOG="$ROOT/logs/backup.log"
KEEP=7
DRY_RUN=0

for arg in "$@"; do
    case "$arg" in
        --dry-run) DRY_RUN=1 ;;
        -h|--help)
            echo "Dùng: $0 [--dry-run]"
            exit 0
            ;;
        *)
            echo "Tham số không hợp lệ: $arg" >&2
            exit 2
            ;;
    esac
done

if [[ ! -f "$DB" ]]; then
    echo "Không tìm thấy database: $DB" >&2
    exit 1
fi

STAMP="$(date +%Y%m%d-%H%M%S)"
OUT="$DEST/economy-$STAMP.db"

if [[ "$DRY_RUN" -eq 1 ]]; then
    echo "[dry-run] Sẽ sao lưu $DB -> $OUT"
    echo "[dry-run] Sẽ giữ $KEEP bản mới nhất trong $DEST"
    exit 0
fi

mkdir -p "$DEST" "$(dirname "$LOG")"

log() {
    local line
    line="[$(date -Iseconds)] $*"
    echo "$line"
    echo "$line" >> "$LOG"
}

# VACUUM INTO tạo bản copy nhất quán kể cả khi bot đang chạy.
if command -v sqlite3 >/dev/null 2>&1; then
    sqlite3 "$DB" "VACUUM INTO '$OUT';"
else
    cp -a "$DB" "$OUT"
    log "Không có sqlite3 — dùng cp (có thể không nhất quán nếu bot đang ghi)."
fi

log "Đã sao lưu: $OUT ($(du -h "$OUT" | cut -f1))"

# Dọn bản cũ bằng gio trash (theo quy tắc không xoá vĩnh viễn).
mapfile -t OLD < <(ls -1t "$DEST"/economy-*.db 2>/dev/null | tail -n +$((KEEP + 1)) || true)
for f in "${OLD[@]:-}"; do
    [[ -z "$f" ]] && continue
    if command -v gio >/dev/null 2>&1; then
        gio trash "$f" && log "Đã đưa vào trash: $f"
    else
        log "Giữ lại bản cũ (không có gio): $f"
    fi
done

log "Hoàn tất. Tổng bản backup: $(ls -1 "$DEST"/economy-*.db 2>/dev/null | wc -l)"
