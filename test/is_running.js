var Asker = require('../lib/asker'),
    assert = require('chai').assert;

module.exports = {
    '#isRunning getter returns actual value of the private field _isRunning': function(done) {
        var request = new Asker();

        assert.strictEqual(request._isRunning, null,
            'default _isRunning state is `null`');

        assert.strictEqual(request.isRunning, false,
            'value returned by isRunning getter equals private field value');

        request._isRunning = true;

        assert.strictEqual(request.isRunning, true,
            'value returned by isRunning getter equals private field value');

        done();
    }
};
