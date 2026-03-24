const got = require('@/utils/got');
const cheerio = require('cheerio');
const timezone = require('@/utils/timezone');
const { parseDate } = require('@/utils/parse-date');

const baseUrl = 'https://seojapan.com';
const listUrl = `${baseUrl}/column/blog/`;

module.exports = async (ctx) => {
    const limit = Math.min(Number(ctx.query.limit) || 20, 50);

    const pages = Math.ceil(limit / 12);
    const requests = [];
    for (let i = 1; i <= pages; i++) {
        const url = i === 1 ? listUrl : `${listUrl}page/${i}/`;
        requests.push(got(url));
    }
    const responses = await Promise.all(requests);

    const allItems = [];
    for (const res of responses) {
        const $ = cheerio.load(res.data);
        $('.p-media-item').each((_, el) => {
            const a = $(el).find('a.p-media-item__link');
            const link = a.attr('href');
            const title = a.find('.p-media-item__title').text().trim();
            const dateStr = a.find('.p-media-item__date').text().trim();
            const img = a.find('img').attr('src');
            if (link && title) {
                allItems.push({ title, link, dateStr, img });
            }
        });
    }

    const seen = new Set();
    const list = allItems.filter((item) => {
        if (seen.has(item.link)) return false;
        seen.add(item.link);
        return true;
    }).slice(0, limit);

    const items = await Promise.all(
        list.map((item) =>
            ctx.cache.tryGet(item.link, async () => {
                const res = await got(item.link);
                const $ = cheerio.load(res.data);

                const content = $('.p-media-detail__main');
                content.find('script, style, .guidance-box').remove();

                const dateText = $('.p-media-detail__meta .date').first().text().replace('公開日：', '').trim();
                const pubDate = dateText
                    ? timezone(parseDate(dateText), +9)
                    : item.dateStr
                    ? timezone(parseDate(item.dateStr), +9)
                    : undefined;

                return {
                    title: item.title,
                    link: item.link,
                    description: content.html() || '',
                    pubDate,
                    image: item.img,
                };
            })
        )
    );

    ctx.state.data = {
        title: 'ブログ | SEO Japan',
        link: listUrl,
        description: 'SEO Japanのブログ記事一覧',
        language: 'ja',
        item: items,
    };
};
