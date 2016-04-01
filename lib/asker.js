var http = require('http'),
    https = require('https'),
    url = require('url'),
    assign = require('object-assign'),
    contimer = require('contimer'),
    retry = require('retry'),
    unzipResponse = require('unzip-response'),
    advancedAgent = require('asker-advanced-agent'),
    AskerError = require('./error'),
    bodyEncoders = require('./body_encoders'),
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
 * @property {Number}  [maxSockets] Pool size, used only if new agent defined
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
 * @property {String}   [bodyEncoding="string"] Body encoding method = multipart|urlencoded|text|stringify
 *    If multipart chosen, there are two ways to transfer file content at body:
 *    - directly as buffer: { param_name: <Buffer ...> }
 *    - with extended info: { param_name: {filename: 'pic.jpg', mime: 'image/jpeg', data: <Buffer ...>} }
 * @property {Function} [isNetworkError] (code Number) Checks whether the given status code
 *    should be treated as network error. By default only codes less than 500 are acceptable.
 * @property {Function} [isRetryAllowed] (err AskerError) Determines if retry is allowed for the given reason
 * @property {Number}   [maxRetries=0] Max number of allowed retries for request
 * @property {Number}   [minRetriesTimeout=300] The number of milliseconds before starting the first retry
 * @property {Number}   [maxRetriesTimeout=Infinity] The maximum number of milliseconds between two retries
 * @property {Number}   [timeout=500] Socket timeout
 * @property {Number}   [queueTimeout=50] Queue timeout
 * @property {Boolean}  [allowGzip=true] Allows response compression with gzip
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
    // execute request immediately after construction if called without `new`
    if ( ! (this instanceof Request)) {
        return (new Request(options, callback))._execute();
    }

    this.options = this._processOptions(options);

    // build request body
    if (typeof this.options.body !== 'undefined') {
        this.options.body = this._compileBody();

        if ( ! this.options.headers['content-length']) {
            this.options.headers['content-length'] = this.options.body.length;
        }
    }

    var acceptEncoding;

    // add "gzip" to the "accept-encoding" header
    if (this.options.allowGzip) {
        acceptEncoding = this.options.headers['accept-encoding'] || '*';

        if (acceptEncoding.indexOf('gzip') === -1) {
            this.options.headers['accept-encoding'] = 'gzip, ' + acceptEncoding;
        }
    }

    var agent = this.options.agent;

    if (typeof agent === 'object' && typeof agent.addRequest !== 'function') {
        this.options.agent = this._createAgent(agent);
    }

    if (typeof this.options.isNetworkError === 'function') {
        this._isNetworkError = this.options.isNetworkError;
    } else {
        this._isNetworkError = null;
    }

    if (typeof this.options.isRetryAllowed === 'function') {
        this._isRetryAllowed = this.options.isRetryAllowed;
    } else {
        this._isRetryAllowed = null;
    }

    // number of retries spent
    this.retries = null;

    this._retrier = retry.operation({
        retries: this.options.maxRetries,
        minTimeout: this.options.minRetriesTimeout,
        maxTimeout: this.options.maxRetriesTimeout
    });
    this._isRunning = null;

    // context used to store contimer's meta data
    this._timerCtx = Object.create(null);
    this._executionTime = null;
    this._networkTime = null;

    // setup callbacks
    this._callback = callback;
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
    protocol: 'http:',
    host: 'localhost',
    path: '/',
    method: 'GET',
    bodyEncoding: 'string',
    maxRetries: 0,
    minRetriesTimeout: 300,
    maxRetriesTimeout: Infinity,
    isNetworkError: undefined,
    isRetryAllowed: undefined,
    queueTimeout: 50,
    timeout: 500,
    allowGzip: true,
    requestId: '',
    url: undefined,
    headers: undefined,
    query: undefined,
    body: undefined,
    agent: undefined,
    port: undefined
};

/**
 * Body encoding methods
 * @type {Object}
 */
Request.bodyEncoders = bodyEncoders;

Request.prototype._processOptions = function(options) {
    var opts = assign({}, Request.DEFAULT_OPTIONS);

    var headers = {},
        key;

    // override default options with passed hash
    if (typeof options === 'object') {
        var optKeys = Object.keys(options),
            k = optKeys.length;

        while (k--) {
            key = optKeys[k];
            // @note copy only non-undefined fields from passed options
            if (typeof options[key] !== 'undefined') {
                opts[key] = options[key];
            }
        }

        opts.hostname = options.hostname;

        // lowercase headers names
        if (typeof options.headers === 'object') {
            var optHeaders = Object.keys(options.headers),
                h = 0;

            while ((key = optHeaders[h++])) {
                headers[key.toLocaleLowerCase()] = options.headers[key];
            }
        }
    }

    opts.headers = headers;

    // set hostname option if not set
    if (typeof opts.hostname === 'undefined') {
        opts.hostname = opts.host;
    }

    // uppercase method name
    opts.method = opts.method.toUpperCase();

    var parsedUrl,
        parsedPath;

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

    return opts;
};

