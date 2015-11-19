var https = require('https'),
    fs = require('fs'),
    util = require('util'),
    server = require('./server'),
    PORT = 10443;

var options = {
    key: fs.readFileSync(__dirname + '/certs/server.key'),
    cert: fs.readFileSync(__dirname + '/certs/server.crt'),
    ca: fs.readFileSync(__dirname + '/certs/ca.crt'),
    requestCert: true,
    rejectUnauthorized: false
};

function TestServer() {
    server.TestServer.apply(this, arguments);

    this.protocol = 'https:';
    this.rootCA = options.ca;
}

util.inherits(TestServer, server.TestServer);

module.exports = server(TestServer, function(dispatcher) {
    return https.createServer(options, dispatcher);
}, PORT);
