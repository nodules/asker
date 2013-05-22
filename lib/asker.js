var http = require('http'),
    zlib = require('zlib'),
    url = require('url'),
    extend = require('extend'),
    AdvancedAgent = require('./advanced_agent'),
    AskerError = require('./error');

/**
 * @typedef {Object} AgentOptions
 * @property {String}  [name=globalAgent] Agent name, use 'globalAgent' for http.globalAgent
 * @property {Number}  [maxSockets=1024] Pool size, used only if new agent defined
 * @property {Boolean} [persistent=true] Non-persistent agents removed when queue empty
 */

/**
 * @typedef  {Object} RequestOptions
 * @property {String}   [host=localhost]
 * @property {Number}   [port=80]
 * @property {String}   [path=/]
 * @property {String}   [method=GET] HTTP-method
 * @property {Object}   [headers] HTTP headers hash
 * @property {Object}   [query] Query params hash
 * @property {String}   [requestId=''] Request identifier for error messages
 * @property {*}        [body] Request body for POST, PUT and PATCH methods, JSON.stringify applies if Object
 * @property {Number}   [maxRetries=0] Max number of allowed retries for request
 * @property {Function} [onretry] (reason Error, retryCount Number) called on retries
 * @property {Number}   [timeout=500] Socket timeout
 * @property {Number}   [queueTimeout=timeout+50] Queue timeout
 * @property {Boolean}  [allowGzip=true] Allows response compression with gzip
 * @property {Function} [statusFilter] (code Number) Filter which determines acceptable status codes
 *      by default only 200 and 201 codes acceptable and retries allowed for all codes, except range from 400 to 499.
 *      Must returns object { accept : Boolean, isRetryAllowed : Boolean }.
 * @property {AgentOptions} [agent] http.Agent options
 */

/**
 * Create new instance and calls the `execute()` method if called as function (without `new`).
 *
 * @constructor
 * @param {RequestOptions} options object with only `host` field required
 * @param {Function} callback
 */
function Request(options, callback) {
    var parsedPath,
        acceptEncoding;

    if ( ! (this instanceof Request)) {
        return (new Request(options, callback)).execute();
    }

    this.options = extend({}, Request.DEFAULT_OPTIONS, options);

    this._callback = callback;
    this._onretry = this.options.onretry;

    if (typeof this.options.statusFilter === 'function') {
        this.statusCodeFilter = this.options.statusFilter;
    }

    // lowercase headers names
    this.options.headers = ( ! options.headers) ?
        {} :
        Object.keys(this.options.headers).reduce(function(headers, headerName) {
            headers[headerName.toLowerCase()] = options.headers[headerName];

            return headers;
        }, {});

    // rebuild path with query params
    // `query` hash properties has higher priority than the specified in the `path` string does
    if (this.options.query) {
        parsedPath = url.parse(this.options.path, true);

        // `search` prop has higher priority than the `query` then remove it
        delete parsedPath.search;
        extend(parsedPath.query, this.options.query);

        this.options.path = url.format(parsedPath);
    }

    // lets build request body for POST, PUT and PATCH methods
    if (['POST','PUT','PATCH'].indexOf(this.options.method) > -1 && typeof this.options.body !== 'undefined') {
        this.options.body = (typeof this.options.body === 'object') ?
            JSON.stringify(this.options.body) :
            String(this.options.body);

        // @todo does we must support encodings rather than 'utf8'?
        if ( ! this.options.headers['content-length']) {
            this.options.headers['content-length'] = Buffer.byteLength(this.options.body, 'utf8');
        }
    }

    if (this.options.allowGzip) {
        acceptEncoding = this.options.headers['accept-encoding'] || 'gzip, *';

        if (acceptEncoding.indexOf('gzip') === -1) {
            this.options.headers['accept-encoding'] = 'gzip, ' + acceptEncoding;
        }
    }

    this.agent = Request.getAgent(this);
}

Request.Error = AskerError;

