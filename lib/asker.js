var http = require('http'),
    https = require('https'),
    url = require('url'),
    assign = require('object-assign'),
    contimer = require('contimer'),
    retry = require('retry'),
    unzipResponse = require('unzip-response'),
    AdvancedAgent = require('asker-advanced-agent'),
    AskerError = require('./error'),
    zlibErrors = require('zlib').codes;

/**
 * Shorthand to call Object#hasOwnProperty in context of the obj with propName argument.
 * @param {Object} obj context object to check
 * @param {String} propName property name to check
 * @returns {Boolean}
 */
function has(obj, propName) {
    return Object.prototype.hasOwnProperty.call(obj, propName);
}

/**
 * @typedef {Object} AgentOptions
 * @property {String}  [name=globalAgent] Agent name, use 'globalAgent' for http.globalAgent
 * @property {Number}  [maxSockets=1024] Pool size, used only if new agent defined
 * @property {Boolean} [persistent=true] Non-persistent agents removed when queue empty
 */

/**
 * @typedef  {Object} RequestOptions
 * @property {String}   [url] shorthand alternative for host, port and path options
 * @property {String}   [host=localhost]
 * @property {Number}   [port=80]
 * @property {String}   [protocol=http:] 'http:' or 'https:'
 * @property {String}   [path=/]
 * @property {String}   [method=GET] HTTP-method
 * @property {Object}   [headers] HTTP headers hash
 * @property {Object}   [query] Query params hash
 * @property {String}   [requestId=''] Request identifier for error messages
 * @property {*}        [body] Request body
 * @property {String}   [bodyEncoding] Body encoding method = multipart|urlencoded|text|stringify (default)
 *    if multipart chosen, there are two ways to transfer file content at body:
 *    directly as buffer: { param_name: <Buffer ...> }
 *    with extended info: { param_name: {filename: 'pic.jpg', mime: 'image/jpeg', data: <Buffer ...>} }
 * @property {Number}   [maxRetries=0] Max number of allowed retries for request
 * @property {Number}   [minRetriesTimeout=300] The number of milliseconds before starting the first retry
 * @property {Number}   [maxRetriesTimeout=Infinity] The maximum number of milliseconds between two retries
 * @property {Function} [onretry] (reason Error, retryCount Number) called on retries
 * @property {Number}   [timeout=500] Socket timeout
 * @property {Number}   [queueTimeout=timeout+50] Queue timeout
 * @property {Boolean}  [allowGzip=true] Allows response compression with gzip
 * @property {Function} [statusFilter] (code Number) Filter which determines acceptable status codes
 *    by default only 200 and 201 codes acceptable and retries allowed for all codes, except range from 400 to 499.
 *    Must returns object { accept : Boolean, isRetryAllowed : Boolean }.
 * @property {AgentOptions} [agent] http.Agent options
 */

/**
 * Create new instance and calls the `execute()` method if called as function (without `new`).
 *
 * @constructor
 * @param {RequestOptions} [options] object with only `host` field required
 * @param {Function} [callback]
 */
