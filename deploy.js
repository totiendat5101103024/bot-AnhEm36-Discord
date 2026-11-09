require('dotenv').config();
const { REST, Routes } = require('discord.js');
const fs = require('fs');
const path = require('path');

const commands = [];
const commandsPath = path.join(__dirname, 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

// Gom tất cả các lệnh lại
for (const file of commandFiles) {
    const command = require(path.join(commandsPath, file));
    commands.push(command.data.toJSON());
}

const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

(async () => {
    try {
        console.log(`Đang nộp danh sách ${commands.length} lệnh lên Discord...`);
        // Đăng ký lệnh cho bot
        await rest.put(
            Routes.applicationCommands(process.env.CLIENT_ID),
            { body: commands },
        );
        console.log('✅ Nộp lệnh thành công! Lệnh đã sẵn sàng.');
    } catch (error) {
        console.error('Lỗi khi nộp lệnh:', error);
    }
})();