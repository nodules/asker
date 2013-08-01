var url = require('url');

/**
 * Randomly generated boundary for multipart request
 * @type {String}
 */
var BOUNDARY = 'AskerBoundary-' + parseInt(Math.random() * 1e16, 10);

/**
 * Newline constant
 * @type {String}
 */
var CRLF = "\r\n";

module.exports = {
    text : {
        header : 'text/plain',
        type : 'string',
        process : function(body) {
            return String(body);
        }
    },

    stringify : {
        header : 'application/json',
        type : 'object',
        process : function(body) {
            return JSON.stringify(body);
        }
    },

    urlencoded : {
        header : 'application/x-www-form-urlencoded',
        type : '*',
        process : function(body) {
            if (typeof body === 'object') {
                body = url.format({ query : body }).substr(1);
            }
            return body;
        }
    },

    multipart : {
        header : 'multipart/form-data; boundary=' + BOUNDARY,
        type : 'object',
        process : function(body) {
            // Buffer collection for body
            var bufs = [];

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

            return Buffer.concat(bufs);
        }
    }
};
