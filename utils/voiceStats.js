'use strict';

/**
 * voiceStats.js — tổng hợp thời gian voice từ bảng voice_sessions.
 *
 * Phiên đang mở (left_at IS NULL) được tính tới thời điểm hiện tại.
 */

const { db } = require('./db');

const PERIODS = new Set(['week', 'month', 'all']);

function periodStart(period) {
    if (period === 'week') return Date.now() - 7 * 24 * 60 * 60 * 1000;
    if (period === 'month') return Date.now() - 30 * 24 * 60 * 60 * 1000;
    return 0;
}

function normalizePeriod(period) {
    return PERIODS.has(period) ? period : 'week';
}

function aggregate(rows, start = 0, now = Date.now()) {
    const map = new Map();
    for (const row of rows) {
        const begin = Math.max(row.joined_at || 0, start);
        const end = Math.min(row.left_at || now, now);
        const seconds = Math.max(0, Math.floor((end - begin) / 1000));
        if (!seconds) continue;
        const cur = map.get(row.user_id) || { user_id: row.user_id, total: 0, study: 0, sessions: 0 };
        cur.total += seconds;
        if (row.study) cur.study += seconds;
        cur.sessions += 1;
        map.set(row.user_id, cur);
    }
    return map;
}

function userVoiceStats(guildId, userId, period = 'week') {
    const start = periodStart(normalizePeriod(period));
    const now = Date.now();
    const rows = db.prepare(`
        SELECT user_id, joined_at, left_at, study
        FROM voice_sessions
        WHERE guild_id = ? AND user_id = ?
          AND COALESCE(left_at, ?) > ?
    `).all(guildId, userId, now, start);
    const stats = aggregate(rows, start, now).get(userId)
        || { user_id: userId, total: 0, study: 0, sessions: 0 };
    return { ...stats, period: normalizePeriod(period), since: start };
}

function topVoice(guildId, period = 'week', limit = 10, studyOnly = false) {
    const start = periodStart(normalizePeriod(period));
    const now = Date.now();
    const rows = db.prepare(`
        SELECT user_id, joined_at, left_at, study
        FROM voice_sessions
        WHERE guild_id = ?
          AND COALESCE(left_at, ?) > ?
          ${studyOnly ? 'AND study = 1' : ''}
    `).all(guildId, now, start);
    return [...aggregate(rows, start, now).values()]
        .sort((a, b) => b.total - a.total)
        .slice(0, limit);
}

module.exports = {
    PERIODS,
    periodStart,
    normalizePeriod,
    userVoiceStats,
    topVoice,
};
