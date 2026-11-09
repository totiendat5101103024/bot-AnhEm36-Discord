'use strict';

/**
 * player.js — panel "đang phát" có nút điều khiển.
 */

const {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
} = require('discord.js');
const { baseEmbed, progressBar, formatDuration, truncate, COLORS } = require('./ui');
const { safeSend, queueDuration } = require('./music');

// guildId → { channelId, messageId }
const panels = new Map();

const LOOP_LABEL = ['Tắt', 'Bài hát', 'Hàng đợi'];
const LOOP_EMOJI = ['🔁', '🔂', '🔁'];

function buildNowPlayingEmbed(queue, song = queue.songs[0]) {
    if (!song) {
        return baseEmbed({
            color: COLORS.music,
            title: '🎶 Đang phát',
            description: 'Không có bài hát nào trong hàng đợi.',
        });
    }

    const bar = progressBar(queue.currentTime, song.duration);
    const time = song.isLive ? '🔴 LIVE' : `${formatDuration(queue.currentTime)} / ${song.formattedDuration || formatDuration(song.duration)}`;

    return baseEmbed({
        color: COLORS.music,
        title: '🎶 Đang phát',
        description: `**[${song.name}](${song.url})**\n\n${bar}\n\`${time}\``,
        thumbnail: song.thumbnail || undefined,
        fields: [
            { name: '👤 Yêu cầu', value: `${song.user ?? 'Không rõ'}`, inline: true },
            { name: '🔊 Âm lượng', value: `${queue.volume}%`, inline: true },
            { name: '🔁 Lặp lại', value: LOOP_LABEL[queue.repeatMode] ?? 'Tắt', inline: true },
            { name: '📜 Hàng đợi', value: `${queue.songs.length} bài`, inline: true },
            { name: '⏱️ Tổng thời lượng', value: formatDuration(queueDuration(queue)), inline: true },
        ],
        footer: { text: `Guild ${queue.id} • ${queue.paused ? 'Đang tạm dừng' : 'Đang phát'}` },
    });
}

function buildPlayerRows(queue) {
    const row1 = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('music:prev').setEmoji('⏮️').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
            .setCustomId('music:pause')
            .setEmoji(queue.paused ? '▶️' : '⏸️')
            .setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId('music:skip').setEmoji('⏭️').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('music:stop').setEmoji('⏹️').setStyle(ButtonStyle.Danger),
        new ButtonBuilder()
            .setCustomId('music:loop')
            .setEmoji(LOOP_EMOJI[queue.repeatMode] ?? '🔁')
            .setStyle(queue.repeatMode ? ButtonStyle.Success : ButtonStyle.Secondary),
    );

    const row2 = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('music:shuffle').setEmoji('🔀').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('music:voldown').setEmoji('🔉').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('music:volup').setEmoji('🔊').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('music:seek').setEmoji('⏱️').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('music:queue').setEmoji('📜').setStyle(ButtonStyle.Secondary),
    );

    return [row1, row2];
}

function buildPlayerPayload(queue, song) {
    return {
        embeds: [buildNowPlayingEmbed(queue, song)],
        components: buildPlayerRows(queue),
    };
}

function buildQueueEmbed(queue, page = 1, perPage = 10) {
    const total = queue.songs.length;
    const pages = Math.max(1, Math.ceil(total / perPage));
    const current = Math.min(Math.max(1, page), pages);
    const start = (current - 1) * perPage;
    const lines = queue.songs.slice(start, start + perPage).map((song, i) => {
        const index = start + i;
        const prefix = index === 0 ? '▶️' : `**${index}.**`;
        return `${prefix} [${truncate(song.name, 55)}](${song.url}) \`${song.formattedDuration || formatDuration(song.duration)}\` • ${song.user ?? ''}`;
    });

    return baseEmbed({
        color: COLORS.music,
        title: '📜 Hàng đợi',
        description: lines.join('\n') || 'Hàng đợi trống.',
        footer: `Trang ${current}/${pages} • ${total} bài • Tổng ${formatDuration(queueDuration(queue))}`,
    });
}

function buildQueueRows(queue, page = 1, perPage = 10) {
    const pages = Math.max(1, Math.ceil(queue.songs.length / perPage));
    const current = Math.min(Math.max(1, page), pages);

    return [
        new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId(`queue:page:${current - 1}`)
                .setEmoji('⬅️')
                .setStyle(ButtonStyle.Secondary)
                .setDisabled(current <= 1),
            new ButtonBuilder()
                .setCustomId(`queue:page:${current + 1}`)
                .setEmoji('➡️')
                .setStyle(ButtonStyle.Secondary)
                .setDisabled(current >= pages),
            new ButtonBuilder()
                .setCustomId('queue:close')
                .setEmoji('✖️')
                .setStyle(ButtonStyle.Danger),
        ),
    ];
}

async function removePanel(client, guildId) {
    const prev = panels.get(guildId);
    panels.delete(guildId);
    if (!prev) return;
    try {
        const channel = await client.channels.fetch(prev.channelId).catch(() => null);
        if (!channel) return;
        const msg = await channel.messages.fetch(prev.messageId).catch(() => null);
        if (msg) await msg.delete();
    } catch {
        // panel đã bị xoá — bỏ qua
    }
}

/**
 * Gửi panel mới và xoá panel cũ của guild.
 */
async function sendPlayerPanel(channel, queue, song) {
    if (!channel) return null;
    await removePanel(channel.client, queue.id);
    const payload = buildPlayerPayload(queue, song);
    const msg = await safeSend(channel, payload);
    if (msg) panels.set(queue.id, { channelId: channel.id, messageId: msg.id });
    return msg;
}

/**
 * Cập nhật panel tại chỗ từ interaction.
 */
async function updatePlayerPanel(interaction, queue) {
    const payload = buildPlayerPayload(queue);
    try {
        if (interaction.deferred || interaction.replied) {
            await interaction.editReply(payload);
        } else {
            await interaction.update(payload);
        }
    } catch (err) {
        // Interaction có thể đã hết hạn (3 giây) — thử edit tin nhắn gốc.
        try {
            const msg = await interaction.message?.edit(payload);
            if (!msg) throw err;
        } catch {
            // bỏ qua
        }
    }
}

module.exports = {
    buildNowPlayingEmbed,
    buildPlayerRows,
    buildPlayerPayload,
    buildQueueEmbed,
    buildQueueRows,
    sendPlayerPanel,
    updatePlayerPanel,
    removePanel,
    panels,
};
