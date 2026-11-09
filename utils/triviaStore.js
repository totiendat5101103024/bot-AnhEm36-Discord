'use strict';

/**
 * triviaStore.js — lưu lượt thưởng trong ngày và cooldown của trivia.
 */

const { db, transaction } = require('./db');

const stmts = {
    getDaily: db.prepare('SELECT rewarded FROM trivia_daily WHERE guild_id = ? AND date_key = ?'),
    upsertDaily: db.prepare(`
        INSERT INTO trivia_daily (guild_id, date_key, rewarded)
        VALUES (?, ?, 1)
        ON CONFLICT(guild_id, date_key) DO UPDATE SET rewarded = rewarded + 1
    `),
    getCooldown: db.prepare('SELECT last_correct_at FROM trivia_cooldown WHERE user_id = ?'),
    setCooldown: db.prepare(`
        INSERT INTO trivia_cooldown (user_id, last_correct_at)
        VALUES (?, ?)
        ON CONFLICT(user_id) DO UPDATE SET last_correct_at = excluded.last_correct_at
    `),
};

const GLOBAL_SCOPE = 'global';

function scopeGuild(guildId) {
    return guildId || GLOBAL_SCOPE;
}

function getDailyCount(guildId, dateKey) {
    const row = stmts.getDaily.get(scopeGuild(guildId), dateKey);
    return row ? row.rewarded : 0;
}

/**
 * Tăng lượt thưởng trong ngày và trả về số lượt TRƯỚC khi tăng (0-based).
 * Chạy trong transaction để hai người bấm cùng lúc không trùng lượt.
 */
const consumeRewardSlot = transaction((guildId, dateKey) => {
    const row = stmts.getDaily.get(scopeGuild(guildId), dateKey);
    const count = row ? row.rewarded : 0;
    stmts.upsertDaily.run(scopeGuild(guildId), dateKey);
    return count;
});

function getLastCorrectAt(userId) {
    const row = stmts.getCooldown.get(userId);
    return row ? row.last_correct_at : 0;
}

function setLastCorrectAt(userId, timestamp) {
    stmts.setCooldown.run(userId, timestamp);
}

module.exports = { getDailyCount, consumeRewardSlot, getLastCorrectAt, setLastCorrectAt };