function Request(options, callback) {
    var parsedUrl,
        parsedPath,
        acceptEncoding;

    // execute request immediately after construction if called without `new`
    if ( ! (this instanceof Request)) {
        return (new Request(options, callback)).execute();
    }

    // override default options with passed hash
    var opts = assign({}, Request.DEFAULT_OPTIONS, options);

    // set hostname option if not set
    opts.hostname = opts.hostname || opts.host;

    // uppercase method name
    opts.method = opts.method.toUpperCase();

    // override status codes filter if passed in the options
    if (typeof opts.statusFilter === 'function') {
        this.statusCodeFilter = opts.statusFilter;
    }

    // lowercase headers names
    opts.headers = (options && options.headers) ?
        Object.keys(opts.headers).reduce(function(headers, headerName) {
            headers[headerName.toLowerCase()] = options.headers[headerName];

            return headers;
        }, {}) :
        {};

    // produce `host`, `port` and `path` options from the `url` option
    if (opts.url) {
        // allow url without protocol (use 'http' by default)
        if ( ! /^https?:\/\//ig.test(opts.url)) {
            opts.url = 'http://' + opts.url;
        }

        parsedUrl = url.parse(opts.url, true);

        opts.protocol = parsedUrl.protocol;
        opts.host = opts.hostname = parsedUrl.hostname;
        opts.port = parseInt(parsedUrl.port, 10);
        opts.path = parsedUrl.path;
    }

    // set default port (80 for http and 443 for https)
    if ( ! opts.port) {
        opts.port = opts.protocol === 'https:' ? 443 : 80;
    }

    // rebuild path with query params
    // `query` hash properties has higher priority than the specified in the `path` string does
    if (opts.query) {
        parsedPath = url.parse(opts.path, true);

        // `search` prop has higher priority than the `query` then remove it
        delete parsedPath.search;
        assign(parsedPath.query, opts.query);

        opts.path = url.format(parsedPath);
    }

    // calculate queueTimeout option if not defined
    if (isNaN(opts.queueTimeout)) {
        opts.queueTimeout = opts.timeout + this.QUEUE_TIMEOUT_DELTA;
    }

    this.options = opts;

    // build request body
    if (typeof this.options.body !== 'undefined') {
        this.compileBody();

        if ( ! this.options.headers['content-length']) {
            this.options.headers['content-length'] = this.options.body.length;
        }
    }

    // add "gzip" to the "accept-encoding" header
    if (this.options.allowGzip) {
        acceptEncoding = this.options.headers['accept-encoding'] || '*';

        if (acceptEncoding.indexOf('gzip') === -1) {
            this.options.headers['accept-encoding'] = 'gzip, ' + acceptEncoding;
        }
    }

    this.retries = null;
    this._retrier = retry.operation({
        retries : this.options.maxRetries,
        minTimeout : this.options.minRetriesTimeout,
        maxTimeout : this.options.maxRetriesTimeout
    });
    this._isRunning = null;
    this._executionTime = null;
    this._networkTime = null;

    // setup callbacks
    this._callback = callback;
    this._onretry = opts.onretry;
}

/**
 * expose AskerError for end user
 * @type {Function} Error constructor, inherited from Terror
 * @see http://npm.im/terror
 */
Request.Error = AskerError;

/**
 * default Request options
 * @type {Object}
 */
Request.DEFAULT_OPTIONS = {
    protocol : 'http:',
    host : 'localhost',
    path : '/',
    method : 'GET',
    bodyEncoding : 'string',
    maxRetries : 0,
    minRetriesTimeout : 300,
    maxRetriesTimeout : Infinity,
    timeout : 500,
    allowGzip : true,
    requestId : '',
    url : undefined,
    headers : undefined,
    query : undefined,
    body : undefined,
    onretry : undefined,
    statusFilter : undefined,
    queueTimeout : undefined,
    agent : undefined,
    port : undefined
};

/**
 * Body encoding methods
 * @type {Object}
 * @see ./body_encoders.js
 */
Request.bodyEncoders = require('./body_encoders');

/**
 * Compiles HTTP request body from Request#options.body object
 * using body encoders
 * @throws {AskerError} UNEXPECTED_ENCODER_ERROR
 */
Request.prototype.compileBody = function() {
    var encoderName = this.options.bodyEncoding,
        encoders = this.constructor.bodyEncoders;

    if ( ! has(encoders, encoderName)) {
        throw AskerError.createError(
            AskerError.CODES.BODY_ENCODER_NOT_EXIST, { encoder : encoderName });
    }

    try {
        // execute encoder in the context of the instance of Request
        this.options.body = encoders[encoderName].call(this, this.options.body, this.setContentType.bind(this));
    } catch (encoderError) {
        throw AskerError
            .ensureError(encoderError, AskerError.CODES.UNEXPECTED_ENCODER_ERROR)
            .bind({ encoder : encoderName });
    }
};

/**
 * Sets 'content-type' header value
 * if it was not previously set or override argument evals as `true`
 * @param {String} contentType
 * @param {Boolean} [override]
 * @returns {String} actual "Content-Type" header value
 */
Request.prototype.setContentType = function(contentType, override) {
    if (override || ! has(this.options.headers, 'content-type')) {
        this.options.headers['content-type'] = contentType;
    }
    return this.options.headers['content-type'];
};

/**
 * Used to calculate queueTimeout = timeout + QUEUE_TIMEOUT_DELTA
 * @type {Number}
 * @const
 */
Request.prototype.QUEUE_TIMEOUT_DELTA = 50;

/**
 * Default status codes filter.
 * Accept or decline status code, allows or decline retries
 * @see https://github.com/nodules/asker#response-status-codes-processing
 *
 * @param {Number} code
 * @returns {{accept : Boolean, isRetryAllowed : Boolean}}
 */
Request.prototype.statusCodeFilter = function(code) {
    return {
        accept : code === 200 || code === 201,
        isRetryAllowed : 400 > code || code > 499
    };
};

/**
 * @returns {{network: (undefined|number), total: (undefined|number)}}
 */
