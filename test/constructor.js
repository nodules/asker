var url = require('url'),
    extend = require('extend'),
    Asker = require('../lib/asker'),
    assert = require('chai').assert;

function testRequestWithoutOptions(request) {
    assert.ok(request instanceof Asker, 'inheritance check');

    Object.keys(Asker.DEFAULT_OPTIONS).forEach(function(option) {
        if (typeof Asker.DEFAULT_OPTIONS[option] === 'undefined') {
            return;
        }

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
    'AskerError accessible via static field "Error"' : function() {
        assert.strictEqual(typeof Asker.Error, 'function',
            'AskerError constructor is accessible via Request.Error field');
    },

    'without arguments' : function() {
        var request = new Asker();

        testRequestWithoutOptions(request);

        assert.strictEqual(typeof request._callback, 'undefined',
            'main callback is undefined by default');
    },

    'minimal options' : function() {
        var callback = function() {},
            request = new Asker({}, callback);

        testRequestWithoutOptions(request);

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

    'default port for "http:" is 80' : function() {
        var request = new Asker({ url : 'http://yandex.ru/' });

        assert.strictEqual(request.options.port, 80);
    },

    'default port for "https:" is 443' : function() {
        var request = new Asker({ url : 'https://yandex.ru/' });

        assert.strictEqual(request.options.port, 443);
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

    'request body building' : function() {
        var QUERY_OBJECT = {
                world : '2',
                rainbow : 'unicorn'
            },

            QUERY_STRING = 'world=2&rainbow=unicorn',

            requestQueryObject = new Asker({
                body : QUERY_OBJECT,
                bodyEncoding : 'json'
            }),

            requestQueryString = new Asker({
                body : QUERY_STRING,
                bodyEncoding : 'string'
            });

        assert.deepEqual(requestQueryObject.options.body, new Buffer(JSON.stringify(QUERY_OBJECT), 'utf8'),
            'object stringified for request body');

        assert.deepEqual(requestQueryString.options.body, new Buffer(QUERY_STRING, 'utf8'),
            'set string body without modification');

        assert.strictEqual(
            requestQueryString.options.headers['content-length'],
            requestQueryString.options.body.length,
            'content-length header set to calculated value');
    },

    'content-length is not calculated if passed in the options' : function() {
        var CONTENT_LENGTH = 10,

            request = new Asker({
                headers : {
                    'content-length' : CONTENT_LENGTH
                },
                body : '1234567'
            });

        assert.strictEqual(request.options.headers['content-length'], CONTENT_LENGTH,
            'content-length header contains passed value');

        assert.notStrictEqual(
            request.options.headers['content-length'],
            request.options.body.length,
            'content-length header value is not equal calculated value');
    },

    'lowercase methods names' : function() {
        var request = new Asker({
                method : 'post',
                body : { test : 1 }
            });

        assert.instanceOf(request.options.body, Buffer,
            'request body buffer has been compiled');
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

    'allow gzip option and header accept-encoding passed with gzip' : function() {
        var ACCEPT_ENCODING = 'gzip, application/json',

            request = new Asker({
                headers : {
                    'accept-encoding' : ACCEPT_ENCODING
                }
            });

        assert.strictEqual(request.options.headers['accept-encoding'], ACCEPT_ENCODING,
            'do not add "gzip" to existing "accept-encoding" header if header already contains "gzip"');
    },

    'calculating queueTimeout if was not passed to constructor' : function() {
        var request = new Asker();

        assert.strictEqual(
            request.options.queueTimeout,
            request.options.timeout + request.QUEUE_TIMEOUT_DELTA,
            'queueTimeout evaluated as timeout + QUEUE_TIMEOUT_DELTA');
    },

    'QUEUE_TIMEOUT_DELTA redifinition' : function() {
        var request1 = new Asker(),
            request2,
            NEW_DELTA = 100,
            DELTA_DIFF = 100 - Asker.prototype.QUEUE_TIMEOUT_DELTA;

        Asker.prototype.QUEUE_TIMEOUT_DELTA = NEW_DELTA;

        request2 = new Asker();

        assert.strictEqual(request2.options.queueTimeout - request1.options.queueTimeout, DELTA_DIFF,
            'QUEUE_TIMEOUT_DELTA change is ok');
    },

    'DEFAULT_OPTIONS should be accessible as property of Asker' : function() {
        assert.strictEqual(typeof Asker.DEFAULT_OPTIONS, 'object',
            'DEFAULT_OPTIONS is accessible via Asker property');

        assert.deepEqual(
            Asker.DEFAULT_OPTIONS,
            {
                protocol : 'http:',
                host : 'localhost',
                path : '/',
                method : 'GET',
                bodyEncoding : 'string',
                maxRetries : 0,
                timeout : 500,
                allowGzip : true,
                requestId : '',
                url : undefined,
                headers : undefined,
                query : undefined,
                body : undefined,
                onretry : undefined,
                statusFilter : undefined,
                queueTimeout : undefined,
                agent : undefined
            },
            'DEFAULT_OPTIONS is ok');
    }
};
