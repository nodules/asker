var url = require('url'),
    assign = require('object-assign'),
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

    assert.deepEqual(request.options.headers, { 'accept-encoding': 'gzip, *' },
        'headers contains "accept-encoding" only by default');

    assert.strictEqual(request.statusCodeFilter, Asker.prototype.statusCodeFilter,
        'default status code filter');

    assert.strictEqual(request.options.method, 'GET',
        'default method is GET');

    assert.strictEqual(typeof request.options.body, 'undefined',
        'no request body by default');

    assert.strictEqual(request.options.hostname, request.options.host,
        'hostname option is same as host option');
}

module.exports = {
    'AskerError accessible via static field "Error"': function() {
        assert.strictEqual(typeof Asker.Error, 'function',
            'AskerError constructor is accessible via Request.Error field');
    },

    'without arguments': function() {
        var request = new Asker();

        testRequestWithoutOptions(request);

        assert.strictEqual(typeof request._callback, 'undefined',
            'main callback is undefined by default');
    },

    'minimal options': function() {
        var callback = function() {},
            request = new Asker({}, callback);

        testRequestWithoutOptions(request);

        assert.strictEqual(request._callback, callback,
            'custom request callback');
    },

    'common options': function() {
        var HOST = 'yandex.com',
            PORT = 8080,
            PATH = '/index.html',
            HEADERS = {
                'x-strange-header': 'hello'
            },
            request = new Asker({
                host: HOST,
                port: PORT,
                path: PATH,
                headers: HEADERS
            });

        assert.strictEqual(request.options.host, HOST,
            'host option setted properly');

        assert.strictEqual(request.options.hostname, HOST,
            'hostname option setted properly');

        assert.strictEqual(request.options.port, PORT,
            'port option setted properly');

        assert.strictEqual(request.options.path, PATH,
            'path option setted properly');

        assert.deepEqual(
            request.options.headers,
            assign(true, {}, HEADERS, { 'accept-encoding': 'gzip, *' }),
            'headers option setted properly');
    },

    'hostname option': function() {
        var HOSTNAME = 'yandex.com',
            HOST = 'none',
            PORT = 8080,
            PATH = '/',
            URL = 'http://' + HOSTNAME + ':' + PORT + PATH,

            request = new Asker({
                hostname: HOSTNAME,
                host: HOST,
                port: PORT,
                path: PATH
            });

        assert.strictEqual(request.options.host, HOST,
            '`host` option setted properly');

        assert.strictEqual(request.options.hostname, HOSTNAME,
            '`hostname` option setted properly');

        assert.strictEqual(request.getUrl(), URL,
            '`getUrl()` method uses `hostname` option');
    },

    'url option': function() {
        var HOST = 'yandex.com',
            PORT = 8080,
            PATH = '/index.html',
            URL = 'http://' + HOST + ':' + PORT + PATH,

            requestHPP = new Asker({
                host: HOST,
                port: PORT,
                path: PATH
            }),

            requestUrl = new Asker({
                url: URL
            });

        assert.strictEqual(requestUrl.options.url, URL,
            '`url` option setted properly');

        [ 'host', 'path', 'port', 'path' ].forEach(function(field) {
            assert.strictEqual(requestHPP.options[field], requestUrl.options[field],
                'options parsed from url and passed manually has the same `' + field + '` field');
        });
    },

    'url without protocol': function() {
        var HOST = 'yandex.com',
            PATH = '/index.html',

            requestHostPath = new Asker({
                host: HOST,
                path: PATH
            }),

            requestUrl = new Asker({
                url: HOST + PATH
            });

        [ 'host', 'path', 'port', 'path' ].forEach(function(field) {
            assert.strictEqual(requestUrl.options[field], requestHostPath.options[field],
                'parsed from url and directly passed options has the same `' + field + '` field');
        });
    },

    'default port for "http:" is 80': function() {
        var request = new Asker({ url: 'http://yandex.ru/' });

        assert.strictEqual(request.options.port, 80);
    },

    'default port for "https:" is 443': function() {
        var request = new Asker({ url: 'https://yandex.ru/' });

        assert.strictEqual(request.options.port, 443);
    },

    'query and path args merging': function() {
        var PATH = '/test?hello=1',
            PATH_2 = PATH + '&rainbow=bahamut',
            QUERY = {
                rainbow: 'unicorn',
                world: '2'
            },

            requestMergedPath = new Asker({
                path: PATH,
                query: QUERY
            }),

            requestOverridenQuery = new Asker({
                path: PATH_2,
                query: QUERY
            });

        assert.deepEqual(
            url.parse(requestMergedPath.options.path, true).query,
            assign(true, {}, url.parse(PATH, true).query, QUERY),
            'path and query params merging without overriding');

        assert.deepEqual(
            url.parse(requestOverridenQuery.options.path, true).query,
            assign(true, {}, url.parse(PATH_2, true).query, QUERY),
            'path and query params merging WITH overriding existing path params');
    },

    'request body building': function() {
        var QUERY_OBJECT = {
                world: '2',
                rainbow: 'unicorn'
            },

            QUERY_STRING = 'world=2&rainbow=unicorn',

            requestQueryObject = new Asker({
                body: QUERY_OBJECT,
                bodyEncoding: 'json'
            }),

            requestQueryString = new Asker({
                body: QUERY_STRING,
                bodyEncoding: 'string'
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

    'content-length is not calculated if passed in the options': function() {
        var CONTENT_LENGTH = 10,

            request = new Asker({
                headers: {
                    'content-length': CONTENT_LENGTH
                },
                body: '1234567'
            });

        assert.strictEqual(request.options.headers['content-length'], CONTENT_LENGTH,
            'content-length header contains passed value');

        assert.notStrictEqual(
            request.options.headers['content-length'],
            request.options.body.length,
            'content-length header value is not equal calculated value');
    },

    'lowercase methods names': function() {
        var request = new Asker({
            method: 'post',
            body: { test: 1 }
        });

        assert.instanceOf(request.options.body, Buffer,
            'request body buffer has been compiled');
    },

    'allow gzip option and header set': function() {
        var HEADERS = {
                'accept-encoding': 'application/json'
            },

            request = new Asker({
                allowGzip: true,
                headers: HEADERS
            }),

            requestNoGzip = new Asker({
                allowGzip: false
            }),

            requestNoGzipWithHeaders = new Asker({
                allowGzip: false,
                headers: HEADERS
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

    'allow gzip option and header accept-encoding passed with gzip': function() {
        var ACCEPT_ENCODING = 'gzip, application/json',

            request = new Asker({
                headers: {
                    'accept-encoding': ACCEPT_ENCODING
                }
            });

        assert.strictEqual(request.options.headers['accept-encoding'], ACCEPT_ENCODING,
            'do not add "gzip" to existing "accept-encoding" header if header already contains "gzip"');
    },

    'DEFAULT_OPTIONS should be accessible as property of Asker': function() {
        assert.strictEqual(typeof Asker.DEFAULT_OPTIONS, 'object',
            'DEFAULT_OPTIONS are accessible via Asker property');

        assert.deepEqual(
            Asker.DEFAULT_OPTIONS,
            {
                protocol: 'http:',
                host: 'localhost',
                path: '/',
                method: 'GET',
                bodyEncoding: 'string',
                maxRetries: 0,
                minRetriesTimeout: 300,
                maxRetriesTimeout: Infinity,
                isNetworkError: undefined,
                isRetryAllowed: undefined,
                queueTimeout: 50,
                timeout: 500,
                allowGzip: true,
                requestId: '',
                url: undefined,
                headers: undefined,
                query: undefined,
                body: undefined,
                agent: undefined,
                port: undefined
            },
            'DEFAULT_OPTIONS is ok');
    }
};
