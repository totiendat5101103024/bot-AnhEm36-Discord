'use strict';

/**
 * index.js — bootstrap bot.
 * Toàn bộ logic được tách vào events/, commands/, components/, jobs/.
 */

require('dotenv').config();

const fs = require('fs');
const path = require('path');
const { Client, GatewayIntentBits, Collection } = require('discord.js');
const { DisTube } = require('distube');
const { YtDlpPlugin } = require('@distube/yt-dlp');
const { YtDlpExtractorPlugin } = require('./plugins/YtDlpExtractorPlugin');

const logger = require('./utils/logger');
const lifecycle = require('./utils/lifecycle');
const { close } = require('./utils/db');
const { loadCommands } = require('./utils/commandLoader');
const { loadEvents } = require('./utils/eventLoader');

lifecycle.install();

// ─── Client ──────────────────────────────────────────────────
// Không cần GuildMembers: bot chỉ dùng slash command, không đọc member list.
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.GuildMessages,
    ],
});

client.commands = new Collection();

// ─── DisTube ─────────────────────────────────────────────────
const ytDlpExtractor = new YtDlpExtractorPlugin();
client.ytDlpExtractor = ytDlpExtractor;

client.distube = new DisTube(client, {
    plugins: [
        ytDlpExtractor,
        // Không auto-update mỗi lần khởi động: chậm và tốn RAM.
        new YtDlpPlugin({ update: false }),
    ],
    emitNewSongOnly: false,
    savePreviousSongs: true,
    nsfw: false,
    ffmpeg: { path: require('ffmpeg-static') },
});

client.on('error', (err) => logger.error('[client error]', err));
client.on('warn', (msg) => logger.warn('[client warn]', msg));

// ─── Nạp component handlers ──────────────────────────────────
const componentsPath = path.join(__dirname, 'components');
if (fs.existsSync(componentsPath)) {
    for (const file of fs.readdirSync(componentsPath).filter((f) => f.endsWith('.js'))) {
        try {
            require(path.join(componentsPath, file));
        } catch (err) {
            logger.error(`[components] Lỗi nạp ${file}:`, err);
        }
    }
    logger.info('[components] Đã nạp component handlers.');
}

// ─── Nạp lệnh & event ────────────────────────────────────────
loadCommands(client);
loadEvents(client);

// ─── Tắt an toàn ─────────────────────────────────────────────
lifecycle.onShutdown(async () => {
    try {
        for (const guild of client.guilds.cache.values()) {
            client.distube.voices.leave(guild.id);
        }
    } catch (err) {
        logger.warn('[shutdown] Không rời voice sạch:', err.message);
    }
    try {
        await client.destroy();
    } catch (err) {
        logger.warn('[shutdown] Không destroy client sạch:', err.message);
    }
});

lifecycle.onShutdown(() => close());

// ─── Login ───────────────────────────────────────────────────
const token = process.env.DISCORD_TOKEN;
if (!token) {
    logger.error('Thiếu DISCORD_TOKEN trong .env — không thể khởi động bot.');
    process.exit(1);
}

client.login(token).catch((err) => {
    logger.error('Đăng nhập Discord thất bại:', err);
    process.exit(1);
});
