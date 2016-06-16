/**
 * Main controller for Ghost frontend
 */

/*global require, module */

var api         = require('../../api'),
    config      = require('../../config'),
    filters     = require('../../filters'),
    templates   = require('./templates'),
    handleError = require('./error'),
    formatResponse = require('./format-response'),
    postLookup     = require('./post-lookup'),
    setResponseContext = require('./context'),
    setRequestIsSecure = require('./secure'),
    TelegramBot = require('node-telegram-bot-api'),

    frontendControllers;

var bot = new TelegramBot(process.env.TELEGRAM_TOKEN);

/*
* Sets the response context around a post and renders it
* with the current theme's post view. Used by post preview
* and single post methods.
* Returns a function that takes the post to be rendered.
*/
function renderPost(req, res) {
    return function renderPost(post) {
        var view = templates.single(req.app.get('activeTheme'), post),
            response = formatResponse.single(post);

        setResponseContext(req, res, response);
        res.render(view, response);
    };
}

frontendControllers = {
    preview: function preview(req, res, next) {
        var params = {
                uuid: req.params.uuid,
                status: 'all',
                include: 'author,tags'
            };

        api.posts.read(params).then(function then(result) {
            var post = result.posts[0];

            if (!post) {
                return next();
            }

            if (post.status === 'published') {
                return res.redirect(301, config.urlFor('post', {post: post}));
            }

            setRequestIsSecure(req, post);

            filters.doFilter('prePostsRender', post, res.locals)
                .then(renderPost(req, res));
        }).catch(handleError(next));
    },
    single: function single(req, res, next) {
        // Query database to find post
        return postLookup(req.path).then(function then(lookup) {
            var post = lookup ? lookup.post : false;

            if (!post) {
                return next();
            }

            // CASE: we only support /:slug format for pages
            if (post.page && post.url !== req.path) {
                return next();
            }

            // CASE: last param is of url is /edit, redirect to admin
            if (lookup.isEditURL) {
                return res.redirect(config.paths.subdir + '/ghost/editor/' + post.id + '/');
            }

            // CASE: permalink is not valid anymore, we redirect him permanently to the correct one
            if (post.url !== req.path) {
                return res.redirect(301, post.url);
            }

            setRequestIsSecure(req, post);

            filters.doFilter('prePostsRender', post, res.locals)
                .then(renderPost(req, res));
        }).catch(handleError(next));
    },
    telegram: function telegram(req, res, next) {
        response = req.body;
        var response_keys = Object.getOwnPropertyNames(response);
        var proceedable_data = ["name", "email", "message"].every(function(val) { return response_keys.indexOf(val) >= 0 });
        if (proceedable_data) {
            var name = response["name"],
                email = response["email"],
                message = response["message"]
            var telegram_message = `Name: ${name}\nEmail: ${email}\nMessage: ${message}`;
            bot.sendMessage(process.env.TELEGRAM_CHAT_ID, telegram_message);
            return res.json({"response": "OK", "result": "success",});
        } else {
            return res.json({"response": "Do not mess with data, please", "result": "error"});
        }

    }
};

module.exports = frontendControllers;
