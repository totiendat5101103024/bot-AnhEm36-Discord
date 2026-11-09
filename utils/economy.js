/**
 * economy.js — Hệ thống xu ảo dùng better-sqlite3
 *
 * Lưu trữ số dư, lịch sử daily claim, và giao dịch cơ bản.
 * Dùng SQLite vì nhẹ, không cần database server riêng, dữ liệu tồn tại
 * qua restart, và safe cho concurrent read/write đơn process.
 */

'use strict';

const path = require('path');
const Database = require('better-sqlite3');

// Database file nằm trong thư mục data/
const DB_PATH = path.join(__dirname, '..', 'data', 'economy.db');

// Đảm bảo thư mục data tồn tại
const fs = require('fs');
const dataDir = path.dirname(DB_PATH);
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

const db = new Database(DB_PATH);

// Bật WAL mode để tăng performance ghi
db.pragma('journal_mode = WAL');

// ─── Khởi tạo bảng ───────────────────────────────────────────
db.exec(`
    CREATE TABLE IF NOT EXISTS users (
        user_id      TEXT PRIMARY KEY,
        username     TEXT NOT NULL DEFAULT '',
        balance      INTEGER NOT NULL DEFAULT 0,
        last_daily   TEXT DEFAULT NULL,
        total_earned INTEGER NOT NULL DEFAULT 0,
        total_lost   INTEGER NOT NULL DEFAULT 0,
        created_at   TEXT NOT NULL DEFAULT (datetime('now'))
    );
`);

// ─── Config ──────────────────────────────────────────────────
const STARTING_BALANCE = 1000;    // Xu khởi đầu cho user mới
const DAILY_REWARD     = 500;     // Xu nhận được mỗi ngày
const DAILY_STREAK_BONUS = 100;   // Bonus thêm cho mỗi ngày liên tiếp (tối đa 7 ngày)
const MIN_BET          = 50;      // Cược tối thiểu
const MAX_BET          = 10000;   // Cược tối đa

// ─── Prepared Statements (nhanh hơn nhiều so với .prepare() mỗi lần gọi) ──
const stmts = {
    getUser: db.prepare('SELECT * FROM users WHERE user_id = ?'),
    createUser: db.prepare(`
        INSERT OR IGNORE INTO users (user_id, username, balance) VALUES (?, ?, ?)
    `),
    updateBalance: db.prepare(`
        UPDATE users SET balance = ? WHERE user_id = ?
    `),
    updateDaily: db.prepare(`
        UPDATE users SET last_daily = ?, balance = balance + ? WHERE user_id = ?
    `),
    addEarned: db.prepare(`
        UPDATE users SET balance = balance + ?, total_earned = total_earned + ? WHERE user_id = ?
    `),
    addLost: db.prepare(`
        UPDATE users SET balance = balance - ?, total_lost = total_lost + ? WHERE user_id = ?
    `),
    updateUsername: db.prepare(`
        UPDATE users SET username = ? WHERE user_id = ?
    `),
    topUsers: db.prepare(`
        SELECT * FROM users ORDER BY balance DESC LIMIT ?
    `),
};

// ─── API Functions ───────────────────────────────────────────

/**
 * Lấy hoặc tạo user, trả về object user
 */
function getOrCreateUser(userId, username = '') {
    stmts.createUser.run(userId, username, STARTING_BALANCE);
    // Cập nhật username nếu thay đổi
    if (username) stmts.updateUsername.run(username, userId);
    return stmts.getUser.get(userId);
}

/**
 * Lấy số dư hiện tại
 */
function getBalance(userId) {
    const user = stmts.getUser.get(userId);
    return user ? user.balance : STARTING_BALANCE;
}

/**
 * Claim daily reward. Trả về { success, amount, newBalance, message }
 */
function claimDaily(userId, username = '') {
    const user = getOrCreateUser(userId, username);
    const now = new Date();
    const todayStr = now.toISOString().slice(0, 10); // YYYY-MM-DD

    if (user.last_daily) {
        const lastDate = user.last_daily.slice(0, 10);
        if (lastDate === todayStr) {
            // Tính thời gian còn lại đến ngày mai
            const tomorrow = new Date(now);
            tomorrow.setDate(tomorrow.getDate() + 1);
            tomorrow.setHours(0, 0, 0, 0);
            const diffMs = tomorrow.getTime() - now.getTime();
            const hours = Math.floor(diffMs / (1000 * 60 * 60));
            const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
            return {
                success: false,
                amount: 0,
                newBalance: user.balance,
                message: `⏳ Bạn đã nhận thưởng hôm nay rồi! Quay lại sau **${hours}h ${minutes}m** nữa nhé.`,
            };
        }
    }

    const reward = DAILY_REWARD;
    stmts.updateDaily.run(now.toISOString(), reward, userId);
    const updatedUser = stmts.getUser.get(userId);

    return {
        success: true,
        amount: reward,
        newBalance: updatedUser.balance,
        message: `🎁 Bạn đã nhận **${reward.toLocaleString()} xu** hàng ngày!`,
    };
}

/**
 * Xử lý đặt cược. Trả về { success, message } nếu bet không hợp lệ.
 */
function validateBet(userId, amount, username = '') {
    const user = getOrCreateUser(userId, username);

    if (isNaN(amount) || amount < MIN_BET) {
        return { valid: false, message: `❌ Cược tối thiểu là **${MIN_BET.toLocaleString()} xu**!` };
    }
    if (amount > MAX_BET) {
        return { valid: false, message: `❌ Cược tối đa là **${MAX_BET.toLocaleString()} xu**!` };
    }
    if (user.balance < amount) {
        return { valid: false, message: `❌ Bạn không đủ xu! Số dư: **${user.balance.toLocaleString()} xu**` };
    }

    return { valid: true, user };
}

/**
 * Thêm xu (thắng cược)
 */
function addBalance(userId, amount) {
    stmts.addEarned.run(amount, amount, userId);
    return stmts.getUser.get(userId);
}

/**
 * Trừ xu (thua cược)
 */
function subtractBalance(userId, amount) {
    stmts.addLost.run(amount, amount, userId);
    return stmts.getUser.get(userId);
}

/**
 * Bảng xếp hạng top N user giàu nhất
 */
function getLeaderboard(limit = 10) {
    return stmts.topUsers.all(limit);
}

// ─── Exports ─────────────────────────────────────────────────
module.exports = {
    getOrCreateUser,
    getBalance,
    claimDaily,
    validateBet,
    addBalance,
    subtractBalance,
    getLeaderboard,
    STARTING_BALANCE,
    DAILY_REWARD,
    MIN_BET,
    MAX_BET,
};
