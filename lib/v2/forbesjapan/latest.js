const got = require('@/utils/got');
const cheerio = require('cheerio');
const timezone = require('@/utils/timezone');
const { parseDate } = require('@/utils/parse-date');

const baseUrl = 'https://forbesjapan.com';

/**
 * Forbes JAPAN の日付表記 "YYYY.M.D H:mm" をパース
 */
function parseForbesDate(str) {
    if (!str || !str.trim()) return null;
    const normalized = str
        .trim()
        .replace(/\s+/g, ' ')
        .replace(/^(\d{4})\.(\d{1,2})\.(\d{1,2})\s+(\d{1,2}):(\d{2})$/, (_, y, m, d, h, min) => `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')} ${h.padStart(2, '0')}:${min}:00`);
    return timezone(parseDate(normalized), +9);
}

module.exports = async (ctx) => {
    const url = `${baseUrl}/articles/latest`;
    const response = await got(url);
    const $ = cheerio.load(response.data);

    const list = $('.articles-list__list .articles-list__item')
        .toArray()
        .map((item) => {
            const el = $(item);
            const a = el.find('a').first();
            const href = a.attr('href') || '';
            const link = href.startsWith('http') ? href : `${baseUrl}${href}`;
            const title = el.find('.tit').text().trim();
            const dateStr = el.find('.meta .date').text().trim();
            const pubDate = parseForbesDate(dateStr);
            const img = el.find('.img-wrap img').attr('src');
            const category = el.find('.meta .cate').text().trim();

            return {
                title,
                link,
                pubDate,
                category,
                image: img || undefined,
            };
        });

    const items = await Promise.all(
        list.map((item) =>
            ctx.cache.tryGet(item.link, async () => {
                const response = await got(item.link);
                const $ = cheerio.load(response.data);

                const articleBody = $('.article-detail-txt.detail, .article-body, .article__body').first();
                if (articleBody.length) {
                    articleBody.find('script, style, .ad').remove();
                    item.description = articleBody.html();
                }

                const ogImage = $('meta[property="og:image"]').attr('content');
                if (ogImage && !item.image) {
                    item.image = ogImage;
                }

                const metaPubDate = $('meta[property="article:published_time"]').attr('content');
                if (metaPubDate) {
                    item.pubDate = timezone(parseDate(metaPubDate), +9);
                }

                return item;
            })
        )
    );

    ctx.state.data = {
        title: '新着記事 | Forbes JAPAN',
        link: url,
        image: 'https://static.forbesjapan.com/asset/frontend/img/og_white.webp',
        item: items,
    };
};
