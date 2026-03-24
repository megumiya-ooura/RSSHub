const got = require('@/utils/got');
const cheerio = require('cheerio');
const timezone = require('@/utils/timezone');
const { parseDate } = require('@/utils/parse-date');

const baseUrl = 'https://forbesjapan.com';

function parseForbesDate(str) {
    if (!str || !str.trim()) return null;
    const normalized = str
        .trim()
        .replace(/\s+/g, ' ')
        .replace(/^(\d{4})\.(\d{1,2})\.(\d{1,2})\s+(\d{1,2}):(\d{2})$/, (_, y, m, d, h, min) => `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')} ${h.padStart(2, '0')}:${min}:00`);
    return timezone(parseDate(normalized), +9);
}

function scrapeCategory(html) {
    const $ = cheerio.load(html);
    return $('.articles-list__list .articles-list__item')
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
            return { title, link, pubDate, category, image: img || undefined };
        });
}

module.exports = async (ctx) => {
    const categories = (ctx.params.categories || '').split('+').filter(Boolean);
    if (categories.length === 0) {
        throw new Error('カテゴリを指定してください (例: /forbesjapan/category/technology_ai+business_marketing)');
    }

    const responses = await Promise.all(
        categories.map((cat) => got(`${baseUrl}/category/${cat}`))
    );

    const allItems = responses.flatMap((res) => scrapeCategory(res.data));

    // 重複除去（同じURLの記事が複数カテゴリに出る場合）
    const seen = new Set();
    const unique = allItems.filter((item) => {
        if (seen.has(item.link)) return false;
        seen.add(item.link);
        return true;
    });

    // 日付降順ソート
    unique.sort((a, b) => {
        const ta = a.pubDate ? new Date(a.pubDate).getTime() : 0;
        const tb = b.pubDate ? new Date(b.pubDate).getTime() : 0;
        return tb - ta;
    });

    const items = await Promise.all(
        unique.map((item) =>
            ctx.cache.tryGet(item.link, async () => {
                const res = await got(item.link);
                const $ = cheerio.load(res.data);

                const articleBody = $('.article-detail-txt.detail, .article-body, .article__body').first();
                if (articleBody.length) {
                    articleBody.find('script, style, .ad').remove();
                    item.description = articleBody.html();
                }

                const ogImage = $('meta[property="og:image"]').attr('content');
                if (ogImage && !item.image) item.image = ogImage;

                const metaPubDate = $('meta[property="article:published_time"]').attr('content');
                if (metaPubDate) item.pubDate = timezone(parseDate(metaPubDate), +9);

                return item;
            })
        )
    );

    const categoryLabel = categories.join(' + ');
    ctx.state.data = {
        title: `${categoryLabel} | Forbes JAPAN`,
        link: `${baseUrl}/category/${categories[0]}`,
        image: 'https://static.forbesjapan.com/asset/frontend/img/og_white.webp',
        item: items,
    };
};
