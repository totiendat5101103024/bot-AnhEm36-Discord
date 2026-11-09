'use strict';

const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { db } = require('../../utils/db');
const { isAdmin } = require('../../utils/permissions');
const { baseEmbed, errorEmbed, successEmbed, COLORS } = require('../../utils/ui');
const voiceStats = require('../../utils/voiceStats');
const logger = require('../../utils/logger');

function humanDuration(seconds) {
    const s = Math.max(0, Math.floor(seconds || 0));
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    if (h > 0) return `${h}g ${m}p`;
    return `${m}p ${s % 60}s`;
}

const getTempChannel = db.prepare('SELECT * FROM temp_channels WHERE channel_id = ?');
const updateOwner = db.prepare('UPDATE temp_channels SET owner_id = ? WHERE channel_id = ?');

function resolveTemp(interaction) {
    const channel = interaction.member?.voice?.channel;
    if (!channel) return { ok: false, message: 'Bạn phải vào một **kênh thoại tạm** trước.' };
    const row = getTempChannel.get(channel.id);
    if (!row) {
        return { ok: false, message: 'Kênh bạn đang ở không phải kênh voice tạm do bot tạo.' };
    }
    return { ok: true, channel, row };
}

function canManage(interaction, row) {
    return row.owner_id === interaction.user.id || isAdmin(interaction.member);
}

async function transferOwnership(channel, row, newOwner, reason) {
    const guild = channel.guild;
    await channel.permissionOverwrites.edit(newOwner.id, {
        Connect: true,
        ManageChannels: true,
        MoveMembers: true,
    }, { reason }).catch((err) => logger.warn('[voice] cấp quyền owner:', err.message));

    if (row.owner_id !== newOwner.id) {
        await channel.permissionOverwrites.edit(row.owner_id, {
            ManageChannels: null,
            MoveMembers: null,
        }, { reason }).catch(() => null);
    }
    updateOwner.run(newOwner.id, channel.id);
    return guild;
}

