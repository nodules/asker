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
/*jshint unused:false*/
function AdvancedAgent(options) {
    http.Agent.apply(this, Array.prototype.slice.call(arguments));
}

util.inherits(AdvancedAgent, http.Agent);

AdvancedAgent.EVENTS = {
    SOCKET_REMOVED : 'socketRemoved'
};

AdvancedAgent.prototype._removeSocket = AdvancedAgent.prototype.removeSocket;

AdvancedAgent.prototype.removeSocket = function() {
    this._removeSocket.apply(this, arguments);
    this.emit(AdvancedAgent.EVENTS.SOCKET_REMOVED);
};

module.exports = AdvancedAgent;