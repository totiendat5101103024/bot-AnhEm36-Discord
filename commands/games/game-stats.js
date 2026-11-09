'use strict';

const { SlashCommandBuilder } = require('discord.js');
const economy = require('../../utils/economy');
const { baseEmbed, COLORS } = require('../../utils/ui');

const GAME_LABEL = {
    taixiu: '🎲 Tài Xỉu',
    slots: '🎰 Slot',
    xocdia: '🍽️ Xóc Đĩa',
    flip: '🪙 Tung xu',
    baucua: '🍐 Bầu Cua',
    rongho: '🐉 Rồng Hổ',
    hilo: '🔼 Hi-Lo',
    wheel: '🎡 Vòng quay',
    blackjack: '🃏 Blackjack',
    videopoker: '🎰 Video Poker',
    poker: '♠️ Poker',
    trivia: '🧠 Trivia',
};

module.exports = {
    cooldown: 3,
    data: new SlashCommandBuilder()
        .setName('game-stats')
        .setDescription('Xem thống kê game của bạn hoặc người khác')
        .addUserOption((o) => o.setName('nguoi_dung').setDescription('Người cần xem (bỏ trống = bạn)').setRequired(false)),

    async execute(interaction) {
        const target = interaction.options.getUser('nguoi_dung') || interaction.user;
        const stats = economy.getGameStats(target.id, interaction.guildId);

        if (!stats.length) {
            return interaction.reply({
                embeds: [baseEmbed({
                    color: COLORS.info,
                    title: '📊 Thống kê game',
                    description: `**${target.username}** chưa chơi game nào trong server này.`,
                })],
                ephemeral: target.id === interaction.user.id,
            });
        }

        const totals = stats.reduce((acc, s) => ({
            wins: acc.wins + s.wins,
            losses: acc.losses + s.losses,
            draws: acc.draws + s.draws,
            plays: acc.plays + s.plays,
            won: acc.won + s.total_won,
            lost: acc.lost + s.total_lost,
        }), { wins: 0, losses: 0, draws: 0, plays: 0, won: 0, lost: 0 });

        const fields = stats.slice(0, 12).map((s) => {
            const name = GAME_LABEL[s.game] || s.game;
            const profit = s.total_won - s.total_lost;
            return {
                name,
                value: `🎮 ${s.plays} ván • ✅ ${s.wins} / ❌ ${s.losses} / 🤝 ${s.draws}`
                    + `\n${profit >= 0 ? '📈' : '📉'} ${profit >= 0 ? '+' : ''}${profit.toLocaleString()} xu`,
                inline: true,
            };
        });

        const net = totals.won - totals.lost;
        const embed = baseEmbed({
            color: net >= 0 ? COLORS.success : COLORS.danger,
            title: `📊 Thống kê game — ${target.username}`,
            description: `🎮 **${totals.plays}** ván • ✅ **${totals.wins}** thắng • ❌ **${totals.losses}** thua • 🤝 **${totals.draws}** hoà\n`
                + `Tổng: **${net >= 0 ? '+' : ''}${net.toLocaleString()} xu**`,
            fields,
            footer: net >= 0 ? 'Đang lãi 📈' : 'Đang lỗ 📉',
            thumbnail: target.displayAvatarURL(),
        });

        await interaction.reply({ embeds: [embed] });
    },
};
