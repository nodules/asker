# Changelog

## 1.0.5 - 2016-03-08

Phillip Kovalev <twilightfeel@gmail.com>

* Stop buffering a response on request abort [#123](https://github.com/nodules/asker/pull/123)

## 1.0.4 - 2016-02-16

Vladimir Varankin <nek.narqo@gmail.com>

* Gzip response might ignore retry when start response buffering [#121](https://github.com/nodules/asker/pull/121)

## 1.0.3 - 2015-11-24

Vladimir Varankin <nek.narqo@gmail.com>

Version 1.0.2 has been unpublished due to internal needs.

* Internal package fixes

## 1.0.2 - 2015-11-19

Vladimir Varankin <nek.narqo@gmail.com>

* TLS options doesn't work with custom agent in Node.js < 0.12 [#119](https://github.com/nodules/asker/issues/119)
* Pass option `rejectUnauthorized` to https module [#86](https://github.com/nodules/asker/issues/86)
* Add unit tests for https functionality [#114](https://github.com/nodules/asker/issues/114)

## 1.0.1 - 2015-11-18

Vladimir Varankin <nek.narqo@gmail.com>

* Accept any `http` / `https` options. The bug was introduced in 1.0.0 [#118](https://github.com/nodules/asker/pull/118)

## 1.0.0 - 2015-11-12

Vladimir Varankin <nek.narqo@gmail.com>

### Notable changes

* `Agent.maxSockets` is not set to 1024 anymore [#106](https://github.com/nodules/asker/issues/106)
* `statusFilter` option has been split into two separate functions `isNetworkError` and `isRetryAllowed` [#93](https://github.com/nodules/asker/issues/93)
* `queueTimeout` option was set to 50ms by default. From now on queue timeout is not calculated
  as a sum of `timeout` options and delta [#103](https://github.com/nodules/asker/issues/103)
* `onretry` option was removed
* `agent.persistent` option was removed
* `minRetriesTimeout` and `maxRetriesTimeout` options were added

### Other changes

* use [asker-advanced-agent](http://npm.im/asker-advanced-agent)
* use [retry](http://npm.im/retry)
* use [unzip-response](http://npm.im/unzip-response)

See MIGRATION.md for migration guide.

## 0.6.2 - 2015-06-18

Phillip Kovalev <twilightfeel@gmail.com>

* allow an instance of Agent as a value of the `agent` option.

## 0.6.1 - 2015-03-30

Phillip Kovalev <twilightfeel@gmail.com>

* fill 'execution' timer on exceeded retries (by Dmitry Sorin https://github.com/1999)

## 0.6.0 - 2014-12-08

Phillip Kovalev <twilightfeel@gmail.com>

* updates terror module version to 1.0.0

## 0.5.0 - 2014-10-03

Phillip Kovalev <twilightfeel@gmail.com>

* implements `hostname` option which is the same as `host` and introduced
  to support results of `url.parse()` as options for asker.
  `hostname` has higher priority than `host` if both passed.
* updates terror module version to 0.4.x

## 0.4.6 - 2014-06-25

Phillip Kovalev <twilightfeel@gmail.com>

* implement encoding of multiple files for single parameter by multipart encoder

## 0.4.5 - 2014-05-13

Phillip Kovalev <twilightfeel@gmail.com>

* add support for `false` value for the option `agent`

## 0.4.4 - 2014-05-13

Phillip Kovalev <twilightfeel@gmail.com>

* fix broken timings in the error messages on failed retries

## 0.4.3 - 2014-05-12

Phillip Kovalev <twilightfeel@gmail.com>

* use `requestId` to form the `contimer` timers IDs

## 0.4.2 - 2014-05-12

Phillip Kovalev <twilightfeel@gmail.com>

* use [contimer](http://npm.im/contimer) module to measure requests execution and network time

## 0.4.1 - 2014-04-08

Phillip Kovalev <twilightfeel@gmail.com>

* return 'Request.DEFAULT_OPTIONS.port' which was lost on https merge

## 0.4.0 - 2014-04-07

Phillip Kovalev <twilightfeel@gmail.com>

* add some support for https (be careful with agents usage for https)

## 0.3.2 - 2013-12-06

Phillip Kovalev <twilightfeel@gmail.com>

* fix serialization of non-string literals in multipart encoder:
  all non-string literals automatically casted as strings

## 0.3.1 - 2013-11-01

Phillip Kovalev <twilightfeel@gmail.com>

* allow to list options accepted by asker request constructor

## 0.3.0 - 2013-10-24

Phillip Kovalev <twilightfeel@gmail.com>

* add "raw" body encoder to pass raw Buffer as request body

## 0.2.2 - 2013-08-23

Phillip Kovalev <twilightfeel@gmail.com>

* fix error name duplication in AskerError
* remove redundant UNKNOWN_ERROR code overriding

## 0.2.1 - 2013-08-11

Phillip Kovalev <twilightfeel@gmail.com>

* change `terror` dependency version to 0.3.x

## 0.2.0 - 2013-08-02

Phillip Kovalev <twilightfeel@gmail.com>

* implement body encoding and support for custom encoders [#9](https://github.com/nodules/asker/issues/9)
* allow to pass callback to Request#execute method [#59](https://github.com/nodules/asker/issues/59)
* add jscs to npm test toolchain
* response.data must be a buffer, not a string [#6](https://github.com/nodules/asker/issues/6)

## 0.1.13 - 2013-07-26

Phillip Kovalev <twilightfeel@gmail.com>

* fulfill error message for code UNEXPECTED_STATUS_CODE [#72](https://github.com/nodules/asker/issues/72)

## 0.1.12 - 2013-07-08

Phillip Kovalev <twilightfeel@gmail.com>

* full code coverage by tests
  https://github.com/nodules/asker/issues?labels=test&milestone=3&page=1&state=closed
* drop support for Node.js < 0.8.21 due to the bugs in the "http" module
* fix incorrect behaviour of Request#isRunning (always returns `false`) [#44](https://github.com/nodules/asker/issues/44)
* constructor compiles request body always when `options.body` have defined [#1](https://github.com/nodules/asker/issues/1)
* fix redundant callbacks is the case when "content-length" header is less than actual response
  body length [#46](https://github.com/nodules/asker/issues/46)
* fix missing callback call in the case when "content-length" header is more than actual
  response body length [#47](https://github.com/nodules/asker/issues/47)
* move `queueTimeout` default value calculation from request excution time to constructor [#48](https://github.com/nodules/asker/issues/48)
* callback has became optional argument of the request constructor [#54](https://github.com/nodules/asker/issues/54)
* fix network timer resolving [#58](https://github.com/nodules/asker/issues/58)
* request can be tried to execute with a dead agent [#60](https://github.com/nodules/asker/issues/60)
* `Request.createAgent` doesn't throw an error if the agent with the same name already
  in the agents pool [#62](https://github.com/nodules/asker/issues/62)

## 0.1.11 - 2013-07-1

Phillip Kovalev <twilightfeel@gmail.com>

* fix bug when response body is empty: "NaN" is returned in the `response.data` [#16](https://github.com/nodules/asker/issues/16)
* fix undefined value of the `response.meta.retries.limit` [#13](https://github.com/nodules/asker/issues/13)
* fix bug of the parsing of the `url` option without protocol on the Node.js <=0.8 [#11](https://github.com/nodules/asker/issues/11)
* fix `queueTimeout` option value (was computed as sum of the `timeout` and `QUEUE_TIMEOUT_DELTA` always) [#20](https://github.com/nodules/asker/issues/20)
* `response` object description has been added to the README.md
* HTTP status code now available from the callback as the `response.statusCode` field [#12](https://github.com/nodules/asker/issues/12)
* transport tests has been added [#15](https://github.com/nodules/asker/issues/15), [#17](https://github.com/nodules/asker/issues/17), [#18](https://github.com/nodules/asker/issues/18)
* [istanbul](http://npm.im/istanbul) has been added as tests coverage testing tool

## 0.1.10 - 2013-06-20

Phillip Kovalev <twilightfeel@gmail.com>

* fix incorrect parsing of the `url` option if protocol is missing [#7](https://github.com/nodules/asker/issues/7)

## 0.1.9 - 2013-06-20

Phillip Kovalev <twilightfeel@gmail.com>

* fix fall of the request constructor called without options hash [#5](https://github.com/nodules/asker/issues/5)
* fix unrecognizable option `method` which passed in lowercase [#8](https://github.com/nodules/asker/issues/8)
* set 'accept-encoding' header if no one passed in the options hash and option `allowGzip` enabled [#10](https://github.com/nodules/asker/issues/10)

## 0.1.7 - 2013-05-27

Phillip Kovalev <twilightfeel@gmail.com>

* add `url` option as an alternative to the combination of the `host`, `port` and `path` options ([508a616](https://github.com/nodules/asker/commit/508a616))

## 0.1.6 - 2013-03-18

Phillip Kovalev <twilightfeel@gmail.com>

* fix hostname logging
