const got = require('@/utils/got');
const cheerio = require('cheerio');
const timezone = require('@/utils/timezone');
const { parseDate } = require('@/utils/parse-date');

const baseUrl = 'https://allabout.co.jp';

module.exports = async (ctx) => {
    const url = `${baseUrl}/r_finance/latest/`;
    const response = await got(url);
    const $ = cheerio.load(response.data);

    // マネー新着一覧のリストは ul[data-tracking-zone="modules-region-mainLatestContents-latest"] 配下
    const list = $('ul[data-tracking-zone="modules-region-mainLatestContents-latest"] li[data-tracking-zone="parts-common-listItemOfContent"]')
        .toArray()
        .map((item) => {
            const el = $(item);
            const a = el.find('a.css-1rojiv5').first();
            const href = a.attr('href') || '';
            const link = href.startsWith('http') ? href : `${baseUrl}${href}`;
            const title = el.find('p.title').text().trim();
            const description = el.find('p.css-8h56gk').text().trim();
            const dateText = el.find('time').text().trim().replace('更新日：', '').replace(/年|月/g, '-').replace('日', '');

            let pubDate;
            if (dateText) {
                try {
                    pubDate = timezone(parseDate(dateText), +9);
                } catch {
                    // ignore parse error
                }
            }

            return {
                title,
                link,
                description: description || undefined,
                pubDate,
            };
        })
        .filter((item) => item.title && item.link);

    const items = await Promise.all(
        list.map((item) =>
            ctx.cache.tryGet(item.link, async () => {
                const response = await got(item.link);
                const $ = cheerio.load(response.data);

                // メタ情報から画像と説明
                const ogImage = $('meta[property="og:image"]').attr('content');
                const metaDesc = $('meta[name="description"]').attr('content');
                if (ogImage) {
                    item.image = ogImage;
                }
                if (!item.description && metaDesc) {
                    item.description = metaDesc;
                }

                // 本文っぽいブロック（クラス名は変わる可能性があるのでゆるく指定）
                const articleBody = $('[class*="article"],[class*="Article"],[itemprop="articleBody"]').first();
                if (articleBody.length) {
                    articleBody.find('script, style, [class*="ad"], [id*="ad"]').remove();
                    item.description = articleBody.html();
                }

                // ページ内 JS から aa.v.article_pubdate が拾える場合
                const pageHtml = $.root().html();
                const m = pageHtml && pageHtml.match(/article_pubdate\s*=\s*'([^']+)'/);
                if (m && m[1]) {
                    try {
                        item.pubDate = timezone(parseDate(m[1]), +9);
                    } catch {
                        // ignore
                    }
                }

                return item;
            })
        )
    );

    ctx.state.data = {
        title: 'マネー 新着記事一覧 | All About',
        link: url,
        image: 'https://img.aacdn.jp/aa/common/ogp300_300.png',
        item: items,
    };
};
