var Asker = require('../lib/asker'),
    ask = Asker,
    httpTest = require('./lib/http'),
    assert = require('chai').assert;

module.exports = {
    'execute request without callback': httpTest(function(done, server) {
        var PATH = '/test';

        server.addTest(function(req, res) {
            assert.strictEqual(req.url, PATH,
                'request recieved');

            res.end();

            done();
        });

        ask({ port: server.port, path: PATH });
    })
};
