'use strict';

/**
 * settings.js — cấu hình theo từng guild, cache trong RAM.
 */

const { db } = require('./db');
const { COLORS } = require('./ui');

const DEFAULTS = Object.freeze({
    embed_color: COLORS.primary,
    dj_role_id: null,
    default_volume: 50,
    max_queue: 100,
    idle_timeout: 600, // giây
    autoplay: 0,
    mode_247: 0,
    log_channel_id: null,
    music_channel_id: null,
    temp_voice_category_id: null,
    temp_voice_channel_id: null,
    study_category_id: null,
});

const ALLOWED_KEYS = new Set(Object.keys(DEFAULTS));
const cache = new Map();

const selectStmt = db.prepare('SELECT * FROM guild_settings WHERE guild_id = ?');
const insertStmt = db.prepare('INSERT OR IGNORE INTO guild_settings (guild_id) VALUES (?)');

function get(guildId) {
    if (!guildId) return { ...DEFAULTS };
    if (cache.has(guildId)) return cache.get(guildId);

    insertStmt.run(guildId);
    const row = selectStmt.get(guildId);
    const merged = { ...DEFAULTS };
    if (row) {
        for (const key of ALLOWED_KEYS) {
            if (row[key] !== null && row[key] !== undefined) merged[key] = row[key];
        }
    }
    cache.set(guildId, merged);
    return merged;
}

function set(guildId, patch) {
    if (!guildId) throw new Error('Thiếu guildId');
    insertStmt.run(guildId);

    const entries = Object.entries(patch).filter(([key]) => ALLOWED_KEYS.has(key));
    if (!entries.length) return get(guildId);

    const sql = `UPDATE guild_settings SET ${entries.map(([key]) => `${key} = ?`).join(', ')}, updated_at = datetime('now') WHERE guild_id = ?`;
    db.prepare(sql).run(...entries.map(([, value]) => value), guildId);

    cache.delete(guildId);
    return get(guildId);
}

function invalidate(guildId) {
    cache.delete(guildId);
}

module.exports = { DEFAULTS, get, set, invalidate };
