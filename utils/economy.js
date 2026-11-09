'use strict';

/**
 * economy.js — hệ thống xu ảo dùng better-sqlite3.
 *
 * Điểm quan trọng: mọi thay đổi số dư đi qua transaction nguyên tử.
 * Trước đây kiểm tra số dư rồi mới trừ sau setTimeout → 2 lệnh cược
 * đồng thời có thể cùng pass và làm số dư âm.
 */

const { db, transaction } = require('./db');

const STARTING_BALANCE = 1000;
const DAILY_REWARD = 500;
const DAILY_STREAK_BONUS = 100;
const MIN_BET = 50;
const MAX_BET = 10000;

// ─── Prepared statements ─────────────────────────────────────
const stmts = {
    getUser: db.prepare('SELECT * FROM users WHERE user_id = ?'),
    createUser: db.prepare(`
        INSERT OR IGNORE INTO users (user_id, username, balance) VALUES (?, ?, ?)
    `),
    updateUsername: db.prepare(`
        UPDATE users SET username = ?, updated_at = datetime('now') WHERE user_id = ?
    `),
    updateDaily: db.prepare(`
        UPDATE users
        SET last_daily = ?, daily_streak = ?, balance = balance + ?,
            total_earned = total_earned + ?, updated_at = datetime('now')
        WHERE user_id = ?
    `),
    debit: db.prepare(`
        UPDATE users
        SET balance = balance - ?, total_lost = total_lost + ?,
            updated_at = datetime('now')
        WHERE user_id = ?
    `),
    credit: db.prepare(`
        UPDATE users
        SET balance = balance + ?, total_earned = total_earned + ?,
            updated_at = datetime('now')
        WHERE user_id = ?
    `),
    topUsers: db.prepare(`
        SELECT * FROM users ORDER BY balance DESC LIMIT ?
    `),
    logTx: db.prepare(`
        INSERT INTO transactions
            (user_id, guild_id, amount, type, game, meta, balance_after)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    `),
    transactions: db.prepare(`
        SELECT * FROM transactions WHERE user_id = ? ORDER BY id DESC LIMIT ?
    `),
    upsertGame: db.prepare(`
        INSERT INTO game_stats
            (user_id, guild_id, game, wins, losses, draws, plays, total_won, total_lost)
        VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?)
        ON CONFLICT(user_id, guild_id, game) DO UPDATE SET
            wins       = wins + excluded.wins,
            losses     = losses + excluded.losses,
            draws      = draws + excluded.draws,
            plays      = plays + 1,
            total_won  = total_won + excluded.total_won,
            total_lost = total_lost + excluded.total_lost
    `),
    gameStats: db.prepare(`
        SELECT * FROM game_stats WHERE user_id = ? AND guild_id = ?
        ORDER BY plays DESC
    `),
    gameStatsOne: db.prepare(`
        SELECT * FROM game_stats WHERE user_id = ? AND guild_id = ? AND game = ?
    `),
};

// ─── Helpers ─────────────────────────────────────────────────
const VN_TZ = 'Asia/Ho_Chi_Minh';

function dateKey(date = new Date()) {
    // en-CA cho ra YYYY-MM-DD
    return date.toLocaleDateString('en-CA', { timeZone: VN_TZ });
}

function yesterdayKey() {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return dateKey(d);
}

function logTransaction(userId, amount, opts = {}) {
    const user = stmts.getUser.get(userId);
    stmts.logTx.run(
        userId,
        opts.guildId || null,
        amount,
        opts.type || 'other',
        opts.game || null,
        opts.meta ? JSON.stringify(opts.meta) : null,
        user ? user.balance : null,
    );
}

function getOrCreateUser(userId, username = '') {
    stmts.createUser.run(userId, username, STARTING_BALANCE);
    if (username) stmts.updateUsername.run(username, userId);
    return stmts.getUser.get(userId);
}

function getBalance(userId) {
    const user = stmts.getUser.get(userId);
    return user ? user.balance : STARTING_BALANCE;
}

