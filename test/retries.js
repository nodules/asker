var Asker = require('../lib/asker'),
    ask = Asker,
    httpTest = require('./lib/http'),
    assert = require('chai').assert;

function filter(code) {
    return {
        /* jshint bitwise:false */
        accept : ~[200, 201].indexOf(code),
        isRetryAllowed : 400 > code || code > 499 || code === 404
    };
}

module.exports = {
    'retries => default => success 500-201' : httpTest(function(done, server) {

        server.addTest(function(req, res) {
            res.statusCode = 500;
            res.end();
        });

        server.addTest(function(req, res) {
            res.statusCode = 201;
            res.end();
        });

        ask({ port : server.port, maxRetries : 1 }, function(error, response) {
            assert.strictEqual(error, null, 'no errors');
            assert.strictEqual(response.meta.retries.used, 1, 'one retry was used');
            assert.strictEqual(response.meta.retries.limit, 1, 'retries limit is correct');

            done();
        });

    }),

    'retries => default => fail 500-500' : httpTest(function(done, server) {

        server.addTest(function(req, res) {
            res.statusCode = 500;
            res.end();
        });

        server.addTest(function(req, res) {
            res.statusCode = 500;
            res.end();
        });

        ask({ port : server.port, maxRetries : 1 }, function(error) {
            assert.strictEqual(error.code, 907, 'retries limit exceeded');

            done();
        });

    }),

    'retries => custom => success 404-201' : httpTest(function(done, server) {

        server.addTest(function(req, res) {
            res.statusCode = 404;
            res.end();
        });

        server.addTest(function(req, res) {
            res.statusCode = 201;
            res.end();
        });

        ask({ port : server.port, maxRetries : 1, statusFilter : filter }, function(error, response) {
            assert.strictEqual(error, null, 'no errors');
            assert.strictEqual(response.meta.retries.used, 1, 'one retry was used');
            assert.strictEqual(response.meta.retries.limit, 1, 'retries limit is correct');

            done();
        });

    }),

    'retries => custom => fail 404-404' : httpTest(function(done, server) {

        server.addTest(function(req, res) {
            res.statusCode = 404;
            res.end();
        });

        server.addTest(function(req, res) {
            res.statusCode = 404;
            res.end();
        });

        ask({ port : server.port, maxRetries : 1, statusFilter : filter }, function(error) {
            assert.strictEqual(error.code, 907, 'retries limit exceeded');

            done();
        });

    }),

    'retries => socket timeout => success' : httpTest(function(done, server) {

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

        ask({ port : server.port, maxRetries : 1, timeout : 50 }, function(error, response) {
            assert.strictEqual(error, null, 'no errors');
            assert.strictEqual(response.meta.retries.used, 1, 'one retry was used');
            assert.strictEqual(response.meta.retries.limit, 1, 'retries limit is correct');

            done();
        });

    }),

    'onretry callback must be called when retry has been commited' : httpTest(function(done, server) {
        var EXPECTED_RETRIES = 2,
            counter = 0,

            retriesHandler = function (reason, count) {
                assert.strictEqual(reason.code, Asker.Error.CODES.UNEXPECTED_STATUS_CODE,
                    'expected retry reason passed');

                assert.ok(count <= EXPECTED_RETRIES, 'expected retries count');

                counter++;
            },

            request = new Asker({ port : server.port, maxRetries : EXPECTED_RETRIES, onretry : retriesHandler },
                function(error, response) {
                    assert.strictEqual(error, null, 'request has been executed without errors');
                    assert.strictEqual(response.data, null, 'response is empty');
                    assert.strictEqual(counter, response.meta.retries.used,
                        'onretry callback was called for each used request attemt');

                    done();
                });

        assert.strictEqual(request._onretry, retriesHandler,
            'retries handler setup is done');

        server.addTest(function(req, res) {
            // instigate for the retry of request
            res.statusCode = 500;
            res.end();
        });

        server.addTest(function(req, res) {
            // instigate for the retry of request
            res.statusCode = 500;
            res.end();
        });

        server.addTest(function(req, res) {
            res.end();
        });

        request.execute();
    })
};
