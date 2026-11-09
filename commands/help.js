const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('help')
        .setDescription('Hiển thị danh sách tất cả các lệnh của bot'),

    async execute(interaction) {
        // Tự động đọc tất cả commands từ thư mục
        const commandsPath = path.join(__dirname);
        const commandFiles = fs.readdirSync(commandsPath).filter(f => f.endsWith('.js'));

        const commands = commandFiles.map(file => {
            const cmd = require(path.join(commandsPath, file));
            return { name: cmd.data.name, description: cmd.data.description };
        });

        // Phân loại commands theo nhóm
        const MUSIC_NAMES = ['play', 'skip', 'stop', 'queue', 'pause', 'resume', 'volume', 'loop', 'nowplaying'];
        const GAME_NAMES = ['balance', 'daily', 'taixiu', 'flip', 'slots', 'xocdia', 'leaderboard-xu'];
        const RESEARCH_NAMES = ['zotero', 'arxiv', 'trichdan', 'deadline', 'deadline-list', 'deadline-done', 'pomodoro', 'hopdinhky'];

        const musicCmds = commands.filter(c => MUSIC_NAMES.includes(c.name));
        const gameCmds = commands.filter(c => GAME_NAMES.includes(c.name));
        const resCmds = commands.filter(c => RESEARCH_NAMES.includes(c.name));
        const utilCmds = commands.filter(c =>
            !MUSIC_NAMES.includes(c.name) &&
            !GAME_NAMES.includes(c.name) &&
            !RESEARCH_NAMES.includes(c.name)
        );

        const embed = new EmbedBuilder()
            .setColor(0x5865F2)
            .setTitle('📖 Danh sách lệnh')
            .setDescription('Tất cả các lệnh slash command của bot. Dùng `/tên_lệnh` để sử dụng.')
            .setThumbnail(interaction.client.user.displayAvatarURL())
            .setTimestamp()
            .setFooter({
                text: `Yêu cầu bởi ${interaction.user.username}`,
                iconURL: interaction.user.displayAvatarURL(),
            });

        if (musicCmds.length > 0) {
            embed.addFields({
                name: '🎵 Nhạc',
                value: musicCmds
                    .map(c => `\`/${c.name}\` — ${c.description}`)
                    .join('\n'),
                inline: false,
            });
        }

        if (gameCmds.length > 0) {
            embed.addFields({
                name: '🎰 Xu Ảo & Mini Game',
                value: gameCmds
                    .map(c => `\`/${c.name}\` — ${c.description}`)
                    .join('\n'),
                inline: false,
            });
        }

        if (resCmds.length > 0) {
            embed.addFields({
                name: '📚 Nghiên Cứu Khoa Học',
                value: resCmds
                    .map(c => `\`/${c.name}\` — ${c.description}`)
                    .join('\n'),
                inline: false,
            });
        }

        if (utilCmds.length > 0) {
            embed.addFields({
                name: '🛠️ Tiện ích',
                value: utilCmds
                    .map(c => `\`/${c.name}\` — ${c.description}`)
                    .join('\n'),
                inline: false,
            });
        }

        await interaction.reply({ embeds: [embed] });
    },
};
