# Migration

## 1.0.0

Version 1.0.0 introduced the following breaking changes:

1\. `Agent.maxSockets` is not set to 1024 anymore.

Since Node.js 0.12 the default value of `Agent.maxSockets` as well as `globalAgent.maxSockets` was set
to `Infinity`. Enforcing it within asker might lead to an undesirable effect for users who use Node.js 0.12
and above, so it was removed.

Those who use Node.js 0.10 and don't use per server agent tuning should set `globalAgent.maxSockets` to
1024 (or any acceptable value) themselves.

See [#106](https://gtihub.com/nodules/asker/issues/106) for discussion.

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

3\. `onretry` option has been removed.

The option was not widely used, so it was removed.

4\. `agent.persistent` option has been removed.

The option was not widely used, so it was removed.

---

See CHANGELOG for the full list of changes introduced in 1.0.0.
