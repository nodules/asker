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
    })
};