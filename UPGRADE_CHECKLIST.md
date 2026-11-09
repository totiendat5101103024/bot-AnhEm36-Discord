# Sinh Tồn Đại Học Bot — Checklist nâng cấp

> Cập nhật lần cuối: 2026-11-09
>
> Quy ước: `[ ]` chưa làm · `[~]` đang làm · `[x]` xong · `[!]` bị chặn

## Trạng thái tổng quan

| Giai đoạn | Trạng thái | Ghi chú |
|---|---|---|
| 0. Nền tảng & an toàn | `[x]` | Hoàn tất, đã kiểm tra |
| 1. Nhạc | `[x]` | Hoàn tất, đã kiểm tra |
| 2. Game | `[x]` | Hoàn tất 14 lệnh game, đã kiểm tra logic + mô phỏng |
| 3. Board game + Voice | `[x]` | Hoàn tất Caro/Cờ vua/Cờ tướng, voice tạm, study, settings |
| 4. QA & vận hành | `[x]` | Hoàn tất test logic, README, log rotate, checklist test tay |

> **Điểm dừng hiện tại: hoàn tất Giai đoạn 4.** Đã xong QA & vận hành: bộ test logic thuần (`npm test`), README + `.env.example`, log rotate tự động dọn log cũ bằng `gio trash`, checklist test tay trên guild riêng. Dự án đã sẵn sàng chạy thật sau khi test tay.

---

## Giai đoạn 0 — Nền tảng & an toàn `[x]`

- [x] `git init` + `.gitignore` + commit baseline `469405c`
- [x] Backup source + `economy.db` → `backups/20261109-1643/`
- [x] `utils/logger.js` — log console + file `logs/bot-YYYY-MM-DD.log`, lỗi ghi file tự tắt
- [x] `utils/lifecycle.js` — bắt `SIGINT`/`SIGTERM`, `unhandledRejection`, `uncaughtException`
- [x] `.catch()` toàn bộ `channel.send` trong event nhạc (`utils/music.js → safeSend`)
- [x] Bỏ intent `GuildMembers` — chỉ còn `Guilds`, `GuildVoiceStates`, `GuildMessages`
- [x] `utils/db.js` + migration theo `PRAGMA user_version` (schema v6)
- [x] `utils/economy.js` — `tryDebit` / `credit` / `refund` / `transfer` trong transaction
- [x] `utils/cooldowns.js` — chống spam theo user + lệnh, tự dọn bucket
- [x] `utils/ui.js` — màu, progress bar, format thời gian, embed helpers
- [x] `utils/settings.js` — `guild_settings` + cache RAM
- [x] `utils/permissions.js` — voice, DJ, admin, safe reply
- [x] `utils/music.js` — `requireQueue`, `preparePlay`, `prepareControl`, `safeSend`
- [x] `utils/components.js` — router button/select/modal theo prefix
- [x] `utils/commandLoader.js` + `utils/eventLoader.js` — nạp đệ quy, hỗ trợ event `setup: true`
- [x] `events/interactionCreate.js` — router lệnh + component + cooldown + bắt lỗi
- [x] `events/distube.js` — panel, prefetch, auto-leave, error handling, dọn panel
- [x] `events/ready.js` — presence, cron, đối soát phiên voice, dọn temp channel
- [x] `jobs/zotero.js`, `jobs/deadlines.js`
- [x] `index.js` rút gọn thành bootstrap
- [x] `ecosystem.config.js` — PM2, `kill_timeout` 10s, `max_memory_restart` 512M
- [x] `deploy.js` — `--guild <id>` (hiện ngay), `--clear`
- [x] `.env.example`

## Giai đoạn 1 — Nhạc `[x]`

