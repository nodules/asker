var http = require('http'),
    url = require('url'),
    extend = require('extend'),
    Asker = require('../lib/asker'),
    AdvancedAgent = require('../lib/advanced_agent'),
    assert = require('chai').assert;

function testRequestWithoutOptions(request) {
    assert.ok(request instanceof Asker, 'inheritance check');

    Object.keys(Asker.DEFAULT_OPTIONS).forEach(function(option) {
        assert.strictEqual(
            request.options[option],
            Asker.DEFAULT_OPTIONS[option],
            'option "' + option + '" value equal to default value');
    });

    assert.deepEqual(request.options.headers, { 'accept-encoding' : 'gzip, *' },
        'headers contains "accept-encoding" only by default');

    assert.strictEqual(typeof request._onretry, 'undefined',
        'retry callback is undefined by default');

    assert.strictEqual(request.statusCodeFilter, Asker.prototype.statusCodeFilter,
        'default status code filter');

    assert.strictEqual(request.options.method, 'GET',
        'default method is GET');

    assert.strictEqual(typeof request.options.body, 'undefined',
        'no request body by default');
}

module.exports = {
    'without arguments' : function() {
        var request = new Asker();

        testRequestWithoutOptions(request);

        assert.strictEqual(request.agent, http.globalAgent,
            'use http.globalAgent by default');

        assert.strictEqual(typeof request._callback, 'undefined',
            'main callback is undefined by default');
    },

    'minimal options' : function() {
        var callback = function() {},
            request = new Asker({}, callback);

        testRequestWithoutOptions(request);

        assert.strictEqual(request.agent, http.globalAgent,
            'use http.globalAgent by default');

        assert.strictEqual(request._callback, callback,
            'custom request callback');
    },

    'common options' : function() {
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

        assert.strictEqual(request.options.host, HOST,
            'host option setted properly');

        assert.strictEqual(request.options.port, PORT,
            'port option setted properly');

        assert.strictEqual(request.options.path, PATH,
            'path option setted properly');

        assert.deepEqual(
            request.options.headers,
            extend(true, {}, HEADERS, { 'accept-encoding' : 'gzip, *' }),
            'headers option setted properly');

        assert.strictEqual(request._onretry, onretry,
            '"onretry" callback setted properly');
    },

    'url option' : function() {
        var HOST = 'yandex.com',
            PORT = 8080,
            PATH = '/index.html',
            URL = 'http://' + HOST + ':' + PORT + PATH,

            requestHPP = new Asker({
                host : HOST,
                port : PORT,
                path : PATH
            }),

            requestUrl = new Asker({
                url : URL
            });

        assert.strictEqual(requestUrl.options.url, URL,
            '`url` option setted properly');

        delete requestUrl.options.url;

        assert.deepEqual(requestHPP.options, requestUrl.options,
            'options parsed from `url` and passed manually are equal');
    },

    'url without protocol' : function() {
        var HOST = 'yandex.com',
            PATH = '/index.html',

            requestHostPath = new Asker({
                host : HOST,
                path : PATH
            }),

            requestUrl = new Asker({
                url : HOST + PATH
            });

        delete requestUrl.options.url;

        assert.deepEqual(requestUrl.options, requestHostPath.options,
            'parsed from url and directly passed options are equal');
    },

    'query and path args merging' : function() {
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

        assert.deepEqual(
            url.parse(requestMergedPath.options.path, true).query,
            extend(true, {}, url.parse(PATH, true).query, QUERY),
            'path and query params merging without overriding');

        assert.deepEqual(
            url.parse(requestOverridenQuery.options.path, true).query,
            extend(true, {}, url.parse(PATH_2, true).query, QUERY),
            'path and query params merging WITH overriding existing path params');
    },

    // @todo issue #1
    'POST request body building' : function() {
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

        assert.strictEqual(requestQueryObject.options.body, JSON.stringify(QUERY_OBJECT),
            'object stringified for request body');

        assert.strictEqual(requestQueryString.options.body, QUERY_STRING,
            'set string body without modification');

        assert.strictEqual(
            requestQueryString.options.headers['content-length'],
            Buffer.byteLength(requestQueryString.options.body, 'utf8'),
            'content-length header set to calculated value');
    },

    'lowercase methods names' : function() {
        var request = new Asker({
                method : 'post',
                body : { test : 1 }
            });

        assert.strictEqual(typeof request.options.body, 'string',
            'request body processed as for POST, PUT, PATCH methods');
    },

    'allow gzip option and header set' : function() {
        var HEADERS = {
                'accept-encoding' : 'application/json'
            },

            request = new Asker({
                allowGzip : true,
                headers : HEADERS
            }),

            requestNoGzip = new Asker({
                allowGzip : false
            }),

            requestNoGzipWithHeaders = new Asker({
                allowGzip : false,
                headers : HEADERS
            });

        assert.strictEqual(
            request.options.headers['accept-encoding'],
            'gzip, ' + HEADERS['accept-encoding'],
            'add "gzip" to list of accepted encodings if gzip support enabled');

        assert.deepEqual(requestNoGzip.options.headers, {},
            'do not add "accept-encoding" header if no one presents and gzip support disabled');

        assert.deepEqual(requestNoGzipWithHeaders.options.headers, HEADERS,
            'do not add "gzip" to existing "accept-encoding" header if gzip support disabled');
    },

    'custom Agent' : function() {
        var agentName = 'test',
            request = new Asker({
                agent : {
                    name : agentName
                }
            });

        testRequestWithoutOptions(request);

        assert.notEqual(request.agent, http.globalAgent,
            'agent is not default http.globalAgent');

        assert.ok(request.agent instanceof AdvancedAgent,
            'using custom agent');

        assert.strictEqual(request.agent, Asker.agentsPool[agentName],
            'custom agent accessible in the agents pool by name');
    }
};
