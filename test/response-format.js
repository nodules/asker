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

    'check statusCode field' : function(test) {
        this.server.addTest(function(req, res) {
            res.statusCode = 200;
            res.end('response ok');
        });

        test.expect(1);

        ask({ port : PORT }, function(error, response) {
            test.strictEqual(response.statusCode, 200, 'statusCode is present and equals 200');

            test.done();
        });
    }
};
