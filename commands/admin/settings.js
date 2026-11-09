'use strict';

const { SlashCommandBuilder, ChannelType, PermissionFlagsBits } = require('discord.js');
const settings = require('../../utils/settings');
const { isAdmin } = require('../../utils/permissions');
const { baseEmbed, errorEmbed, successEmbed, COLORS } = require('../../utils/ui');

function orDash(value, type) {
    if (!value) return '—';
    return type === 'channel' ? `<#${value}>` : type === 'role' ? `<@&${value}>` : String(value);
}

function showSettings(guildId) {
    const s = settings.get(guildId);
    return baseEmbed({
        color: COLORS.info,
        title: '⚙️ Cấu hình server',
        fields: [
            { name: 'Kênh tạo voice tạm', value: orDash(s.temp_voice_channel_id, 'channel'), inline: true },
            { name: 'Danh mục voice tạm', value: orDash(s.temp_voice_category_id, 'channel'), inline: true },
            { name: 'Danh mục học tập', value: orDash(s.study_category_id, 'channel'), inline: true },
            { name: 'Kênh log', value: orDash(s.log_channel_id, 'channel'), inline: true },
            { name: 'Kênh nhạc', value: orDash(s.music_channel_id, 'channel'), inline: true },
            { name: 'Role DJ', value: orDash(s.dj_role_id, 'role'), inline: true },
            { name: 'Âm lượng mặc định', value: `${s.default_volume}%`, inline: true },
            { name: 'Giới hạn queue', value: `${s.max_queue} bài`, inline: true },
            { name: 'Idle timeout', value: `${Math.round(s.idle_timeout / 60)} phút`, inline: true },
            { name: 'Autoplay', value: s.autoplay ? 'Bật' : 'Tắt', inline: true },
            { name: 'Chế độ 24/7', value: s.mode_247 ? 'Bật' : 'Tắt', inline: true },
        ],
        footer: 'Dùng /settings kèm các tùy chọn để thay đổi',
    });
}

module.exports = {
    cooldown: 3,
    data: new SlashCommandBuilder()
        .setName('settings')
        .setDescription('Cấu hình server (chỉ admin)')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
        .addChannelOption((o) => o
            .setName('kenh_tao_voice')
            .setDescription('Kênh voice "Join to Create" — vào kênh này sẽ tạo voice tạm')
            .setRequired(false)
            .addChannelTypes(ChannelType.GuildVoice))
        .addChannelOption((o) => o
            .setName('danh_muc_voice')
            .setDescription('Danh mục chứa voice tạm')
            .setRequired(false)
            .addChannelTypes(ChannelType.GuildCategory))
        .addChannelOption((o) => o
            .setName('danh_muc_hoc')
            .setDescription('Danh mục dành cho kênh học tập')
            .setRequired(false)
            .addChannelTypes(ChannelType.GuildCategory))
        .addChannelOption((o) => o
            .setName('kenh_log')
            .setDescription('Kênh nhận log của bot')
            .setRequired(false)
            .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement))
        .addChannelOption((o) => o
            .setName('kenh_nhac')
            .setDescription('Kênh nhạc mặc định')
            .setRequired(false)
            .addChannelTypes(ChannelType.GuildVoice, ChannelType.GuildText))
        .addRoleOption((o) => o
            .setName('role_dj')
            .setDescription('Role được điều khiển nhạc')
            .setRequired(false))
        .addIntegerOption((o) => o
            .setName('am_luong')
            .setDescription('Âm lượng mặc định 0–100')
            .setRequired(false)
            .setMinValue(0)
            .setMaxValue(100))
        .addIntegerOption((o) => o
            .setName('gioi_han_queue')
            .setDescription('Số bài tối đa trong queue (1–500)')
            .setRequired(false)
            .setMinValue(1)
            .setMaxValue(500))
        .addIntegerOption((o) => o
            .setName('idle_timeout')
            .setDescription('Tự rời voice sau bao nhiêu giây không hoạt động (30–7200)')
            .setRequired(false)
            .setMinValue(30)
            .setMaxValue(7200))
        .addBooleanOption((o) => o
            .setName('autoplay')
            .setDescription('Tự phát bài tiếp theo khi hết queue')
            .setRequired(false))
        .addBooleanOption((o) => o
            .setName('mode_247')
            .setDescription('Luôn ở trong kênh voice')
            .setRequired(false))
        .addBooleanOption((o) => o
            .setName('dat_lai')
            .setDescription('Đặt lại toàn bộ cấu hình về mặc định')
            .setRequired(false)),

    async execute(interaction) {
        if (!interaction.guildId) {
            return interaction.reply({ embeds: [errorEmbed('Lệnh này chỉ dùng được trong server.')], ephemeral: true });
        }
        if (!isAdmin(interaction.member)) {
            return interaction.reply({ embeds: [errorEmbed('Chỉ admin mới được đổi cấu hình server.')], ephemeral: true });
        }

        if (interaction.options.getBoolean('dat_lai')) {
            settings.set(interaction.guildId, { ...settings.DEFAULTS });
            return interaction.reply({ embeds: [successEmbed('Đã đặt lại toàn bộ cấu hình về mặc định.')] });
        }

        const patch = {};
        const map = [
            ['kenh_tao_voice', 'temp_voice_channel_id', 'channel'],
            ['danh_muc_voice', 'temp_voice_category_id', 'channel'],
            ['danh_muc_hoc', 'study_category_id', 'channel'],
            ['kenh_log', 'log_channel_id', 'channel'],
            ['kenh_nhac', 'music_channel_id', 'channel'],
            ['role_dj', 'dj_role_id', 'role'],
        ];
        for (const [option, key, type] of map) {
            const value = type === 'channel'
                ? interaction.options.getChannel(option)
                : interaction.options.getRole(option);
            if (value) patch[key] = value.id;
        }

        for (const [option, key] of [
            ['am_luong', 'default_volume'],
            ['gioi_han_queue', 'max_queue'],
            ['idle_timeout', 'idle_timeout'],
        ]) {
            const value = interaction.options.getInteger(option);
            if (value !== null && value !== undefined) patch[key] = value;
        }

        for (const [option, key] of [['autoplay', 'autoplay'], ['mode_247', 'mode_247']]) {
            const value = interaction.options.getBoolean(option);
            if (value !== null && value !== undefined) patch[key] = value ? 1 : 0;
        }

        if (!Object.keys(patch).length) {
            return interaction.reply({ embeds: [showSettings(interaction.guildId)] });
        }

        settings.set(interaction.guildId, patch);
        return interaction.reply({
            embeds: [showSettings(interaction.guildId), successEmbed('Đã cập nhật cấu hình.')],
        });
    },
};
