'use strict';

/**
 * ui.js — bộ dựng embed/progress bar dùng chung để giao diện đồng nhất.
 */

const { EmbedBuilder } = require('discord.js');

const COLORS = {
    primary: 0x5865f2,
    success: 0x57f287,
    danger: 0xed4245,
    warning: 0xfee75c,
    gold: 0xf1c40f,
    music: 0x1db954,
    info: 0x3498db,
    purple: 0x9b59b6,
    dark: 0x2b2d31,
};

function formatDuration(seconds) {
    if (!Number.isFinite(seconds) || seconds <= 0) return '🔴 LIVE';
    const s = Math.floor(seconds % 60);
    const m = Math.floor((seconds / 60) % 60);
    const h = Math.floor(seconds / 3600);
    const pad = (n) => String(n).padStart(2, '0');
    return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}

function progressBar(current, total, length = 20, filledChar = '▬', emptyChar = '▬', knob = '🔘') {
    if (!Number.isFinite(total) || total <= 0) return '🔴 **LIVE**';
    const ratio = Math.max(0, Math.min(current / total, 1));
    const filled = Math.round(ratio * length);
    return filledChar.repeat(filled) + knob + emptyChar.repeat(Math.max(length - filled, 0));
}

function truncate(text, max = 1024) {
    if (!text) return '';
    return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

function baseEmbed({ color = COLORS.primary, title, description, footer, thumbnail, image, fields, timestamp = true } = {}) {
    const embed = new EmbedBuilder().setColor(color);
    if (title) embed.setTitle(truncate(title, 256));
    if (description) embed.setDescription(truncate(description, 4096));
    if (footer) embed.setFooter(typeof footer === 'string' ? { text: truncate(footer, 2048) } : footer);
    if (thumbnail) embed.setThumbnail(thumbnail);
    if (image) embed.setImage(image);
    if (Array.isArray(fields)) embed.addFields(fields);
    if (timestamp) embed.setTimestamp();
    return embed;
}

function errorEmbed(message) {
    return baseEmbed({ color: COLORS.danger, title: '❌ Lỗi', description: message, timestamp: false });
}

function successEmbed(message, title = '✅ Thành công') {
    return baseEmbed({ color: COLORS.success, title, description: message, timestamp: false });
}

function warnEmbed(message, title = '⚠️ Chú ý') {
    return baseEmbed({ color: COLORS.warning, title, description: message, timestamp: false });
}

module.exports = {
    COLORS,
    formatDuration,
    progressBar,
    truncate,
    baseEmbed,
    errorEmbed,
    successEmbed,
    warnEmbed,
};
