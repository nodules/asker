var ask = require('../lib/asker'),
    httpsTest = require('./lib/https'),
    assert = require('chai').assert,
    RESPONSE = 'ok done';

module.exports = {
    'https: self signed certificate': httpsTest(function(done, server) {
        server.addTest(function(req, res) {
            res.end(RESPONSE);
        });

        ask({ protocol: server.protocol, port: server.port }, function(error, response) {
            assert.strictEqual(error.code, ask.Error.CODES.HTTP_CLIENT_REQUEST_ERROR,
                'got self signed certificate error');
            assert.isUndefined(response, 'response was not compiled');
            done();
        });
    }),

    'https: self signed certificate (custom agent)': httpsTest(function(done, server) {
        server.addTest(function(req, res) {
            res.end(RESPONSE);
        });

        var opts = {
            protocol: server.protocol,
            port: server.port,
            agent: { name: 'agent1' }
        };

        ask(opts, function(error, response) {
            assert.strictEqual(error.code, ask.Error.CODES.HTTP_CLIENT_REQUEST_ERROR,
                'got self signed certificate error');
            assert.isUndefined(response, 'response was not compiled');
            done();
        });
    }),

    'https: ignore self signed certificate': httpsTest(function(done, server) {
        server.addTest(function(req, res) {
            res.end(RESPONSE);
        });

        var opts = {
            protocol: server.protocol,
            port: server.port,
            rejectUnauthorized: false
        };

        ask(opts, function(error, response) {
            assert.isNull(error, 'self signed certificate was ignored');
            assert.strictEqual(response.data.toString(), RESPONSE, 'response was compiled');
            done();
        });
    }),

    'https: ignore self signed certificate (custom agent)': httpsTest(function(done, server) {
        server.addTest(function(req, res) {
            res.end(RESPONSE);
        });

        var opts = {
            protocol: server.protocol,
            port: server.port,
            agent: { name: 'agent2' },
            rejectUnauthorized: false
        };

        ask(opts, function(error, response) {
            assert.isNull(error, 'self signed certificate was ignored');
            assert.strictEqual(response.data.toString(), RESPONSE, 'response was compiled');
            done();
        });
    }),

    'https: pass proper CA for self signed certificate': httpsTest(function(done, server) {
        server.addTest(function(req, res) {
            res.end(RESPONSE);
        });

        var opts = {
            protocol: server.protocol,
            port: server.port,
            ca: server.rootCA
        };

        ask(opts, function(error, response) {
            assert.isNull(error, 'self signed certificate was accepted');
            assert.strictEqual(response.data.toString(), RESPONSE, 'response was compiled');
            done();
        });
    }),

    'https: pass proper CA for self signed certificate (custom agent)': httpsTest(function(done, server) {
        server.addTest(function(req, res) {
            res.end(RESPONSE);
        });

        var opts = {
            protocol: server.protocol,
            port: server.port,
            agent: { name: 'agent3' },
            ca: server.rootCA
        };

        ask(opts, function(error, response) {
            assert.isNull(error, 'self signed certificate was accepted');
            assert.strictEqual(response.data.toString(), RESPONSE, 'response was compiled');
            done();
        });
    }),

    'https: sanity check': httpsTest(function(done, server) {
        server.addTest(function(req, res) {
            res.end(RESPONSE);
        });

        var opts = {
            protocol: server.protocol,
            port: server.port,
            ca: server.rootCA
        };

        ask(opts, function(error, response) {
            assert.isNull(error);
            assert.strictEqual(response.statusCode, 200);
            assert.ok(response.data.length > 0);
            done();
        });
    })
};
