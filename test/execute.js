var Asker = require('../lib/asker'),
    httpTest = require('./lib/http'),
    assert = require('chai').assert;

module.exports = {
    'run via Request#execute' : httpTest(function(done, server) {
        var request = new Asker(
                { port : server.port },
                function(error, response) {
                    assert.strictEqual(response.data, null, 'response given');

                    done();
                });

        server.addTest(function(req, res) {
            res.end();
        });

        request.execute();
    }),

    'subsequent Request#execute calls must fails' : httpTest(function(done, server) {
        var request = new Asker(
                { port : server.port },
                function() {
                    assert.strictEqual(request.isRunning, false,
                        'Request#isRunning equals false when request completed');

                    done();
                });

        server.addTest(function(req, res) {
            setTimeout(function() {
                res.end();
            });
        });

        assert.strictEqual(request.execute(), true,
            'first Request#execute call returns true');

        assert.strictEqual(request.isRunning, true,
            'Request#isRunning equals true when request running');

        request.isRunning = false;

        assert.strictEqual(request.isRunning, true,
            'Request#isRunning is read-only property');

        assert.strictEqual(request.execute(), false,
            'second Request#execute call returns false');
    })
};
