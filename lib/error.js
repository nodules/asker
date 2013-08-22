var Terror = require('terror');

/**
 * @class AskerError
 * @extends Terror
 * @constructor
 * @returns {AskerError} object compatible with Error
 * @see http://npm.im/terror
 */
var AskerError = Terror.create('AskerError', {
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
    GUNZIP_ERROR :
        [ 909, 'Response body deflating error for request %requestId% %url%' ],
    AGENT_NAME_ALREADY_IN_USE :
        [ 910, 'Agent with name "%agentName%" already in the agents pool' ],
    BODY_ENCODER_NOT_EXIST :
        [ 911, 'Body encoder "%encoder%" is not defined' ],
    UNEXPECTED_BODY_TYPE :
        [ 912, 'Unexpect type "%type%" of the option "body" in the body encoder "%encoder%". Expected {%expectedTypes%}' ],
    UNEXPECTED_ENCODER_ERROR :
        [ 913, 'Unexpected error duering "%encoder%" body encoder execution' ]
});

// Override Terror UNKNOWN_ERROR code
AskerError.CODES['UNKNOWN_ERROR'] = 908;
AskerError.MESSAGES[908] = 'Unknown error during request %requestId% processing %timings% %url%';
AskerError.CODE_NAMES[908] = 'UNKNOWN_ERROR';

module.exports = AskerError;
