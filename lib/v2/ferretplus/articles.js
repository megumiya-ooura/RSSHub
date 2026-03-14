const got = require('@/utils/got');
const cheerio = require('cheerio');
const timezone = require('@/utils/timezone');
const { parseDate } = require('@/utils/parse-date');

const baseUrl = 'https://ferret-plus.com';

module.exports = async (ctx) => {
    const url = `${baseUrl}/articles`;
    const response = await got(url);
    const $ = cheerio.load(response.data);

    const list = $('.article-cards-col-3 .article')
        .toArray()
        .map((item) => {
            const el = $(item);
            const titleLink = el.find('a.article-title').first();
            const href = titleLink.attr('href') || '';
            const link = href.startsWith('http') ? href : `${baseUrl}${href}`;
            const title = titleLink.text().trim();
            const category = el.find('a.article-top-category-name').first().text().trim();
            const img = el.find('.article-eyecatch img').attr('src');

            return {
                title,
                link,
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

                const jsonLd = $('script[type="application/ld+json"]').html();
                if (jsonLd) {
                    try {
                        const data = typeof jsonLd === 'string' ? JSON.parse(jsonLd) : jsonLd;
                        const article = Array.isArray(data) ? data.find((d) => d['@type'] === 'Article') : data['@type'] === 'Article' ? data : null;
                        if (article && article.datePublished) {
                            item.pubDate = timezone(parseDate(article.datePublished), +9);
                        }
                    } catch {
                        // ignore
                    }
                }
                if (!item.pubDate) {
                    const releasedAt = $('time.released-at').text().trim().replace(/公開日:\s*/, '');
                    if (releasedAt) {
                        const normalized = releasedAt.replace(/年/g, '-').replace(/月/g, '-').replace(/日/g, '');
                        item.pubDate = timezone(parseDate(normalized), +9);
                    }
                }

                const articleBody = $('.article-contents').first();
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
        title: '新着記事 | ferretメディア',
        link: url,
        image: 'https://ferret-plus.com/apple-touch-icon.png',
        item: items,
    };
};
