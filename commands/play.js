const { SlashCommandBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('play')
        .setDescription('Phát nhạc từ link Spotify, YouTube hoặc SoundCloud')
        .addStringOption(option =>
            option.setName('link')
                .setDescription('Dán link Playlist hoặc bài hát vào đây')
                .setRequired(true)),
    
    async execute(interaction) {
        const voiceChannel = interaction.member.voice.channel;
        if (!voiceChannel) {
            return interaction.reply({
                content: '❌ Bạn phải vào một **Kênh Thoại (Voice Channel)** trước!',
                ephemeral: true,
            });
        }

        const query = interaction.options.getString('link');

        // Defer reply ngay lập tức để tránh lỗi "Unknown Message" (10008)
        // Discord cho phép 15 phút để editReply sau khi deferReply
        await interaction.deferReply();

        try {
            await interaction.client.distube.play(voiceChannel, query, {
                member: interaction.member,
                textChannel: interaction.channel,
            });

            // Nếu không có lỗi nào được throw, chỉ cần xác nhận đã nhận lệnh
            // Thông báo "Đang phát" sẽ đến từ sự kiện playSong / addSong trong index.js
            await interaction.editReply(`✅ Đã nhận lệnh! Đang xử lý \`${query}\`...`);

        } catch (error) {
            console.error('[play.js ERROR]', error);
            // Chỉ editReply nếu interaction chưa bị xóa
            try {
                await interaction.editReply({
                    content: `❌ **Lỗi:** ${error.message?.slice(0, 200) ?? 'Không thể phát link này.'}`,
                });
            } catch (editErr) {
                // Interaction đã hết hạn hoặc bị xóa, bỏ qua
                console.error('[play.js] editReply failed:', editErr.code, editErr.message);
            }
        }
    },
};