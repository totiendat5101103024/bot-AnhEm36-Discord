const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

// ─── Cấu hình Zotero (đọc từ .env) ─────────────────────────────
// ZOTERO_API_KEY   : API key tạo tại https://www.zotero.org/settings/keys
// ZOTERO_LIBRARY_ID: User ID hoặc Group ID (xem trong link thư viện / trang settings/keys)
// ZOTERO_LIBRARY_TYPE: "user" hoặc "group"
// ─────────────────────────────────────────────────────────────
const API_KEY = process.env.ZOTERO_API_KEY;
const LIBRARY_ID = process.env.ZOTERO_LIBRARY_ID;
const LIBRARY_TYPE = process.env.ZOTERO_LIBRARY_TYPE || 'user'; // "user" | "group"

function formatCreators(creators) {
    if (!creators?.length) return 'Không rõ tác giả';
    return creators
        .map(c => c.name || `${c.firstName ?? ''} ${c.lastName ?? ''}`.trim())
        .filter(Boolean)
        .join(', ');
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('zotero')
        .setDescription('Xem hoặc tìm tài liệu trong thư viện Zotero của nhóm')
        .addStringOption(option =>
            option.setName('tim')
                .setDescription('Từ khoá tìm kiếm (bỏ trống để xem tài liệu mới thêm gần đây)')
                .setRequired(false)),

    async execute(interaction) {
        if (!API_KEY || !LIBRARY_ID) {
            return interaction.reply({
                content: '❌ Bot chưa được cấu hình Zotero! Cần thêm `ZOTERO_API_KEY` và `ZOTERO_LIBRARY_ID` vào file `.env`.',
                ephemeral: true,
            });
        }

        await interaction.deferReply();

        const tuKhoa = interaction.options.getString('tim');
        // /items/top: chỉ lấy item cấp cao nhất (paper thật), tự động bỏ qua
        // attachment/note con nằm bên trong item khác (VD: ảnh chụp màn hình đính trong note)
        const base = `https://api.zotero.org/${LIBRARY_TYPE}s/${LIBRARY_ID}/items/top`;
        const params = new URLSearchParams({
            key: API_KEY,
            limit: '8',
            sort: tuKhoa ? 'relevance' : 'dateAdded',
            direction: 'desc',
        });
        if (tuKhoa) {
            params.set('q', tuKhoa);
            params.set('qmode', 'everything');
        }

        try {
            const res = await fetch(`${base}?${params.toString()}`, {
                headers: { 'Zotero-API-Version': '3' },
                signal: AbortSignal.timeout(10000),
            });
            if (!res.ok) throw new Error(`Zotero API trả về HTTP ${res.status}`);

            const items = (await res.json())
                // Bỏ attachment/note, chỉ giữ tài liệu thật (bài báo, sách, v.v.)
                .filter(it => !['attachment', 'note'].includes(it.data.itemType));

            if (!items.length) {
                return interaction.editReply(tuKhoa
                    ? `❌ Không tìm thấy tài liệu nào khớp với \`${tuKhoa}\`.`
                    : '❌ Thư viện Zotero hiện chưa có tài liệu nào.');
            }

            const embed = new EmbedBuilder()
                .setColor(0xCC2936) // Đỏ Zotero
                .setTitle(tuKhoa ? `🔍 Kết quả tìm kiếm: "${tuKhoa}"` : '📚 Tài liệu mới nhất trong thư viện')
                .setDescription(
                    items.map(it => {
                        const d = it.data;
                        const link = d.url || it.links?.alternate?.href || `https://www.zotero.org/${LIBRARY_TYPE}s/${LIBRARY_ID}/items/${it.key}`;
                        const year = d.date ? ` (${d.date.slice(0, 4)})` : '';
                        return `**[${d.title || 'Không có tiêu đề'}](${link})**${year}\n✍️ ${formatCreators(d.creators)}`;
                    }).join('\n\n')
                )
                .setFooter({ text: `Thư viện Zotero • ${items.length} tài liệu` })
                .setTimestamp();

            await interaction.editReply({ embeds: [embed] });
        } catch (error) {
            console.error('[zotero.js ERROR]', error);
            await interaction.editReply(`❌ Lỗi khi lấy dữ liệu từ Zotero: ${error.message}`);
        }
    },
};