var Asker = require('../lib/asker'),
    ask = Asker,
    httpTest = require('./lib/http'),
    assert = require('chai').assert;

module.exports = {
    'check response format' : httpTest(function(done, server) {

        var RESPONSE = 'response ok';

        server.addTest(function(req, res) {
            res.statusCode = 200;
            res.end(RESPONSE);
        });

        ask({ port : server.port }, function(error, response) {
            assert.strictEqual(error, null, 'no errors occured');

            assert.strictEqual(response.data, RESPONSE, 'response data is present and is a correct string');

            assert.strictEqual(response.statusCode, 200, 'statusCode is present and equals 200');

            assert.strictEqual(typeof response.meta.time.network, 'number', 'network time is present and is a number');
            assert.strictEqual(typeof response.meta.time.total, 'number', 'total time is present and is a number');
            assert.ok(response.meta.time.total >= response.meta.time.network,
                'total time is greater or equals total time');

            assert.strictEqual(response.meta.retries.used, 0, 'no retries were used');
            assert.strictEqual(response.meta.retries.limit, 0, 'no retries allowed by default');

            assert.strictEqual(response.meta.options.port, server.port, 'port is correct');

            done();
        });

    })
};