Request.prototype.getTimers = function() {
    return {
        network : this._networkTime ? this._networkTime.time : void(0),
        total : this._executionTime ? this._executionTime.time : void(0)
    };
};

/**
 * timestamp for error messages in the '[in XX~YY ms]' format
 * XX – time between socket was assigned for request and response or error retrieved
 * YY – time about `execute` method call and response or error retrieved
 * @returns {String}
 */
Request.prototype.formatTimestamp = function() {
    var timers = this.getTimers();

    // @todo let user to use custom format
    return 'in ' + (timers.network || '0') + '~' + timers.total + ' ms';
};

/**
 * @returns {{time:{network:number,total:number},retries:{used:number,limit:number}}}
 */
Request.prototype.getResponseMetaBase = function() {
    return {
        time : this.getTimers(),
        options : this.options,
        retries : {
            used : this.retries,
            limit : this.options.maxRetries
        }
    };
};

/**
 * Getter of the private _isRunning flag
 *
 * @memberOf Request.prototype
 * @field {Boolean} isRunning
 */
Object.defineProperty(Request.prototype, 'isRunning', {
    get : function() {
        return Boolean(this._isRunning);
    },
    enumerable : true
});

/**
 * @returns {Object} used to fill common placeholders of Asker errors (%timings, %url, %requestId%)
 */
Request.prototype.getCommonErrorData = function() {
    return {
        timings : this.formatTimestamp(),
        url : this.getUrl(),
        requestId : this.options.requestId
    };
};

/**
 * @param {String} timerId Short timer name
 * @returns {String} Full timer nme, which satisfies the pattern "asker.<requestId>.<timerId>"
 */
Request.prototype.buildTimerId = function(timerId) {
    var base = 'asker.';

    if (this.options.requestId) {
        base += this.options.requestId + '.';
    }

    return base + timerId;
};

/**
 * Sets _isRunning flag to false and call the callback if any
 *
 * @param {Error} err
 * @param {Object} [data]
 * @returns {*}
 */
Request.prototype.done = function(err, data) {
    this._isRunning = false;

    if ( ! this._networkTime) {
        this._networkTime = contimer.stop(this, this.buildTimerId('network'));
    }

    if ( ! this._executionTime) {
        this._executionTime = contimer.stop(this, this.buildTimerId('execution'));
    }

    if (err instanceof AskerError) {
        err.bind(this.getCommonErrorData());
    }

    if (typeof this._callback === 'function') {
        this._callback(err, data);
    }
};

/**
 * @returns {String} request URL for errors details producing
 */
Request.prototype.getUrl = function() {
    return this.options.protocol + '//' + this.options.hostname + ':' + this.options.port + this.options.path;
};

/**
 * Handles request retries. Throw an error if retries limit exceeded.
 * @param {AskerError} retryReason error which is a reason for retry
 * @private
 */
Request.prototype._retryHttpRequest = function(retryReason) {
    this.retries++;

    if (typeof this._onretry === 'function') {
        // call `onretry` callback if any has been passed to the constructor in the options.onretry
        // used to notify callee about retries
        this._onretry(retryReason, this.retries);
    }

    if ( ! this._retrier.retry(retryReason)) {
        this._executionTime = contimer.stop(this, this.buildTimerId('execution'));

        // retries limit exceeded
        // throw an RETRIES_LIMIT_EXCEEDED if retries allowed for request
        // or retry reason error in other case
        if (this.options.maxRetries > 0) {
            // @todo throw following error with `reason` prop which contains retryReason
            // so user code can determine limits exceeded errors
            retryReason = AskerError
                .createError(
                    AskerError.CODES.RETRIES_LIMIT_EXCEEDED,
                    retryReason.bind(this.getCommonErrorData()))
                .bind({
                    maxRetries : this.options.maxRetries
                });
        }

        this.done(retryReason);
    }
};

/**
 * Runs the request
 * @param {Object} options request params the same as for http.request
 * @private
 */
