var Asker = require('../lib/asker'),
    ask = Asker,
    httpTest = require('./lib/http'),
    assert = require('chai').assert,
    fs = require('fs'),

    RESPONSE = 'response ok',
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
        non_string_literal : 32,
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
    'body encoder "string"' : httpTest(function(done, server) {
        server.addTest(function(req, res) {
            if (req.body && req.body === bodyText) {
                res.statusCode = 200;
                res.end(RESPONSE);
            } else {
                res.statusCode = 500;
                res.end();
            }
        });

        ask({ port : server.port, method : 'post', bodyEncoding : 'string', body : bodyText }, function(error, response) {
            assert.isNull(error, 'no errors occured');
            assert.strictEqual(response.data.toString(), RESPONSE, 'response is correct');

            done();
        });
    }),

    'body encoder "json"' : httpTest(function(done, server) {
        server.addTest(function(req, res) {
            if (req.body && req.body.data[0].id === bodyStringify.data[0].id) {
                res.statusCode = 200;
                res.end(RESPONSE);
            } else {
                res.statusCode = 500;
                res.end();
            }
        });

        ask({ port : server.port, method : 'post', bodyEncoding : 'json', body : bodyStringify }, function(error, response) {
            assert.isNull(error, 'no errors occured');
            assert.strictEqual(response.data.toString(), RESPONSE, 'response is correct');

            done();
        });
    }),

    'body encoder "urlencoded"' : httpTest(function(done, server) {
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
            assert.isNull(error, 'no errors occured');
            assert.strictEqual(response.data.toString(), RESPONSE, 'response is correct');

            done();
        });
    }),

    'test body encoder "urlencoded" => incorrect body type' : function() {
        assert.throw(function() {
            ask({ bodyEncoding : 'urlencoded', body : bodyText });
        }, /Unexpect type ".*" of the option "body" in the body encoder "urlencoded". Expected \{Object\}/);
    },

    'body encoder "multipart"' : httpTest(function(done, server) {
        server.addTest(function(req, res) {
            if (req.body && JSON.parse(req.body.complex_param).key1 === bodyMultipart.complex_param.key1 &&
                req.body.non_string_literal === String(bodyMultipart.non_string_literal) &&
                req.files && req.files.file1 && req.files.file1.size === fileSize) {
                res.statusCode = 200;
                res.end(RESPONSE);
            } else {
                res.statusCode = 500;
                res.end();
            }
        });

        ask({ port : server.port, method : 'post', bodyEncoding : 'multipart', body : bodyMultipart }, function(error, response) {
            assert.isNull(error, 'no errors occured');
            assert.strictEqual(response.data.toString(), RESPONSE, 'response is correct');

            done();
        });
    }),

    'throw error on incorrect value of the option "bodyEncoding"' : function() {
        assert.throw(function() {
            new Asker({ bodyEncoding : 'duckduckandsend', body : bodyUrlencoded });
        }, /Body encoder ".*" is not defined/);
    },

    'test body encoder "multipart" => incorrect body type' : function() {
        assert.throw(function() {
            ask({ bodyEncoding : 'multipart', body : bodyText });
        }, /Unexpect type ".*" of the option "body" in the body encoder "multipart". Expected \{Object\}/);
    },

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
