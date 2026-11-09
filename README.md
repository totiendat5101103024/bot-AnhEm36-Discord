# Sinh Tồn Đại Học Bot

Discord bot cho nhóm sinh viên: nhạc, kinh tế xu ảo, mini game, board game async, voice tạm và phiên học nhóm.

- **Ngôn ngữ:** Node.js (CommonJS), Discord.js v14
- **Dữ liệu:** SQLite (`better-sqlite3`), schema tự migrate theo `user_version`
- **Nhạc:** DisTube + yt-dlp + ffmpeg-static
- **Không cần dịch vụ ngoài** ngoài Discord (Spotify/Zotero là tùy chọn)

## Yêu cầu

- Node.js **20+** (khuyến nghị LTS mới nhất)
- npm
- Hệ điều hành Linux/macOS/Windows (hướng dẫn dưới đây dùng Linux/PM2)

`ffmpeg` và `yt-dlp` đã đi kèm qua `ffmpeg-static` và `@distube/yt-dlp`, không cần cài thêm.

## Cài đặt

```bash
git clone <repo-url>
cd SinhTonDaiHoc_bot

npm install

# Tạo file cấu hình từ mẫu
cp .env.example .env
# Mở .env và điền DISCORD_TOKEN, CLIENT_ID, các ID kênh nếu dùng

# Đăng ký slash command (chỉ chọn MỘT: global hoặc guild)
npm run deploy
# hoặc hiện ngay trong 1 server:
npm run deploy -- --guild <GUILD_ID>

# Chạy thử
npm start
```

> Không deploy cả global lẫn guild cho cùng bộ lệnh — Discord sẽ hiển thị **2 dòng trùng nhau** trong ô nhập lệnh. Nếu đã lỡ deploy cả hai, xoá bản global bằng `npm run deploy -- --clear`.

### Chạy bằng PM2 (khuyến nghị khi chạy local 24/7)

```bash
pm2 start ecosystem.config.js
pm2 status
pm2 logs sinhtondaihoc
pm2 restart sinhtondaihoc
pm2 stop sinhtondaihoc
```

`ecosystem.config.js` đã bật `autorestart`, giới hạn RAM 512 MB và `kill_timeout` 10 giây để bot đóng SQLite / rời voice sạch trước khi bị kill.

## Cấu hình `.env`

| Biến | Bắt buộc | Mô tả |
|---|---|---|
| `DISCORD_TOKEN` | ✅ | Token bot Discord |
| `CLIENT_ID` | ✅ | Application ID, dùng cho `npm run deploy` |
| `SPOTIFY_CLIENT_ID` / `SPOTIFY_CLIENT_SECRET` | — | Tùy chọn cho tìm nhạc Spotify |
| `ZOTERO_API_KEY` / `ZOTERO_LIBRARY_ID` / `ZOTERO_LIBRARY_TYPE` / `ZOTERO_CHANNEL_ID` | — | Tùy chọn cho lệnh Zotero |
| `DEADLINE_CHANNEL_ID` | — | Kênh nhận nhắc deadline |
| `DB_PATH` | — | Đường dẫn SQLite, mặc định `data/economy.db` |
| `YTDLP_PATH` | — | Binary yt-dlp tùy chỉnh |
| `LOG_KEEP_DAYS` | — | Số ngày giữ log `bot-*.log`, mặc định `14` |
| `DEBUG` | — | Đặt `1` để bật log debug |

> Không commit `.env`. File này đã nằm trong `.gitignore`.

## Danh sách lệnh (56 lệnh / 8 nhóm)

### 🎵 Nhạc (21)
`/play` `/search` `/skip` `/stop` `/pause` `/resume` `/queue` `/nowplaying` `/volume` `/loop` `/shuffle` `/clear` `/move` `/remove` `/seek` `/jump` `/leave` `/lyrics` `/playlist` `/autoplay` `/247`

