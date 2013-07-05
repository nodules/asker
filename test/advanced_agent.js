var http = require('http'),
    Asker = require('../lib/asker'),
    AdvancedAgent = require('../lib/advanced_agent'),
    assert = require('chai').assert;

module.exports = {
    beforeEach : function(callback) {
        // reset agents pools before each test
        Object.keys(Asker.agentsPool).forEach(function(agentName) {
            delete Asker.agentsPool[agentName];
        });

        callback();
    },

    'inheritance' : function() {
        var agent = new AdvancedAgent();

        assert.ok(agent instanceof AdvancedAgent,
            'agent instanceof AdvancedAgent');

        assert.ok(agent instanceof http.Agent,
            'agent instanceof http.Agent');
    },

    'agents pool usage' : function() {
        var AGENT_NAME = 'smith',
            request1 = new Asker({ agent : { name : AGENT_NAME, persistent : true } }),
            request2 = new Asker({ agent : { name : AGENT_NAME, persistent : false } });

        assert.strictEqual(request1.agent, request2.agent,
            'agent reused from pool by name');

        assert.strictEqual(request2.agent.options.persistent, true,
            'agent options was not overriden by second declaration');
    },

    'agent persistence' : function() {
        var AGENT_NAME = 'temp',
            request = new Asker({
                agent : {
                    name : AGENT_NAME,
                    persistent : false
                }
            });

        assert.strictEqual(request.agent, Asker.agentsPool[AGENT_NAME],
            'step #1: agent in the pool');

        request = null;

        assert.ok(Asker.agentsPool[AGENT_NAME] instanceof AdvancedAgent,
            'step #2: agent still in the pool');

        Asker.agentsPool[AGENT_NAME].emit(AdvancedAgent.EVENTS.SOCKET_REMOVED);

        assert.strictEqual(Object.keys(Asker.agentsPool).length, 0,
            'non-persistent agent removed from pool by "' +
                AdvancedAgent.EVENTS.SOCKET_REMOVED +
                '" event');
    },

    'global and default pools sizes is 1024' : function() {
        assert.strictEqual(http.globalAgent.maxSockets, 1024,
            'http.globalAgent per host:port pair pools size is 1024');
        assert.strictEqual(http.Agent.defaultMaxSockets, 1024,
            'http.Agent per host:port pair pools size is 1024 by default');
    }
};
