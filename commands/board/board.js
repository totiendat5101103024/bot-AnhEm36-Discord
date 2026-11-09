'use strict';

const { SlashCommandBuilder } = require('discord.js');
const store = require('../../games/board/store');
const service = require('../../games/board/service');
const { baseEmbed, COLORS, errorEmbed, truncate } = require('../../utils/ui');

const GAME_CHOICES = [
    { name: 'Caro/Gomoku', value: 'caro' },
    { name: 'Cờ vua', value: 'chess' },
    { name: 'Cờ tướng', value: 'xiangqi' },
];

function getGame(interaction, id) {
    if (id) {
        const game = store.getGame(id);
        if (!game || game.guild_id !== interaction.guildId) return null;
        return game;
    }
    return store.getActiveForUser(interaction.guildId, interaction.user.id);
}

function gameTypeLabel(type) {
    return service.LABELS[type] || type;
}

module.exports = {
    cooldown: 3,
    data: new SlashCommandBuilder()
        .setName('board')
        .setDescription('Board game async — đi nước, xem ván, xếp hạng, lịch sử')
        .addSubcommand((s) => s
            .setName('move')
            .setDescription('Đi một nước trong ván đang chơi')
            .addStringOption((o) => o
                .setName('nuoc')
                .setDescription('Nước đi, ví dụ H8 / e2e4 / a7a4')
                .setRequired(true))
            .addStringOption((o) => o
                .setName('id')
                .setDescription('ID ván (bỏ trống để lấy ván đang chơi của bạn)')
                .setRequired(false)))
        .addSubcommand((s) => s
            .setName('resign')
            .setDescription('Xin thua ván đang chơi')
            .addStringOption((o) => o
                .setName('id')
                .setDescription('ID ván (bỏ trống để lấy ván đang chơi của bạn)')
                .setRequired(false)))
        .addSubcommand((s) => s
            .setName('list')
            .setDescription('Xem các ván board game đang diễn ra trong server'))
        .addSubcommand((s) => s
            .setName('rank')
            .setDescription('Bảng xếp hạng Elo board game')
            .addStringOption((o) => o
                .setName('game')
                .setDescription('Loại game (bỏ trống = tất cả)')
                .setRequired(false)
                .addChoices(...GAME_CHOICES))
            .addIntegerOption((o) => o
                .setName('so_luong')
                .setDescription('Số người hiển thị (mặc định 10)')
                .setRequired(false)
                .setMinValue(1)
                .setMaxValue(25)))
        .addSubcommand((s) => s
            .setName('history')
            .setDescription('Lịch sử đấu của bạn hoặc người khác')
            .addUserOption((o) => o
                .setName('nguoi_dung')
                .setDescription('Người cần xem (bỏ trống = bạn)')
                .setRequired(false))
            .addStringOption((o) => o
                .setName('game')
                .setDescription('Loại game (bỏ trống = tất cả)')
                .setRequired(false)
                .addChoices(...GAME_CHOICES))
            .addIntegerOption((o) => o
                .setName('so_luong')
                .setDescription('Số ván hiển thị (mặc định 10)')
                .setRequired(false)
                .setMinValue(1)
                .setMaxValue(25))),

    async execute(interaction) {
        if (!interaction.guildId) {
            return interaction.reply({
                embeds: [errorEmbed('Lệnh này chỉ dùng được trong server.')],
                ephemeral: true,
            });
        }

        const sub = interaction.options.getSubcommand();

        if (sub === 'move') {
            const id = interaction.options.getString('id');
            const input = interaction.options.getString('nuoc', true);
            const game = getGame(interaction, id);
            if (!game) return interaction.reply({ embeds: [errorEmbed('Không tìm thấy ván đang chơi.')], ephemeral: true });
            const out = await service.applyMove(interaction, game, input);
            if (!out.ok) return interaction.reply({ embeds: [errorEmbed(out.message)], ephemeral: true });
            await service.refreshMessage(interaction, out.game, out.payload);
            return;
        }

        if (sub === 'resign') {
            const game = getGame(interaction, interaction.options.getString('id'));
            if (!game) return interaction.reply({ embeds: [errorEmbed('Không tìm thấy ván đang chơi.')], ephemeral: true });
            const out = await service.resign(interaction, game);
            if (!out.ok) return interaction.reply({ embeds: [errorEmbed(out.message)], ephemeral: true });
            await service.refreshMessage(interaction, out.game, out.payload);
            return;
        }

        if (sub === 'list') {
            const games = store.listActiveGames(interaction.guildId, 15);
            if (!games.length) {
                return interaction.reply({
                    embeds: [baseEmbed({
                        color: COLORS.info,
                        title: '♟️ Board game đang diễn ra',
                        description: 'Chưa có ván nào. Dùng `/caro`, `/chess` hoặc `/xiangqi` để thách đấu.',
                    })],
                });
            }
            const embed = baseEmbed({
                color: COLORS.primary,
                title: '♟️ Board game đang diễn ra',
                description: `Có **${games.length}** ván chưa kết thúc.`,
                fields: games.map((g) => ({
                    name: `${gameTypeLabel(g.game_type)} • ${g.id}`,
                    value: `${g.player1_name} vs ${g.player2_name}\nKênh: <#${g.channel_id}>`,
                    inline: false,
                })),
            });
            return interaction.reply({ embeds: [embed] });
        }

        if (sub === 'rank') {
            const gameType = interaction.options.getString('game') || null;
            const limit = interaction.options.getInteger('so_luong') || 10;
            const rows = store.getRank(interaction.guildId, gameType, limit);
            if (!rows.length) {
                return interaction.reply({
                    embeds: [baseEmbed({
                        color: COLORS.info,
                        title: '🏅 Bảng xếp hạng board game',
                        description: 'Chưa có dữ liệu. Hãy chơi ván đầu tiên!',
                    })],
                });
            }
            const embed = baseEmbed({
                color: COLORS.gold,
                title: `🏅 Bảng xếp hạng ${gameType ? gameTypeLabel(gameType) : 'board game'}`,
                fields: rows.map((r, i) => {
                    const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${i + 1}`;
                    return {
                        name: `${medal} <@${r.user_id}>`,
                        value: `Elo **${r.elo}** • ✅ ${r.wins} / ❌ ${r.losses} / 🤝 ${r.draws}`,
                        inline: false,
                    };
                }),
            });
            return interaction.reply({ embeds: [embed] });
        }

        if (sub === 'history') {
            const target = interaction.options.getUser('nguoi_dung') || interaction.user;
            const gameType = interaction.options.getString('game') || null;
            const limit = interaction.options.getInteger('so_luong') || 10;
            const rows = store.getHistory(interaction.guildId, target.id, gameType, limit);
            if (!rows.length) {
                return interaction.reply({
                    embeds: [baseEmbed({
                        color: COLORS.info,
                        title: '📜 Lịch sử đấu',
                        description: `**${target.username}** chưa có ván nào đã kết thúc.`,
                    })],
                });
            }
            const embed = baseEmbed({
                color: COLORS.purple,
                title: `📜 Lịch sử đấu — ${target.username}`,
                description: `${rows.length} ván gần nhất.`,
                fields: rows.map((g) => {
                    const targetSide = g.player1_id === target.id ? 'p1' : 'p2';
                    const win = g.winner_id === target.id;
                    const draw = !g.winner_id;
                    const outcome = draw ? '🤝 Hoà' : win ? '✅ Thắng' : '❌ Thua';
                    return {
                        name: `${outcome} • ${gameTypeLabel(g.game_type)}`,
                        value: `${g.player1_name} vs ${g.player2_name}\n\`${g.id}\` • ${truncate(g.updated_at, 20)}`,
                        inline: false,
                    };
                }),
            });
            return interaction.reply({ embeds: [embed] });
        }
    },
};
