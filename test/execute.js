var Asker = require('../lib/asker'),
    ask = Asker,
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
    }),

    'Request#isRunning getter returns actual value of the private field _isRunning' : function(done) {
        var request = new Asker();

        assert.strictEqual(typeof request._isRunning, 'undefined',
            'default _isRunning state is "unefined"');

        assert.strictEqual(request.isRunning, false,
            'value returned by isRunning getter equals private field value');

        request._isRunning = true;

        assert.strictEqual(request.isRunning, true,
            'value returned by isRunning getter equals private field value');

        done();
    },

    'set callback via Request#execute()' : function(done) {
        var request = new Asker();

        assert.strictEqual(typeof request._callback, 'undefined',
            'callback has not been set in the constructor call');

        request.execute(function() {
            assert.ok(true, 'callback called');

            done();
        });
    },

    'sanity check for https client' : function(done) {
        ask({ url : 'https://mail.yandex.ru/', timeout : 3000 }, function(error, response) {
            assert.isNull(error);
            assert.strictEqual(response.statusCode, 200);
            assert.ok(response.data.length > 0);

            done();
        });
    }
};
