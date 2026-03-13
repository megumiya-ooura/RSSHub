module.exports = {
    'allabout.co.jp': {
        _name: 'All About マネー',
        '.': [
            {
                title: 'マネー 新着記事一覧',
                docs: 'https://docs.rsshub.app/routes/traditional-media#all-about-money',
                source: ['/r_finance/latest/', '/r_finance/latest/:page'],
                target: '/allabout/finance/latest',
            },
        ],
    },
};
