var Asker = require('../lib/asker'),
    ask = Asker,
    httpTest = require('./lib/http'),
    assert = require('chai').assert;

module.exports = {
    'httpRequest error event listener test' : httpTest(function(done, server) {
        server.addTest(function(req, res) {
            res.writeHead(201, { 'ктулху\nотаке' : 333 });
            res.end();
        });

        ask({ port : server.port }, function(error, response) {
            assert.strictEqual(error.code, Asker.Error.CODES.HTTP_CLIENT_REQUEST_ERROR,
                'http parser error recieved');

            assert.strictEqual(typeof response, 'undefined',
                'response is not compiled');

            done();
        });
    })
};