- [x] Player panel + nút pause/skip/stop/prev/loop/shuffle/volume/seek/queue
- [x] `/queue` phân trang (nút ⬅️ ➡️ ✖️)
- [x] `/search` — select menu 5 kết quả YouTube
- [x] `/seek`, `/shuffle`, `/remove`, `/move`, `/jump`, `/clear`, `/leave`
- [x] `/lyrics` (lyrics.ovh), `/autoplay`, `/247`
- [x] `/playlist save|load|list|delete` (SQLite)
- [x] Auto-leave: kênh trống 45s, hết hàng đợi, và idle watcher (`jobs/idle.js`)
- [x] Kiểm tra quyền Connect/Speak + cùng kênh voice
- [x] Giới hạn queue: chặn trước khi thêm (`/play`), cắt bớt khi nạp playlist
- [x] Chống spam: cooldown mặc định 2s/lệnh, `/play` 2s
- [x] Plugin: dedupe yt-dlp, cache 45 phút / 100 entry, prefetch 2 bài, warm-up 4×3s
- [x] Bỏ auto-update yt-dlp mỗi lần khởi động (`update: false`)
- [x] `/help` dạng select menu theo nhóm

### Bổ sung khi rà soát

- [x] `jobs/idle.js` — tự rời voice khi tạm dừng quá `idle_timeout` (mặc định 10 phút) hoặc kênh trống quá 60s
- [x] `deleteQueue` → xoá panel để không còn nút chết sau `/stop`
- [x] `scripts/backup-db.sh` — `--dry-run` không tạo thư mục/log; `VACUUM INTO`, giữ 7 bản, bản cũ vào `gio trash`

## Giai đoạn 2 — Game `[x]`

- [x] Economy: `tryDebit`, `credit`, `transfer`, `refund`, bảng `transactions`
- [x] Cân bằng payout (xóc đĩa 1.9x, slot 5x/1.5x), daily streak
- [x] Viết lại `/taixiu`, `/slots`, `/xocdia`, `/flip` theo pattern cược → animation → settle/refund
- [x] `utils/games.js` — `placeBet`, `settleWin`, `settleLoss`, `settleDraw`, `refundBet`
- [x] `utils/cards.js` — bộ bài 52 lá, chia bài, điểm blackjack
- [x] Texas Hold'em 2–6 người: blinds 10/20, 4 vòng cược, side-pot, timeout 45s, lobby 5 phút
- [x] `games/poker/evaluator.js` — đánh giá 5/7 lá, so sánh tay, xử lý wheel (A-2-3-4-5)
- [x] Heads-up Texas với bot AI Monte Carlo (`games/poker/bot.js`)
- [x] Video Poker Jacks or Better (giữ/đổi bài, paytable đầy đủ)
- [x] Blackjack (Hit/Stand/Double, dealer dừng 17, Blackjack trả 3:2)
- [x] Trivia tiếng Việt (`data/trivia.json`, 26 câu, thưởng 150 xu, timeout 25s)
- [x] Bầu Cua, Rồng Hổ, Hi-Lo, Vòng quay
- [x] `/game-stats` — thống kê theo game, thắng/thua/hoà, lãi/lỗ
- [x] Escrow poker + hoàn tiền khi restart (`refundStaleEscrow()` trong `events/ready.js`)
- [x] Phân quyền nút bấm: chỉ đúng người chơi hiện tại mới thao tác; chỉ chủ ván bắt đầu/huỷ
- [x] Chuẩn hoá `guildId` khi chơi ngoài server (DM) — tránh lỗi `NOT NULL` của `game_stats`

### Kết quả kiểm tra Giai đoạn 2

