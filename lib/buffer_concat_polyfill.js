/**
 * @type {Function}
 * @param {Array} list of buffers
 * @param {Number} [totalLength] length of the result buffer, calculated if not provided
 * @returns {Buffer}
 * @throws TypeError if list isn't an Array or list item isn't a Buffer
 */
function polyfill(list, totalLength) {
    var size = (typeof totalLength !== 'undefined') ?
            totalLength :
            list.reduce(function(sz, buf) {
                return sz + buf.length;
            }, 0),

        result,
        offset = 0,
        i = 0;

    // @see http://nodejs.org/api/buffer.html#buffer_class_method_buffer_concat_list_totallength
    if (list.length === 0 || size === 0) {
        return new Buffer(0);
    } else if (list.length === 1) {
        return list[0];
    } else {
        result = new Buffer(size);

        for (; i < list.length; ++i) {
            offset += list[i].copy(result, offset);
        }

        return result;
    }
}

module.exports = {
    bufferConcat : (typeof Buffer.concat === 'function') ? Buffer.concat : polyfill,
    polyfill : polyfill
};
