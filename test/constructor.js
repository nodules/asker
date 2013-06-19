var http = require('http'),
    url = require('url'),
    extend = require('extend'),
    Asker = require('../lib/asker'),
    AdvancedAgent = require('../lib/advanced_agent');

function testRequestWithoutOptions(request, test) {
    test.ok(request instanceof Asker, 'inheritance check');

    Object.keys(Asker.DEFAULT_OPTIONS).forEach(function(option) {
        test.strictEqual(
            request.options[option],
            Asker.DEFAULT_OPTIONS[option],
            'option "' + option + '" value equal to default value');
    });

    test.deepEqual(request.options.headers, { 'accept-encoding' : 'gzip, *' },
        'headers contains "accept-encoding" only by default');

    test.strictEqual(typeof request._onretry, 'undefined',
        'retry callback is undefined by default');

    test.strictEqual(request.statusCodeFilter, Asker.prototype.statusCodeFilter,
        'default status code filter');

    test.strictEqual(request.options.method, 'GET',
        'default method is GET');

    test.strictEqual(typeof request.options.body, 'undefined',
        'no request body by default');
}

module.exports = {
    'without arguments' : function(test) {
        var request = new Asker();

        testRequestWithoutOptions(request, test);

        test.strictEqual(request.agent, http.globalAgent,
            'use http.globalAgent by default');

        test.strictEqual(typeof request._callback, 'undefined',
            'main callback is undefined by default');

        test.done();
    },

    'minimal options' : function(test) {
        var callback = function() {},
            request = new Asker({}, callback);

        testRequestWithoutOptions(request, test);

        test.strictEqual(request.agent, http.globalAgent,
            'use http.globalAgent by default');

        test.strictEqual(request._callback, callback,
            'custom request callback');

        test.done();
    },

    'common options' : function(test) {
        var HOST = 'yandex.com',
            PORT = 8080,
            PATH = '/index.html',
            HEADERS = {
                'x-strange-header' : 'hello'
            },
            onretry = function() {},

            request = new Asker({
                host : HOST,
                port : PORT,
                path : PATH,
                headers : HEADERS,
                onretry : onretry
            });

        test.strictEqual(request.options.host, HOST,
            'host option setted properly');

        test.strictEqual(request.options.port, PORT,
            'port option setted properly');

        test.strictEqual(request.options.path, PATH,
            'path option setted properly');

        test.deepEqual(
            request.options.headers,
            extend(true, {}, HEADERS, { 'accept-encoding' : 'gzip, *' }),
            'headers option setted properly');

        test.strictEqual(request._onretry, onretry,
            '"onretry" callback setted properly');

        test.done();
    },

    'url option' : function(test) {
        var HOST = 'yandex.com',
            PORT = 8080,
            PATH = '/index.html',
            // @todo parsing without protocol #7
            URL = 'http://' + HOST + ':' + PORT + PATH,

            requestHPP = new Asker({
                host : HOST,
                port : PORT,
                path : PATH
            }),

            requestUrl = new Asker({
                url : URL
            });

        test.strictEqual(requestUrl.options.url, URL,
            '`url` option setted properly');

        delete requestUrl.options.url;

        test.deepEqual(requestHPP.options, requestUrl.options,
            'options parsed from `url` and passed manually are equal');

        test.done();
    },

    'query and path args merging' : function(test) {
        var PATH = '/test?hello=1',
            PATH_2 = PATH + '&rainbow=bahamut',
            QUERY = {
                rainbow : 'unicorn',
                world : '2'
            },

            requestMergedPath = new Asker({
                path : PATH,
                query : QUERY
            }),

            requestOverridenQuery = new Asker({
                path : PATH_2,
                query : QUERY
            });

        test.deepEqual(
            url.parse(requestMergedPath.options.path, true).query,
            extend(true, {}, url.parse(PATH, true).query, QUERY),
            'path and query params merging without overriding');

        test.deepEqual(
            url.parse(requestOverridenQuery.options.path, true).query,
            extend(true, {}, url.parse(PATH_2, true).query, QUERY),
            'path and query params mreging WITH overriding existing path params');

        test.done();
    },

    // @todo issue #1
    'POST request body building' : function(test) {
        var QUERY_OBJECT = {
                world : '2',
                rainbow : 'unicorn'
            },

            QUERY_STRING = 'world=2&rainbow=unicorn',

            requestQueryObject = new Asker({
                method : 'POST',
                body : QUERY_OBJECT
            }),

            requestQueryString = new Asker({
                method : 'POST',
                body : QUERY_STRING
            });

        test.strictEqual(requestQueryObject.options.body, JSON.stringify(QUERY_OBJECT),
            'object stringified for request body');

        test.strictEqual(requestQueryString.options.body, QUERY_STRING,
            'set string body without modification');

        test.strictEqual(
            requestQueryString.options.headers['content-length'],
            Buffer.byteLength(requestQueryString.options.body, 'utf8'),
            'content-length header set to calculated value');

        test.done();
    },

    /*
    // @todo failed now, issue #8
    'lowercase methods names' : function(test) {
        var request = new Asker({
                method : 'post',
                body : { test : 1 }
            });

        test.strictEqual(typeof request.options.body, 'string',
            'request body processed as for POST, PUT, PATCH methods');

        test.done();
    },
    */

    'allow gzip option and header set' : function(test) {
        var request = new Asker({
                allowGzip : true,
                headers : {
                    'accept-encoding' : 'application/json'
                }
            });

        test.strictEqual(request.options.headers['accept-encoding'], 'gzip, application/json',
            'add "gzip" to list of accepted encodings if gzip support enabled');

        test.done();
    },

    'custom Agent' : function(test) {
        var agentName = 'test',
            request = new Asker({
                agent : {
                    name : agentName
                }
            });

        testRequestWithoutOptions(request, test);

        test.notEqual(request.agent, http.globalAgent,
            'agent is not default http.globalAgent');

        test.ok(request.agent instanceof AdvancedAgent,
            'using custom agent');

        test.strictEqual(request.agent, Asker.agentsPool[agentName],
            'custom agent accessible in the agents pool by name');

        test.done();
    }
};
