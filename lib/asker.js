var http = require('http'),
    https = require('https'),
    zlib = require('zlib'),
    url = require('url'),
    extend = require('extend'),
    contimer = require('contimer'),
    agentFactory = require('./advanced_agent'),
    AskerError = require('./error');

/**
 * Shorthand to call Object#hasOwnProperty in context of the obj with propName argument.
 * @param {Object} obj context object to check
 * @param {String} propName property name to check
 * @returns {Boolean}
 */
function has (obj, propName) {
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
    this.options = extend({}, Request.DEFAULT_OPTIONS, options);

    // set hostname option if not set
    this.options.hostname = this.options.hostname || this.options.host;

    // setup callbacks
    this._callback = callback;
    this._onretry = this.options.onretry;

    // uppercase method name
    this.options.method = this.options.method.toUpperCase();

    // override status codes filter if passed in the options
    if (typeof this.options.statusFilter === 'function') {
        this.statusCodeFilter = this.options.statusFilter;
    }

    // lowercase headers names
    this.options.headers = (options && options.headers) ?
        Object.keys(this.options.headers).reduce(function(headers, headerName) {
            headers[headerName.toLowerCase()] = options.headers[headerName];

            return headers;
        }, {}) :
        {};

    // produce `host`, `port` and `path` options from the `url` option
    if (this.options.url) {
        // allow url without protocol (use 'http' by default)
        if ( ! /^https?:\/\//ig.test(this.options.url)) {
            this.options.url = 'http://' + this.options.url;
        }

        parsedUrl = url.parse(this.options.url, true);

        this.options.protocol = parsedUrl.protocol;
        this.options.host = this.options.hostname = parsedUrl.hostname;
        this.options.port = parseInt(parsedUrl.port, 10);
        this.options.path = parsedUrl.path;
    }

    // set default port (80 for http and 443 for https)
    if ( ! this.options.port) {
        this.options.port = this.options.protocol === 'https:' ? 443 : 80;
    }

    // rebuild path with query params
    // `query` hash properties has higher priority than the specified in the `path` string does
    if (this.options.query) {
        parsedPath = url.parse(this.options.path, true);

        // `search` prop has higher priority than the `query` then remove it
        delete parsedPath.search;
        extend(parsedPath.query, this.options.query);

        this.options.path = url.format(parsedPath);
    }

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

    // calculate queueTimeout option if not defined
    if (isNaN(this.options.queueTimeout)) {
        this.options.queueTimeout = this.options.timeout + this.QUEUE_TIMEOUT_DELTA;
    }
}

/**
 * expose AskerError for end user
 * @type {Fucntion} Error constructor, inherited from Terror
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
 * Set 'content-type' header value
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
 * used to calculate queueTimeout = timeout + QUEUE_TIMEOUT_DELTA
 * @type {Number}
 * @const
 */
Request.prototype.QUEUE_TIMEOUT_DELTA = 50;

/**
 * default pool sizes
 */
http.globalAgent.maxSockets = 1024;
https.globalAgent.maxSockets = 1024;
http.Agent.defaultMaxSockets = 1024;
https.Agent.defaultMaxSockets = 1024;

/**
 * Returns existing agent from agents pool or creates new if no one exists with requested name.
 * Method have the side-effect: if you call it twice or more with same agent name,
 * but other options is different, then Agent willn't be reconfigured.
 *
 * @param {Request} request instance
 * @returns {Agent|AdvancedAgent|Boolean}
 */
Request.getAgent = function(request) {
    if (request.options.agent === false) {
        return false;
    }

    var options = request.options.agent,
        protocol = request.options.protocol.split(':')[0],
        name = options && options.name,
        AdvancedAgent = agentFactory(protocol),
        assignedAgent;

    // returns `http.globalAgent` if agent name is undefined or equals 'globalAgent'
    if ( ! name || name === 'globalAgent') {
        assignedAgent = protocol === 'https' ? https.globalAgent : http.globalAgent;
    } else {
        assignedAgent = AdvancedAgent.get(name);
    }

    // if agent is not globalAgent or is not exists in the pool, then create one
    return assignedAgent || new AdvancedAgent(extend({ persistent : true }, options));
};

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
    return ['in ', timers.network || '0', '~', timers.total, ' ms'].join('');
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
 * Set _isRunning flag to false and call the callback if any
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
 * Successfully resolve request
 *
 * @param {Number} code http status code
 * @param {*} response data
 * @param {Object} [meta]
 * @param {Object} headers http response headers
 */
