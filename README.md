# Asker [![Build Status](https://secure.travis-ci.org/nodules/asker.png)](http://travis-ci.org/nodules/asker)

Asker is a wrapper for `http.request` method, which incorporates:
* response deflating using gzip,
* requests retrying,
* connection pools tuning.

If you are looking for a module to fetch 3rd-party web content (pages, RSS, files or something else), don't waste your time and look at the [request](http://npm.im/request) module, because `asker` doesn't support cookies and redirects out of the box.

`Asker`'s main goal is to communicate between frontends and backends that use some kind of [SLA](http://en.wikipedia.org/wiki/Service-level_agreement).

## Quick start

```javascript
var ask = require('asker');

ask({ host : 'ya.ru' }, function(error, response) {
    if (error) {
        return error.log();
    }

    console.log('Response retrieved in ' + response.meta.totalTime + 'ms');
    console.log('==========\n', response.data, '\n==========');
});
```

## Options

All parameters are optional.

* `{String} host="localhost"`
* `{Number} port=80`
* `{String} path="/"`
* `{String} url` — Shorthand alternative for `host`, `port` and `path` options
* `{String} method="GET"`
* `{Object} headers` — HTTP headers
* `{Object} query` — Query params
* `{String} requestId=""` — Request ID, used in log messages
* `{*} body` — request body. If it's an `Object` — `JSON.stringify` is applied, otherwise it's converted to `String`.
* `{String} bodyEncoding="string"` — Body encoding method (`string`, `json`, `urlencoded`, `multipart` or self implemented). [More info](#body-encoding).
* `{Number} maxRetries=0` — Max number of retries allowed for the request
* `{Function} onretry(reason Error, retryCount Number)` — called when retry happens. By default it does nothing. As an example, you can pass a function that logs a warning.
* `{Number} timeout=500` — timeout from the moment, when a socket was given by a pool manager.
* `{Number} queueTimeout=timeout+50` — timeout from the moment, when asker initiated the request. Useful if pool manager failed to provide a socket for any reason.
* `{Boolean} allowGzip=true` — allows response compression with gzip
* `{Function} statusFilter` — status codes processing, see [Response status codes processing](#response-status-codes-processing) section for details.
* `{Object} agent` — http.Agent options, see [Connection pools tuning](#connection-pools-tuning) section for details.

## Response format

Succesful requests will return data and additional information in the following format:

`{Object} response`
* `{*} data` received data (if response body wasn't provided, `null` is returned)
* `{Number} statusCode` http status code
* `{Object} headers` returned http headers (names are lowercased)
* `{Object} meta` meta information
    * `{Object} time` request timers
        * `{Number} network` from socket open until the request completion
        * `{Number} total` total execution time
    * `{Object} options` options that you provided when created an `Asker` request
    * `{Object} retries`
        * `{Number} used` number of retries used
        * `{Number} limit` retries limit for a given request

## Response status codes processing

When response status code is received, `asker` passes status code through the filter function, which should determine whether this response code is acceptable. And if not, whether is it necessary to retry a request.

The only filter function argument is `code`:
* `{Number} code` is a response status code provided by `asker`.

Function must return an Object with two fields:
* `{Boolean} accept` — whether to accept response with a given status code;
* `{Boolean} isRetryAllowed` — whether to retry an unaccepted request.

Result must be returned ASAP, because filter's execution time WILL affect request timeouts.

Default filter accepts codes `200` and `201` and allows retries for all codes except `400-499`.

Let's make a quick example. Suppose, we want to accept only responses with `200`, `201` and `304` status codes and do not want to retry requests for `4xx`.

```javascript
var ask = require('asker');

function filter(code) {
    return {
        accept : ~[200, 201, 304].indexOf(code),
        isRetryAllowed : 400 > code || code > 499
    }
}

ask({ host: 'data-feed.local', statusFilter : filter }, function(error, response) {
    // @see http://npm.im/terror for details about error codes
    if (error.code === ask.Error.CODES.UNEXPECTED_STATUS_CODE) {
        console.log('Response status code is not 200, 201 or 304');
    }

    // ...
});
```

## Body encoding

Body encoder converts `body` to corresponding format and sets `Content-type` header.

### Built-in encoders

* `string` — Used by default. Converts `body` to `String`. Accepts all types.
* `json` — Applies `JSON.stringify` to the `body`. Accepts all types.
* `urlencoded` — Converts `body` to query string. Accepts `Object`.
* `multipart` — Formats `body` according to [multipart/form-data spec](http://www.w3.org/TR/html4/interact/forms.html#h-17.13.4.2). Accepts `Object` (or `Buffer` object).
* `raw` – Use body as is. Accepts instance of Buffer. Remember to set `content-type` header manually if required.

### Content-type

If you pass `Buffer` as property value, mime-type `application/octet-stream` will be applied. And property name will be used as file name.

Otherwise, you can pass additional info (mime-type and filename) in parameter's description:
```javascript
ask({
    bodyEncoding : 'multipart', // encoder name

    body : {
        'sample.mp3' : buffer, // an instance of Buffer, "sample.mp3" will be used as file name

        image : {
            filename : 'image.jpg',
            mime : 'image/jpeg',
            data : image_buffer // an instance of Buffer
        }
    }
}, function(error, response) {
    /* ... */
});
```

### Exceptions

If you use body encoder, Asker can throw following errors:

* `BODY_ENCODER_NOT_EXISTS` – unknown `bodyEncoder` has been passed;
* `BODY_INCORRECT_TYPE` – `body`'s type is not allowed by the encoder.

### Custom encoders

To implement you own body encoder, you must add an encoding function as the `Asker.bodyEncoders` property. Property name will be used as the encoder name.

Example:
```javascript
var Asker = require('asker');

// encoder name is 'trimText'
Asker.bodyEncoders.trimText = function(body, setContentType) {
    // throw error if passed body format is not acceptable for your encoder
    if (['number', 'string', 'boolean'].indexOf(typeof body) === -1) {
        throw AskerError.createError(AskerError.CODES.UNEXPECTED_BODY_TYPE, {
            type : typeof body,
            expectedTypes : 'Object'
        });
    }

    // 'content-type' header will be set to 'text/plain'
    setContentType('text/plain');

    return String(data).trim();
};
```

Note: `setContentType` sets `Content-Type` header only if header was not set before. But you can force overriding by passing `true` as second argument:

```javascript
Asker.bodyEncoders.trimText = function(body, setContentType) {
    setContentType('nyan/colorful', true);

    return 'Colorful nyan cat';
};
```

## Connection pools tuning

### The problem

At this point of time (version `0.10` and below) node.js provides a socket pool manager that works as follows:

* by default `globalAgent` is used for all outgoing http requests;
* each `Agent` instance, including `globalAgent`, has a `maxSockets` property, which you can change;
* socket limit is set for each unique __host-port pair__, that is served by this particular `Agent`.

That is sometimes an unwanted behaviour. Let's take an example.

You have two backends: `backend:3000` and `backend:4000`. First backend is indispensable for the application, but the second one is complementary. E.g., it makes http calls for the advertisements that you show later.

Under heavy load this additional backend (which is usually less fault-tolerant) may occupy all sockets that OS provides for the whole `node` process, because default pool manager cares only about __host-port__ pairs. `defaultAgent` does not anyhow correct each backend' socket limit according to process limit.

### Solution

How `Asker` can help you manage this problem? `Asker` can create a custom instance of `http.Agent` for any given backend. And you can set up a `maxSockets` property by calculating each backend priority.

### API

`{Object} agent` `http.Agent` options:

* `{String} name='globalAgent'` unique name for this backend
* `{Number} maxSockets=1024` socket limit for this backend
* `{Boolean} persistent=true` either agent would be deleted when it's last socket is removed. You can consider setting it to false, if you create agent's `name` in runtime.

## Error handling

Asker produces errors using [Terror](http://npm.im/terror), so you can setup your own logger and use `error.log()` method for logging.

If you already use Terror and created a logger for Terror itself, you shouldn't setup it again for AskerError.

`AskerError` class is available via `request('asker').Error` property. So you can, for example, localize error messages or customize it in your own way.
