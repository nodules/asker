var ask = require('../lib/asker'),
    httpTest = require('./lib/http'),
    httpsTest = require('./lib/https'),
    assert = require('chai').assert;

module.exports = {
    'http: error event listener test': httpTest(function(done, server) {
        server.addTest(function(req, res) {
            try {
                res.writeHead(201, { 'ктулху\nотаке': 333 });
            } catch (err) {
                // @note: try-catch is used as nodejs-5 throws "TypeError: Header name must be a valid HTTP Token" here
                res.destroy(err);
            }
            res.end();
        });

        ask({ port: server.port }, function(error, response) {
            assert.strictEqual(error.code, ask.Error.CODES.HTTP_CLIENT_REQUEST_ERROR,
                'got http parser error');

            assert.isUndefined(response, 'response was not compiled');

            done();
        });
    }),

    'https: error event listener test': httpsTest(function(done, server) {
        server.addTest(function(req, res) {
            res.end();
        });

        // @note: test server uses "self signed certificate"
        ask({ protocol: server.protocol, port: server.port }, function(error, response) {
            assert.strictEqual(error.code, ask.Error.CODES.HTTP_CLIENT_REQUEST_ERROR,
                'got self signed certificate error');

            assert.isUndefined(response, 'response was not compiled');

            done();
        });
    })
};
