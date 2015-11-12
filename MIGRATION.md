# Migration

## 1.0.0

Version 1.0.0 introduced the following breaking changes:

1\. `Agent.maxSockets` is not set to 1024 anymore.

Since Node.js 0.12 the default value of `Agent.maxSockets` as well as `globalAgent.maxSockets` was set
to `Infinity`. Enforcing it within asker might lead to an undesirable effect for users who use Node.js 0.12
and above, so it was removed.

Those who use Node.js 0.10 and don't use per server agent tuning should set `globalAgent.maxSockets` to
1024 (or any acceptable value) themselves.

See [#106](https://github.com/nodules/asker/issues/106) for discussion.

2\. `statusFilter` option has been split into two separate functions:

- `isNetworkError(Number statusCode) -> Boolean`;
- `isRetryAllowed(AskerError retryReason) -> Boolean`.

For asker before 1.0.0:

```js
var ask = require('asker');

function statusFilter(statusCode) {
    return {
        accept: ~[200, 201, 304].indexOf(statusCode),
        isRetryAllowed: statusCode < 400 || statusCode > 499
    }
}

ask({ host: 'yandex.com', statusFilter: statusFilter }, callback);
```

The code above should be changed to:

```js
var ask = require('asker');

function isNetworkError(statusCode) {
    return [200, 201, 304].indexOf(statusCode) === -1;
}

function isRetryAllowed(retryReason) {
    if (retryReason.code === ask.Error.CODES.UNEXPECTED_STATUS_CODE) {
        var statusCode = retryReason.data.statusCode;
        return statusCode < 400 || statusCode > 499;
    }
}

ask({ host: 'yandex.com', isNetworkError: isNetworkError, isRetryAllowed: isRetryAllowed }, callback);
```

See [#93](https://github.com/nodules/asker/issues/93) for discussion.

3\. `queueTimeout` option has been reworked.

From now on `queueTimeout` sets the exact amount of time, socket has to be assigned to the request and it's
default value is set to 50 ms. In previous versions the exact value was calculated as a sum of the value
of `timeout` plus `QUEUE_TIMEOUT_DELTA`.

For asker before 1.0.0:

```js
var ask = require('asker');

ask({
    timeout: 10  // the value of `queueTimeout = timeout + 50`
}, callback);
```

The code above should be changed to:

```js
var ask = require('asker');

ask({
    timeout: 10,
    queueTimeout: 60
}, callback);
```

4\. `onretry` option has been removed.

The option was not widely used, so it was removed.

5\. `agent.persistent` option has been removed.

The option was not widely used, so it was removed.

6\. Instantiation of `Asker` internal class from the user code has been marked as deprecated.

It is still technically possible to use asker as a class, e.g.

```js
var Asker = require('asker');
var ask = new Asker({  });
```

but since version 1.0.0 this method is marked as deprecated. Most methods of `Asker` class
have been marked as private. It's unlikely for the end user to use them from the code.

---

See [CHANGELOG.md](https://github.com/nodules/asker/blob/1.0.0/CHANGELOG.md) for the full list of changes introduced in 1.0.0.
