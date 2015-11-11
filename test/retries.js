var Asker = require('../lib/asker'),
    ask = Asker,
    httpTest = require('./lib/http'),
    assert = require('chai').assert;

function isNetworkError(code) {
    return [ 200, 201 ].indexOf(code) === -1;
}

function isRetryAllowed(error) {
    if (error.code === Asker.Error.CODES.UNEXPECTED_STATUS_CODE) {
        return error.data.statusCode === 404;
    }
    return true;
}

module.exports = {
    'retries => default => success 500-201': httpTest(function(done, server) {

        server.addTest(function(req, res) {
            res.statusCode = 500;
            res.end();
        });

        server.addTest(function(req, res) {
            res.statusCode = 201;
            res.end();
        });

        ask({ port: server.port, maxRetries: 1 }, function(error, response) {
            assert.strictEqual(error, null, 'no errors');
            assert.strictEqual(response.meta.retries.used, 1, 'one retry was used');
            assert.strictEqual(response.meta.retries.limit, 1, 'retries limit is correct');

            done();
        });

    }),

    'retries => default => fail 500-500': httpTest(function(done, server) {
        var requestId = 'test';

        server.addTest(function(req, res) {
            res.statusCode = 500;
            res.end();
        });

        server.addTest(function(req, res) {
            res.statusCode = 500;
            res.end();
        });

        ask({ port: server.port, maxRetries: 1, requestId: requestId }, function(error) {
            assert.strictEqual(error.code, Asker.Error.CODES.RETRIES_LIMIT_EXCEEDED, 'retries limit exceeded');

            assert.ok(
                (new RegExp(
                    'Retries limit {LIMIT:1} exceeded for request ' +
                    requestId +
                    ' in \\d+~\\d+ ms http://localhost:' +
                    server.port +
                    '/'
                )).test(error.message),
                'error message fulfilled');

            done();
        });

    }),

    'retries => custom => success 404-201': httpTest(function(done, server) {
        server.addTest(function(req, res) {
            res.statusCode = 404;
            res.end();
        });

        server.addTest(function(req, res) {
            res.statusCode = 201;
            res.end();
        });

        var opts = {
            port: server.port,
            maxRetries: 1,
            isNetworkError: isNetworkError,
            isRetryAllowed: isRetryAllowed
        };

        ask(opts, function(error, response) {
            assert.strictEqual(error, null, 'no errors');
            assert.strictEqual(response.meta.retries.used, 1, 'one retry was used');
            assert.strictEqual(response.meta.retries.limit, 1, 'retries limit is correct');

            done();
        });
    }),

    'retries => custom => fail 404-404': httpTest(function(done, server) {
        server.addTest(function(req, res) {
            res.statusCode = 404;
            res.end();
        });

        server.addTest(function(req, res) {
            res.statusCode = 404;
            res.end();
        });

        var opts = {
            port: server.port,
            maxRetries: 1,
            isNetworkError: isNetworkError,
            isRetryAllowed: isRetryAllowed
        };

        ask(opts, function(error) {
            assert.strictEqual(error.code, Asker.Error.CODES.RETRIES_LIMIT_EXCEEDED, 'retries limit exceeded');

            done();
        });
    }),

    'retries => socket timeout => success': httpTest(function(done, server) {
        server.addTest(function(req, res) {
            setTimeout(function() {
                res.statusCode = 201;
                res.end();
            }, 200);
        });

        server.addTest(function(req, res) {
            res.statusCode = 201;
            res.end();
        });

        ask({
            port: server.port,
            maxRetries: 1,
            timeout: 50,
            isRetryAllowed: isRetryAllowed
        }, function(error, response) {
            assert.strictEqual(error, null, 'no errors');
            assert.strictEqual(response.meta.retries.used, 1, 'one retry was used');
            assert.strictEqual(response.meta.retries.limit, 1, 'retries limit is correct');

            done();
        });

    })
};