Request.prototype._createAgent = function(agentOpts) {
    var options = this.options,
        defaultOpts = {
            name: undefined,
            protocol: options.protocol
        };

    // @note we have to pass TLS options to Agent explicitly because Node.js<0.12 doesn't do it
    if (options.protocol === 'https:') {
        if (typeof options.ca !== 'undefined') {
            defaultOpts.ca = options.ca;
        }
        if (typeof options.cert !== 'undefined') {
            defaultOpts.cert = options.cert;
        }
        if (typeof options.ciphers !== 'undefined') {
            defaultOpts.ciphers = options.ciphers;
        }
        if (typeof options.key !== 'undefined') {
            defaultOpts.key = options.key;
        }
        if (typeof options.passphrase !== 'undefined') {
            defaultOpts.passphrase = options.passphrase;
        }
        if (typeof options.pfx !== 'undefined') {
            defaultOpts.pfx = options.pfx;
        }
        if (typeof options.rejectUnauthorized !== 'undefined') {
            defaultOpts.rejectUnauthorized = options.rejectUnauthorized;
        }
    }

    return advancedAgent(assign(defaultOpts, agentOpts));
};

/**
 * @param {String} encoderName
 * @param {*} body
 * @param {Function} setStatusCode
 * @return {*}
 * @throws {AskerError} UNEXPECTED_ENCODER_ERROR
 */
function tryCompileBody(encoderName, body, setStatusCode) {
    try {
        // execute encoder in the context of the instance of Request
        return bodyEncoders[encoderName](body, setStatusCode);
    } catch (encoderError) {
        throw AskerError
            .ensureError(encoderError, AskerError.CODES.UNEXPECTED_ENCODER_ERROR)
            .bind({ encoder: encoderName });
    }
}

/**
 * Compiles HTTP request body from Request#options.body object
 * using body encoders
 * @throws {AskerError} UNEXPECTED_ENCODER_ERROR
 * @private
 */
Request.prototype._compileBody = function() {
    var encoderName = this.options.bodyEncoding;

    if ( ! has(bodyEncoders, encoderName)) {
        throw AskerError.createError(
            AskerError.CODES.BODY_ENCODER_NOT_EXIST, { encoder: encoderName });
    }

    return tryCompileBody(encoderName, this.options.body, this._setContentType.bind(this));
};

/**
 * Sets 'content-type' header value
 * if it was not previously set or override argument evals as `true`
 * @param {String} contentType
 * @param {Boolean} [override]
 * @returns {String} actual "Content-Type" header value
 * @private
 */
Request.prototype._setContentType = function(contentType, override) {
    if (override || ! has(this.options.headers, 'content-type')) {
        this.options.headers['content-type'] = contentType;
    }
    return this.options.headers['content-type'];
};

/**
 * @returns {{network: (undefined|number), total: (undefined|number)}}
 */
