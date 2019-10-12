import { md, util } from 'node-forge';
import { parse } from 'url';

function verifyFunctionForPublicKey(publicKey) {
  return async (data, signature) => {
    const messageDigest = md.sha256.create();
    messageDigest.update(data, 'raw');
    try {
      const signatureBytes = util.decode64(signature);
      return publicKey.verify(messageDigest.digest().getBytes(), signatureBytes);
    } catch (error) {
      return false;
    }
  };
}

function normalizeHeaders(headers) {
  return Object.keys(headers)
    .sort()
    .reduce((result, header) => {
      const normalized = header.replace(/^([a-z])|[-\s]+([a-z])/g, character => character.toUpperCase());
      result[normalized] = headers[header];
      return result;
    }, {});
}

async function responseInterceptor(response) {
  const { config } = response;
  if (config.doneCallback) config.doneCallback();
  response.bunq = {};

  const headers = normalizeHeaders(response.headers);

  try {
    const responseId = headers['X-Bunq-Client-Response-Id'];
    if (!responseId) throw new Error('Response does not contain client response ID');
    response.bunq.responseId = responseId;

    const originalRequestId = config.headers['X-Bunq-Client-Request-Id'];
    if (!originalRequestId) throw new Error('Request did not have a bunq request ID');

    const returnedRequestId = headers['X-Bunq-Client-Request-Id'];
    if (!returnedRequestId) throw new Error('Response does not contain client request ID');

    if (originalRequestId !== returnedRequestId) throw new Error('Response does not match request ID');

    if (config.bunq.shouldVerifyResponseSignature) {
      const signature = headers['X-Bunq-Server-Signature'];
      if (!signature) throw new Error('Response does not contain signature');

      let verifyFunction = null;
      if (config.bunq.asyncServerSignatureVerify) {
        verifyFunction = config.bunq.asyncServerSignatureVerify;
      } else if (config.bunq.serverPublicKey) {
        verifyFunction = verifyFunctionForPublicKey(config.bunq.serverPublicKey);
      } else {
        throw new Error('Missing server key or verify function');
      }

      const verifyHeaderKeys = Object.keys(headers).filter(
        header => header.startsWith('X-Bunq-') && header !== 'X-Bunq-Server-Signature'
      );

      let verifyData = verifyHeaderKeys.reduce(
        (data, header) => `${data}\n${header}: ${headers[header]}`,
        `${response.status}`
      );
      verifyData += '\n\n';
      verifyData += response.data.toString('binary');

      if (!(await verifyFunction(verifyData, signature))) throw new Error('Server signature was not valid');
    }

    if (headers['Content-Type'] === 'application/json') {
      response.data = JSON.parse(response.data.toString('utf8'));
      if (!('Response' in response.data)) throw new Error('Unknown JSON response from server');

      response.bunq.objects = [];
      response.bunq.objectsByType = {};
      for (const objectWrapper of response.data.Response) {
        if (typeof objectWrapper !== 'object' || objectWrapper instanceof Array) continue;
        const objectType = Object.keys(objectWrapper)[0];
        const object = objectWrapper[objectType];

        // Append the type to the bunq object
        object.__type = objectType; // eslint-disable-line no-underscore-dangle

        response.bunq.objects.push(object);
        if (!(objectType in response.bunq.objectsByType)) response.bunq.objectsByType[objectType] = [];
        response.bunq.objectsByType[objectType].push(object);
      }

      if ('Pagination' in response.data) {
        const urlParts = parse(response.config.url);

        const fixPaginationUrl = paginationUrl => {
          if (!paginationUrl) return null;
          const fullPaginationUrl = `${urlParts.protocol}//${urlParts.host}${paginationUrl}`;
          if (response.config.baseURL && fullPaginationUrl.indexOf(response.config.baseURL) === 0)
            return fullPaginationUrl.slice(response.config.baseURL.length).replace(/^\/+/, '');
          return fullPaginationUrl;
        };

        response.bunq.pagination = {
          future: fixPaginationUrl(response.data.Pagination.future_url),
          newer: fixPaginationUrl(response.data.Pagination.newer_url),
          older: fixPaginationUrl(response.data.Pagination.older_url),
        };
      }
    }
  } catch (error) {
    error.request = response.request;
    error.response = response;
    throw error;
  }

  return response;
}

async function responseErrorInterceptor(error) {
  const { config, request, response } = error;
  if (!config) throw error;
  if (config.doneCallback) config.doneCallback();
  if (!response) throw error;

  response.bunq = {};

  const headers = normalizeHeaders(response.headers);

  const responseId = headers['X-Bunq-Client-Response-Id'];
  if (responseId) response.bunq.responseId = responseId;

  // X-Bunq-Client-Request-Id not always set for errors, so don't check it.
  // X-Bunq-Server-Signature not always set for errors, so don't verify it.

  if (headers['Content-Type'] !== 'application/json') throw error;

  response.data = JSON.parse(response.data.toString('utf8'));
  if (!('Error' in response.data)) throw error;

  response.bunq.errors = response.data.Error;

  const bunqError = new Error(response.bunq.errors[0].error_description);
  bunqError.request = request;
  bunqError.response = response;
  throw bunqError;
}

export default [responseInterceptor, responseErrorInterceptor];
