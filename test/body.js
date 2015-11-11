var Asker = require('../lib/asker'),
    ask = Asker,
    httpTest = require('./lib/http'),
    assert = require('chai').assert,
    qs = require('querystring');

var RESPONSE = 'response ok',
    RESPONSE_BUFFER = new Buffer(RESPONSE, 'utf8'),
    test = {
        'data': [
            { 'id': 'AC', 'name': 'AC' },
            { 'id': 'ACURA', 'name': 'Acura' },
            { 'id': 'ALFA_ROMEO', 'name': 'Alfa Romeo' },
            { 'id': 'ALPINA', 'name': 'Alpina' },
            { 'id': 'ARO', 'name': 'Aro' }
        ]
    };

module.exports = {
    'test response body => get => string': httpTest(function(done, server) {
        server.addTest(function(req, res) {
            res.statusCode = 200;
            res.end(RESPONSE);
        });

        ask({ port: server.port }, function(error, response) {
            assert.strictEqual(response.data.toString(), RESPONSE, 'response is correct');

            done();
        });
    }),

    'test response body => get => buffer': httpTest(function(done, server) {
        server.addTest(function(req, res) {
            res.statusCode = 200;
            res.end(new Buffer(RESPONSE));
        });

        ask({ port: server.port }, function(error, response) {
            assert.strictEqual(response.data.toString(), RESPONSE, 'response is correct');

            done();
        });
    }),

    'test response body => get => parse json': httpTest(function(done, server) {
        server.addTest(function(req, res) {
            res.statusCode = 200;
            res.end(JSON.stringify(test));
        });

        ask({ port: server.port }, function(error, response) {
            var parsed = JSON.parse(response.data.toString());

            assert.strictEqual(error, null, 'no errors occured');
            assert.strictEqual(parsed.data[2].name, 'Alfa Romeo', 'response is correct');
            assert.strictEqual(parsed.data[4].id, 'ARO', 'response is correct');

            done();
        });
    }),

    'test request body => post => parse json': httpTest(function(done, server) {
        server.addTest(function(req, res) {
            if (req.body && req.body.data[0].name === 'AC' && req.method === 'POST') {
                res.statusCode = 200;
                res.end(RESPONSE);
            } else {
                res.statusCode = 500;
                res.end();
            }
        });

        ask({ port: server.port, method: 'post', body: test, bodyEncoding: 'json' }, function(error, response) {
            assert.strictEqual(error, null, 'no errors occured');
            assert.strictEqual(response.data.toString(), RESPONSE, 'response is correct');

            done();
        });
    }),

    'test request body => put => parse json': httpTest(function(done, server) {
        server.addTest(function(req, res) {
            if (req.body && req.body.data[0].name === 'AC' && req.method === 'PUT') {
                res.statusCode = 200;
                res.end(RESPONSE);
            } else {
                res.statusCode = 500;
                res.end();
            }
        });

        ask({ port: server.port, method: 'put', body: test, bodyEncoding: 'json' }, function(error, response) {
            assert.strictEqual(error, null, 'no errors occured');
            assert.strictEqual(response.data.toString(), RESPONSE, 'response is correct');

            done();
        });
    }),

    'test request body => patch => parse querystring': httpTest(function(done, server) {
        server.addTest(function(req, res) {
            if (req.body && qs.parse(req.body.toString()).changeCounter === '10' && req.method === 'PATCH') {
                res.statusCode = 200;
                res.end();
            } else {
                res.statusCode = 500;
                res.end();
            }
        });

        ask({ port: server.port, method: 'patch', body: 'changeCounter=10' }, function(error) {
            assert.strictEqual(error, null, 'no errors occured');

            done();
        });
    }),

    'test request body => delete => parse querystring': httpTest(function(done, server) {
        server.addTest(function(req, res) {
            if (req.body && qs.parse(req.body.toString()).id === '100' && req.method === 'DELETE') {
                res.statusCode = 200;
                res.end();
            } else {
                res.statusCode = 500;
                res.end();
            }
        });

        ask({ port: server.port, method: 'delete', body: 'id=100' }, function(error) {
            assert.strictEqual(error, null, 'no errors occured');

            done();
        });
    }),

    'chunked response body compilation': httpTest(function(done, server) {
        server.addTest(function(req, res) {
            res.write(RESPONSE_BUFFER.slice(0, 5));
            res.write(RESPONSE_BUFFER.slice(5, 10));
            res.end(RESPONSE_BUFFER.slice(10));
        });

        ask({ port: server.port }, function(error, response) {
            assert.strictEqual(error, null, 'no errors occured');

            assert.strictEqual(response.data.toString(), RESPONSE,
                'chunked response compiled');

            done();
        });
    }),

    'response body compilation with recieved "content-length"': httpTest(function(done, server) {
        server.addTest(function(req, res) {
            res.writeHead(200, { 'Content-length': RESPONSE_BUFFER.length });
            res.end(RESPONSE_BUFFER);
        });

        ask({ port: server.port }, function(error, response) {
            assert.isNull(error, 'no errors occured');
            assert.strictEqual(response.data.toString(), RESPONSE,
                'chunked response compiled');

            done();
        });
    }),

    'response body compilation with "content-length" less than actual content length': httpTest(function(done, server) { // jscs: disable maximumLineLength
        server.addTest(function(req, res) {
            res.writeHead(200, { 'Content-length': Buffer.byteLength(RESPONSE, 'utf8') - 10 });
            res.end(RESPONSE);
        });

        ask({ port: server.port }, function(error, response) {
            // @note kaero Node.js 0.8 doesn't emit error if content-length value is less than actual content-length
            // @note narqo this is an issue in Node.js 0.10 ReadableStream implementation (see http://stackoverflow.com/questions/17370309/nodejs-gm-content-length-implementation-hangs-browser#comment38374611_17370309)
            if (error === null) {
                assert.strictEqual(
                    response.data.toString(),
                    RESPONSE_BUFFER.slice(0, RESPONSE_BUFFER.length - 10).toString(),
                    'response recieved');
            } else {
                assert.strictEqual(error.code, Asker.Error.CODES.HTTP_CLIENT_REQUEST_ERROR, 'http client error');

                assert.strictEqual(typeof response, 'undefined',
                    'response is not recieved');
            }

            done();
        });
    }),

    // @todo needs to be fixed
    // if content-length received, then don't wait for more chunks
    // @note narqo this is an issue in Node.js 0.10 ReadableStream implementation (see http://stackoverflow.com/questions/17370309/nodejs-gm-content-length-implementation-hangs-browser#comment38374611_17370309)
    'response body compilation with "content-length" more than actual content length': httpTest(function(done, server) {
        server.addTest(function(req, res) {
            res.writeHead(200, { 'Content-length': Buffer.byteLength(RESPONSE, 'utf8') + 10 });
            res.end(RESPONSE);
        });

        ask({ port: server.port, timeout: 300 }, function(error, response) {
            if (error === null) {
                assert.strictEqual(
                    response.data.toString(),
                    RESPONSE_BUFFER.slice(0, RESPONSE_BUFFER.length + 10).toString(),
                    'response recieved');
            } else {
                assert.strictEqual(error.code, Asker.Error.CODES.SOCKET_TIMEOUT, 'http client error');

                assert.strictEqual(typeof response, 'undefined',
                    'response is not recieved');
            }

            done();
        });
    })
};
