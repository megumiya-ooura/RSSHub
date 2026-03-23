const got = require('@/utils/got');
const cheerio = require('cheerio');
const { parseDate } = require('@/utils/parse-date');
const timezone = require('@/utils/timezone');

module.exports = async (ctx) => {
    const baseUrl = 'https://www.snrec.jp';
    const url = `${baseUrl}/archive`;

    const response = await got(url);
    const $ = cheerio.load(response.data);

    const item = $('section.archive-entry')
        .map((_, el) => {
            const titleEl = $(el).find('a.entry-title-link');
            const title = titleEl.text().trim();
            const link = titleEl.attr('href');
            const dateStr = $(el).find('time').attr('datetime');
            const pubDate = dateStr ? timezone(parseDate(dateStr), +9) : undefined;
            const description = $(el).find('p.entry-description').text().trim();

            return {
                title,
                link,
                pubDate,
                description,
            };
        })
        .get();

    ctx.state.data = {
        title: 'サウンド＆レコーディングマガジン アーカイブ',
        link: url,
        description: 'サウンド＆レコーディングマガジン（snrec.jp）の最新記事',
        language: 'ja',
        item,
    };
};
