var http = require('http'),
    Asker = require('../lib/asker'),
    ask = Asker,
    AdvancedAgent = require('../lib/advanced_agent'),
    httpTest = require('./lib/http'),
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
            request2 = new Asker({ agent : { name : AGENT_NAME, persistent : false } }),
            agent1,
            agent2;

        assert.strictEqual(typeof Asker.agentsPool, 'object',
            'agent pool is object and accessible via Asker.agentsPool');

        assert.strictEqual(Object.keys(Asker.agentsPool).length, 0,
            'pool is empty, globalAgent is not holded by the agents pool');

        agent1 = Asker.getAgent(request1);
        agent2 = Asker.getAgent(request2);

        assert.strictEqual(Object.keys(Asker.agentsPool).length, 1,
            'agent added to the agents pool due to request contructor call with `agent` option');

        assert.strictEqual(agent1, agent2,
            'agent reused from pool by name');

        assert.strictEqual(agent2.options.persistent, true,
            'agent options was not overriden by second declaration');
    },

    'agent persistence' : function() {
        var AGENT_NAME = 'temp',
            request = new Asker({
                agent : {
                    name : AGENT_NAME,
                    persistent : false
                }
            }),
            agent = Asker.getAgent(request);

        assert.strictEqual(agent, Asker.agentsPool[AGENT_NAME],
            'step #1: agent in the pool');

        request = null;

        assert.ok(agent instanceof AdvancedAgent,
            'step #2: agent still in the pool');

        agent.emit(AdvancedAgent.EVENTS.SOCKET_REMOVED);

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
    },

    'Request.createAgent() must create AdvancedAgent instance and host it in the Request.agentsPool' : function() {
        var AGENT_OPTIONS = {
                name : 'test agent',
                maxSockets : 2000,
                persistent : false
            },
            agent = Asker.createAgent(AGENT_OPTIONS);

        assert.ok(agent instanceof AdvancedAgent,
            'createAgent returns AdvancedAgent instance');

        assert.ok(agent instanceof http.Agent,
            'createAgent returns instance of http.Agent inheritor');

        assert.strictEqual(agent, Asker.agentsPool[AGENT_OPTIONS.name],
            'agent hosted in the pool');

        assert.strictEqual(Object.keys(Asker.agentsPool).length, 1,
            'only 1 agent in the pool');
    },

    'Request.createAgent() throws an error, if agent name already reserved in the pool' : function() {
        var AGENT_OPTIONS = {
                name : 'test agent',
                maxSockets : 2000,
                persistent : false
            },
            agent;

        assert.strictEqual(Object.keys(Asker.agentsPool).length, 0,
            'agents pool is empty');

        agent = Asker.createAgent(AGENT_OPTIONS);

        assert.strictEqual(Object.keys(Asker.agentsPool).length, 1,
            'agent is hosted in the pool');

        assert.throws(
            function() {
                Asker.createAgent(AGENT_OPTIONS);
            },
            Asker.Error.createError(
                Asker.Error.CODES.AGENT_NAME_ALREADY_IN_USE,
                { agentName : AGENT_OPTIONS.name }).message);

        assert.strictEqual(Object.keys(Asker.agentsPool).length, 1,
            'still 1 agent is hosted in the pool');
    },

    'non-persistent agent should not be removed from pool if it has any requests in queue' : httpTest(function(done, server) {
        var AGENT_OPTIONS = {
                name : 'non-persistent agent test #75840',
                maxSockets : 1,
                persistent : false
            },
            agent = Asker.createAgent(AGENT_OPTIONS),
            socketRemoveEmitted = 0,
            requestsResolved = 0;

        function responseListener() {
            if (++requestsResolved === 2) {
                setTimeout(function() {
                    assert.strictEqual(socketRemoveEmitted, 2,
                        'socketRemoved event emitted on each inappropriate response');

                    assert.strictEqual(typeof Asker.agentsPool[AGENT_OPTIONS.name], 'undefined',
                        'non-persistent agent removed when it`s queue became empty');

                    done();
                }, 50);
            }
        }

        function testResponse(req, res) {
            // return inaccepatble code to instigate SOCKET_REMOVED event
            res.statusCode = 404;
            res.end();
        }

        server.addTest(testResponse);
        server.addTest(testResponse);

        agent.on(AdvancedAgent.EVENTS.SOCKET_REMOVED, function() {
            socketRemoveEmitted++;
        });

        // use same agent as created before using same name in the options
        ask({ port : server.port, agent : AGENT_OPTIONS }, responseListener);
        ask({ port : server.port, agent : AGENT_OPTIONS }, responseListener);
    }),

    'Request.getAgent() must returns http.globalAgent if agent name is not defined in the request options' : function() {
        assert.strictEqual(Asker.getAgent(new Asker()), http.globalAgent,
            'http.globalAgent is returned for request without agent configuration');

        assert.strictEqual(Asker.getAgent(new Asker({ agent : { maxSockets : 1 } })), http.globalAgent,
            'http.globalAgent is returned for request without agent name');

        assert.notStrictEqual(http.globalAgent.maxSockets, 1,
            'http.globalAgent was not modified');

        assert.strictEqual(Asker.getAgent(new Asker({ agent : { name : 'globalAgent' } })), http.globalAgent,
            'http.globalAgent is returned for request with agent name "globalAgent"');
    },

    'Request.getAgent() must create agent if no agent with desired name is not exist in the pool' : function() {
        var agent;

        assert.strictEqual(Object.keys(Asker.agentsPool).length, 0,
            'agents pool is empty');

        agent = Asker.getAgent(new Asker({ agent : { name : 'getAgent test' } }));

        assert.ok(agent instanceof AdvancedAgent, 'Advanced agent created');

        assert.strictEqual(Object.keys(Asker.agentsPool).length, 1,
            'agents pool contains 1 agent');

        assert.strictEqual(Asker.agentsPool[agent.options.name], agent,
            'created agent is hosted in the agents pool');
    },

    'Request.getAgent() must returns existing agent from pool if agent with desired name exists in the agents pool' : function() {
        var AGENT_OPTIONS = { name : 'getAgent test' },
            agent = Asker.createAgent(AGENT_OPTIONS);

        assert.strictEqual(Asker.getAgent(new Asker({ agent : AGENT_OPTIONS })), agent,
            'getAgent returns existing agent');

        assert.strictEqual(Object.keys(Asker.agentsPool).length, 1,
            'only 1 advanced agent in the agents pool');
    }
};
