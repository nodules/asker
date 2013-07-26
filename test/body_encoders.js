var Asker = require('../lib/asker'),
    ask = Asker,
    httpTest = require('./lib/http'),
    assert = require('chai').assert,
    fs = require('fs');

var RESPONSE = 'response ok',
    filePath = 'test/pic.jpg',
    fileSize = fs.statSync(filePath).size,
    fileBuffer = fs.readFileSync(filePath),
    bodyText = 'plain text test',
    bodyStringify = {
        'data' : [
            { 'id' : 'AC',         'name' : 'AC' },
            { 'id' : 'ACURA',      'name' : 'Acura' },
            { 'id' : 'ALFA_ROMEO', 'name' : 'Alfa Romeo' },
            { 'id' : 'ALPINA',     'name' : 'Alpina' },
            { 'id' : 'ARO',        'name' : 'Aro' }
        ]
    },
    bodyUrlencoded = {
        'simple' : 'ok',
        'complex' : [
            'one',
            'two'
        ]
    },
    bodyMultipart = {
        simple_param : 'hey!',
        complex_param : {
            key1 : 'one',
            key2 : 'two'
        },
        file0 : fileBuffer,
        file1 : {
            filename : 'pic1.jpg',
            mime : 'image/jpeg',
            data : fileBuffer
        }
    };

module.exports = {
    'test body encoder => text' : httpTest(function(done, server) {
        server.addTest(function(req, res) {
            if (req.body && req.body === bodyText) {
                res.statusCode = 200;
                res.end(RESPONSE);
            } else {
                res.statusCode = 500;
                res.end();
            }
        });

        ask({ port : server.port, method : 'post', bodyEncoding : 'text', body : bodyText }, function(error, response) {
            assert.strictEqual(error, null, 'no errors occured');
            assert.strictEqual(response.data.toString(), RESPONSE, 'response is correct');

            done();
        });
    }),

    'test body encoder => stringify' : httpTest(function(done, server) {
        server.addTest(function(req, res) {
            if (req.body && req.body.data[0].id === bodyStringify.data[0].id) {
                res.statusCode = 200;
                res.end(RESPONSE);
            } else {
                res.statusCode = 500;
                res.end();
            }
        });

        ask({ port : server.port, method : 'post', bodyEncoding : 'stringify', body : bodyStringify }, function(error, response) {
            assert.strictEqual(error, null, 'no errors occured');
            assert.strictEqual(response.data.toString(), RESPONSE, 'response is correct');

            done();
        });
    }),

    'test body encoder => urlencoded' : httpTest(function(done, server) {
        server.addTest(function(req, res) {
            if (req.body && req.body.simple === bodyUrlencoded.simple) {
                res.statusCode = 200;
                res.end(RESPONSE);
            } else {
                res.statusCode = 500;
                res.end();
            }
        });

        ask({ port : server.port, method : 'post', bodyEncoding : 'urlencoded', body : bodyUrlencoded }, function(error, response) {
            assert.strictEqual(error, null, 'no errors occured');
            assert.strictEqual(response.data.toString(), RESPONSE, 'response is correct');

            done();
        });
    }),

    'test body encoder => multipart' : httpTest(function(done, server) {
        server.addTest(function(req, res) {
            if (req.body && JSON.parse(req.body.complex_param).key1 === bodyMultipart.complex_param.key1 &&
                req.files && req.files.file1 && req.files.file1.size === fileSize) {
                res.statusCode = 200;
                res.end(RESPONSE);
            } else {
                res.statusCode = 500;
                res.end();
            }
        });
        ask({ port : server.port, method : 'post', bodyEncoding : 'multipart', body : bodyMultipart }, function(error, response) {
            assert.strictEqual(error, null, 'no errors occured');
            assert.strictEqual(response.data.toString(), RESPONSE, 'response is correct');

            done();
        });
    }),

    'test body encoder => incorrect bodyEncoding' : httpTest(function(done, server) {
        server.addTest(function(req, res) {
            res.statusCode = 200;
            res.end(RESPONSE);
        });

        try {
            ask({ port : server.port, method : 'post', bodyEncoding : 'yrlenkoded', body : bodyUrlencoded }, function(error, response) {
                assert.strictEqual(error, null, 'no errors occured');
                assert.strictEqual(response.data.toString(), RESPONSE, 'response is correct');

                done();
            });
        } catch(e) {
            done();
        }
    }),

    'test body encoder => incorrect body type' : httpTest(function(done, server) {
        server.addTest(function(req, res) {
            res.statusCode = 200;
            res.end(RESPONSE);
        });

        try {
            ask({ port : server.port, method : 'post', bodyEncoding : 'multipart', body : bodyText }, function(error, response) {
                assert.strictEqual(error, null, 'no errors occured');
                assert.strictEqual(response.data.toString(), RESPONSE, 'response is correct');

                done();
            });
        } catch(e) {
            done();
        }
    }),

    'test body encoder => manually set content-type' : httpTest(function(done, server) {
        server.addTest(function(req, res) {
            res.statusCode = 200;
            res.end(RESPONSE);
        });

        ask({ port : server.port, method : 'post', headers : { 'content-type' : 'text/plain' }, body : bodyText }, function(error, response) {
            assert.strictEqual(error, null, 'no errors occured');
            assert.strictEqual(response.data.toString(), RESPONSE, 'response is correct');

            done();
        });
    }),

    'test body encoder => already urlencoded body' : httpTest(function(done, server) {
        server.addTest(function(req, res) {
            if (req.body && req.body.param2 === 'b') {
                res.statusCode = 200;
                res.end(RESPONSE);
            } else {
                res.statusCode = 500;
                res.end();
            }
        });

        ask({ port : server.port, method : 'post', bodyEncoding : 'urlencoded', body : 'param1=a&param2=b' }, function(error, response) {
            assert.strictEqual(error, null, 'no errors occured');
            assert.strictEqual(response.data.toString(), RESPONSE, 'response is correct');

            done();
        });
    }),

    'test body encoder => no file data for multipart' : httpTest(function(done, server) {
        server.addTest(function(req, res) {
            if (req.body && JSON.parse(req.body.file).filename === 'nope') {
                res.statusCode = 200;
                res.end(RESPONSE);
            } else {
                res.statusCode = 500;
                res.end();
            }
        });

        ask({ port : server.port, method : 'post', bodyEncoding : 'multipart', body : { file : { filename : 'nope' } } }, function(error, response) {
            assert.strictEqual(error, null, 'no errors occured');
            assert.strictEqual(response.data.toString(), RESPONSE, 'response is correct');

            done();
        });
    })
};
