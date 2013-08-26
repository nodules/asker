var util = require('util'),
    cache = {};

/**
 * @param {Function} BaseAgent Agent constructor (http.Agent, https.Agent or something had similiar public API)
 * @returns {Function} AdvancedAgent constructor
 */
function createAdvancedAgent(BaseAgent) {
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
        BaseAgent.apply(this, Array.prototype.slice.call(arguments));

        // keep track for all AdvancedAgent instances
        AdvancedAgent.pool[options.name] = this;

        // Setup `removeSocket` event listener for non-persistnt agents.
        // Destroy agent then requests queue and sockets pool became empty.
        if ( ! options.persistent) {
            this.on(AdvancedAgent.EVENTS.SOCKET_REMOVED, function() {
                if (Object.keys(this.requests).length === 0 &&
                    Object.keys(this.sockets).length === 0) {
                    delete AdvancedAgent.pool[options.name];
                }
            });
        }
    }

    util.inherits(AdvancedAgent, BaseAgent);

    /**
     * Pool of AdvancedAgent instances
     * @type {Object}
     */
    AdvancedAgent.pool = {};

    /**
     * returns AdvancedAgent instance from the pool or
     * `undefined` if agent with desired name is not exists
     * @param {String} name
     * @returns {AdvancedAgent|undefined}
     */
    AdvancedAgent.get = function(name) {
        return this.pool[name];
    };

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

    return AdvancedAgent;
}

module.exports = {
    /**
     * Memoization for createAdvancedAgent by module name
     * @param {String} moduleName 'http', 'https' or something had similiar Agent implementation
     * @returns {Function} AdvancedAgent constructor
     */
    get : function get(moduleName) {
        if (typeof moduleName === 'undefined') {
            moduleName = 'http';
        }

        if ( ! Object.prototype.hasOwnProperty.call(cache, moduleName)) {
            cache[moduleName] = createAdvancedAgent(require(moduleName).Agent);
        }

        return cache[moduleName];
    }
};
