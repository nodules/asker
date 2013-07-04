var Asker = require('../lib/asker'),
    ask = Asker,
    httpTest = require('./lib/http'),
    assert = require('chai').assert,
    qs = require('querystring');

var RESPONSE = 'response ok',
    test = {
        'data' : [
            { 'id' : 'AC',         'name' : 'AC' },
            { 'id' : 'ACURA',      'name' : 'Acura' },
            { 'id' : 'ALFA_ROMEO', 'name' : 'Alfa Romeo' },
            { 'id' : 'ALPINA',     'name' : 'Alpina' },
            { 'id' : 'ARO',        'name' : 'Aro' }
        ]
    };

module.exports = {
    'test response body => get => string' : httpTest(function(done, server) {
        server.addTest(function(req, res) {
            res.statusCode = 200;
            res.end(RESPONSE);
        });

        ask({ port : server.port }, function(error, response) {
            assert.strictEqual(response.data, RESPONSE, 'response is correct');

            done();
        });
    }),

    'test response body => get => buffer' : httpTest(function(done, server) {
        server.addTest(function(req, res) {
            res.statusCode = 200;
            res.end(new Buffer(RESPONSE));
        });

        ask({ port : server.port }, function(error, response) {
            assert.strictEqual(response.data, RESPONSE, 'response is correct');

            done();
        });
    }),

    'test response body => get => parse json' : httpTest(function(done, server) {
        server.addTest(function(req, res) {
            res.statusCode = 200;
            res.end(JSON.stringify(test));
        });

        ask({ port : server.port }, function(error, response) {
            var parsed = JSON.parse(response.data);

            assert.strictEqual(error, null, 'no errors occured');
            assert.strictEqual(parsed.data[2].name, 'Alfa Romeo', 'response is correct');
            assert.strictEqual(parsed.data[4].id, 'ARO', 'response is correct');

            done();
        });
    }),

    'test request body => post => parse json' : httpTest(function(done, server) {
        server.addTest(function(req, res) {
            if (req.body && JSON.parse(req.body).data[0].name === 'AC' && req.method === 'POST') {
                res.statusCode = 200;
                res.end(RESPONSE);
            } else {
                res.statusCode = 500;
                res.end();
            }
        });

        ask({ port : server.port, method : 'post', body : test }, function(error, response) {
            assert.strictEqual(error, null, 'no errors occured');
            assert.strictEqual(response.data, RESPONSE, 'response is correct');

            done();
        });
    }),

    'test request body => put => parse json' : httpTest(function(done, server) {
        server.addTest(function(req, res) {
            if (req.body && JSON.parse(req.body).data[0].name === 'AC' && req.method === 'PUT') {
                res.statusCode = 200;
                res.end(RESPONSE);
            } else {
                res.statusCode = 500;
                res.end();
            }
        });

        ask({ port : server.port, method : 'put', body : test }, function(error, response) {
            assert.strictEqual(error, null, 'no errors occured');
            assert.strictEqual(response.data, RESPONSE, 'response is correct');

            done();
        });
    }),

    'test request body => patch => parse querystring' : httpTest(function(done, server) {
        server.addTest(function(req, res) {
            if (req.body && qs.parse(req.body).changeCounter === '10' && req.method === 'PATCH') {
                res.statusCode = 200;
                res.end();
            } else {
                res.statusCode = 500;
                res.end();
            }
        });

        ask({ port : server.port, method : 'patch', body : 'changeCounter=10' }, function(error) {
            assert.strictEqual(error, null, 'no errors occured');

            done();
        });
    }),

    'test request body => delete => parse querystring' : httpTest(function(done, server) {
        server.addTest(function(req, res) {
            if (req.body && qs.parse(req.body).id === '100' && req.method === 'DELETE') {
                res.statusCode = 200;
                res.end();
            } else {
                res.statusCode = 500;
                res.end();
            }
        });

        ask({ port : server.port, method : 'delete', body : 'id=100' }, function(error) {
            assert.strictEqual(error, null, 'no errors occured');

            done();
        });
    }),

    'chunked response body compilation' : httpTest(function(done, server) {
        var responseBuf = new Buffer(RESPONSE, 'utf8');

        server.addTest(function(req, res) {
            res.write(responseBuf.slice(0, 5));
            res.write(responseBuf.slice(5, 10));
            res.end(responseBuf.slice(10));
        });

        ask({ port : server.port }, function(error, response) {
            assert.strictEqual(error, null, 'no errors occured');

            assert.strictEqual(response.data, RESPONSE,
                'chunked response compiled');

            done();
        });
    }),

    'response body compilation with recieved "content-length"' : httpTest(function(done, server) {
        var responseBuf = new Buffer(RESPONSE, 'utf8');

        server.addTest(function(req, res) {
            res.writeHead(200, { 'Content-length' : responseBuf.length });
            res.end(responseBuf);
        });

        ask({ port : server.port }, function(error, response) {
            assert.strictEqual(error, null, 'no errors occured');

            assert.strictEqual(response.data, RESPONSE,
                'chunked response compiled');

            done();
        });
    }),

    'response body compilation with "content-length" less than actual content length' : httpTest(function(done, server) {
        // turn off the test for node.js 0.6
        // due to https://github.com/joyent/node/pull/3777 which will not be ported to 0.6 branch ever
        if (process.version.indexOf('v0.6') === 0) {
            return done();
        }

        server.addTest(function(req, res) {
            res.writeHead(200, { 'Content-length' : Buffer.byteLength(RESPONSE, 'utf8') - 10 });
            res.end(RESPONSE);
        });

        ask({ port : server.port }, function(error, response) {
            var resBuffer = new Buffer(RESPONSE, 'utf8');

            // @todo: remove workaround for Node.js 0.8 when 0.8 support will be dropped
            // NOde.js 0.8 doesn't emit error if content-length value is less than actual contetn-length
            if (error === null) {
                assert.strictEqual(response.data, resBuffer.slice(0, resBuffer.length - 10).toString('utf8'),
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
    // if content-length recieved, then don't wait for more chunks
    'response body compilation with "content-length" more than actual content length' : httpTest(function(done, server) {
        server.addTest(function(req, res) {
            res.writeHead(200, { 'Content-length' : Buffer.byteLength(RESPONSE, 'utf8') + 10 });
            res.end(RESPONSE);
        });

        ask({ port : server.port, timeout : 300 }, function(error, response) {
            assert.strictEqual(error.code, Asker.Error.CODES.SOCKET_TIMEOUT, 'http client error');

            assert.strictEqual(typeof response, 'undefined',
                'response is not recieved');

            done();
        });
    })
};