| Hạng mục | Kết quả |
|---|---|
| Evaluator poker (royal, wheel, quads, full house, flush, straight, trips, two pair, pair, high, so sánh) | ✅ 0 lỗi |
| Mô phỏng poker 80 ván (2–6 người, fold/all-in/raise ngẫu nhiên) | ✅ `SIM_FAIL 0`, không lệch chip |
| Side-pot (stack 100/500/500): main pot 300, side pot 800 | ✅ đúng, tổng chip bảo toàn 1100 |
| Chia đôi pot (3 người, 2 người hoà tay mạnh nhất) | ✅ 450/450/0, tổng chip 900 |
| Bot AI: equity AA pre-flop | ✅ ~0.817 |
| Blackjack 300 ván (hit/stand/double ngẫu nhiên) | ✅ 0 lỗi, delta số dư khớp payout |
| Video Poker 200 ván (giữ ngẫu nhiên) | ✅ 0 lỗi, payout khớp paytable |
| Trivia 60 câu (trả lời đúng) | ✅ 0 lỗi, cộng đúng 150 xu |
| Bầu Cua 60 ván | ✅ delta số dư hợp lệ |
| Rồng Hổ 60 ván | ✅ delta số dư hợp lệ |
| Hi-Lo 80 ván | ✅ delta số dư hợp lệ |
| Vòng quay 120 ván | ✅ delta số dư hợp lệ (gồm x0.5) |
| DM fallback (`guildId` rỗng) | ✅ không crash, ghi scope `global` |
| Escrow: 2 khoản treo sau restart | ✅ hoàn đủ 1000 xu, `status = refunded` |
| `node --check` toàn bộ `.js` | ✅ 0 lỗi |
| Nạp lệnh / event / component | ✅ 49 lệnh, 4 event, 8 prefix (`search, blackjack, help, music, poker, queue, trivia, vp`) |
| `/help` và deploy JSON | ✅ Game 14 lệnh, 49 tên duy nhất |

> Escrow poker dùng bảng `poker_escrow` (schema v6). Khi bot restart giữa ván, toàn bộ tiền mua chip còn `held` được hoàn lại tự động.

## Giai đoạn 3 — Board game async + Voice `[x]`

- [x] Caro/Gomoku 15×15, thách đấu, Elo (`games/board/caro.js`, `/caro`, `/board`)
- [x] Cờ vua engine đầy đủ: castling, en passant, promotion, check, checkmate, stalemate, 50 nước, lặp 3 lần, thiếu quân
- [x] Cờ tướng: luật đi quân, cung, sông, cản mã, mặt tướng, chiếu hết / hết nước tính thua
- [x] Lưu ván trong SQLite (`board_games`, `board_stats`), chơi async qua nhiều ngày
- [x] Nút **Đánh** mở modal nhập nước đi; nút **Xin thua**; `/board move` dự phòng khi message cũ
- [x] `/board rank`, `/board history`, `/board list`
- [x] Temp Voice "Join to Create" qua `/settings kenh_tao_voice`
- [x] `/voice name|limit|lock|unlock|kick|claim|transfer`
- [x] `/voice stats` — thời gian voice 7 ngày / 30 ngày / tất cả
- [x] `/study start|stop|rank` — phiên học voice, thông báo kết thúc, xếp hạng giờ học
- [x] Ghi giờ voice + thống kê tuần/tháng (`voice_sessions`, `utils/voiceStats.js`)
- [x] Chia phiên voice tại mốc bắt đầu/kết thúc study để không tính lẫn giờ học
- [x] Khôi phục phiên study đang chạy sau restart (`resumeAll` trong `events/ready.js`)
- [x] `/settings` cho admin — voice tạm, danh mục, log, DJ, âm lượng, queue, idle, autoplay, 24/7

### Kết quả kiểm tra Giai đoạn 3

