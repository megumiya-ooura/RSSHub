const got = require('@/utils/got');
const { parseDate } = require('@/utils/parse-date');

const baseUrl = 'https://liskul.com';

module.exports = async (ctx) => {
    const limit = Math.min(Number(ctx.query.limit) || 20, 100);

    const response = await got(`${baseUrl}/wp-json/wp/v2/posts`, {
        searchParams: {
            per_page: limit,
            _fields: 'id,title,link,date,content,excerpt,author',
        },
    });

    const items = response.data.map((post) => ({
        title: post.title.rendered,
        link: post.link,
        description: post.content.rendered,
        pubDate: parseDate(post.date),
        guid: `${baseUrl}/?p=${post.id}`,
    }));

    ctx.state.data = {
        title: 'LISKUL',
        link: baseUrl,
        description: 'LISKULは、中小・ベンチャー企業で働くWebマーケターに「より実践的なコンテンツ」を提供して支援するWebマーケティングメディアです。',
        language: 'ja',
        item: items,
    };
};
