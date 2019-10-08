# bunq-http

[![npm version](https://badge.fury.io/js/bunq-http.svg)](https://www.npmjs.com/package/bunq-http)

Low-level bunq HTTP client. Extends [axios](https://github.com/axios/axios) to manage:

- setting required request headers
- request signing (using [node-forge](https://github.com/digitalbazaar/forge))
- response header & signature verification
- rate limiting

Please note this client does NOT know:

- where to find the bunq production/staging API endpoints
- what rate limits to use
- how to login / obtain a session token

For a bit higher level API client, please see [bunq-session](https://github.com/robbertkl/bunq-session). It uses bunq-http to create a usable API client, so if you're looking to get started with simply logging in and making API calls, use bunq-session instead.

## Installation

```sh
npm install --save bunq-http
```

## Authors

- Robbert Klarenbeek, <robbertkl@renbeek.nl>

## License

This repo is published under the [MIT License](LICENSE).