// ─── Daily ───────────────────────────────────────────────────
function claimDaily(userId, username = '') {
    return transaction(() => {
        const user = getOrCreateUser(userId, username);
        const now = new Date();
        const today = dateKey(now);

        if (user.last_daily && dateKey(new Date(user.last_daily)) === today) {
            const tomorrow = new Date(now);
            tomorrow.setHours(24, 0, 0, 0);
            const diff = Math.max(0, tomorrow.getTime() - now.getTime());
            const hours = Math.floor(diff / 3600000);
            const minutes = Math.floor((diff % 3600000) / 60000);
            return {
                success: false,
                amount: 0,
                bonus: 0,
                streak: user.daily_streak || 0,
                newBalance: user.balance,
                message: `⏳ Bạn đã nhận thưởng hôm nay rồi! Quay lại sau **${hours}h ${minutes}m** nữa nhé.`,
            };
        }

        let streak = 1;
        if (user.last_daily) {
            const last = dateKey(new Date(user.last_daily));
            if (last === yesterdayKey()) streak = (user.daily_streak || 0) + 1;
        }

        const bonus = Math.min(Math.max(streak - 1, 0), 7) * DAILY_STREAK_BONUS;
        const reward = DAILY_REWARD + bonus;

        stmts.updateDaily.run(now.toISOString(), streak, reward, reward, userId);
        logTransaction(userId, reward, { type: 'daily', meta: { streak, bonus } });

        const updated = stmts.getUser.get(userId);
        return {
            success: true,
            amount: reward,
            bonus,
            streak,
            newBalance: updated.balance,
            message: bonus > 0
                ? `🎁 Bạn nhận **${reward.toLocaleString()} xu** (chuỗi ${streak} ngày, thưởng thêm ${bonus.toLocaleString()} xu)!`
                : `🎁 Bạn nhận **${reward.toLocaleString()} xu** hàng ngày!`,
        };
    })();
}

// ─── Betting ─────────────────────────────────────────────────
/**
 * Kiểm tra cược (chỉ để báo lỗi sớm). Không dùng để trừ tiền.
 */
