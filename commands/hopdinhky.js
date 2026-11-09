const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

// ─── /hopdinhky — Poll chọn giờ họp nhóm NCKH ───────────────
// Tạo embed với các mốc thời gian, thành viên react emoji để bầu chọn

const TIME_OPTIONS = [
    { emoji: '1️⃣', label: '8:00 - 9:00' },
    { emoji: '2️⃣', label: '9:00 - 10:00' },
    { emoji: '3️⃣', label: '10:00 - 11:00' },
    { emoji: '4️⃣', label: '14:00 - 15:00' },
    { emoji: '5️⃣', label: '15:00 - 16:00' },
    { emoji: '6️⃣', label: '19:00 - 20:00' },
    { emoji: '7️⃣', label: '20:00 - 21:00' },
];

module.exports = {
    data: new SlashCommandBuilder()
        .setName('hopdinhky')
        .setDescription('Tạo poll chọn giờ họp nhóm NCKH')
        .addStringOption(o =>
            o.setName('ngay').setDescription('Ngày họp (vd: Thứ 5, 28/08)').setRequired(true))
        .addStringOption(o =>
            o.setName('noi_dung').setDescription('Nội dung/mục đích cuộc họp').setRequired(false)),

    async execute(interaction) {
        try {
            const ngay = interaction.options.getString('ngay');
            const noiDung = interaction.options.getString('noi_dung') || 'Họp định kỳ nhóm NCKH';

            const optionLines = TIME_OPTIONS.map(o => `${o.emoji} ${o.label}`).join('\n');

            const embed = new EmbedBuilder()
                .setColor(0x5865F2)
                .setTitle('📅 Bầu Chọn Giờ Họp Nhóm')
                .setDescription([
                    `📋 **${noiDung}**`,
                    `📆 **Ngày:** ${ngay}`,
                    ``,
                    `Chọn khung giờ phù hợp bằng cách react emoji tương ứng:`,
                    ``,
                    optionLines,
                    ``,
                    `✅ Có thể chọn **nhiều** khung giờ!`,
                ].join('\n'))
                .setFooter({ text: `Tạo bởi ${interaction.user.username}` })
                .setTimestamp();

            const msg = await interaction.reply({ embeds: [embed], fetchReply: true });

            // Tự động thêm reaction cho mỗi option
            for (const opt of TIME_OPTIONS) {
                await msg.react(opt.emoji);
            }
        } catch (error) {
            console.error('[hopdinhky.js ERROR]', error);
            await interaction.reply({ content: '❌ Lỗi khi tạo poll!', ephemeral: true });
        }
    },
};
