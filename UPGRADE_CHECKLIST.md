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
| 3. Board game + Voice | `[ ]` | Chưa bắt đầu |
| 4. QA & vận hành | `[ ]` | Chưa bắt đầu (mới có kiểm tra tĩnh) |

> **Điểm dừng hiện tại: hết Giai đoạn 2.** Đã xong poker (2–6 người + bot), blackjack, video poker, trivia, Bầu Cua, Rồng Hổ, Hi-Lo, Vòng quay, `/game-stats`, escrow/hoàn tiền khi restart. Chưa làm Giai đoạn 3–4.

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

## Giai đoạn 3 — Board game async + Voice `[ ]`

- [ ] Caro/Gomoku 15×15, thách đấu, Elo
- [ ] Cờ vua (engine đầy đủ: castling, en passant, promotion, checkmate)
- [ ] Cờ tướng (tuỳ thời gian)
- [ ] Lưu ván trong SQLite, chơi qua nhiều ngày
- [ ] `/board rank`, lịch sử đấu
- [ ] Temp Voice "Join to Create"
- [ ] `/voice name|limit|lock|unlock|kick|claim|transfer`
- [ ] `/study start|stop|rank`
- [ ] Ghi giờ voice + thống kê tuần/tháng
- [ ] `/settings` cho admin

> Schema v5 đã có `voice_sessions`, `temp_channels`, `study_sessions`; `events/voiceStateUpdate.js` đã ghi phiên voice và tạo kênh tạm cơ bản. `events/ready.js` gọi `studyManager` trong `try/catch` (module chưa tồn tại — bỏ qua an toàn).

## Giai đoạn 4 — QA & vận hành `[ ]`

- [x] `node --check` toàn bộ file (đã chạy, 0 lỗi)
- [ ] Test logic thuần: poker evaluator, chess, caro
- [ ] README + cập nhật `.env.example` lần cuối
- [x] Script backup DB (`--dry-run`, log)
- [ ] Log rotate tự động (hiện xoay theo ngày, chưa xoá bản cũ)
- [ ] Checklist test tay trên guild riêng

---

## Kết quả kiểm tra (2026-11-09)

| Hạng mục | Kết quả |
|---|---|
| `node --check` toàn bộ `.js` | ✅ 0 lỗi |
| Nạp lệnh | ✅ 49 lệnh, không trùng tên |
| Nạp event | ✅ 4 event (`interactionCreate`, `clientReady`, `voiceStateUpdate`, DisTube setup) |
| Component handler | ✅ 8 prefix: `search`, `blackjack`, `help`, `music`, `poker`, `queue`, `trivia`, `vp` |
| `/help` embed | ✅ 5 nhóm hiển thị đúng (Game 14 lệnh) |
| Deploy JSON | ✅ 49 lệnh, 49 tên duy nhất |
| Economy | ✅ daily, debit/credit, transfer, refund, thống kê, leaderboard |
| Game helper | ✅ cược → thắng/thua/hoàn tiền, transaction log đúng |
| Idle watcher | ✅ giả lập: paused >10 phút và kênh trống >60s đều stop + leave |
| Migration DB thật (bản copy) | ✅ v0 → v6, đủ 12 bảng, DB gốc không bị đụng |
| Backup script | ✅ `--dry-run` chạy sạch, không tạo file |

> Chưa chạy bot thật với Discord (cần token/kết nối). Các kiểm tra trên là tĩnh + logic + mô phỏng.

---

## Nhật ký thay đổi

- 2026-11-09: Khởi tạo checklist, bắt đầu Giai đoạn 0.
- 2026-11-09: Hoàn tất code Giai đoạn 0 + 1; thêm idle watcher, chặn giới hạn queue, dọn panel khi `deleteQueue`; rà soát và chốt Giai đoạn 0–1.
- 2026-11-09: Giai đoạn 2 mới hoàn thành phần kinh tế + 4 game cũ (`taixiu`, `slots`, `xocdia`, `flip`); dừng ở đây theo yêu cầu.
- 2026-11-09: Hoàn tất Giai đoạn 2 — poker 2–6 người + bot Monte Carlo, blackjack, video poker, trivia, Bầu Cua, Rồng Hổ, Hi-Lo, Vòng quay, `/game-stats`, escrow/hoàn tiền khi restart. Đã kiểm tra tĩnh + 80 ván poker + 300 ván blackjack + 200 ván video poker + 60 câu trivia + 320 ván game nhỏ + side-pot + escrow, 0 lỗi.
