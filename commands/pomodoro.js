const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

// ─── /pomodoro — Phiên học nhóm kiểu Pomodoro ───────────────
// Thông báo bắt đầu phiên tập trung (25p) và giờ nghỉ (5p), lặp lại N vòng

// Lưu trữ phiên đang chạy theo guild+channel
const activeSessions = new Map();

module.exports = {
    data: new SlashCommandBuilder()
        .setName('pomodoro')
        .setDescription('Bắt đầu phiên học nhóm Pomodoro (25p tập trung + 5p nghỉ)')
        .addIntegerOption(o =>
            o.setName('so_vong').setDescription('Số vòng Pomodoro (mặc định 4)').setRequired(false)
                .setMinValue(1).setMaxValue(8))
        .addIntegerOption(o =>
            o.setName('tap_trung').setDescription('Phút tập trung (mặc định 25)').setRequired(false)
                .setMinValue(5).setMaxValue(60))
        .addIntegerOption(o =>
            o.setName('nghi').setDescription('Phút nghỉ (mặc định 5)').setRequired(false)
                .setMinValue(1).setMaxValue(15)),

    async execute(interaction) {
        try {
            const key = `${interaction.guildId}-${interaction.channelId}`;

            // Kiểm tra nếu đã có phiên đang chạy
            if (activeSessions.has(key)) {
                // Cho phép dừng phiên
                const session = activeSessions.get(key);
                clearTimeout(session.timer);
                activeSessions.delete(key);
                return interaction.reply({ embeds: [
                    new EmbedBuilder().setColor(0xFF4444).setTitle('⏹️ Pomodoro Đã Dừng!')
                        .setDescription('Phiên Pomodoro đã bị huỷ. Gõ `/pomodoro` để bắt đầu phiên mới.')
                ] });
            }

            const rounds = interaction.options.getInteger('so_vong') || 4;
            const focusMin = interaction.options.getInteger('tap_trung') || 25;
            const breakMin = interaction.options.getInteger('nghi') || 5;

            const startEmbed = new EmbedBuilder()
                .setColor(0x00FF88)
                .setTitle('🍅 Pomodoro — Bắt Đầu!')
                .setDescription([
                    `📚 **${rounds} vòng** × (**${focusMin}p** tập trung + **${breakMin}p** nghỉ)`,
                    `Tổng: ~**${rounds * (focusMin + breakMin)}p**`,
                    ``,
                    `🔔 Bot sẽ thông báo khi bắt đầu/kết thúc mỗi phiên.`,
                    `💡 Gõ \`/pomodoro\` lần nữa để **dừng** phiên.`,
                ].join('\n'))
                .setTimestamp();

            await interaction.reply({ embeds: [startEmbed] });

            // Bắt đầu vòng lặp Pomodoro
            const channel = interaction.channel;
            let currentRound = 1;

            function startRound() {
                if (!activeSessions.has(key) || currentRound > rounds) {
                    // Kết thúc toàn bộ
                    activeSessions.delete(key);
                    channel.send({ embeds: [
                        new EmbedBuilder().setColor(0xFFD700).setTitle('🎉 Pomodoro Hoàn Thành!')
                            .setDescription(`✅ Đã hoàn thành **${rounds} vòng** Pomodoro! Nghỉ ngơi đi nào! 🎊`)
                    ] });
                    return;
                }

                // Thông báo bắt đầu tập trung
                channel.send({ embeds: [
                    new EmbedBuilder().setColor(0xFF6347).setTitle(`🍅 Vòng ${currentRound}/${rounds} — TẬP TRUNG!`)
                        .setDescription(`⏱️ **${focusMin} phút** tập trung bắt đầu!\n🔇 Tắt thông báo và cố gắng nhé!`)
                ] });

                // Sau focusMin phút → nghỉ
                const focusTimer = setTimeout(() => {
                    if (!activeSessions.has(key)) return;

                    if (currentRound >= rounds) {
                        // Vòng cuối: không cần nghỉ
                        currentRound++;
                        startRound();
                        return;
                    }

                    channel.send({ embeds: [
                        new EmbedBuilder().setColor(0x00BFFF).setTitle(`☕ Vòng ${currentRound}/${rounds} — NGHỈ NGƠI!`)
                            .setDescription(`⏱️ **${breakMin} phút** nghỉ! Uống nước, vươn vai đi nào! 🧘`)
                    ] });

                    // Sau breakMin phút → vòng tiếp
                    const breakTimer = setTimeout(() => {
                        currentRound++;
                        startRound();
                    }, breakMin * 60 * 1000);

                    activeSessions.set(key, { timer: breakTimer });
                }, focusMin * 60 * 1000);

                activeSessions.set(key, { timer: focusTimer });
            }

            // Bắt đầu vòng 1
            activeSessions.set(key, { timer: null });
            startRound();

        } catch (error) {
            console.error('[pomodoro.js ERROR]', error);
            await interaction.reply({ content: '❌ Lỗi khi bắt đầu Pomodoro!', ephemeral: true });
        }
    },
};
