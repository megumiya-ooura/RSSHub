const got = require('@/utils/got');
const cheerio = require('cheerio');
const timezone = require('@/utils/timezone');
const { parseDate } = require('@/utils/parse-date');

const baseUrl = 'https://www.suzukikenichi.com/blog';

module.exports = async (ctx) => {
    const limit = Math.min(Number(ctx.query.limit) || 20, 50);

    // 複数ページから記事リストを収集
    const pages = Math.ceil(limit / 10);
    const requests = [];
    for (let i = 1; i <= pages; i++) {
        const url = i === 1 ? `${baseUrl}/` : `${baseUrl}/page/${i}/`;
        requests.push(got(url));
    }
    const responses = await Promise.all(requests);

    const allItems = [];
    for (const res of responses) {
        const $ = cheerio.load(res.data);
        $('.entry-list').each((_, el) => {
            const a = $(el).find('.entry-title a');
            const link = a.attr('href');
            const title = a.text().trim();
            const dateStr = $(el).find('.entry-date').text().trim();
            if (link && title) {
                allItems.push({ title, link, dateStr });
            }
        });
    }

    // 重複除去・件数制限
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

                const content = $('#entry-content');
                content.find('script, style, .ad, .related-entry').remove();

                const pubDateMeta = $('meta[property="article:published_time"]').attr('content');
                const pubDate = pubDateMeta
                    ? timezone(parseDate(pubDateMeta), +9)
                    : item.dateStr
                    ? timezone(parseDate(item.dateStr), +9)
                    : undefined;

                const author = $('meta[name="author"]').attr('content') || 'Kenichi Suzuki';
                const ogImage = $('meta[property="og:image"]').attr('content');

                return {
                    title: item.title,
                    link: item.link,
                    description: content.html() || '',
                    pubDate,
                    author,
                    image: ogImage,
                };
            })
        )
    );

    ctx.state.data = {
        title: '海外SEO情報ブログ',
        link: baseUrl,
        description: '海外発の検索エンジン最新情報を配信するSEOブログ',
        language: 'ja',
        item: items,
    };
};
