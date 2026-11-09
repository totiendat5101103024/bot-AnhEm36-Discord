'use strict';

/**
 * commandLoader.js — nạp lệnh đệ quy từ commands/.
 * Hỗ trợ cả cấu trúc phẳng cũ và thư mục con mới.
 */

const fs = require('fs');
const path = require('path');
const logger = require('./logger');

const CATEGORY_LABELS = Object.freeze({
    music: '🎵 Nhạc',
    games: '🎮 Game',
    economy: '💰 Kinh tế',
    study: '📚 Học tập',
    board: '♟️ Board game',
    voice: '🔊 Voice & Study',
    util: '🛠️ Tiện ích',
    admin: '⚙️ Quản trị',
});

// Các lệnh cũ nằm phẳng ở commands/ — gán nhóm thủ công.
const FLAT_CATEGORY = Object.freeze({
    play: 'music',
    skip: 'music',
    stop: 'music',
    queue: 'music',
    pause: 'music',
    resume: 'music',
    volume: 'music',
    loop: 'music',
    nowplaying: 'music',
    daily: 'economy',
    balance: 'economy',
    'leaderboard-xu': 'economy',
    taixiu: 'games',
    slots: 'games',
    xocdia: 'games',
    flip: 'games',
    deadline: 'study',
    'deadline-list': 'study',
    'deadline-done': 'study',
    pomodoro: 'study',
    hopdinhky: 'study',
    help: 'util',
    ping: 'util',
    alternos: 'util',
});

function walk(dir) {
    const out = [];
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) out.push(...walk(full));
        else if (entry.isFile() && entry.name.endsWith('.js')) out.push(full);
    }
    return out;
}

function categoryFor(filePath, commandName) {
    const rel = path.relative(path.join(__dirname, '..', 'commands'), filePath);
    const parts = rel.split(path.sep);
    if (parts.length > 1) return parts[0];
    return FLAT_CATEGORY[commandName] || 'util';
}

function loadCommands(client) {
    const commandsPath = path.join(__dirname, '..', 'commands');
    if (!fs.existsSync(commandsPath)) return 0;

    let loaded = 0;
    for (const filePath of walk(commandsPath)) {
        try {
            delete require.cache[require.resolve(filePath)];
            const command = require(filePath);
            if (!command || !command.data || typeof command.execute !== 'function') {
                logger.warn(`[commands] Bỏ qua ${path.relative(process.cwd(), filePath)} (thiếu data/execute)`);
                continue;
            }
            const name = command.data.name;
            command.category = categoryFor(filePath, name);
            command.filePath = filePath;

            if (client.commands.has(name)) {
                logger.warn(`[commands] Trùng tên lệnh "${name}" — bỏ qua ${filePath}`);
                continue;
            }

            client.commands.set(name, command);
            loaded++;
        } catch (err) {
            logger.error(`[commands] Lỗi nạp ${filePath}:`, err);
        }
    }

    logger.info(`[commands] Đã nạp ${loaded} lệnh.`);
    return loaded;
}

function categoryLabel(category) {
    if (category === 'all') return '📖 Tất cả';
    return CATEGORY_LABELS[category] || '📦 Khác';
}

module.exports = { loadCommands, CATEGORY_LABELS, categoryLabel, FLAT_CATEGORY };
