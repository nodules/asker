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

    'GET / => 200 - string' : function(test) {
        var RESPONSE = 'response ok';

        this.server.addTest(function(req, res) {
            res.statusCode = 200;
            res.end(RESPONSE);
        });

        test.expect(3);

        ask({ port : PORT }, function(error, response) {
            test.strictEqual(error, null, 'response callback called without error');
            test.strictEqual(typeof response, 'object', 'response object received');
            test.strictEqual(response.data, RESPONSE, 'recieved expected response');

            test.done();
        });
    }
};
