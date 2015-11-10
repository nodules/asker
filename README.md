asker [![NPM version][npm-image]][npm-link] [![Build status][build-image]][build-link]
=====

[![Dependency status][deps-image]][deps-link]
[![devDependency status][devdeps-image]][devdeps-link]

asker is a wrapper for `http.request`, which incorporates:

* response deflating using gzip,
* requests retrying,
* connection pools tuning.

If you are looking for a module to fetch 3rd-party web content (pages, RSS, files or something else), don't waste your
time and look at the [request](http://npm.im/request) module, as asker doesn't support cookies and redirects out of the box.

The main goal of asker is to communicate between frontends and backends that use some kind of [SLA](http://en.wikipedia.org/wiki/Service-level_agreement).

## Quick start

```javascript
var ask = require('asker');

ask({ host: 'yandex.com' }, function(error, response) {
    if (error) {
        return error.log();
    }

    console.log('Response retrieved in %s ms', response.meta.time.total);
    console.log('Response data', response.data);
});
```

## Options

All parameters are optional.

* `{String} host="localhost"`
* `{String} hostname` – The same as the `host`, used for compatibility with results of the `url.parse()`. Has higher priority than the `host`.
* `{Number} port=80`
* `{String} path="/"`
* `{String} protocol` – Default is `"http:"` if `port` is set to 80, and `"https:"` if port is 443.
* `{String} url` – Shorthand alternative for `protocol`, `hostname`, `port` and `path` options.
* `{String} method="GET"`
* `{Object} headers` – HTTP headers
* `{Object} query` – Query parameters.
* `{String} requestId=""` – Request identifier which is used in log messages.
* `{*} body` – Request body. If it's an `Object`, `JSON.stringify` is applied for encoding, otherwise it's converted to `String`.
* `{String} bodyEncoding="string"` – Body encoding method (`string`, `json`, `urlencoded`, `multipart` or the one implemented by user). See ["Body encoding"](#body-encoding) for details.
* `{Number} timeout=500` – Timeout from the moment when a socket was given by the pool manager.
* `{Number} queueTimeout=timeout+50` – Timeout from the moment, when asker initiated the request. Useful if pool manager failed to provide a socket for any reason.
* `{Function} isNetworkError` – A function that checks whether the given status code should be treated as network error. See ["Response status codes processing"](#response-status-codes-processing) for details.
* `{Number} maxRetries=0` – Maximum number of retries allowed for the request.
* `{Number} minRetriesTimeout=300` – The number of milliseconds before starting the first retry if `maxRetries` is greater than 0.
* `{Number} maxRetriesTimeout=Infinity` – The maximum number of milliseconds between two retries.
* `{Function} isRetryAllowed` – A function that determines if retry is allowed for the given reason.
* `{Boolean} allowGzip=true` – Allows response compression with gzip.
* `{Object|false} agent` – http.Agent options, see [Connection pools tuning](#connection-pools-tuning) section for details.

## Response format

Successful requests will return data and additional information in the following format:

`{Object} response`
* `{Number} statusCode` http status code
* `{Object} headers` returned http headers (names are lowercased)
* `{Object} meta` meta information
    * `{Object} time` request timers
        * `{Number} network` the time from socket was opened and until the request was completed
        * `{Number} total` total execution time
    * `{Object} options` options which was provided for request creation
    * `{Object} retries`
        * `{Number} used` number of retries used
        * `{Number} limit` retries limit for a given request
* `{*} data` received data. If response body wasn't provided, `null` is returned.

## Response status codes processing

### isNetworkError(statusCode)

When response status code is received, asker passes status code through the filter function `isNetworkError(statusCode)`,
which determines whether this response code is acceptable:

* `{Number} statusCode` – A response status code provided by `asker`.

The function must return `false` if particular `statusCode` should be treated as network error. By default all status
codes less than 500 are allowed.

Note, that result must be returned ASAP, because execution time of the filter WILL affect request timeouts.

#### Example

Suppose, we want to accept only responses with `200`, `201` and `304` status codes.

```javascript
var ask = require('asker');

function isNetworkError(statusCode) {
    return [200, 201, 304].indexOf(statusCode) === -1;
}

ask({ host: 'yandex.com', isNetworkError: isNetworkError }, function(error, response) {
    // @see http://npm.im/terror for details about error codes
    if (error.code === ask.Error.CODES.UNEXPECTED_STATUS_CODE) {
        console.error('Response status code is not 200, 201 or 304');
    }

    // ...
});
```

### isRetryAllowed(retryReason)

In addition to status code filtering, asker can check whether particular failed response is allowed for retrying.
`isRetryAllowed(retryReason)` filter function is used for that:

* `{AskerError} retryReason` – An error to check, if retry is allowed.

#### Example

Let's assume that the backend server we ask is quite laggy, so we want to retry our requests in case of temporary errors:

```javascript
var ask = require('asker');

function isRetryAllowed(retryReason) {
    if (retryReason.code === ask.Error.CODES.UNEXPECTED_STATUS_CODE) {
        // in case of network errors, retry only if backend returns "Server Unavailable"
        return retryReason.data.statusCode === 503;
    }
    return true;
}

ask({ host: 'yandex.com', maxRetries: 5, isRetryAllowed: isRetryAllowed }, function(error, response) {
    if ( ! error) {
        console.log('Retries used: %d', response.meta.retries.used);
    }
});
```

## Body encoding

Body encoder converts `body` to corresponding format and sets `Content-type` header.

### Built-in encoders

* `string` – Used by default. Converts `body` to `String`. Accepts all types.
* `json` – Applies `JSON.stringify` to the `body`. Accepts all types.
* `urlencoded` – Converts `body` to query string. Accepts `Object`.
* `multipart` – Formats `body` according to [multipart/form-data spec](http://www.w3.org/TR/html4/interact/forms.html#h-17.13.4.2). Accepts `Object` (or `Buffer` object).
* `raw` – Use body as is. Accepts instance of Buffer. Remember to set `content-type` header manually if required.

### Content-type

If you pass `Buffer` as property value, mime-type `application/octet-stream` will be applied. And property name will be used as file name.

Otherwise, you can pass additional info (mime-type and filename) in description of the parameter:

```javascript
ask({
    bodyEncoding: 'multipart', // encoder name
    body: {
        'sample.mp3': buffer, // an instance of Buffer, "sample.mp3" will be used as file name
        image: {
            filename: 'image.jpg',
            mime: 'image/jpeg',
            data: image_buffer // an instance of Buffer
        }
    }
}, function(error, response) {
    /* ... */
});
```

Wrap the fields in an array if you want to send multiple files:

```javascript
ask({
    bodyEncoding: 'multipart',
    body: {
        images: [
            'sample.mp3': buffer,
            {
                filename: 'pic.jpg',
                mime: 'image/jpeg',
                data: pic_buffer
            }
        ]
    }
}, function(error, response) {
    /* ... */
});
```

### Exceptions

asker may throw the following errors, if you use body encoders:

* `BODY_ENCODER_NOT_EXISTS` – unknown `bodyEncoder` has been passed;
* `BODY_INCORRECT_TYPE` – `body`'s type is not allowed by the encoder.

### Custom encoders

To implement you own body encoder, you must add an encoding function as the `asker.bodyEncoders` property.
Property name will be used as the encoder name.

#### Example:

```javascript
var ask = require('asker');

var AskerError = ask.Error;

// encoder name is 'trimText'
ask.bodyEncoders.trimText = function(body, setContentType) {
    // throw error if passed body format is not acceptable for your encoder
    if (['number', 'string', 'boolean'].indexOf(typeof body) === -1) {
        throw AskerError.createError(AskerError.CODES.UNEXPECTED_BODY_TYPE, {
            type: typeof body,
            expectedTypes: 'Object'
        });
    }

    // 'content-type' header will be set to 'text/plain'
    setContentType('text/plain');

    return String(data).trim();
};
```

Note: `setContentType` sets `Content-Type` header only if header was not set before. You can force overriding
by passing `true` as second argument:

```javascript
ask.bodyEncoders.trimText = function(body, setContentType) {
    setContentType('nyan/colorful', true);

    return 'Colorful nyan cat';
};
```

## Connection pools tuning

### The problem

Node.js provides an internal socket pool manager which works as follow:

* by default `globalAgent` is used for all outgoing http requests;
* each `Agent` instance, including `globalAgent`, has a `maxSockets` property, which you can change;
* socket limit is set for each unique **host:port pair**, that is served by this particular `Agent`.

The pool may behave unexpectedly in some cases.

For example, if you have two backend servers `backend:3000` and `backend:4000` and first server is indispensable
for the application, but the second one is complementary (e.g. it makes an http call for advertisements you show later).

Under the heavy load this secondary backend (which is usually less fault-tolerant) may occupy all sockets that
OS provides for the whole Node.js process, because the default pool manager cares only about **host:port pairs**
and `defaultAgent` does not correct socket limit for each server according to the process limits.

In the scenario above both servers will be unavailable, even if first indispensable backend works fine.

### Solution

How asker can help you manage this problem? You can create a custom instance of `http.Agent` for any given backend.
And you can set a `maxSockets` property by calculating each backend priority. asker provides an API to help with that.

### API

`{Object} agent` `http.Agent` options:

* `{String} name='globalAgent'` – Unique name for the asked server.
* `{Number} maxSockets` – Socket limit for the server. Node.js 0.10 and below sets it to `5` by default.

#### Example

```js
var ask = require('asker');

var server1 = {
    host: 'backend',
    port: 3000,
    agent: { name: 'backend1', maxSockets: 1024 }
};

var server2 = {
    host: 'backend',
    port: 4000,
    agent: { name: 'backend2', maxSockets: 100 }  // keep maxSockets for server2 small as we don't care much about it's availability
};

ask(server1, function() {});
ask(server1, function() {});
```

## Error handling

asker produces errors using [Terror](http://npm.im/terror), so you can setup your own logger or use `error.log()` method for logging.

If you already use Terror and had created a logger for Terror itself, you shouldn't setup it again for AskerError.

`AskerError` class is available via `request('asker').Error` property. So you can, localize error messages or customize it in your own way.

[npm-image]: https://img.shields.io/npm/v/asker.svg?style=flat
[npm-link]: https://npmjs.org/package/asker
[build-image]: https://img.shields.io/travis/nodules/asker.svg?style=flat
[build-link]: https://travis-ci.org/nodules/asker
[deps-image]: https://img.shields.io/david/nodules/asker.svg?style=flat
[deps-link]: https://david-dm.org/nodules/asker
[devdeps-image]: https://img.shields.io/david/dev/nodules/asker.svg?style=flat
[devdeps-link]: https://david-dm.org/nodules/asker#info=peerDependencies
