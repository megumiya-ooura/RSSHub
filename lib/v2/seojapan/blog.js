const got = require('@/utils/got');
const cheerio = require('cheerio');
const timezone = require('@/utils/timezone');
const { parseDate } = require('@/utils/parse-date');

const baseUrl = 'https://seojapan.com';

/**
 * 「2026年02月20日」形式をパース
 */
function parseSeoJapanDate(str) {
    if (!str || !str.trim()) return null;
    const normalized = str
        .trim()
        .replace(/年/g, '-')
        .replace(/月/g, '-')
        .replace(/日/g, '');
    return timezone(parseDate(normalized), +9);
}

module.exports = async (ctx) => {
    const url = `${baseUrl}/column/blog/`;
    const response = await got(url);
    const $ = cheerio.load(response.data);

    const list = $('ul.p-media-list li.p-media-item')
        .toArray()
        .map((item) => {
            const el = $(item);
            const a = el.find('a.p-media-item__link').first();
            const href = a.attr('href') || '';
            const link = href.startsWith('http') ? href : `${baseUrl}${href}`;
            const title = el.find('p.p-media-item__title').text().trim();
            const dateStr = el.find('p.p-media-item__date').text().trim();
            const pubDate = parseSeoJapanDate(dateStr);
            const category = el.find('.p-media-item__cateItem').first().text().trim();
            const img = el.find('.p-media-item__img img').attr('src');

            return {
                title,
                link,
                pubDate,
                category: category || undefined,
                image: img || undefined,
            };
        })
        .filter((item) => item.title && item.link);

    const items = await Promise.all(
        list.map((item) =>
            ctx.cache.tryGet(item.link, async () => {
                const response = await got(item.link);
                const $ = cheerio.load(response.data);

                const ogImage = $('meta[property="og:image"]').attr('content');
                if (ogImage && !item.image) {
                    item.image = ogImage;
                }

                const metaPubDate = $('meta[property="article:published_time"]').attr('content');
                if (metaPubDate) {
                    item.pubDate = timezone(parseDate(metaPubDate), +9);
                }

                const articleBody = $('.post-content, .entry-content, [class*="article-body"], .c-entry__body').first();
                if (articleBody.length) {
                    articleBody.find('script, style, .ad').remove();
                    item.description = articleBody.html();
                }

                const metaDesc = $('meta[property="og:description"]').attr('content');
                if (metaDesc && !item.description) {
                    item.description = metaDesc;
                }

                return item;
            })
        )
    );

    ctx.state.data = {
        title: 'ブログ | SEO Japan',
        link: url,
        image: 'https://seojapan.com/wp-content/themes/seojapan/assets/img/common/ogp.jpg',
        item: items,
    };
};
