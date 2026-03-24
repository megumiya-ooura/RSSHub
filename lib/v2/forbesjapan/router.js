module.exports = function (router) {
    router.get('/latest', require('./latest'));
    router.get('/category/:categories', require('./category'));
};
