var Asker = require('../lib/asker'),
    ask = Asker,
    httpTest = require('./lib/http'),
    assert = require('chai').assert;

module.exports = {
    'GET / => 200 - string' : httpTest(function(done, server) {

        var RESPONSE = 'response ok';

        server.addTest(function(req, res) {
            res.statusCode = 200;
            res.end(RESPONSE);
        });

        ask({ port : server.port }, function(error, response) {
            assert.strictEqual(error, null, 'response callback called without error');
            assert.strictEqual(typeof response, 'object', 'response object received');
            assert.strictEqual(response.data, RESPONSE, 'received expected response');

            done();
        });

    })
};