Request.prototype._tryHttpRequest = function(options) {
    var self = this,
        requestModule = options.protocol === 'https:' ? https : http;

    /** @type {undefined|http.ClientRequest} */
    var httpRequest = requestModule.request(options, /** @param {http.IncomingMessage} res */ function(res) {
        /** @type {{ accept : Boolean, isRetryAllowed : Boolean }} */
        var statusFilterResult = self.statusCodeFilter(res.statusCode);

        // if status code isn't accepted by status filter
        // then abort current request execution and
        // retry request or raise `UNEXPECTED_STATUS_CODE` error
        if ( ! statusFilterResult.accept) {
            httpRequest.break();

            var error = AskerError.createError(
                AskerError.CODES.UNEXPECTED_STATUS_CODE,
                {
                    statusCode : res.statusCode,
                    url : self.getUrl()
                });

            if (statusFilterResult.isRetryAllowed) {
                return self._retryHttpRequest(error);
            } else {
                return self.done(error);
            }
        }

        /** @type {Array|Buffer} */
        var body = [],
            /** @type Number calculated for chunked request to boost buffers concatenation */
            bodyLength = 0;

        res = unzipResponse(res);

        res.on('data', function(chunk) {
            body.push(chunk);
            bodyLength += chunk.length;
        });

        res.on('end', function() {
            httpRequest.clearTimeouts();

            if (httpRequest.rejected) {
                // don't try to produce response if any error,
                // like http parser error, was recieved early from http client
                // @todo may be needs to be revised in the future
                return;
            }

            var data = Buffer.concat(body, bodyLength);

            self._executionTime = contimer.stop(self, self.buildTimerId('execution'));

            self.done(null, {
                statusCode : res.statusCode,
                data : data.length > 0 ? data : null,
                headers : res.headers,
                meta : self.getResponseMetaBase()
            });
        });

        res.once('error', function(error) {
            httpRequest.clearTimeouts();

            if (has(zlibErrors, error.code)) {
                error = AskerError.createError(AskerError.CODES.GUNZIP_ERROR, error);
            }

            self.done(error);
        });
    });

    /**
     * clear queue and socket timeouts if any
     */
    httpRequest.clearTimeouts = function() {
        // stop tracking time for network operations
        self._networkTime = contimer.stop(self, self.buildTimerId('network'));

        if (httpRequest.socketTimeout) {
            clearTimeout(httpRequest.socketTimeout);
            httpRequest.socketTimeout = null;
        }

        if (httpRequest.queueTimeout) {
            clearTimeout(httpRequest.queueTimeout);
            httpRequest.queueTimeout = null;
        }
    };

    /**
     * breaks request execution and retry request if errorCode provided as retry reason
     *
     * @param {String} errorCode Asker.Error code
     * @param {Object} errorData data for Asker.Error message interpolation
     */
    httpRequest.break = function(errorCode, errorData) {
        httpRequest.clearTimeouts();

        // mark this request as rejected, response must not be built in this case
        httpRequest.rejected = true;
        httpRequest.abort();

        // force socket removing due to errors
        httpRequest.emit('removeSocket');

        if (errorCode) {
            // call for retry if error provided as the reason for it
            self._retryHttpRequest(AskerError.createError(errorCode, errorData));
        }
    };

    // setup queue timeout
    httpRequest.queueTimeout = setTimeout(function() {
        httpRequest.break(AskerError.CODES.QUEUE_TIMEOUT);
    }, options.queueTimeout);

    // socket assigned to request
    httpRequest.on('socket', function() {
        // start tracking time of the network operations
        contimer.start(self, self.buildTimerId('network'));

        httpRequest.socketTimeout = setTimeout(function() {
            httpRequest.break(AskerError.CODES.SOCKET_TIMEOUT);
        }, options.timeout);
    });

    httpRequest.on('error', function(error) {
        if ( ! httpRequest.rejected) {
            // don't try to break request execution twice or more
            httpRequest.break(AskerError.CODES.HTTP_CLIENT_REQUEST_ERROR, error);
        }
    });

    // send request body
    if (typeof options.body !== 'undefined') {
        httpRequest.write(options.body);
    }

    httpRequest.end();
};

/**
 * Executes the request
 * @param {Function} [callback]
 * @returns {Boolean} `false` if request already running
 */
Request.prototype.execute = function(callback) {
    // don't try to execute already running request
    if (this.isRunning) {
        return false;
    }

    // @todo may be throw error if _callback is defined already
    if (typeof callback === 'function') {
        this._callback = callback;
    }

    this._isRunning = true;
    this.retries = 0;

    // start tracing total request execution time
    // including networks ops time, asker code execution and queue in the pool
    contimer.start(this, this.buildTimerId('execution'));

    var agent = this.options.agent;

    if (typeof agent === 'object' && typeof agent.addRequest !== 'function') {
        agent = new AdvancedAgent(assign({ protocol : this.options.protocol }, agent));
    }

    var options = assign({}, this.options, { agent : agent }),
        self = this;

    this._retrier.attempt(function() {
        self._tryHttpRequest(options);
    });

    return true;
};

module.exports = Request;
