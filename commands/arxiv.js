const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { parseStringPromise } = require('xml2js');

// ─── /arxiv — Tìm bài báo mới trên arXiv ────────────────────
// Dùng arXiv API công khai (export.arxiv.org/api/query), không cần key

module.exports = {
    data: new SlashCommandBuilder()
        .setName('arxiv')
        .setDescription('Tìm bài báo mới trên arXiv theo từ khoá nghiên cứu')
        .addStringOption(o =>
            o.setName('tu_khoa').setDescription('Từ khoá tìm kiếm').setRequired(true))
        .addIntegerOption(o =>
            o.setName('so_luong').setDescription('Số bài hiển thị (mặc định 5, tối đa 10)')
                .setRequired(false).setMinValue(1).setMaxValue(10)),

    async execute(interaction) {
        await interaction.deferReply();

        try {
            const query = interaction.options.getString('tu_khoa');
            const maxResults = interaction.options.getInteger('so_luong') || 5;

            // Gọi arXiv API
            const apiUrl = `https://export.arxiv.org/api/query?${new URLSearchParams({
                search_query: `all:${query}`,
                start: '0',
                max_results: String(maxResults),
                sortBy: 'submittedDate',
                sortOrder: 'descending',
            })}`;

            const res = await fetch(apiUrl, { signal: AbortSignal.timeout(15000) });
            if (!res.ok) throw new Error(`arXiv API trả về HTTP ${res.status}`);

            const xml = await res.text();
            const parsed = await parseStringPromise(xml, { explicitArray: false });
            const feed = parsed.feed;

            // Kiểm tra có kết quả không
            const totalResults = parseInt(feed['opensearch:totalResults']?._ || feed['opensearch:totalResults'] || '0');
            if (!totalResults || !feed.entry) {
                return interaction.editReply(`❌ Không tìm thấy bài báo nào cho từ khoá \`${query}\`.`);
            }

            // Đảm bảo entries luôn là array
            const entries = Array.isArray(feed.entry) ? feed.entry : [feed.entry];

            const lines = entries.map((e, i) => {
                const title = (e.title || 'Không có tiêu đề').replace(/\s+/g, ' ').trim();
                // Lấy link PDF
                const links = Array.isArray(e.link) ? e.link : [e.link];
                const pdfLink = links.find(l => l?.$?.title === 'pdf')?.$?.href;
                const absLink = links.find(l => l?.$?.rel === 'alternate')?.$?.href || e.id;
                // Tác giả
                const authors = Array.isArray(e.author)
                    ? e.author.map(a => a.name).slice(0, 3).join(', ') + (e.author.length > 3 ? ' et al.' : '')
                    : e.author?.name || 'Unknown';
                // Ngày
                const published = e.published ? e.published.slice(0, 10) : '';

                return `**${i + 1}. [${title}](${absLink})**\n✍️ ${authors} • 📅 ${published}${pdfLink ? ` • [PDF](${pdfLink})` : ''}`;
            });

            const embed = new EmbedBuilder()
                .setColor(0xB31B1B) // Đỏ arXiv
                .setTitle(`🔬 arXiv: "${query}"`)
                .setDescription(lines.join('\n\n'))
                .setFooter({ text: `${totalResults} kết quả • Hiển thị ${entries.length} bài mới nhất` })
                .setTimestamp();

            await interaction.editReply({ embeds: [embed] });
        } catch (error) {
            console.error('[arxiv.js ERROR]', error);
            await interaction.editReply(`❌ Lỗi khi tìm trên arXiv: ${error.message}`);
        }
    },
};
