var Asker = require('../lib/asker'),
    ask = Asker,
    httpTest = require('./lib/http'),
    assert = require('chai').assert;

module.exports = {
    'test response body => get => string' : httpTest(function(done, server) {
        server.addTest(function(req, res) {
            res.statusCode = 200;
            res.end('response ok');
        });

        ask({ port : server.port }, function(error, response) {
            assert.strictEqual(response.data, 'response ok', 'response is correct');

            done();
        });
    }),

    'test response body => get => buffer' : httpTest(function(done, server) {
        server.addTest(function(req, res) {
            res.statusCode = 200;
            res.end(new Buffer('response ok'));
        });

        ask({ port : server.port }, function(error, response) {
            assert.strictEqual(response.data, 'response ok', 'response is correct');

            done();
        });
    }),

    'test response body => get => parse json' : httpTest(function(done, server) {
        var test = {
            'data' : [
                { 'id' : 'AC',         'name' : 'AC' },
                { 'id' : 'ACURA',      'name' : 'Acura' },
                { 'id' : 'ALFA_ROMEO', 'name' : 'Alfa Romeo' },
                { 'id' : 'ALPINA',     'name' : 'Alpina' },
                { 'id' : 'ARO',        'name' : 'Aro' }
            ]
        };

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
    })
};