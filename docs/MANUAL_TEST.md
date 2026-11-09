# Checklist test tay trên guild riêng

Dùng một guild riêng (không phải server thật) để kiểm tra trước khi chạy production.
Mỗi mục ghi rõ **cách làm** và **kết quả mong đợi**. Đánh dấu `[x]` khi đạt.

## 0. Chuẩn bị

- [ ] Bot online, `pm2 status` báo `online`.
- [ ] `/ping` trả về độ trễ, không lỗi.
- [ ] `/help` mở embed, có đủ 8 nhóm và chuyển nhóm bằng select menu.
- [ ] `npm run deploy` báo đăng ký 56 lệnh, không trùng tên.

## 1. Nhạc

- [ ] Vào một voice channel, `/play <tên bài>` → bot join, phát nhạc, hiện embed.
- [ ] `/queue` hiện danh sách; nút phân trang hoạt động.
- [ ] `/pause` → `/resume` hoạt động đúng.
- [ ] `/skip`, `/stop`, `/clear`, `/shuffle`, `/loop` không lỗi.
- [ ] `/volume 50` đổi âm lượng, thông báo đúng.
- [ ] `/nowplaying` hiện bài đang phát + nút điều khiển.
- [ ] `/search` chọn kết quả bằng select menu → thêm vào queue.
- [ ] `/leave` bot rời voice.
- [ ] Rời voice trống > 60 giây hoặc pause > 10 phút → bot tự dừng và rời (idle watcher).

## 2. Kinh tế

- [ ] `/daily` lần đầu cộng xu; gọi lần 2 trong ngày báo đã nhận.
- [ ] `/balance` hiện số xu đúng.
- [ ] `/leaderboard-xu` hiện top người nhiều xu.
- [ ] Chuyển xu qua game: thắng/thua cập nhật số dư, không âm quá mức.
- [ ] Restart bot khi đang có ván cược → số dư/escrow được hoàn đúng.

## 3. Game

- [ ] `/taixiu`, `/xocdia`, `/baucua`, `/rongho`, `/hilo`, `/wheel`, `/flip`: đặt cược nhỏ, kết quả + số dư nhất quán.
- [ ] `/slots` quay và trả thưởng đúng.
- [ ] `/blackjack`: hit/stand/double, nhà cái rút đúng luật, thanh toán đúng.
- [ ] `/videopoker`: giữ/bỏ bài, tính thưởng đúng.
- [ ] `/poker` 2–6 người: chia bài, tố, fold, showdown, chia pot (kể cả side pot).
- [ ] `/pokerbot`: bot Monte Carlo chơi được, không treo.
- [ ] `/trivia`: trả lời đúng/sai, hết giờ xử lý đúng.
- [ ] `/game-stats`: thống kê khớp các ván vừa chơi.

## 4. Board game async

- [ ] `/caro @user` tạo ván, hiện bàn 15×15 và nút **Đánh** / **Xin thua**.
- [ ] Bấm **Đánh** mở modal, nhập `H8` → bàn cập nhật, đổi lượt.
- [ ] Đi sai lượt / ô đã có quân / tọa độ sai → báo lỗi ephemeral, ván không đổi.
- [ ] `/chess @user`: đi `e2e4`, nhập thành `e1g1`, phong cấp `e7e8q`, en passant.
- [ ] `/xiangqi @user`: đi `b8e8`, kiểm tra cản mã / cung / sông.
- [ ] Kết thúc bằng chiếu hết hoặc xin thua → embed hiện kết quả + Elo.
- [ ] `/board list`, `/board rank`, `/board history` hiển thị đúng.
- [ ] Restart bot giữa ván → bấm **Đánh** trên message cũ vẫn đi tiếp được.
- [ ] `/board move` hoạt động khi message cũ không còn nút.

## 5. Voice tạm (Join to Create)

- [ ] `/settings kenh_tao_voice <kênh>` và `danh_muc_voice <danh mục>`.
- [ ] Vào kênh trigger → bot tạo voice tạm, đặt tên theo người tạo.
- [ ] `/voice name`, `/voice limit`, `/voice lock`, `/voice unlock` hoạt động.
- [ ] `/voice kick @user` mời người ra; `/voice transfer @user` chuyển chủ.
- [ ] Chủ rời kênh → người ở lại `/voice claim` nhận quyền.
- [ ] Kênh tạm trống → bot tự xoá.
- [ ] `/voice stats` hiện tổng giờ, giờ học, số phiên.

## 6. Study

- [ ] `/study start mon_hoc:"Giải tích" phut:60` khi đang ở voice → tạo phiên, thông báo kênh.
- [ ] Vào voice trong phiên → thời gian được ghi nhận.
- [ ] `/study rank ky:week` hiện bảng xếp hạng giờ học.
- [ ] `/study stop` → thông báo tổng kết, thời gian học dừng lại.
- [ ] Restart bot khi phiên đang chạy → phiên được khôi phục và tự kết thúc đúng giờ.
- [ ] Thời gian voice trước/sau phiên học không bị tính lẫn vào giờ học.

## 7. Settings

- [ ] `/settings` (admin) hiện toàn bộ cấu hình.
- [ ] Đổi âm lượng mặc định, giới hạn queue, idle timeout, autoplay, 24/7 → lưu đúng.
- [ ] `/settings dat_lai:true` reset về mặc định.
- [ ] Người không phải admin bị chặn.

## 8. Vận hành

- [ ] `./scripts/backup-db.sh --dry-run` in đường dẫn, không tạo file.
- [ ] `./scripts/backup-db.sh` tạo bản backup trong `backups/db/`, ghi `logs/backup.log`.
- [ ] Tạo file `logs/bot-2000-01-01.log` cũ rồi restart → file được đưa vào trash.
- [ ] `pm2 restart sinhtondaihoc` → bot lên lại, không mất dữ liệu, phiên study/board còn nguyên.
- [ ] `npm test` → 37/37 pass.

## 9. Kết luận

- [ ] Không có lỗi trong `logs/pm2-error.log` và `logs/bot-YYYY-MM-DD.log`.
- [ ] Đã sao lưu DB trước khi đưa lên server thật.
- [ ] Ghi lại mọi lỗi phát hiện vào mục "Ghi chú" bên dưới.

### Ghi chú

- ...
