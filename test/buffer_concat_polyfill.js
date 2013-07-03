var bufferConcat = require('../lib/buffer_concat_polyfill').bufferConcat,
    polyfill = require('../lib/buffer_concat_polyfill').polyfill,
    assert = require('chai').assert;

module.exports = {
    'bufferConcat polyfill must use native implementation if available' : function(done) {
        if (typeof Buffer.concat === 'function') {
            assert.strictEqual(bufferConcat, Buffer.concat,
                'bufferConcat use Buffer.concat');
        } else {
            assert.strictEqual(bufferConcat, polyfill,
                'bufferConcat use polyfill');
        }

        done();
    },

    'polyfill returns zero length buffer if list is empty or totalLength equals 0' : function(done) {
        var buf = polyfill([]);

        assert.ok(Buffer.isBuffer(buf), 'result is buffer');

        assert.strictEqual(buf.length, 0,
            'buffer has zero length when produced from empty array');

        assert.strictEqual(polyfill([ new Buffer('hello'), new Buffer('world') ], 0).length, 0,
            'buffer has zero length when produced by polyfill which is called with totalLength = 0');

        done();
    },

    'polyfill returns first buffer from the list if list contains only one' : function(done) {
        var lonelyBuf = new Buffer(0);

        assert.strictEqual(polyfill([lonelyBuf]), lonelyBuf,
            'polyfill returns the same buffer as passed alone in the list');

        done();
    },

    'polyfill must not calculate result buffer length if it passed as second arg' : function(done) {

        assert.strictEqual(polyfill([ new Buffer(5), new Buffer(5), new Buffer(3), new Buffer(3) ], 11).length, 11,
            'polyfill returns a buffer with required length');

        assert.strictEqual(polyfill([ new Buffer(5), new Buffer(5), new Buffer(3) ], 10).length, 10,
            'polyfill returns a buffer with required length');

        done();
    },

    'polyfill just works in the common case (;' : function(done) {
        var VALUE = 'test message',
            arr = [
                new Buffer(VALUE.slice(0, 4)),
                new Buffer(VALUE.slice(4))
            ],
            buf = polyfill(arr);

        assert.strictEqual(buf.toString(), VALUE,
            'concatenated buffer contains expected data');

        assert.strictEqual(buf.length, arr.reduce(function(size, b) { return size + b.length; }, 0),
            'concatenated buffer length calculated in right way');

        done();
    }
};