module.exports = {
    cooldown: 2,
    data: new SlashCommandBuilder()
        .setName('voice')
        .setDescription('Quản lý kênh voice tạm của bạn')
        .addSubcommand((s) => s
            .setName('name')
            .setDescription('Đổi tên kênh voice tạm')
            .addStringOption((o) => o.setName('ten').setDescription('Tên mới').setRequired(true).setMaxLength(100)))
        .addSubcommand((s) => s
            .setName('limit')
            .setDescription('Giới hạn số người trong kênh (0 = không giới hạn)')
            .addIntegerOption((o) => o.setName('so_nguoi').setDescription('0–99').setRequired(true).setMinValue(0).setMaxValue(99)))
        .addSubcommand((s) => s.setName('lock').setDescription('Khoá kênh — không cho người khác vào'))
        .addSubcommand((s) => s.setName('unlock').setDescription('Mở khoá kênh'))
        .addSubcommand((s) => s
            .setName('kick')
            .setDescription('Mời một người ra khỏi kênh')
            .addUserOption((o) => o.setName('nguoi_dung').setDescription('Người cần mời ra').setRequired(true)))
        .addSubcommand((s) => s.setName('claim').setDescription('Nhận quyền chủ kênh nếu chủ cũ đã rời'))
        .addSubcommand((s) => s
            .setName('transfer')
            .setDescription('Chuyển quyền chủ kênh cho người khác')
            .addUserOption((o) => o.setName('nguoi_dung').setDescription('Chủ kênh mới').setRequired(true)))
        .addSubcommand((s) => s
            .setName('stats')
            .setDescription('Xem thời gian voice của bạn hoặc người khác')
            .addUserOption((o) => o.setName('nguoi_dung').setDescription('Bỏ trống = bạn').setRequired(false))
            .addStringOption((o) => o
                .setName('ky')
                .setDescription('Khoảng thời gian')
                .setRequired(false)
                .addChoices(
                    { name: '7 ngày gần đây', value: 'week' },
                    { name: '30 ngày gần đây', value: 'month' },
                    { name: 'Tất cả', value: 'all' },
                ))),

    async execute(interaction) {
        const sub = interaction.options.getSubcommand();

        if (sub === 'stats') {
            const target = interaction.options.getUser('nguoi_dung') || interaction.user;
            const period = interaction.options.getString('ky') || 'week';
            const stats = voiceStats.userVoiceStats(interaction.guildId, target.id, period);
            const periodLabel = period === 'week' ? '7 ngày' : period === 'month' ? '30 ngày' : 'tất cả';
            return interaction.reply({
                embeds: [baseEmbed({
                    color: COLORS.info,
                    title: `🔊 Thời gian voice — ${target.username}`,
                    description: `Khoảng: **${periodLabel}**`,
                    fields: [
                        { name: 'Tổng thời gian', value: `**${humanDuration(stats.total)}**`, inline: true },
                        { name: 'Thời gian học', value: `**${humanDuration(stats.study)}**`, inline: true },
                        { name: 'Số phiên', value: `**${stats.sessions}**`, inline: true },
                    ],
                })],
            });
        }

        const resolved = resolveTemp(interaction);
        if (!resolved.ok) {
            return interaction.reply({ embeds: [errorEmbed(resolved.message)], ephemeral: true });
        }
        const { channel, row } = resolved;

        if (sub === 'claim') {
            if (row.owner_id === interaction.user.id) {
                return interaction.reply({ embeds: [errorEmbed('Bạn đã là chủ kênh này rồi.')], ephemeral: true });
            }
            if (channel.members.has(row.owner_id)) {
                return interaction.reply({ embeds: [errorEmbed('Chủ kênh vẫn đang ở trong kênh.')], ephemeral: true });
            }
            await transferOwnership(channel, row, interaction.user, `Claim bởi ${interaction.user.tag}`);
            return interaction.reply({
                embeds: [successEmbed(`Bạn đã trở thành chủ kênh **${channel.name}**.`, '🔊 Nhận kênh')],
            });
        }

        if (!canManage(interaction, row)) {
            return interaction.reply({ embeds: [errorEmbed('Chỉ chủ kênh hoặc admin mới được làm việc này.')], ephemeral: true });
        }

        if (sub === 'name') {
            const name = interaction.options.getString('ten', true).trim();
            if (!name) return interaction.reply({ embeds: [errorEmbed('Tên không được để trống.')], ephemeral: true });
            await channel.setName(name, `Đổi tên bởi ${interaction.user.tag}`);
            return interaction.reply({ embeds: [successEmbed(`Đã đổi tên kênh thành **${name}**.`)] });
        }

        if (sub === 'limit') {
            const limit = interaction.options.getInteger('so_nguoi', true);
            await channel.setUserLimit(limit, `Giới hạn bởi ${interaction.user.tag}`);
            return interaction.reply({
                embeds: [successEmbed(limit === 0 ? 'Đã bỏ giới hạn số người.' : `Đã giới hạn kênh còn **${limit}** người.`)],
            });
        }

        if (sub === 'lock' || sub === 'unlock') {
            const lock = sub === 'lock';
            await channel.permissionOverwrites.edit(channel.guild.id, {
                Connect: lock ? false : null,
            }, { reason: `${lock ? 'Khoá' : 'Mở khoá'} bởi ${interaction.user.tag}` });
            return interaction.reply({
                embeds: [successEmbed(lock ? 'Đã khoá kênh — chỉ người được phép mới vào được.' : 'Đã mở khoá kênh.')],
            });
        }

        if (sub === 'kick') {
            const user = interaction.options.getUser('nguoi_dung', true);
            if (user.id === interaction.user.id) {
                return interaction.reply({ embeds: [errorEmbed('Bạn không thể tự mời mình ra.')], ephemeral: true });
            }
            if (user.id === row.owner_id) {
                return interaction.reply({ embeds: [errorEmbed('Không thể mời chủ kênh ra.')], ephemeral: true });
            }
            const member = channel.members.get(user.id);
            if (!member) return interaction.reply({ embeds: [errorEmbed('Người này không ở trong kênh của bạn.')], ephemeral: true });
            await member.voice.disconnect(`Bị mời ra bởi ${interaction.user.tag}`).catch(() => null);
            return interaction.reply({ embeds: [successEmbed(`Đã mời **${user.username}** ra khỏi kênh.`)] });
        }

        if (sub === 'transfer') {
            const user = interaction.options.getUser('nguoi_dung', true);
            if (user.bot) return interaction.reply({ embeds: [errorEmbed('Không thể chuyển cho bot.')], ephemeral: true });
            if (user.id === row.owner_id) {
                return interaction.reply({ embeds: [errorEmbed('Người này đã là chủ kênh.')], ephemeral: true });
            }
            const member = channel.members.get(user.id);
            if (!member) return interaction.reply({ embeds: [errorEmbed('Người này phải đang ở trong kênh.')], ephemeral: true });
            await transferOwnership(channel, row, user, `Chuyển quyền bởi ${interaction.user.tag}`);
            return interaction.reply({ embeds: [successEmbed(`Đã chuyển quyền chủ kênh cho **${user.username}**.`)] });
        }
    },
};