Request.prototype.getTimers = function() {
    return {
        network: this._networkTime ? this._networkTime.time : undefined,
        total: this._executionTime ? this._executionTime.time : undefined
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

    // @todo let user use custom format
    return 'in ' + (timers.network || '0') + '~' + timers.total + ' ms';
};

/**
 * @returns {{time:{network:number,total:number},retries:{used:number,limit:number}}}
 */
Request.prototype.getResponseMetaBase = function() {
    return {
        time: this.getTimers(),
        options: this.options,
        retries: {
            used: this.retries,
            limit: this.options.maxRetries
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
    get: function() {
        return Boolean(this._isRunning);
    },
    enumerable: true
});

/**
 * @returns {Object} used to fill common placeholders of Asker errors (%timings, %url, %requestId%)
 */
Request.prototype.getCommonErrorData = function() {
    return {
        time: this.getTimers(),
        timings: this.formatTimestamp(),
        url: this.getUrl(),
        requestId: this.options.requestId
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
 * Sets _isRunning flag to false, stop timers and call the callback if any
 *
 * @param {Error} err
 * @param {Object} [data]
 */
Request.prototype.done = function(err, data) {
    this._isRunning = false;

    if ( ! this._networkTime) {
        this._networkTime = contimer.stop(this._timerCtx, this.buildTimerId('network'));
    }

    if ( ! this._executionTime) {
        this._executionTime = contimer.stop(this._timerCtx, this.buildTimerId('execution'));
    }

    if (err instanceof AskerError) {
        err.bind(this.getCommonErrorData());
    }

    if (typeof this._callback === 'function') {
        this._callback(err, data);
    }
};

/**
 * Processes status code with internal `_isNetworkError` filter.
 * Returns new "UNEXPECTED_STATUS_CODE" error if status code is not allowed.
 *
 * @see https://github.com/nodules/asker#response-status-codes-processing
 *
 * @param {Number} code
 * @returns {AskerError}
 * @private
 */
Request.prototype._createNetworkError = function(code) {
    var isNetworkError = typeof this._isNetworkError === 'function' ?
        this._isNetworkError(code) :
        code > 499;

    if (isNetworkError) {
        return AskerError.createError(
            AskerError.CODES.UNEXPECTED_STATUS_CODE, { statusCode: code, url: this.getUrl() });
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
    if (typeof this._isRetryAllowed === 'function' && this._isRetryAllowed(retryReason) === false) {
        return this.done(retryReason);
    }

    this.retries++;

    var error;

    if ( ! this._retrier.retry(retryReason)) {
        this._executionTime = contimer.stop(this._timerCtx, this.buildTimerId('execution'));

        // retries limit exceeded
        // throw an RETRIES_LIMIT_EXCEEDED if retries allowed for request
        // or retry reason error in other case
        if (this.options.maxRetries > 0) {
            // @todo throw following error with `reason` prop which contains retryReason
            // so user code can determine limits exceeded errors
            error = AskerError
                .createError(
                    AskerError.CODES.RETRIES_LIMIT_EXCEEDED,
                    retryReason.bind(this.getCommonErrorData()))
                .bind({
                    maxRetries: this.options.maxRetries
                });
        } else {
            error = retryReason;
        }

        this.done(error);
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

    /** @type {http.ClientRequest} */
    var httpRequest = requestModule.request(options, /** @param {http.IncomingMessage} res */ function(res) {
        var error = self._createNetworkError(res.statusCode);

        if (error) {
            // abort current request execution in case of network errors
            return breakRequest(error);
        }

        res = unzipResponse(res);

        res.once('error', function(error) {
            clearTimeouts();

            if (httpRequest.rejected) {
                // Ingnore response "error" event in case of aborted request
                return;
            }

            if (has(zlibErrors, error.code)) {
                error = AskerError.createError(AskerError.CODES.GUNZIP_ERROR, error);
            }

            self.done(error);
        });

        var body = [],
            bodyLength = 0;

        res.on('data', function(chunk) {
            body.push(chunk);
            bodyLength += chunk.length;
        });

        res.on('end', function() {
            clearTimeouts();

            if (httpRequest.rejected) {
                // don't try to produce response if any error,
                // like http parser error, was recieved early from http client
                // @todo may be needs to be revised in the future
                return;
            }

            self._executionTime = contimer.stop(self._timerCtx, self.buildTimerId('execution'));

            var data = Buffer.concat(body, bodyLength);

            self.done(null, {
                statusCode: res.statusCode,
                data: data.length > 0 ? data : null,
                headers: res.headers,
                meta: self.getResponseMetaBase()
            });
        });
    });

    var queueTimeout,
        socketTimeout;

    /**
     * Clears queue and socket timeouts if any
     */
    function clearTimeouts() {
        // stop tracking time for network operations
        self._networkTime = contimer.stop(self._timerCtx, self.buildTimerId('network'));

        if (socketTimeout) {
            clearTimeout(socketTimeout);
            socketTimeout = null;
        }

        if (queueTimeout) {
            clearTimeout(queueTimeout);
            queueTimeout = null;
        }
    }

    /**
     * Breaks request execution and retry request if retryReason is provided
     * @param {AskerError} [retryReason]
     */
    function breakRequest(retryReason) {
        clearTimeouts();

        // mark this request as rejected, response must not be built in this case
        httpRequest.rejected = true;
        // force agent "freeness" (e.g. release) in Node.js<0.12 and dump response object internally
        httpRequest.abort();

        if (retryReason) {
            // call for retry if retryReason provided
            self._retryHttpRequest(retryReason);
        }
    }

    // socket assigned to request
    httpRequest.on('socket', function() {
        if (queueTimeout) {
            clearTimeout(queueTimeout);
            queueTimeout = null;
        }

        // do nothing if request was already aborted
        if (httpRequest.rejected) {
            return;
        }

        // start tracking time of the network operations
        contimer.start(self._timerCtx, self.buildTimerId('network'));

        if ( ! socketTimeout) {
            socketTimeout = setTimeout(function() {
                breakRequest(AskerError.createError(AskerError.CODES.SOCKET_TIMEOUT));
            }, options.timeout);
        }
    });

    httpRequest.on('error', function(error) {
        if ( ! httpRequest.rejected) {
            // don't try to break request execution twice or more
            breakRequest(AskerError.createError(AskerError.CODES.HTTP_CLIENT_REQUEST_ERROR, error));
        }
    });

    // setup queue timeout
    queueTimeout = setTimeout(function() {
        breakRequest(AskerError.createError(AskerError.CODES.QUEUE_TIMEOUT));
    }, options.queueTimeout);

    // send request body
    if (typeof options.body !== 'undefined') {
        httpRequest.write(options.body);
    }

    httpRequest.end();
};

/**
 * Executes the request
 * @returns {Boolean} `false` if request already running
 * @private
 */
Request.prototype._execute = function() {
    // don't try to execute already running request
    if (this._isRunning) {
        return false;
    }

    this.retries = 0;
    this._isRunning = true;

    // start tracing total request execution time
    // including networks ops time, asker code execution and queue in the pool
    contimer.start(this._timerCtx, this.buildTimerId('execution'));

    var self = this;

    this._retrier.attempt(function() {
        self._tryHttpRequest(self.options);
    });

    return true;
};

module.exports = Request;
