'use strict';

const {
    SlashCommandBuilder,
    EmbedBuilder,
} = require('discord.js');
const { db } = require('../../utils/db');
const { preparePlay, requireQueue, getQueue, guildSettings } = require('../../utils/music');
const { baseEmbed, errorEmbed, successEmbed, COLORS, formatDuration, truncate } = require('../../utils/ui');
const logger = require('../../utils/logger');

const MAX_SONGS = 50;

const saveStmt = db.prepare(`
    INSERT INTO playlists (user_id, name, songs) VALUES (?, ?, ?)
    ON CONFLICT(user_id, name) DO UPDATE SET songs = excluded.songs, created_at = datetime('now')
`);
const getStmt = db.prepare('SELECT * FROM playlists WHERE user_id = ? AND name = ?');
const listStmt = db.prepare('SELECT name, songs, created_at FROM playlists WHERE user_id = ? ORDER BY name');
const deleteStmt = db.prepare('DELETE FROM playlists WHERE user_id = ? AND name = ?');

function songToJson(song) {
    return {
        name: song.name,
        url: song.url,
        duration: song.duration || 0,
        thumbnail: song.thumbnail || null,
        search: song._searchQuery || null,
    };
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('playlist')
        .setDescription('Lưu và phát lại playlist cá nhân')
        .addSubcommand((sub) =>
            sub.setName('save').setDescription('Lưu hàng đợi hiện tại thành playlist')
                .addStringOption((o) => o.setName('ten').setDescription('Tên playlist').setRequired(true).setMaxLength(50)))
        .addSubcommand((sub) =>
            sub.setName('load').setDescription('Phát một playlist đã lưu')
                .addStringOption((o) => o.setName('ten').setDescription('Tên playlist').setRequired(true).setMaxLength(50)))
        .addSubcommand((sub) =>
            sub.setName('list').setDescription('Xem danh sách playlist của bạn'))
        .addSubcommand((sub) =>
            sub.setName('delete').setDescription('Xoá một playlist')
                .addStringOption((o) => o.setName('ten').setDescription('Tên playlist').setRequired(true).setMaxLength(50))),

    async execute(interaction) {
        const sub = interaction.options.getSubcommand();

        if (sub === 'save') {
            const queue = await requireQueue(interaction);
            if (!queue) return;

            const name = interaction.options.getString('ten', true).trim();
            const songs = queue.songs.slice(0, MAX_SONGS).map(songToJson);
            if (!songs.length) return interaction.reply({ embeds: [errorEmbed('Hàng đợi đang trống!')], ephemeral: true });

            saveStmt.run(interaction.user.id, name, JSON.stringify(songs));
            await interaction.reply({
                embeds: [successEmbed(`Đã lưu **${songs.length} bài** vào playlist \`${name}\`.`, '💾 Đã lưu playlist')],
            });
            return;
        }

        if (sub === 'list') {
            const rows = listStmt.all(interaction.user.id);
            if (!rows.length) {
                return interaction.reply({ embeds: [errorEmbed('Bạn chưa có playlist nào. Dùng `/playlist save` trước!')], ephemeral: true });
            }

            const embed = new EmbedBuilder()
                .setColor(COLORS.music)
                .setTitle('💾 Playlist của bạn')
                .setDescription(rows.map((row) => {
                    let count = 0;
                    try {
                        count = JSON.parse(row.songs).length;
                    } catch {
                        count = 0;
                    }
                    return `**${row.name}** — ${count} bài`;
                }).join('\n'))
                .setTimestamp();

            await interaction.reply({ embeds: [embed] });
            return;
        }

        if (sub === 'delete') {
            const name = interaction.options.getString('ten', true).trim();
            const result = deleteStmt.run(interaction.user.id, name);
            if (!result.changes) {
                return interaction.reply({ embeds: [errorEmbed(`Không tìm thấy playlist \`${name}\`.`)], ephemeral: true });
            }
            await interaction.reply({ embeds: [successEmbed(`Đã xoá playlist \`${name}\`.`, '🗑️ Đã xoá')] });
            return;
        }

        // load
        const name = interaction.options.getString('ten', true).trim();
        const row = getStmt.get(interaction.user.id, name);
        if (!row) {
            return interaction.reply({ embeds: [errorEmbed(`Không tìm thấy playlist \`${name}\`.`)], ephemeral: true });
        }

        const voiceChannel = await preparePlay(interaction);
        if (!voiceChannel) return;

        let songs;
        try {
            songs = JSON.parse(row.songs);
        } catch {
            return interaction.reply({ embeds: [errorEmbed('Playlist bị hỏng, hãy lưu lại.')], ephemeral: true });
        }

        const queries = songs.map((s) => s.search || s.url).filter(Boolean);
        if (!queries.length) return interaction.reply({ embeds: [errorEmbed('Playlist không có bài hợp lệ!')], ephemeral: true });

        // Giới hạn theo số chỗ còn trống trong hàng đợi.
        const max = guildSettings(interaction.guildId).max_queue;
        const existing = getQueue(interaction.client, interaction.guildId);
        const used = existing ? existing.songs.length : 0;
        const remaining = Math.max(0, max - used);
        if (remaining === 0) {
            return interaction.reply({
                embeds: [errorEmbed(`Hàng đợi đã đạt giới hạn **${max} bài**. Hãy dùng \`/clear\` trước!`)],
                ephemeral: true,
            });
        }

        const toLoad = queries.slice(0, remaining);
        const skipped = queries.length - toLoad.length;

        await interaction.deferReply();
        try {
            const playlist = await interaction.client.distube.createCustomPlaylist(toLoad, {
                member: interaction.member,
                parallel: true,
                name: row.name,
            });

            await interaction.client.distube.play(voiceChannel, playlist, {
                member: interaction.member,
                textChannel: interaction.channel,
            });

            await interaction.editReply({
                embeds: [baseEmbed({
                    color: COLORS.music,
                    title: '💾 Đang nạp playlist',
                    description: `**${truncate(row.name, 100)}** — ${toLoad.length} bài (tối đa ${max} bài trong hàng đợi).`
                        + (skipped > 0 ? `\n⚠️ Bỏ qua **${skipped} bài** vì hàng đợi đã đầy.` : '')
                        + `\nTổng thời lượng lưu: ${formatDuration(songs.reduce((sum, s) => sum + (s.duration || 0), 0))}`,
                })],
            });
        } catch (err) {
            logger.warn('[playlist:load]', err.message);
            await interaction.editReply({ embeds: [errorEmbed(`Không nạp được playlist: ${err.message?.slice(0, 300)}`)] });
        }
    },
};
