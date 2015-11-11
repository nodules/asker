var Asker = require('../lib/asker'),
    ask = Asker,
    httpTest = require('./lib/http'),
    assert = require('chai').assert;

module.exports = {
    'sent http headers are correct => 200-Accept': httpTest(function(done, server) {
        var RESPONSE = 'response ok';

        server.addTest(function(req, res) {
            res.statusCode = 200;
            res.end(req.headers.accept === 'text/plain' ? RESPONSE : null);
        });

        ask(
            {
                port: server.port,
                headers: {
                    'accept': 'text/plain'
                }
            },
            function(error, response) {
                assert.strictEqual(error, null, 'no errors occured');
                assert.strictEqual(response.data.toString(), RESPONSE, 'response is correct');

                done();
            }
        );
    }),
    'returned http headers are correct => 201-Location': httpTest(function(done, server) {
        server.addTest(function(req, res) {
            res.writeHead(201, { 'Location': 'http://example.com' });
            res.end();
        });

        ask({ port: server.port }, function(error, response) {
            assert.strictEqual(error, null, 'no errors occured');
            assert.strictEqual(response.headers.location, 'http://example.com', 'location header is correct');

            done();
        });
    })
};
