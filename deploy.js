'use strict';

/**
 * deploy.js — đăng ký slash command.
 *
 *   node deploy.js                 → global (chậm tới 1 giờ)
 *   node deploy.js --guild <id>    → guild command (hiện ngay, dùng khi test)
 *   node deploy.js --clear         → xoá toàn bộ lệnh global
 */

require('dotenv').config();

const { REST, Routes } = require('discord.js');
const fs = require('fs');
const path = require('path');
const logger = require('./utils/logger');

const CATEGORY_FLAT = {
    play: 'music', skip: 'music', stop: 'music', queue: 'music', pause: 'music',
    resume: 'music', volume: 'music', loop: 'music', nowplaying: 'music',
    daily: 'economy', balance: 'economy', 'leaderboard-xu': 'economy',
    chuyenxu: 'economy',
    taixiu: 'games', slots: 'games', xocdia: 'games', flip: 'games',
    deadline: 'study',
    'deadline-list': 'study', 'deadline-done': 'study', pomodoro: 'study',
    hopdinhky: 'study', help: 'util', ping: 'util', alternos: 'util',
};

function walk(dir) {
    const out = [];
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) out.push(...walk(full));
        else if (entry.isFile() && entry.name.endsWith('.js')) out.push(full);
    }
    return out;
}

function loadCommandJson() {
    const commandsPath = path.join(__dirname, 'commands');
    const commands = [];
    for (const filePath of walk(commandsPath)) {
        try {
            const command = require(filePath);
            if (command?.data?.toJSON) {
                const json = command.data.toJSON();
                const rel = path.relative(commandsPath, filePath).split(path.sep);
                const category = rel.length > 1 ? rel[0] : (CATEGORY_FLAT[json.name] || 'util');
                json.default_member_permissions = json.default_member_permissions ?? undefined;
                commands.push(json);
                logger.debug(`[deploy] ${json.name} (${category})`);
            }
        } catch (err) {
            logger.error(`[deploy] Lỗi nạp ${filePath}:`, err.message);
        }
    }
    return commands;
}

async function main() {
    const token = process.env.DISCORD_TOKEN;
    const clientId = process.env.CLIENT_ID;
    if (!token || !clientId) {
        logger.error('Thiếu DISCORD_TOKEN hoặc CLIENT_ID trong .env');
        process.exit(1);
    }

    const rest = new REST({ version: '10' }).setToken(token);

    const guildFlag = process.argv.indexOf('--guild');
    const guildId = guildFlag !== -1 ? process.argv[guildFlag + 1] : null;
    const clear = process.argv.includes('--clear');

    if (clear && !guildId) {
        await rest.put(Routes.applicationCommands(clientId), { body: [] });
        logger.info('✅ Đã xoá toàn bộ lệnh global.');
        return;
    }

    const commands = loadCommandJson();
    logger.info(`Đang nộp ${commands.length} lệnh ${guildId ? `cho guild ${guildId}` : 'global'}...`);

    if (guildId) {
        await rest.put(Routes.applicationGuildCommands(clientId, guildId), { body: commands });
        logger.info(`✅ Đã nộp ${commands.length} lệnh guild — dùng được ngay.`);
    } else {
        await rest.put(Routes.applicationCommands(clientId), { body: commands });
        logger.info(`✅ Đã nộp ${commands.length} lệnh global — có thể mất tới 1 giờ để hiện.`);
    }
}

main().catch((err) => {
    logger.error('Deploy thất bại:', err);
    process.exit(1);
});
