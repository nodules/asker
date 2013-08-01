var url = require('url'),
    AskerError = require('./error'),
    encoders = {},

    /** @type {String} Randomly generated boundary for multipart request */
    BOUNDARY = 'AskerBoundary-' + parseInt(Math.random() * 1e16, 10),

    /** @type {String} Newline constant */
    CRLF = "\r\n";

/**
 * @memberOf Request.bodyEncoders
 * @param {*} body
 * @param {Function} setContentType (String mimeType)
 * @this {Request}
 */
encoders.string = function(body, setContentType) {
    setContentType('text/plain');

    // @todo utf8 only?
    return new Buffer(String(body), 'utf8');
};

/**
 * @memberOf Request.bodyEncoders
 * @param {*} body
 * @param {Function} setContentType (String mimeType)
 * @this {Request}
 */
encoders.json = function(body, setContentType) {
    setContentType('application/json');

    // @todo utf8 only?
    return new Buffer(JSON.stringify(body), 'utf8');
};

/**
 * @memberOf Request.bodyEncoders
 * @param {*} body
 * @param {Function} setContentType (String mimeType)
 * @this {Request}
 */
encoders.urlencoded = function(body, setContentType) {
    setContentType('application/x-www-form-urlencoded');

    if (typeof body !== 'object') {
        throw AskerError.createError(AskerError.CODES.UNEXPECTED_BODY_TYPE, {
                type : typeof body,
                encoder : 'urlencoded',
                expectedTypes : 'Object'
            });
    }

    // @todo O'RLY? Use qs module for encoding
    body = url.format({ query : body }).substr(1);

    // @todo utf8 only?
    return new Buffer(body, 'utf8');
};

/**
 * @memberOf Request.bodyEncoders
 * @this {Request}
 */
encoders.multipart = function(body, setContentType) {
    // Buffer collection for body
    var bufs = [];

    setContentType('multipart/form-data; boundary=' + BOUNDARY);

    Object.keys(body).forEach(function(name) {
        var headers = [],
            attach = body[name],
            isObject = typeof attach === 'object',
            isFile = attach && Buffer.isBuffer(attach.data),
            isBuffer = attach && Buffer.isBuffer(attach);

        headers.push('--' + BOUNDARY);

        var disposition = [
            'content-disposition: form-data; name="' + name + '"'
        ];
        if (isFile && attach.filename) {
            disposition.push('; filename="' + attach.filename + '"');
        }
        headers.push(disposition.join(''));

        if (isObject) {
            var contentType = [
                'content-type:'
            ];
            if (isFile && attach.mime) {
                contentType.push(attach.mime);
            } else if (isFile || isBuffer) {
                contentType.push('application/octet-stream');
            } else {
                contentType.push('application/json');
            }
            headers.push(contentType.join(' '));
        }

        headers.push('', '');

        bufs.push(new Buffer(headers.join(CRLF)));

        var data;
        if (isBuffer) {
            data = attach;
        } else if (isFile) {
            data = attach.data;
        } else if (isObject) {
            // Assume, that it's just JS object, not file
            data = new Buffer(JSON.stringify(attach));
        } else {
            data = new Buffer(attach);
        }
        bufs.push(data);

        bufs.push(new Buffer(CRLF));
    });

    bufs.push(new Buffer('--' + BOUNDARY + '--'));

    // @todo calculate resulting buf length in the forEach above
    return Buffer.concat(bufs);
};

module.exports = encoders;
