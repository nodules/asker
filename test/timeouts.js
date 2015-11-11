var Asker = require('../lib/asker'),
    ask = Asker,
    httpTest = require('./lib/http'),
    assert = require('chai').assert;

module.exports = {
    'socket timeout => default': httpTest(function(done, server) {

        server.addTest(function(req, res) {
            setTimeout(function() {
                res.statusCode = 201;
                res.end();
            }, 1000);
        });

        ask({ port: server.port }, function(error) {
            assert.strictEqual(error.code, Asker.Error.CODES.SOCKET_TIMEOUT, 'socket timeout');

            done();
        });

    }),

    'socket timeout => custom': httpTest(function(done, server) {

        server.addTest(function(req, res) {
            setTimeout(function() {
                res.statusCode = 201;
                res.end();
            }, 200);
        });

        ask({ port: server.port, timeout: 100 }, function(error) {
            assert.strictEqual(error.code, Asker.Error.CODES.SOCKET_TIMEOUT, 'socket timeout');

            done();
        });

    }),

    'queue timeout => default': httpTest(function(done, server) {

        server.addTest(function(req, res) {
            setTimeout(function() {
                res.statusCode = 201;
                res.end();
            }, 400);
        });

        server.addTest(function(req, res) {
            setTimeout(function() {
                res.statusCode = 201;
                res.end();
            }, 400);
        });

        var agent = {
            name: 'faulty',
            maxSockets: 1
        };

        ask({
            port: server.port,
            agent: agent
        },
        function(error) {
            assert.strictEqual(error, null, 'no errors for first request');
        });

        setTimeout(function() {
            ask({
                port: server.port,
                agent: agent
            },
            function(error) {
                assert.strictEqual(error.code, Asker.Error.CODES.QUEUE_TIMEOUT, 'queue timeout');

                done();
            });
        }, 100);

    }),

    'queue timeout => custom': httpTest(function(done, server) {

        server.addTest(function(req, res) {
            setTimeout(function() {
                res.statusCode = 201;
                res.end();
            }, 400);
        });

        server.addTest(function(req, res) {
            setTimeout(function() {
                res.statusCode = 201;
                res.end();
            }, 400);
        });

        var agent = {
            name: 'faulty',
            maxSockets: 1
        };

        ask({
            port: server.port,
            agent: agent
        },
        function(error) {
            assert.strictEqual(error, null, 'no errors for first request');
        });

        setTimeout(function() {
            ask({
                port: server.port,
                queueTimeout: 1000,
                agent: agent
            },
            function(error) {
                assert.strictEqual(error, null, 'still no errors');

                done();
            });
        }, 100);

    }),

    'socket timeout must works correctly for chunked response (must not flash timeouts on first chunk)': httpTest(function(done, server) { // jscs: disable maximumLineLength
        server.addTest(function(req, res) {
            res.write('chunk1');

            setTimeout(function() {
                res.end('chunk2');
            }, 300);
        });

        ask({ port: server.port, timeout: 100 }, function(error, response) {
            assert.strictEqual(error.code, Asker.Error.CODES.SOCKET_TIMEOUT,
                'request has been failed due to socket timeout');

            assert.strictEqual(typeof response, 'undefined',
                'response must not be passed to callback');

            done();
        });
    })

};
