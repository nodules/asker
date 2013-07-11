var Asker = require('../lib/asker'),
    ask = Asker,
    zlib = require('zlib'),
    httpTest = require('./lib/http'),
    assert = require('chai').assert,

    ORIGINAL_RESPONSE = require('fs').readFileSync(__dirname + '/../lib/asker.js');

module.exports = {
    'asker must send gzip in the "accept-encoding" header' : httpTest(function(done, server) {
        server.addTest(function(req, res) {
            assert.ok(req.headers['accept-encoding'].indexOf('gzip') > -1,
                '"accept-encoding" header recieved and contains "gzip"');

            res.end();

            done();
        });

        // @todo remove empty callback after fixing #54
        ask({ port : server.port }, function() {});
    }),

    'asker must deflate message body compressed with gzip' : httpTest(function(done, server) {
        server.addTest(function(req, res) {
            res.setHeader('content-encoding', 'gzip');

            zlib.gzip(ORIGINAL_RESPONSE, function(error, buf) {
                if (error) {
                    throw error;
                } else {
                    res.end(buf);
                }
            });
        });

        ask({ port : server.port }, function(error, response) {
            assert.strictEqual(response.data.toString(), ORIGINAL_RESPONSE.toString(),
                'compressed response has been deflated as expected');

            done();
        });
    }),

    'asker must return deflating error if body deflate has been failed' : httpTest(function(done, server) {
        server.addTest(function(req, res) {
            res.setHeader('content-encoding', 'gzip');

            zlib.gzip(ORIGINAL_RESPONSE, function(error, buf) {
                if (error) {
                    throw error;
                } else {
                    res.end(buf.slice(5, 100));
                }
            });
        });

        ask({ port : server.port }, function(error, response) {
            assert.strictEqual(error.code, Asker.Error.CODES.GUNZIP_ERROR,
                'response deflating must fail with GUNZIP_ERROR code');

            assert.strictEqual(typeof response, 'undefined',
                'response object must not be compiled');

            done();
        });
    })
};
