var http = require('http'),
    server = require('./server'),
    PORT = 10080;

module.exports = server(server.TestServer, function(dispatcher) {
    return http.createServer(dispatcher);
}, PORT);
