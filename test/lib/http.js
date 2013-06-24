var http = require('http');

/**
 * @constructor
 * @class TestServer
 * @param {Number} port
 * @param {String} [host=localhost]
 * @param {Array} testDispatchers array of functions used as dispatchers for request
 */
function TestServer(port, host, testDispatchers) {
    if (Array.isArray(host) && typeof testDispatchers === 'undefined') {
        this.tests = host;
    } else {
        this.tests = testDispatchers ? [].concat(testDispatchers) : [];
    }

    this.port = port;
    this.host = (typeof host === 'string') ? host : 'localhost';

    this.servant = http.createServer(this.dispatcher.bind(this));
}

/**
 * @param {Function} callback
 */
TestServer.prototype.listen = function(callback) {
    return this.servant.listen(this.port, this.host, callback);
};

/**
 * @param {http.IncomingMessage} req
 * @param {http.ServerResponse} res
 */
TestServer.prototype.dispatcher = function(req, res) {
    var d = this.tests.shift();

    if ( ! d || (typeof d !== 'function')) {
        res.statusCode = 500;
        res.end(this.buildResponse(false, ( ! d) ? 'test dispatcher not found' : 'test dispatcher is not a function'));
    } else {
        d(req, res);
    }
};

/**
 * add test dispatcher to tests pool
 * @param {Function} testDispatcher
 */
TestServer.prototype.addTest = function(testDispatcher) {
    this.tests.push(testDispatcher);
};

/**
 * build JSON response
 * @param {Boolean} isDone
 * @param {String} message
 * @returns {String} stringified object { done : isDone, message : message }
 */
TestServer.prototype.buildResponse = function(isDone, message) {
    return JSON.stringify({
        done : isDone,
        message : message
    });
};

/**
 * proxy to http.Server.close method
 * @param {Function} callback
 */
TestServer.prototype.close = function(callback) {
    return this.servant.close(callback);
};

module.exports = TestServer;
