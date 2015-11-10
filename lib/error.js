var Terror = require('terror');

/**
 * @class AskerError
 * @extends Terror
 * @constructor
 * @returns {AskerError} object compatible with Error
 * @see http://npm.im/terror
 */
module.exports = Terror.create('AskerError', {
    QUEUE_TIMEOUT :
        'Queue timeout %requestId% %timings% %url%',
    SOCKET_TIMEOUT :
        'Socket timeout %requestId% %timings% %url%',
    UNEXPECTED_STATUS_CODE :
        'Unexpected status code {CODE:%statusCode%} in the response for request %requestId% %timings% %url%',
    HTTP_CLIENT_REQUEST_ERROR :
        'http.clientRequest error for request %requestId% %timings% %url%',
    REQUEST_ALREADY_RUNNING :
        'execute() for already running request %requestId% %timings% %url%',
    RETRIES_LIMIT_EXCEEDED :
        'Retries limit {LIMIT:%maxRetries%} exceeded for request %requestId% %timings% %url%',
    GUNZIP_ERROR :
        'Response body deflating error for request %requestId% %url%',
    AGENT_NAME_ALREADY_IN_USE :
        'Agent with name "%agentName%" already in the agents pool',
    BODY_ENCODER_NOT_EXIST :
        'Body encoder "%encoder%" is not defined',
    UNEXPECTED_BODY_TYPE :
        'Unexpected type "%type%" of the option "body" in the body encoder "%encoder%". Expected {%expectedTypes%}',
    UNEXPECTED_ENCODER_ERROR :
        'Unexpected error during "%encoder%" body encoder execution'
});
