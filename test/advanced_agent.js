var http = require('http'),
    Asker = require('../lib/asker'),
    AdvancedAgent = require('../lib/advanced_agent');

module.exports = {
    'inheritance' : function(test) {
        var agent = new AdvancedAgent();

        test.ok(agent instanceof AdvancedAgent,
            'agent instanceof AdvancedAgent');

        test.ok(agent instanceof http.Agent,
            'agent instanceof http.Agent');

        test.done();
    },

    'agents pool usage' : function(test) {
        var AGENT_NAME = 'smith',
            request1 = new Asker({ agent : { name : AGENT_NAME, persistent : true } }),
            request2 = new Asker({ agent : { name : AGENT_NAME, persistent : false } });

        test.strictEqual(request1.agent, request2.agent,
            'agent reused from pool by name');

        test.strictEqual(request2.agent.options.persistent, true,
            'agent options was not overriden by second declaration');

        delete Asker.agentsPool[AGENT_NAME];

        test.done();
    },

    'agent persistence' : function(test) {
        var AGENT_NAME = 'temp',
            request = new Asker({
                agent : {
                    name : AGENT_NAME,
                    persistent : false
                }
            });

        test.strictEqual(request.agent, Asker.agentsPool[AGENT_NAME],
            'step #1: agent in the pool');

        request = null;

        test.ok(Asker.agentsPool[AGENT_NAME] instanceof AdvancedAgent,
            'step #2: agent still in the pool');

        Asker.agentsPool[AGENT_NAME].emit(AdvancedAgent.EVENTS.SOCKET_REMOVED);

        test.strictEqual(Object.keys(Asker.agentsPool).length, 0,
            'non-persistent agent removed from pool by "' +
                AdvancedAgent.EVENTS.SOCKET_REMOVED +
                '" event');

        test.done();
    }
};
