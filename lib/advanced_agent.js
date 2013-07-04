var http = require('http'),
    util = require('util');

/**
 * http.Agent successor which fire 'socketRemoved' event in the end of Agent#removeSocket
 *
 * @constructor
 * @extends http.Agent
 * @param {Object} options default http.Agent options object, extended with following props:
 *      @param {String} options.name Agent name to identify it
 *      @param {Boolean} [options.persistent] Non-persistent agents removed when queue empty
 */
function AdvancedAgent(options) {
    /*jshint unused:false*/
    http.Agent.apply(this, Array.prototype.slice.call(arguments));
}

util.inherits(AdvancedAgent, http.Agent);

/**
 * new events names
 */
AdvancedAgent.EVENTS = {
    SOCKET_REMOVED : 'socketRemoved'
};

/**
 * keep inherited removeSocket
 */
AdvancedAgent.prototype._removeSocket = AdvancedAgent.prototype.removeSocket;

/**
 * extends inherited removeSocket method
 * with emitting `socketRemoved` event
 */
AdvancedAgent.prototype.removeSocket = function() {
    var result = this._removeSocket.apply(this, arguments);

    this.emit(AdvancedAgent.EVENTS.SOCKET_REMOVED);

    return result;
};

module.exports = AdvancedAgent;
