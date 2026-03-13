module.exports = function (router) {
    router.get('/finance/latest', require('./finance-latest'));
};
