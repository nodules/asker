var Terror = require('terror');

module.exports = Terror.create('AskerError', {
    QUEUE_TIMEOUT :
        [ 902, 'Queue timeout %requestId% %timings% %url%' ],
    SOCKET_TIMEOUT :
        [ 903, 'Socket timeout %requestId% %timings% %url%' ],
    UNEXPECTED_STATUS_CODE :
        [ 904, 'Unexpected status code {CODE:%statusCode%} in the response for request %requestId% %timings% %url%' ],
    HTTP_CLIENT_REQUEST_ERROR :
        [ 905, 'http.clientRequest error for request %requestId% %timings% %url%' ],
    REQUEST_ALREADY_RUNNING :
        [ 906, 'execute() for already running request %requestId% %timings% %url%' ],
    RETRIES_LIMIT_EXCEEDED :
        [ 907, 'Retries limit {LIMIT:%maxRetries%} exceeded for request %requestId% %timings% %url%' ],
    UNKNOWN_ERROR :
        [ 908, 'Unknown error during request %requestId% processing %timings% %url%' ],
    GUNZIP_ERROR :
        [ 909, 'Response body deflating error for request %requestId% %url%' ]
});