### 🎮 Game (14)
`/taixiu` `/slots` `/xocdia` `/flip` `/poker` `/pokerbot` `/blackjack` `/videopoker` `/trivia` `/baucua` `/rongho` `/hilo` `/wheel` `/game-stats`

### 💰 Kinh tế (4)
`/daily` `/balance` `/leaderboard-xu` `/chuyenxu`

### ♟️ Board game (4)
`/caro` `/chess` `/xiangqi` `/board` (`move|resign|list|rank|history`)

### 🔊 Voice & Study (1 + lệnh học)
`/voice` (`name|limit|lock|unlock|kick|claim|transfer|stats`)

### 📚 Học tập & NCKH (9)
`/study` (`start|stop|rank`) `/pomodoro` `/deadline` `/deadline-list` `/deadline-done` `/zotero` `/arxiv` `/trichdan` `/hopdinhky`

### 🛠️ Tiện ích (3)
`/help` `/ping` `/alternos`

### ⚙️ Quản trị (1)
`/settings` — cấu hình voice tạm, danh mục, log, role DJ, âm lượng, queue, idle, autoplay, 24/7 (chỉ admin).

Xem chi tiết ngay trong Discord bằng `/help`.

## Dữ liệu & sao lưu

- Database: `data/economy.db` (SQLite WAL). Không commit file này.
- Backup thủ công:

```bash
./scripts/backup-db.sh --dry-run   # xem trước
./scripts/backup-db.sh             # sao lưu thật
```

Script dùng `VACUUM INTO` để sao lưu nhất quán khi bot đang chạy, giữ 7 bản mới nhất, bản cũ đưa vào trash bằng `gio`, và ghi log vào `logs/backup.log`.

## Log

- Log bot: `logs/bot-YYYY-MM-DD.log`, tự xoay theo ngày.
- Log PM2: `logs/pm2-out.log`, `logs/pm2-error.log`.
- Tự động dọn log cũ hơn `LOG_KEEP_DAYS` ngày (mặc định 14) mỗi ngày một lần; file cũ được đưa vào trash bằng `gio`, không xoá vĩnh viễn.

## Kiểm thử

```bash
npm test
```

Bộ test thuần Node (không cần framework) gồm:

- **Poker evaluator:** 9 hạng bài, tie-break, wheel, chọn best 5/7 lá.
- **Cờ vua:** perft độ sâu 1–4 (20 / 400 / 8.902 / 197.281), nhập thành, en passant, phong cấp, chiếu hết, stalemate.
- **Caro/Gomoku:** thắng ngang/dọc/chéo, chặn nước sai, ô đã có quân, sai lượt.

Kiểm tra cú pháp toàn bộ file:

```bash
find . -path ./node_modules -prune -o -path ./.git -prune -o -name '*.js' -print0 \
  | xargs -0 -n1 node --check
```

Checklist test tay trên guild riêng: xem [`docs/MANUAL_TEST.md`](docs/MANUAL_TEST.md).

## Cấu trúc thư mục

```
index.js              # bootstrap bot
deploy.js             # đăng ký slash command
ecosystem.config.js   # cấu hình PM2
commands/             # slash command, chia theo nhóm
components/           # handler nút / select / modal
events/               # interactionCreate, ready, voiceStateUpdate, distube
games/                # engine game thuần (poker, blackjack, board...)
jobs/                 # cron: deadline, zotero, idle watcher
utils/                # db, logger, economy, settings, studyManager...
scripts/              # backup DB
tests/                # test logic thuần Node
data/                 # SQLite + dữ liệu runtime (không commit)
logs/                 # log runtime (không commit)
backups/              # bản sao DB (không commit)
```

## Ghi chú an toàn

- Không commit `.env`, database, log, backup.
- Không xoá dữ liệu vĩnh viễn: script dùng `gio trash` cho file cũ.
- Bot chỉ dùng slash command, không bật intent đọc member list.
