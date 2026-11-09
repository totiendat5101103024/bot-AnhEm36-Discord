# Sinh Tồn Đại Học Bot — Checklist nâng cấp

> Cập nhật lần cuối: 2026-11-09
>
> Quy ước: `[ ]` chưa làm · `[~]` đang làm · `[x]` xong · `[!]` bị chặn

## Trạng thái tổng quan

| Giai đoạn | Trạng thái | Ghi chú |
|---|---|---|
| 0. Nền tảng & an toàn | `[~]` | Đang thực hiện |
| 1. Nhạc | `[ ]` | |
| 2. Game | `[ ]` | |
| 3. Board game + Voice | `[ ]` | |
| 4. QA & vận hành | `[ ]` | |

---

## Giai đoạn 0 — Nền tảng & an toàn

- [ ] `git init` + `.gitignore` + commit baseline
- [ ] Backup source + `economy.db` ra `backups/`
- [ ] `utils/logger.js` ghi log xoay theo ngày
- [ ] `utils/lifecycle.js` bắt SIGINT/SIGTERM, unhandledRejection, uncaughtException
- [ ] `.catch()` toàn bộ `channel.send` trong event nhạc
- [ ] Bỏ intent `GuildMembers` không cần thiết
- [ ] `utils/db.js` + migration theo `user_version`
- [ ] `utils/economy.js` dùng transaction nguyên tử
- [ ] `utils/cooldowns.js`
- [ ] `utils/ui.js` (màu, progress bar, format thời gian)
- [ ] `utils/settings.js` (guild settings + cache)
- [ ] `utils/permissions.js` (voice, DJ, admin, safe reply)
- [ ] `utils/music.js` (requireQueue, requireVoice)
- [ ] `utils/components.js` (router cho button/select/modal)
- [ ] `utils/commandLoader.js` + `utils/eventLoader.js` (nạp đệ quy)
- [ ] `events/interactionCreate.js`
- [ ] `events/distube.js`
- [ ] `events/ready.js`
- [ ] `jobs/zotero.js`, `jobs/deadlines.js`
- [ ] `index.js` rút gọn thành bootstrap
- [ ] `ecosystem.config.js` cho PM2 + graceful shutdown
- [ ] `deploy.js` hỗ trợ `--guild <id>`
- [ ] `.env.example`

## Giai đoạn 1 — Nhạc

- [ ] Player panel + nút điều khiển (pause/skip/stop/prev/loop/shuffle/volume/seek)
- [ ] `/queue` phân trang
- [ ] `/search` select menu 5 kết quả
- [ ] `/seek`, `/shuffle`, `/remove`, `/move`, `/jump`, `/clear`, `/leave`
- [ ] `/lyrics`, `/autoplay`, `/247`
- [ ] `/playlist save|load|list|delete` (SQLite)
- [ ] Auto-leave khi kênh trống / idle
- [ ] Kiểm tra quyền Connect/Speak + cùng kênh voice
- [ ] Giới hạn queue + chống spam
- [ ] Plugin: dedupe yt-dlp, cache 45 phút, prefetch 2 bài, warm-up ngắn
- [ ] Bỏ auto-update yt-dlp mỗi lần khởi động
- [ ] `/help` dạng select menu theo nhóm

## Giai đoạn 2 — Game

- [ ] Economy: `tryDebit`, `credit`, `transfer`, bảng `transactions`
- [ ] Cân bằng payout (xóc đĩa, slot), daily streak
- [ ] Texas Hold'em 2–6 người (blinds, 4 vòng cược, side-pot, timeout)
- [ ] Video Poker Jacks or Better
- [ ] Heads-up Texas với bot AI (Monte Carlo)
- [ ] Blackjack (Hit/Stand/Double)
- [ ] Trivia tiếng Việt
- [ ] Bầu Cua, Rồng Hổ, Hi-Lo, Vòng quay
- [ ] `/game-stats`
- [ ] Escrow poker + hoàn tiền khi restart

## Giai đoạn 3 — Board game async + Voice

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

## Giai đoạn 4 — QA & vận hành

- [ ] `node --check` toàn bộ file
- [ ] Test logic thuần: poker evaluator, chess, caro
- [ ] README + `.env.example`
- [ ] Script backup DB (`--dry-run`, log)
- [ ] Log rotate
- [ ] Checklist test tay trên guild riêng

---

## Nhật ký thay đổi

- 2026-11-09: Khởi tạo checklist, bắt đầu Giai đoạn 0.
