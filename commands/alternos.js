const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

// ─── Thông tin server Minecraft ───────────────────────────────
const SERVER_IP   = '3anhemHCMUE.aternos.me';
const SERVER_PORT = '64549';
// ──────────────────────────────────────────────────────────────

module.exports = {
    data: new SlashCommandBuilder()
        .setName('alternos')
        .setDescription('Hiển thị địa chỉ IP kết nối đến server Minecraft Aternos'),

    async execute(interaction) {
        const embed = new EmbedBuilder()
            .setColor(0x4CAF50)               // Xanh lá — màu Minecraft
            .setTitle('⛏️ Server Minecraft — 3 Anh Em HCMUE')
            .setDescription('Dùng thông tin bên dưới để tham gia server Aternos của nhóm!')
            .addFields(
                {
                    name: '🌐 Địa chỉ IP',
                    value: `\`\`\`${SERVER_IP}\`\`\``,
                    inline: false,
                },
                {
                    name: '🔌 Port',
                    value: `\`\`\`${SERVER_PORT}\`\`\``,
                    inline: true,
                },
                {
                    name: '📋 Full Address (copy nhanh)',
                    value: `\`\`\`${SERVER_IP}:${SERVER_PORT}\`\`\``,
                    inline: false,
                },
                {
                    name: '💡 Cách vào',
                    value: [
                        '1. Mở Minecraft Java Edition',
                        '2. Vào **Multiplayer** → **Add Server**',
                        `3. Paste địa chỉ: \`${SERVER_IP}:${SERVER_PORT}\``,
                        '4. Nhấn **Done** → **Join Server** 🎮',
                    ].join('\n'),
                    inline: false,
                },
            )
            .setFooter({
                text: '⚠️ Server Aternos chỉ online khi có người bật — liên hệ admin nếu server offline!',
            })
            .setTimestamp();

        await interaction.reply({ embeds: [embed] });
    },
};