function validateBet(userId, amount, username = '') {
    const user = getOrCreateUser(userId, username);

    if (!Number.isInteger(amount) || amount < MIN_BET) {
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
 * Trừ xu nguyên tử. Trả về { ok, balance, message? }.
 * Đây là hàm duy nhất nên dùng trước khi chơi game.
 */
function tryDebit(userId, amount, opts = {}) {
    if (!Number.isInteger(amount) || amount <= 0) {
        return { ok: false, balance: getBalance(userId), message: '❌ Số xu không hợp lệ!' };
    }

    return transaction(() => {
        const user = getOrCreateUser(userId, opts.username || '');
        if (user.balance < amount) {
            return {
                ok: false,
                balance: user.balance,
                message: `❌ Bạn không đủ xu! Số dư: **${user.balance.toLocaleString()} xu**`,
            };
        }

        stmts.debit.run(amount, opts.countLost === false ? 0 : amount, userId);
        logTransaction(userId, -amount, {
            type: opts.type || 'bet_loss',
            game: opts.game,
            guildId: opts.guildId,
            meta: opts.meta,
        });
        return { ok: true, balance: stmts.getUser.get(userId).balance };
    })();
}

/**
 * Cộng xu nguyên tử. Trả về số dư mới.
 */
function credit(userId, amount, opts = {}) {
    if (!Number.isInteger(amount) || amount <= 0) return getBalance(userId);

    return transaction(() => {
        getOrCreateUser(userId, opts.username || '');
        stmts.credit.run(amount, opts.countEarned === false ? 0 : amount, userId);
        logTransaction(userId, amount, {
            type: opts.type || 'bet_win',
            game: opts.game,
            guildId: opts.guildId,
            meta: opts.meta,
        });
        return stmts.getUser.get(userId).balance;
    })();
}

/**
 * Hoàn tiền một cược đã trừ (khi lỗi giữa chừng).
 */
function refund(userId, amount, opts = {}) {
    if (!Number.isInteger(amount) || amount <= 0) return getBalance(userId);

    return transaction(() => {
        getOrCreateUser(userId, opts.username || '');
        db.prepare(`
            UPDATE users
            SET balance = balance + ?, total_lost = MAX(0, total_lost - ?), updated_at = datetime('now')
            WHERE user_id = ?
        `).run(amount, amount, userId);
        logTransaction(userId, amount, {
            type: 'refund',
            game: opts.game,
            guildId: opts.guildId,
            meta: opts.meta,
        });
        return stmts.getUser.get(userId).balance;
    })();
}

// Tương thích code cũ
function addBalance(userId, amount) {
    return credit(userId, amount, { type: 'bet_win' });
}

function subtractBalance(userId, amount) {
    const result = tryDebit(userId, amount, { type: 'bet_loss' });
    return result.ok ? { balance: result.balance } : null;
}

/**
 * Chuyển xu giữa 2 người, nguyên tử.
 */
function transfer(fromId, toId, amount, opts = {}) {
    if (fromId === toId) return { ok: false, message: '❌ Không thể chuyển cho chính mình!' };
    if (!Number.isInteger(amount) || amount <= 0) return { ok: false, message: '❌ Số xu không hợp lệ!' };

    return transaction(() => {
        const from = getOrCreateUser(fromId, opts.fromName || '');
        getOrCreateUser(toId, opts.toName || '');
        if (from.balance < amount) {
            return { ok: false, message: `❌ Bạn không đủ xu! Số dư: **${from.balance.toLocaleString()} xu**` };
        }

        stmts.debit.run(amount, 0, fromId);
        stmts.credit.run(amount, 0, toId);
        logTransaction(fromId, -amount, {
            type: 'transfer_out',
            guildId: opts.guildId,
            meta: { to: toId },
        });
        logTransaction(toId, amount, {
            type: 'transfer_in',
            guildId: opts.guildId,
            meta: { from: fromId },
        });

        return {
            ok: true,
            fromBalance: stmts.getUser.get(fromId).balance,
            toBalance: stmts.getUser.get(toId).balance,
        };
    })();
}

// ─── Thống kê ────────────────────────────────────────────────
function getLeaderboard(limit = 10) {
    return stmts.topUsers.all(limit);
}

function getTransactions(userId, limit = 10) {
    return stmts.transactions.all(userId, limit);
}

/** Guild ID dùng khi lệnh chạy ngoài server (DM) — tránh vi phạm NOT NULL. */
const GLOBAL_SCOPE = 'global';

function scopeGuild(guildId) {
    return guildId || GLOBAL_SCOPE;
}

function recordGame(userId, guildId, game, result, amount = 0) {
    const win = result === 'win' ? 1 : 0;
    const loss = result === 'loss' ? 1 : 0;
    const draw = result === 'draw' ? 1 : 0;
    stmts.upsertGame.run(
        userId,
        scopeGuild(guildId),
        game,
        win,
        loss,
        draw,
        result === 'win' ? amount : 0,
        result === 'loss' ? amount : 0,
    );
}

function getGameStats(userId, guildId) {
    return stmts.gameStats.all(userId, scopeGuild(guildId));
}

function getGameStat(userId, guildId, game) {
    return stmts.gameStatsOne.get(userId, scopeGuild(guildId), game);
}

module.exports = {
    getOrCreateUser,
    getBalance,
    claimDaily,
    validateBet,
    tryDebit,
    credit,
    addBalance,
    subtractBalance,
    transfer,
    refund,
    getLeaderboard,
    getTransactions,
    recordGame,
    getGameStats,
    getGameStat,
    dateKey,
    STARTING_BALANCE,
    DAILY_REWARD,
    DAILY_STREAK_BONUS,
    MIN_BET,
    MAX_BET,
};
