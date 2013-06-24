var Asker = require('../lib/asker'),
    ask = Asker,
    Server = require('./lib/http'),
    PORT = process.env.ASKER_TEST_PORT || 10080;

module.exports = {
    setUp : function(callback) {
        this.server = new Server(PORT);
        this.server.listen(callback);
    },

    tearDown : function(callback) {
        this.server.close(callback);
    },

    'check response format' : function(test) {
        var RESPONSE = 'response ok';

        this.server.addTest(function(req, res) {
            res.statusCode = 200;
            res.end(RESPONSE);
        });

        test.expect(9);

        ask({ port : PORT }, function(error, response) {
            test.strictEqual(error, null, 'no errors occured');

            test.strictEqual(response.data, RESPONSE, 'response data is present and is a correct string');

            test.strictEqual(response.statusCode, 200, 'statusCode is present and equals 200');

            test.strictEqual(typeof response.meta.time.network, 'number', 'network time is present and is a number');
            test.strictEqual(typeof response.meta.time.total, 'number', 'total time is present and is a number');
            test.ok(response.meta.time.total >= response.meta.time.network,
                'total time should is greater or equals total time');

            test.strictEqual(response.meta.retries.used, 0, 'no retries were used');
            test.strictEqual(response.meta.retries.limit, 0, 'no retries allowed by default');

            test.strictEqual(response.meta.options.port, PORT, 'port is correct');

            test.done();
        });
    }
};
