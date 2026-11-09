'use strict';

const { SlashCommandBuilder } = require('discord.js');
const { getQueue } = require('../../utils/music');
const { baseEmbed, errorEmbed, COLORS, truncate } = require('../../utils/ui');
const logger = require('../../utils/logger');

function cleanTitle(text = '') {
    return text
        .replace(/\((official|lyrics?|mv|video|audio|visualizer)[^)]*\)/gi, '')
        .replace(/\[(official|lyrics?|mv|video|audio|visualizer)[^\]]*\]/gi, '')
        .replace(/\s+/g, ' ')
        .trim();
}

function splitQuery(rawName, uploader) {
    const name = cleanTitle(rawName);
    const sep = name.indexOf(' - ');
    if (sep > 0) {
        return { artist: name.slice(0, sep).trim(), title: name.slice(sep + 3).trim() };
    }
    return { artist: cleanTitle(uploader || ''), title: name };
}

async function fetchLyrics(artist, title) {
    if (!artist || !title) return null;
    const url = `https://api.lyrics.ovh/v1/${encodeURIComponent(artist)}/${encodeURIComponent(title)}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
    if (!res.ok) return null;
    const data = await res.json().catch(() => null);
    return data?.lyrics?.trim() || null;
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('lyrics')
        .setDescription('Tìm lời bài hát đang phát hoặc theo từ khoá')
        .addStringOption((option) =>
            option
                .setName('bai_hat')
                .setDescription('Tên bài hát (bỏ trống = bài đang phát)')
                .setRequired(false)
                .setMaxLength(200)),

    async execute(interaction) {
        await interaction.deferReply();

        const manual = interaction.options.getString('bai_hat');
        let query;

        if (manual) {
            query = { artist: '', title: cleanTitle(manual) };
        } else {
            const queue = getQueue(interaction.client, interaction.guildId);
            const song = queue?.songs?.[0];
            if (!song) {
                return interaction.editReply({ embeds: [errorEmbed('Không có bài nào đang phát và bạn cũng không nhập tên bài!')] });
            }
            query = splitQuery(song._searchQuery || song.name, song.uploader?.name);
        }

        try {
            let lyrics = await fetchLyrics(query.artist, query.title);
            if (!lyrics && query.artist) lyrics = await fetchLyrics(query.title, query.artist);
            if (!lyrics) lyrics = await fetchLyrics('', query.title);
            if (!lyrics) {
                return interaction.editReply({
                    embeds: [errorEmbed(`Không tìm thấy lời cho **${query.title}**.`)],
                });
            }

            const chunks = [];
            for (let i = 0; i < lyrics.length && chunks.length < 3; i += 3500) {
                chunks.push(lyrics.slice(i, i + 3500));
            }

            const embed = baseEmbed({
                color: COLORS.music,
                title: `🎤 ${truncate(query.title, 200)}`,
                description: chunks[0],
                footer: query.artist ? `Nghệ sĩ: ${query.artist}` : undefined,
            });

            await interaction.editReply({ embeds: [embed] });
            for (const chunk of chunks.slice(1)) {
                await interaction.followUp({ content: chunk }).catch(() => null);
            }
        } catch (err) {
            logger.warn('[lyrics]', err.message);
            await interaction.editReply({ embeds: [errorEmbed(`Lỗi tìm lời bài hát: ${err.message?.slice(0, 200)}`)] });
        }
    },
};