| Hạng mục | Kết quả |
|---|---|
| Cờ vua perft độ sâu 1–4 | ✅ 20 / 400 / 8.902 / 197.281 — khớp chuẩn |
| Cờ vua: nhập thành, en passant, phong cấp, chiếu hết (fool's mate), stalemate | ✅ tất cả đúng |
| Cờ tướng: nước đi hợp lệ ban đầu / perft 2 | ✅ 44 / 1.920 |
| Cờ tướng: mặt tướng, cản mã, cung, sông, chiếu | ✅ kiểm tra bằng thế cờ dựng tay |
| Caro: nối 5 quân, phát hiện thắng, tọa độ sai | ✅ đúng, không nhận nước sai |
| Lưu ván SQLite + đọc lại sau khi đi nước | ✅ state/lượt đi còn nguyên |
| Elo + thắng/thua/hoà | ✅ cập nhật đúng, tổng Elo bảo toàn tương đối |
| `/board rank`, `/board history`, `/board list` | ✅ không lỗi, hiển thị đúng |
| Voice: name/limit/lock/unlock/kick/claim/transfer | ✅ đổi tên, giới hạn, quyền, chuyển chủ đúng |
| Study: start/stop/rank, resume sau restart | ✅ tạo/đóng phiên, aggregate giờ đúng |
| Voice stats tuần/tháng/all | ✅ tính cả phiên đang mở, tách giờ học |
| `/settings` hiển thị + cập nhật + reset | ✅ lưu DB, cache làm mới đúng |
| `node --check` toàn bộ `.js` | ✅ 0 lỗi |
| Nạp lệnh / event / component | ✅ 56 lệnh, 4 event, 9 prefix (`search, blackjack, board, help, music, poker, queue, trivia, vp`) |
| `/help` và deploy JSON | ✅ 8 nhóm, 56 tên duy nhất |

## Giai đoạn 4 — QA & vận hành `[x]`

- [x] `node --check` toàn bộ file (đã chạy, 0 lỗi)
- [x] Test logic thuần: poker evaluator, chess, caro (`tests/`, `npm test` — 37/37 pass)
- [x] README + cập nhật `.env.example` lần cuối (`README.md`, `LOG_KEEP_DAYS`)
- [x] Script backup DB (`--dry-run`, log)
- [x] Log rotate tự động: xoay theo ngày + dọn `bot-*.log` cũ hơn `LOG_KEEP_DAYS` ngày bằng `gio trash`
- [x] Checklist test tay trên guild riêng (`docs/MANUAL_TEST.md`)
- [x] Deploy 56 lệnh global + chạy PM2; bot online (`AnhEm36#2223`, 1 server), log không lỗi

### Kết quả kiểm tra Giai đoạn 4

| Hạng mục | Kết quả |
|---|---|
| `npm test` — poker evaluator | ✅ 16 test: 9 hạng bài, tie-break, wheel, best 5/7 lá, lỗi dưới 5 lá |
| `npm test` — cờ vua | ✅ 12 test: perft 1–4 (20 / 400 / 8.902 / 197.281), nhập thành, en passant, phong cấp, fool's mate, stalemate, chặn nước sai |
| `npm test` — Caro | ✅ 9 test: thắng ngang/dọc/chéo, chưa đủ 5, tọa độ sai, ô đã có quân, sai lượt |
| Tổng test | ✅ 37 pass, 0 fail |
| Log rotate | ✅ file `bot-2000-01-01.log` cũ được đưa vào trash khi khởi động, log hôm nay giữ nguyên |
| README / `.env.example` | ✅ đủ cài đặt, cấu hình, PM2, 56 lệnh / 8 nhóm, backup, test |
| Tài liệu test tay | ✅ `docs/MANUAL_TEST.md` — 9 nhóm, có kết quả mong đợi |
| Deploy lệnh | ✅ 56 lệnh global nộp thành công (có thể chờ tới 1 giờ để hiện) |
| Chạy thật | ✅ PM2 online, bot `AnhEm36#2223` kết nối 1 server, 0 lỗi trong `pm2-error.log` |

---

## Kết quả kiểm tra (2026-11-09)

| Hạng mục | Kết quả |
|---|---|
| `node --check` toàn bộ `.js` | ✅ 0 lỗi |
| Nạp lệnh | ✅ 56 lệnh, không trùng tên |
| Nạp event | ✅ 4 event (`interactionCreate`, `clientReady`, `voiceStateUpdate`, DisTube setup) |
| Component handler | ✅ 9 prefix: `search`, `blackjack`, `board`, `help`, `music`, `poker`, `queue`, `trivia`, `vp` |
| `/help` embed | ✅ 8 nhóm hiển thị đúng (Game 14, Board 4) |
| Deploy JSON | ✅ 56 lệnh, 56 tên duy nhất |
| Economy | ✅ daily, debit/credit, transfer, refund, thống kê, leaderboard |
| Game helper | ✅ cược → thắng/thua/hoàn tiền, transaction log đúng |
| Board game | ✅ Caro/cờ vua/cờ tướng, perft cờ vua 197.281, Elo + lưu SQLite |
| Voice & Study | ✅ voice tạm, `/voice`, `/study`, thống kê tuần/tháng, resume sau restart |
| Settings | ✅ admin-only, cập nhật DB + cache, reset mặc định |
| Idle watcher | ✅ giả lập: paused >10 phút và kênh trống >60s đều stop + leave |
| Migration DB thật (bản copy) | ✅ v0 → v6, đủ 12 bảng, DB gốc không bị đụng |
| Backups DB | ✅ script `--dry-run` + `VACUUM INTO`, giữ 7 bản, dọn bằng `gio trash` |
| Test logic thuần | ✅ `npm test`: 37/37 pass (poker, cờ vua, caro) |
| Log rotate | ✅ dọn `bot-*.log` cũ hơn `LOG_KEEP_DAYS` ngày vào trash |

> Chưa chạy bot thật với Discord (cần token/kết nối). Các kiểm tra trên là tĩnh + logic + mô phỏng.

---

## Nhật ký thay đổi

- 2026-11-09: Khởi tạo checklist, bắt đầu Giai đoạn 0.
- 2026-11-09: Hoàn tất code Giai đoạn 0 + 1; thêm idle watcher, chặn giới hạn queue, dọn panel khi `deleteQueue`; rà soát và chốt Giai đoạn 0–1.
- 2026-11-09: Giai đoạn 2 mới hoàn thành phần kinh tế + 4 game cũ (`taixiu`, `slots`, `xocdia`, `flip`); dừng ở đây theo yêu cầu.
- 2026-11-09: Hoàn tất Giai đoạn 2 — poker 2–6 người + bot Monte Carlo, blackjack, video poker, trivia, Bầu Cua, Rồng Hổ, Hi-Lo, Vòng quay, `/game-stats`, escrow/hoàn tiền khi restart. Đã kiểm tra tĩnh + 80 ván poker + 300 ván blackjack + 200 ván video poker + 60 câu trivia + 320 ván game nhỏ + side-pot + escrow, 0 lỗi.
- 2026-11-09: Hoàn tất Giai đoạn 3 — Caro/Gomoku, cờ vua (perft 4 = 197.281), cờ tướng, Elo + lưu ván SQLite, `/board`; voice tạm Join-to-Create, `/voice`, `/study`, thống kê giờ voice tuần/tháng, `/settings`. Đã kiểm tra engine, persistence, Elo, voice ops, study start/stop/rank + resume, 0 lỗi.
- 2026-11-09: Hoàn tất Giai đoạn 4 — thêm bộ test logic thuần `tests/` (`npm test`, 37/37 pass), log rotate tự động dọn log cũ bằng `gio trash`, README + `.env.example` (`LOG_KEEP_DAYS`), `docs/MANUAL_TEST.md`. Đã chạy lại `node --check` toàn bộ, harness nạp 56 lệnh / 4 event / 9 prefix, 0 lỗi.
- 2026-11-09: Triển khai thật — nộp 56 lệnh global thành công, `pm2 start ecosystem.config.js` đưa bot online (`AnhEm36#2223`, 1 server), DB schema v6, deadline cron + idle watcher + đối soát voice phiên chạy bình thường, `pm2-error.log` trống.
