'use strict';

/**
 * studyManager.js — phiên học nhóm trong voice + thông báo kết thúc.
 *
 * Mỗi phiên gắn với 1 voice channel; voice_sessions phát sinh trong lúc phiên
 * hoạt động được đánh dấu study = 1 để thống kê giờ học.
 */

const crypto = require('crypto');
const { db } = require('./db');
const logger = require('./logger');
const { baseEmbed, COLORS, formatDuration } = require('./ui');

const timers = new Map();

const insertSession = db.prepare(`
    INSERT INTO study_sessions
        (id, guild_id, channel_id, notify_channel_id, subject, duration_min,
         host_id, started_at, ends_at, active)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
`);
const selectSession = db.prepare('SELECT * FROM study_sessions WHERE id = ?');
const selectActiveByChannel = db.prepare(`
    SELECT * FROM study_sessions WHERE channel_id = ? AND active = 1 LIMIT 1
`);
const selectActiveByGuild = db.prepare(`
    SELECT * FROM study_sessions WHERE guild_id = ? AND active = 1 ORDER BY started_at DESC
`);
const deactivate = db.prepare('UPDATE study_sessions SET active = 0 WHERE id = ?');
const studyRows = db.prepare(`
    SELECT user_id, joined_at, left_at, study
    FROM voice_sessions
    WHERE channel_id = ? AND joined_at < ?
`);
const openVoiceRows = db.prepare(`
    SELECT * FROM voice_sessions WHERE channel_id = ? AND left_at IS NULL
`);
const closeVoiceRow = db.prepare('UPDATE voice_sessions SET left_at = ? WHERE id = ?');
const openVoiceRow = db.prepare(`
    INSERT INTO voice_sessions
        (guild_id, user_id, channel_id, channel_name, joined_at, left_at, study, subject)
    VALUES (?, ?, ?, ?, ?, NULL, ?, ?)
`);

function makeId() {
    return `study-${Date.now().toString(36)}-${crypto.randomBytes(2).toString('hex')}`;
}

/**
 * Đóng các phiên voice đang mở và mở lại tại mốc thời gian hiện tại với cờ study mới.
 * Giúp thời gian trước/sau phiên học không bị tính lẫn.
 */
function splitOpenSessions(channelId, at, study, subject) {
    const rows = openVoiceRows.all(channelId);
    for (const row of rows) {
        closeVoiceRow.run(at, row.id);
        openVoiceRow.run(
            row.guild_id,
            row.user_id,
            row.channel_id,
            row.channel_name,
            at,
            study ? 1 : 0,
            subject || null,
        );
    }
    return rows.length;
}

function getSession(id) {
    return selectSession.get(id) || null;
}

function getActiveForChannel(channelId) {
    return selectActiveByChannel.get(channelId) || null;
}

function getActiveForGuild(guildId) {
    return selectActiveByGuild.all(guildId);
}

function aggregateParticipants(rows, startedAt, endsAt) {
    const now = Date.now();
    const map = new Map();
    for (const row of rows) {
        const begin = Math.max(row.joined_at || 0, startedAt);
        const end = Math.min(row.left_at || now, endsAt, now);
        const secs = Math.max(0, Math.floor((end - begin) / 1000));
        if (!secs) continue;
        const cur = map.get(row.user_id) || { user_id: row.user_id, seconds: 0 };
        cur.seconds += secs;
        map.set(row.user_id, cur);
    }
    return [...map.values()].sort((a, b) => b.seconds - a.seconds);
}

async function notifyEnd(client, session, participants) {
    if (!client || !session.notify_channel_id) return;
    try {
        const channel = await client.channels.fetch(session.notify_channel_id);
        if (!channel?.send) return;
        const top = participants.slice(0, 5)
            .map((p, i) => `${i + 1}. <@${p.user_id}> — **${formatDuration(p.seconds)}**`)
            .join('\n');
        const embed = baseEmbed({
            color: COLORS.success,
            title: '📚 Phiên học đã kết thúc',
            description: [
                `Chủ đề: **${session.subject || 'Tự do'}**`,
                `Thời lượng: **${session.duration_min} phút**`,
                `Chủ phòng: <@${session.host_id}>`,
                '',
                top ? `**Thời gian học:**\n${top}` : 'Không có ai ghi nhận thời gian học.',
            ].join('\n'),
        });
        await channel.send({ content: `<@${session.host_id}>`, embeds: [embed] }).catch(() => null);
    } catch (err) {
        logger.debug('[study] không gửi thông báo:', err.message);
    }
}

async function endSession(id, client = null, { silent = false } = {}) {
    const session = getSession(id);
    if (!session || !session.active) return null;

    deactivate.run(id);
    clearTimeout(timers.get(id));
    timers.delete(id);

    const endsAt = Math.min(session.ends_at, Date.now());
    const rows = studyRows.all(session.channel_id, endsAt);
    const participants = aggregateParticipants(rows, session.started_at, endsAt);

    // Người vẫn còn trong voice sau khi phiên kết thúc không tiếp tục tích giờ học.
    splitOpenSessions(session.channel_id, Date.now(), 0, null);

    if (!silent) await notifyEnd(client, session, participants);
    logger.info(`[study] Kết thúc phiên ${id} (${session.subject || 'tự do'}).`);
    return { ...session, active: 0, participants };
}

function schedule(session, client) {
    clearTimeout(timers.get(session.id));
    const delay = session.ends_at - Date.now();
    if (delay <= 0) {
        endSession(session.id, client).catch((err) => logger.error('[study]', err));
        return;
    }
    const timer = setTimeout(() => {
        endSession(session.id, client).catch((err) => logger.error('[study]', err));
    }, Math.min(delay, 2_147_000_000));
    timer.unref?.();
    timers.set(session.id, timer);
}

function startSession({
    guildId,
    channelId,
    notifyChannelId,
    subject,
    durationMin,
    hostId,
    client,
}) {
    if (!guildId || !channelId || !hostId) {
        return { ok: false, message: 'Thiếu thông tin phiên học.' };
    }
    const existing = getActiveForChannel(channelId);
    if (existing) {
        return { ok: false, message: 'Kênh này đang có một phiên học chưa kết thúc.' };
    }

    const id = makeId();
    const startedAt = Date.now();
    const endsAt = startedAt + durationMin * 60_000;
    insertSession.run(
        id,
        guildId,
        channelId,
        notifyChannelId || null,
        subject || null,
        durationMin,
        hostId,
        startedAt,
        endsAt,
    );
    const session = getSession(id);
    splitOpenSessions(channelId, startedAt, 1, subject);
    schedule(session, client);
    return { ok: true, session };
}

function stopSession(id, client = null, { silent = false } = {}) {
    return endSession(id, client, { silent });
}

function resumeAll(client) {
    const sessions = db.prepare("SELECT * FROM study_sessions WHERE active = 1").all();
    for (const session of sessions) {
        if (session.ends_at <= Date.now()) {
            endSession(session.id, client, { silent: true }).catch((err) => logger.error('[study]', err));
        } else {
            schedule(session, client);
        }
    }
    if (sessions.length) {
        logger.info(`[study] Khôi phục ${sessions.length} phiên học đang hoạt động.`);
    }
    return sessions.length;
}

module.exports = {
    startSession,
    stopSession,
    endSession,
    resumeAll,
    getSession,
    getActiveForChannel,
    getActiveForGuild,
    timers,
};
