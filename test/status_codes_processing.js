var Asker = require('../lib/asker'),
    ask = Asker,
    httpTest = require('./lib/http'),
    assert = require('chai').assert,
    RESPONSE = 'response ok',
    REQUEST_ID = 'test';

function filter(code) {
    return {
        /* jshint bitwise:false */
        accept : ~[200, 304, 404].indexOf(code),
        isRetryAllowed : 400 > code || code > 499
    };
}

module.exports = {
    'default http status codes processing => 200' : httpTest(function(done, server) {
        server.addTest(function(req, res) {
            res.statusCode = 200;
            res.end(RESPONSE);
        });

        ask({ port : server.port }, function(error, response) {
            assert.strictEqual(error, null, 'no errors occured');
            assert.strictEqual(response.statusCode, 200, 'statusCode equals 200');
            assert.strictEqual(response.data, RESPONSE, 'response is correct');

            done();
        });
    }),

    'default http status codes processing => 201' : httpTest(function(done, server) {
        server.addTest(function(req, res) {
            res.writeHead(201, { 'Location': 'http://example.com' });
            res.end();
        });

        ask({ port : server.port }, function(error, response) {
            assert.strictEqual(error, null, 'no errors occured');
            assert.strictEqual(response.statusCode, 201, 'statusCode equals 201');
            assert.strictEqual(response.data, null, 'response is null');

            done();
        });
    }),

    'default http status codes processing => 304' : httpTest(function(done, server) {
        server.addTest(function(req, res) {
            res.statusCode = 304;
            res.end();
        });

        ask({ port : server.port, requestId : 'test' }, function(error) {
            assert.strictEqual(error.code, 904, '304 is not valid by default');
            assert.ok(
                (new RegExp([
                    'Unexpected status code {CODE:304} in the response for request ',
                    REQUEST_ID,
                    ' in \\d+~\\d+ ms localhost:',
                    server.port,
                    '/'
                ].join(''))).test(error.message),
                'error message fulfilled');

            done();
        });
    }),

    'default http status codes processing => 404' : httpTest(function(done, server) {
        server.addTest(function(req, res) {
            res.statusCode = 404;
            res.end();
        });

        ask({ port : server.port }, function(error) {
            assert.strictEqual(error.code, 904, '404 is not valid by default');

            done();
        });
    }),

    'default http status codes processing => 500' : httpTest(function(done, server) {
        server.addTest(function(req, res) {
            res.statusCode = 500;
            res.end();
        });

        ask({ port : server.port }, function(error) {
            assert.strictEqual(error.code, 904, '500 is not valid by default');

            done();
        });
    }),

    'custom http status codes processing => 200' : httpTest(function(done, server) {
        server.addTest(function(req, res) {
            res.statusCode = 200;
            res.end(RESPONSE);
        });

        ask({ port : server.port, statusFilter : filter }, function(error, response) {
            assert.strictEqual(error, null, '200 is still allowed, even with custom statusFilter function');
            assert.strictEqual(response.statusCode, 200, 'statusCode equals 200');
            assert.strictEqual(response.data, RESPONSE, 'response is correct');

            done();
        });
    }),

    'custom http status codes processing => 304' : httpTest(function(done, server) {
        server.addTest(function(req, res) {
            res.statusCode = 304;
            res.end();
        });

        ask({ port : server.port, statusFilter : filter }, function(error, response) {
            assert.strictEqual(error, null, '304 is now allowed, according to statusFilter function');
            assert.strictEqual(response.statusCode, 304, 'statusCode equals 304');
            assert.strictEqual(response.data, null, '304 responses do not contain any body');

            done();
        });
    }),

    'custom http status codes processing => 404' : httpTest(function(done, server) {
        server.addTest(function(req, res) {
            res.statusCode = 404;
            res.end(RESPONSE);
        });

        ask({ port : server.port, statusFilter : filter }, function(error, response) {
            assert.strictEqual(error, null, '404 is now allowed, according to statusFilter function');
            assert.strictEqual(response.statusCode, 404, 'statusCode equals 404');
            assert.strictEqual(response.data, RESPONSE, 'response is correct');

            done();
        });
    })
};
