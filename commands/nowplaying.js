const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

const BAR_LENGTH = 20;

/** Vẽ thanh tiến trình dạng ▬▬▬🔘▬▬▬ */
function buildProgressBar(current, total) {
    if (!total || total <= 0) return '🔴 **LIVE**';
    const ratio = Math.min(current / total, 1);
    const filled = Math.round(ratio * BAR_LENGTH);
    return '▬'.repeat(filled) + '🔘' + '▬'.repeat(Math.max(BAR_LENGTH - filled, 0));
}

function formatTime(seconds) {
    const s = Math.floor(seconds % 60).toString().padStart(2, '0');
    const m = Math.floor((seconds / 60) % 60).toString().padStart(2, '0');
    const h = Math.floor(seconds / 3600);
    return h > 0 ? `${h}:${m}:${s}` : `${m}:${s}`;
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('nowplaying')
        .setDescription('Xem thông tin bài hát đang phát'),

    async execute(interaction) {
        const queue = interaction.client.distube.getQueue(interaction.guildId);
        if (!queue) return interaction.reply({ content: '❌ Hiện tại không có bài hát nào đang phát!', ephemeral: true });

        const song = queue.songs[0];
        const bar = buildProgressBar(queue.currentTime, song.duration);
        const time = song.isLive
            ? '🔴 LIVE'
            : `${formatTime(queue.currentTime)} / ${song.formattedDuration}`;

        const embed = new EmbedBuilder()
            .setColor(0x5865F2)
            .setTitle('🎶 Đang phát')
            .setDescription(`**[${song.name}](${song.url})**\n\n${bar}\n${time}`)
            .setThumbnail(song.thumbnail || null)
            .addFields(
                { name: '👤 Yêu cầu bởi', value: `${song.user ?? 'Không rõ'}`, inline: true },
                { name: '🔊 Âm lượng', value: `${queue.volume}%`, inline: true },
                { name: '🔁 Lặp lại', value: ['Tắt', 'Bài hát', 'Hàng đợi'][queue.repeatMode], inline: true },
            );

        await interaction.reply({ embeds: [embed] });
    },
};