// default Request options
Request.DEFAULT_OPTIONS = {
    host : 'localhost',
    port : 80,
    path : '/',
    method : 'GET',
    maxRetries : 0,
    timeout : 500,
    allowGzip : true,
    requestId : ''
};

// if not defined queueTimeout = timeout + QUEUE_TIMEOUT_DELTA
Request.prototype.QUEUE_TIMEOUT_DELTA = 50;

// pool of Agents. Yes, it's pool of pools
Request.agentsPool = {};

http.globalAgent.maxSockets = 1024;
http.Agent.defaultMaxSockets = 1024;

/**
 * @param {AgentOptions} options
 * @returns {AdvancedAgent}
 */
Request.createAgent = function(options) {
    var agentsPool = this.agentsPool,
        agent = new AdvancedAgent(extend({ persistent : true }, options));

    agentsPool[agent.options.name] = agent;

    // Setup `removeSocket` event listener for non-persistnt agents.
    // Destroy agent then requests queue and sockets pool became empty.
    if ( ! agent.options.persistent) {
        agent.on(AdvancedAgent.EVENTS.SOCKET_REMOVED, function() {
            if (this.requests.keys().length === 0 && this.sockets.keys().length === 0) {
                delete agentsPool[agent.options.name];
            }
        });
    }

    return agent;
};

/**
 * Returns existing agent from agents pool or creates new if no one exists
 * @param {Request} request instance
 * @returns {Agent|AdvancedAgent}
 */
Request.getAgent = function(request) {
    var options = request.options.agent,
        agent = false;

    // returns `http.globalAgent` if agent name is undefined or equals 'globalAgent'
    if ( ! options || ! options.name || options.name === 'globalAgent') {
        agent = http.globalAgent;
    } else if (Object.prototype.hasOwnProperty.call(this.agentsPool, options.name)) {
        agent = this.agentsPool[options.name];
    }

    return agent || this.createAgent(options);
};

/**
 * Accept or decline status code, allows or decline retries
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
    var now = Date.now();

    return {
        network : this._timeNetworkStart && ((this._timeNetworkEnd || now) - this._timeNetworkStart),
        total : this._timeExecuteStart && (now - this._timeExecuteStart)
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
            limit : this.maxRetries
        }
    };
};

/**
 * @memberOf Request.prototype
 * @field {boolean} isRunning
 */
Object.defineProperty(Request.prototype, 'isRunning', {
    get : function() {
        return !! this._isRunning;
    },
    enumerable : true
});

/**
 * @param {Error} err
 * @param {Object} [data]
 * @returns {*}
 */
Request.prototype.done = function(err, data) {
    this._isRunning = false;

    return this._callback(err, data);
};

/**
 * Successfully resolve request
 * @param {*} response data
 * @param {Object} [meta]
 */
Request.prototype.resolve = function(response, meta) {
    this.done(null, {
        data : response,
        meta : meta ? extend(this.getResponseMetaBase(), meta) : this.getResponseMetaBase()
    });
};

/**
 * Handle request retries. Throw an error if retries limit exceeded.
 * @param {Object} requestOptions same as for _tryHttpRequest
 * @param {AskerError} retryReason error which is a reason for retry
 * @private
 */
Request.prototype._retryHttpRequest = function(requestOptions, retryReason) {
    var errorData = {
            requestId : this.options.requestId,
            timings : this.formatTimestamp(),
            maxRetries : this.options.maxRetries,
            url : [
                requestOptions.host,
                requestOptions.port ? ':' + requestOptions.port : '',
                requestOptions.path
            ].join('')
        };

    retryReason.bind(errorData);

    if (this.retries >= this.options.maxRetries) {
        // retries limit exceeded
        // throw an RETRIES_LIMIT_EXCEEDED if retries allowed for request
        // or retry reason error in another case
        if (this.options.maxRetries > 0) {
            // @todo throw following error with `reason` prop which contains retryReason
            // so user code can determine limits exceeded errors
            retryReason = AskerError
                .createError(AskerError.CODES.RETRIES_LIMIT_EXCEEDED, retryReason)
                .bind(errorData);
        }
        this.done(retryReason);
    } else {
        this.retries++;
        this._onretry && this._onretry(retryReason, this.retries);
        this._tryHttpRequest(requestOptions);
    }
};

