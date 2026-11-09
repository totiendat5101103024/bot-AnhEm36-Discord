'use strict';

/**
 * jobs/zotero.js — poll tài liệu mới trong thư viện Zotero.
 */

const fs = require('fs');
const path = require('path');
const { EmbedBuilder } = require('discord.js');
const cron = require('node-cron');
const logger = require('../utils/logger');
const { safeSend } = require('../utils/music');

const STATE_FILE = path.join(__dirname, '..', 'data', 'zotero_state.json');

function loadState() {
    try {
        if (fs.existsSync(STATE_FILE)) {
            return JSON.parse(fs.readFileSync(STATE_FILE, 'utf-8'));
        }
    } catch (err) {
        logger.error('[Zotero] Lỗi đọc state file:', err.message);
    }
    return { lastDateAdded: null };
}

function saveState(state) {
    try {
        fs.mkdirSync(path.dirname(STATE_FILE), { recursive: true });
        fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
    } catch (err) {
        logger.error('[Zotero] Lỗi ghi state file:', err.message);
    }
}

async function pollZoteroNewItems(client) {
    const apiKey = process.env.ZOTERO_API_KEY;
    const libraryId = process.env.ZOTERO_LIBRARY_ID;
    const libraryType = process.env.ZOTERO_LIBRARY_TYPE || 'user';
    const channelId = process.env.ZOTERO_CHANNEL_ID;

    if (!apiKey || !libraryId || !channelId) return;

    const channel = await client.channels.fetch(channelId).catch(() => null);
    if (!channel) return;

    try {
        const state = loadState();
        const base = `https://api.zotero.org/${libraryType}s/${libraryId}/items/top`;
        const params = new URLSearchParams({
            key: apiKey,
            limit: '10',
            sort: 'dateAdded',
            direction: 'desc',
        });

        const res = await fetch(`${base}?${params.toString()}`, {
            headers: { 'Zotero-API-Version': '3' },
            signal: AbortSignal.timeout(15000),
        });
        if (!res.ok) throw new Error(`Zotero API HTTP ${res.status}`);

        const items = (await res.json())
            .filter((it) => !['attachment', 'note'].includes(it.data.itemType));

        if (!items.length) return;

        const newItems = state.lastDateAdded
            ? items.filter((it) => it.data.dateAdded > state.lastDateAdded)
            : [];

        if (newItems.length > 0) {
            const embed = new EmbedBuilder()
                .setColor(0xcc2936)
                .setTitle('📚 Tài liệu mới trong thư viện Zotero!')
                .setDescription(newItems.map((it) => {
                    const d = it.data;
                    const creators = d.creators?.length
                        ? d.creators
                            .map((c) => c.name || `${c.firstName ?? ''} ${c.lastName ?? ''}`.trim())
                            .filter(Boolean)
                            .join(', ')
                        : 'Không rõ tác giả';
                    const link = d.url || it.links?.alternate?.href
                        || `https://www.zotero.org/${libraryType}s/${libraryId}/items/${it.key}`;
                    const year = d.date ? ` (${d.date.slice(0, 4)})` : '';
                    return `**[${d.title || 'Không có tiêu đề'}](${link})**${year}\n✍️ ${creators}`;
                }).join('\n\n'))
                .setFooter({ text: `${newItems.length} tài liệu mới được thêm` })
                .setTimestamp();

            await safeSend(channel, { embeds: [embed] });
            logger.info(`[Zotero] Đã gửi thông báo ${newItems.length} tài liệu mới.`);
        }

        state.lastDateAdded = items[0].data.dateAdded;
        saveState(state);
    } catch (err) {
        logger.error('[Zotero] Lỗi polling:', err.message);
    }
}

function startZoteroPolling(client) {
    if (!process.env.ZOTERO_CHANNEL_ID) return;
    pollZoteroNewItems(client);
    cron.schedule('*/10 * * * *', () => pollZoteroNewItems(client));
    logger.info('📚 Zotero auto-polling đã bật (mỗi 10 phút).');
}

module.exports = { pollZoteroNewItems, startZoteroPolling };