Request.prototype.resolve = function(code, response, meta, headers) {
    this._executionTime = contimer.stop(this, this.buildTimerId('execution'));

    this.done(null, {
        data : response,
        statusCode : code,
        headers : headers,
        meta : meta ? extend(this.getResponseMetaBase(), meta) : this.getResponseMetaBase()
    });
};

/**
 * @returns {String} request URL for errors details producing
 */
Request.prototype.getUrl = function() {
    return [
            this.options.protocol,
            '//',
            this.options.hostname,
            ':',
            this.options.port,
            this.options.path
        ].join('');
};

/**
 * Handle request retries. Throw an error if retries limit exceeded.
 * @param {Object} requestOptions same as for _tryHttpRequest
 * @param {AskerError} retryReason error which is a reason for retry
 * @private
 */
Request.prototype._retryHttpRequest = function(requestOptions, retryReason) {
    if (this.retries >= this.options.maxRetries) {
        // retries limit exceeded
        // throw an RETRIES_LIMIT_EXCEEDED if retries allowed for request
        // or retry reason error in another case
        if (this.options.maxRetries > 0) {
            this._executionTime = contimer.stop(this, this.buildTimerId('execution'));

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
    } else {
        this.retries++;

        if (typeof this._onretry === 'function') {
            // call `onretry` callback if any has been passed to the constructor in the options.onretry
            // used to notify callee about retries
            this._onretry(retryReason, this.retries);
        }

        // @todo may be in the next tick?
        this._tryHttpRequest(requestOptions);
    }
};

/**
 * run the request
 * @param {Object} options request params the same as for http.request
 * @private
 */
Request.prototype._tryHttpRequest = function(options) {
    var self = this,

        requestModule = options.protocol === 'https:' ? https : http,

        /** @type {undefined|http.ClientRequest} */
        httpRequest,

        /**
         * @type {Function}
         * @param {Error} reason
         */
        retryRequest = this._retryHttpRequest.bind(this, options);

    httpRequest = requestModule.request(options, /** @param {http.IncomingMessage} res */ function(res) {
        /** @type {{ accept : Boolean, isRetryAllowed : Boolean }} */
        var statusFilterResult,
            /** @type {Array|Buffer} */
            body = [],
            /** @type Number calculated for chunked request to boost buffers concatenation */
            bodyLength = 0;

        statusFilterResult = self.statusCodeFilter(res.statusCode);

        // if status code isn't accepted by status filter
        // then abort current request execution and
        // retry reqeust or raise the UNEXPECTED_STATUS_CODE error
        if ( ! statusFilterResult.accept) {
            var error;

            httpRequest.break();

            error = AskerError.createError(
                AskerError.CODES.UNEXPECTED_STATUS_CODE,
                {
                    statusCode : res.statusCode,
                    url : self.getUrl()
                });

            if (statusFilterResult.isRetryAllowed) {
                return retryRequest(error);
            } else {
                return self.done(error);
            }
        }

        res.on('data', function(chunk) {
            body.push(chunk);
            bodyLength += chunk.length;
        });

        res.on('end', function() {
            var encoding;

            httpRequest.clearTimeouts();

            if (httpRequest.rejected) {
                // don't try to produce response if any error,
                // like http parser error, was recieved early from http client
                // @todo may be needs to be revised in the future
                return;
            }

            encoding = res.headers['content-encoding'];
            body = Buffer.concat(body, bodyLength);

            // @todo "gzip" presence test must be improved to don't pass anything like "ggzip"
            // @todo don't miss to write the test for it
            if (encoding && encoding.toLowerCase().indexOf('gzip') > -1) {
                zlib.gunzip(body, function(error, deflatedBody) {
                    if (error) {
                        self.done(AskerError.createError(AskerError.CODES.GUNZIP_ERROR, error));
                    } else {
                        self.resolve(res.statusCode, deflatedBody, { gzip : true }, res.headers);
                    }
                });
            } else {
                self.resolve(res.statusCode, body.length > 0 ? body : null, {}, res.headers);
            }
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
     * @param {Number} errorCode Asker.Error code
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
            retryRequest(AskerError.createError(errorCode, errorData));
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
    if (typeof this.options.body !== 'undefined') {
        httpRequest.write(this.options.body);
    }

    httpRequest.end();
};

/**
 * Execute request
 * @param {Function} [callback]
 * @returns {boolean} `false` if request already running
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

    this.retries = 0;
    this._isRunning = true;

    // start tracing total request execution time
    // including networks ops time, asker code execution and queue in the pool
    contimer.start(this, this.buildTimerId('execution'));

    this._tryHttpRequest(extend({}, this.options, { agent : Request.getAgent(this) }));

    return true;
};

module.exports = Request;