/**
 * run the request
 * @param options Параметры запроса, аналогичны параметрам http.request
 * @private
 */
Request.prototype._tryHttpRequest = function(options) {
    var self = this,
        url = options.host + ':' + options.port + options.path,
        retryRequest = this._retryHttpRequest.bind(this, options),
        httpRequest,
        statusFilterResult;

    httpRequest = http.request(options, function(res) {
        var contentLen = parseInt(res.headers['content-length'], 10),
            body = contentLen && new Buffer(contentLen),
            offset = 0,
            error;

        contentLen && body.fill(0);

        statusFilterResult = self.statusCodeFilter(res.statusCode);

        if ( ! statusFilterResult.accept) {
            httpRequest.break(true);
            error = AskerError.createError(
                AskerError.CODES.UNEXPECTED_STATUS_CODE, { statusCode : res.statusCode, url : url });
            return statusFilterResult.isRetryAllowed ? retryRequest(error) : self.done(error);
        }

        res.on('data', function(chunk) {
            var isBuffer = Buffer.isBuffer(chunk),
                chunkBuffer;

            httpRequest.clearTimeouts();

            if (contentLen) {
                offset += isBuffer ? chunk.copy(body, offset) : body.write(chunk, offset);
            } else {
                chunkBuffer = isBuffer ? chunk : new Buffer(chunk);
                body = body ? Buffer.concat([body, chunkBuffer]) : chunkBuffer;
            }
        });

        res.on('end', function() {
            var encoding = res.headers['content-encoding'];

            // for sure ;)
            httpRequest.clearTimeouts();

            if (encoding && encoding.toLowerCase().indexOf('gzip') > -1) {
                zlib.gunzip(body, function(err, deflatedBody) {
                    error ?
                        self.done(AskerError.createError(AskerError.CODES.GUNZIP_ERROR, error)) :
                        self.resolve(deflatedBody.toString(), { gzip : true });
                });
            } else {
                self.resolve(body.toString());
            }
        });
    });

    httpRequest.clearTimeouts = function() {
        httpRequest.socketTimeout && clearTimeout(httpRequest.socketTimeout);
        httpRequest.queueTimeout && clearTimeout(httpRequest.queueTimeout);
    };

    httpRequest.break = function(abort, errorCode, errorData) {
        httpRequest.clearTimeouts();

        if (abort) {
            httpRequest.rejected = true;
            httpRequest.abort();
        }

        httpRequest.emit('removeSocket');
        self._timeNetworkEnd = Date.now();

        errorCode && retryRequest(AskerError.createError(errorCode, errorData));
    };

    // setup queue timeout
    httpRequest.queueTimeout = setTimeout(function() {
        httpRequest.break(true, AskerError.CODES.QUEUE_TIMEOUT);
    }, options.timeout + self.QUEUE_TIMEOUT_DELTA);

    httpRequest.on('socket', function() {
        self._timeNetworkStart = Date.now();

        httpRequest.socketTimeout = setTimeout(function() {
            httpRequest.break(true, AskerError.CODES.SOCKET_TIMEOUT);
        }, options.timeout);
    });

    httpRequest.on('error', function(error) {
        // request manually aborted
        ! httpRequest.rejected && httpRequest.break(false, AskerError.CODES.HTTP_CLIENT_REQUEST_ERROR, error);
    });

    // send request body
    this.options.body && httpRequest.write(this.options.body);

    httpRequest.end();
};

/**
 * Execute request
 * @returns {boolean} `false` if request already running
 */
Request.prototype.execute = function() {
    if (this.isRunning) {
        return false;
    }

    this.retries = 0;
    this._timeExecuteStart = Date.now();
    this._tryHttpRequest(extend({}, this.options, { agent : this.agent }));

    return true;
};

module.exports = Request;
