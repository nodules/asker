var http = require('http'),
    Asker = require('../lib/asker'),
    AdvancedAgent = require('../lib/advanced_agent');

function testRequestWithoutOptions(request, test) {
    test.ok(request instanceof Asker, 'inheritance check');

    Object.keys(Asker.DEFAULT_OPTIONS).forEach(function(option) {
        test.strictEqual(
            request.options[option],
            Asker.DEFAULT_OPTIONS[option],
            'option "' + option + '" value equal to default value');
    });

    test.deepEqual(request.options.headers, {},
        'empty headers by default');

    test.strictEqual(typeof request._onretry, 'undefined',
        'retry callback is undefined by default');

    test.strictEqual(request.statusCodeFilter, Asker.prototype.statusCodeFilter,
        'default status code filter');

    test.strictEqual(request.options.method, 'GET',
        'default method is GET');

    test.strictEqual(typeof request.options.body, 'undefined',
        'no request body by default');
}

module.exports = {
    'without arguments' : function(test) {
        var request = new Asker();

        testRequestWithoutOptions(request, test);

        test.strictEqual(request.agent, http.globalAgent,
            'use http.globalAgent by default');

        test.strictEqual(typeof request._callback, 'undefined',
            'main callback is undefined by default');

        test.done();
    },

    'minimal options' : function(test) {
        var callback = function() {},
            request = new Asker({}, callback);

        testRequestWithoutOptions(request, test);

        test.strictEqual(request.agent, http.globalAgent,
            'use http.globalAgent by default');

        test.strictEqual(request._callback, callback,
            'custom request callback');

        test.done();
    },

    'url option' : function(test) {
        var HOST = 'yandex.com',
            PORT = 8080,
            PATH = '/index.html',
            URL = 'http://' + HOST + ':' + PORT + PATH,

            requestHPP = new Asker({
                host : HOST,
                port : PORT,
                path : PATH
            }),

            requestUrl = new Asker({
                url : URL
            });

        test.strictEqual(requestUrl.options.url, URL,
            '`url` option setted properly');

        delete requestUrl.options.url;

        test.deepEqual(requestHPP.options, requestUrl.options,
            'options parsed from `url` and passed manually are equal');

        test.done();
    },

    'common options' : function(test) {

        test.done();
    },

    'GET specific query parsing' : function(test) {

        test.done();
    },

    'POST specific query parsing' : function(test) {

        test.done();
    },

    'custom Agent' : function(test) {
        var agentName = 'test',
            request = new Asker({
                agent : {
                    name : agentName
                }
            });

        testRequestWithoutOptions(request, test);

        test.notEqual(request.agent, http.globalAgent,
            'agent is not default http.globalAgent');

        test.ok(request.agent instanceof AdvancedAgent,
            'using custom agent');

        test.strictEqual(request.agent, Asker.agentsPool[agentName],
            'custom agent accessible in the agents pool by name');

        test.done();
    }
};
