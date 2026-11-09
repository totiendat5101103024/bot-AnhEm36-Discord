'use strict';

const { SlashCommandBuilder, ChannelType } = require('discord.js');
const studyManager = require('../../utils/studyManager');
const voiceStats = require('../../utils/voiceStats');
const { isAdmin } = require('../../utils/permissions');
const { baseEmbed, errorEmbed, successEmbed, COLORS, formatDuration } = require('../../utils/ui');

function periodLabel(period) {
    return period === 'week' ? '7 ngày gần đây' : period === 'month' ? '30 ngày gần đây' : 'tất cả';
}

function humanDuration(seconds) {
    const s = Math.max(0, Math.floor(seconds || 0));
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    if (h > 0) return `${h}g ${m}p`;
    return `${m}p ${s % 60}s`;
}

module.exports = {
    cooldown: 3,
    data: new SlashCommandBuilder()
        .setName('study')
        .setDescription('Phiên học nhóm trong voice và bảng xếp hạng giờ học')
        .addSubcommand((s) => s
            .setName('start')
            .setDescription('Bắt đầu phiên học tại kênh voice bạn đang ở')
            .addStringOption((o) => o
                .setName('mon_hoc')
                .setDescription('Chủ đề / môn học')
                .setRequired(false)
                .setMaxLength(100))
            .addIntegerOption((o) => o
                .setName('phut')
                .setDescription('Thời lượng (mặc định 60 phút)')
                .setRequired(false)
                .setMinValue(5)
                .setMaxValue(240))
            .addChannelOption((o) => o
                .setName('kenh_thong_bao')
                .setDescription('Kênh nhận thông báo kết thúc (mặc định kênh hiện tại)')
                .setRequired(false)
                .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)))
        .addSubcommand((s) => s
            .setName('stop')
            .setDescription('Kết thúc phiên học đang chạy')
            .addStringOption((o) => o
                .setName('id')
                .setDescription('ID phiên (bỏ trống = phiên ở kênh voice của bạn)')
                .setRequired(false)))
        .addSubcommand((s) => s
            .setName('rank')
            .setDescription('Bảng xếp hạng thời gian học / voice')
            .addStringOption((o) => o
                .setName('ky')
                .setDescription('Khoảng thời gian')
                .setRequired(false)
                .addChoices(
                    { name: '7 ngày gần đây', value: 'week' },
                    { name: '30 ngày gần đây', value: 'month' },
                    { name: 'Tất cả', value: 'all' },
                ))
            .addStringOption((o) => o
                .setName('loai')
                .setDescription('Xếp theo giờ học hoặc tổng giờ voice')
                .setRequired(false)
                .addChoices(
                    { name: 'Giờ học', value: 'study' },
                    { name: 'Tổng voice', value: 'voice' },
                ))
            .addIntegerOption((o) => o
                .setName('so_luong')
                .setDescription('Số người hiển thị (mặc định 10)')
                .setRequired(false)
                .setMinValue(1)
                .setMaxValue(25))),

    async execute(interaction) {
        const sub = interaction.options.getSubcommand();

        if (sub === 'start') {
            const channel = interaction.member?.voice?.channel;
            if (!channel) {
                return interaction.reply({ embeds: [errorEmbed('Bạn phải vào một kênh voice trước khi bắt đầu phiên học.')], ephemeral: true });
            }
            if (!channel.isVoiceBased?.()) {
                return interaction.reply({ embeds: [errorEmbed('Kênh hiện tại không phải kênh voice.')], ephemeral: true });
            }

            const subject = interaction.options.getString('mon_hoc') || null;
            const duration = interaction.options.getInteger('phut') || 60;
            const notify = interaction.options.getChannel('kenh_thong_bao') || interaction.channel;

            const out = studyManager.startSession({
                guildId: interaction.guildId,
                channelId: channel.id,
                notifyChannelId: notify?.id,
                subject,
                durationMin: duration,
                hostId: interaction.user.id,
                client: interaction.client,
            });
            if (!out.ok) {
                return interaction.reply({ embeds: [errorEmbed(out.message)], ephemeral: true });
            }

            const s = out.session;
            return interaction.reply({
                embeds: [baseEmbed({
                    color: COLORS.success,
                    title: '📚 Bắt đầu phiên học',
                    description: [
                        `Kênh: <#${channel.id}>`,
                        `Chủ đề: **${subject || 'Tự do'}**`,
                        `Thời lượng: **${duration} phút**`,
                        `Kết thúc: <t:${Math.floor(s.ends_at / 1000)}:R>`,
                        `Thông báo: <#${notify?.id || interaction.channelId}>`,
                        '',
                        'Mọi người vào kênh voice để được ghi giờ học.',
                    ].join('\n'),
                    footer: `Phiên ${s.id}`,
                })],
            });
        }

        if (sub === 'stop') {
            const id = interaction.options.getString('id');
            let session = id ? studyManager.getSession(id) : null;
            if (!session && !id) {
                const channel = interaction.member?.voice?.channel;
                if (channel) session = studyManager.getActiveForChannel(channel.id);
            }
            if (!session) {
                const mine = studyManager.getActiveForGuild(interaction.guildId)
                    .find((s) => s.host_id === interaction.user.id);
                session = mine || null;
            }
            if (!session) {
                return interaction.reply({ embeds: [errorEmbed('Không tìm thấy phiên học đang hoạt động.')], ephemeral: true });
            }
            if (session.guild_id !== interaction.guildId) {
                return interaction.reply({ embeds: [errorEmbed('Phiên này không thuộc server hiện tại.')], ephemeral: true });
            }
            if (session.host_id !== interaction.user.id && !isAdmin(interaction.member)) {
                return interaction.reply({ embeds: [errorEmbed('Chỉ chủ phòng hoặc admin mới được kết thúc phiên.')], ephemeral: true });
            }

            const summary = await studyManager.stopSession(session.id, interaction.client);
            if (!summary) {
                return interaction.reply({ embeds: [errorEmbed('Phiên này đã kết thúc rồi.')], ephemeral: true });
            }
            const top = summary.participants.slice(0, 5)
                .map((p, i) => `${i + 1}. <@${p.user_id}> — **${humanDuration(p.seconds)}**`)
                .join('\n');
            return interaction.reply({
                embeds: [baseEmbed({
                    color: COLORS.warning,
                    title: '⏹️ Đã kết thúc phiên học',
                    description: [
                        `Chủ đề: **${summary.subject || 'Tự do'}**`,
                        `Thời lượng dự kiến: **${summary.duration_min} phút**`,
                        '',
                        top || 'Không có ai ghi nhận thời gian học.',
                    ].join('\n'),
                })],
            });
        }

        if (sub === 'rank') {
            const period = interaction.options.getString('ky') || 'week';
            const type = interaction.options.getString('loai') || 'study';
            const limit = interaction.options.getInteger('so_luong') || 10;
            const studyOnly = type === 'study';
            const rows = voiceStats.topVoice(interaction.guildId, period, limit, studyOnly);
            const title = studyOnly ? '📚 Bảng xếp hạng giờ học' : '🔊 Bảng xếp hạng voice';

            if (!rows.length) {
                return interaction.reply({
                    embeds: [baseEmbed({
                        color: COLORS.info,
                        title,
                        description: `Chưa có dữ liệu cho **${periodLabel(period)}**.`,
                    })],
                });
            }

            return interaction.reply({
                embeds: [baseEmbed({
                    color: COLORS.gold,
                    title,
                    description: `Khoảng: **${periodLabel(period)}**`,
                    fields: rows.map((r, i) => {
                        const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${i + 1}`;
                        return {
                            name: `${medal} <@${r.user_id}>`,
                            value: `Tổng: **${humanDuration(r.total)}**${studyOnly ? '' : ` • Học: **${humanDuration(r.study)}**`}`,
                            inline: false,
                        };
                    }),
                })],
            });
        }
    },
};
