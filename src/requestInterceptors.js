import { md, util } from 'node-forge';
import { parse } from 'url';
import { v4 as uuid } from 'uuid';

function signFunctionForPrivateKey(privateKey) {
  return async data => {
    const messageDigest = md.sha256.create();
    messageDigest.update(data, 'raw');
    const signatureBytes = privateKey.sign(messageDigest);
    return util.encode64(signatureBytes);
  };
}

function urlFromConfig(config) {
  if (/^([a-z][a-z\d+\-.]*:)?\/\//i.test(config.url)) return config.url;
  return config.url ? `${config.baseURL.replace(/\/+$/, '')}/${config.url.replace(/^\/+/, '')}` : config.baseURL;
}

async function requestInterceptor(config) {
  const urlParts = parse(urlFromConfig(config));
  const endpointWithoutQuery = urlParts.pathname;

  const requestId = uuid();

  Object.assign(config.headers, {
    'X-Bunq-Client-Request-Id': requestId,
    'X-Bunq-Geolocation': config.bunq.geoLocation,
    'X-Bunq-Language': config.bunq.language,
    'X-Bunq-Region': config.bunq.region,
  });

  if (config.bunq.token) {
    config.headers['X-Bunq-Client-Authentication'] = config.bunq.token;
  }

  if (config.bunq.attachmentDescription) {
    config.headers['X-Bunq-Attachment-Description'] = config.bunq.attachmentDescription;
  }

  if (config.data) {
    // Turn everything into a Buffer
    if (config.data instanceof Buffer) {
      if (!('Content-Type' in config.headers)) throw new Error('No Content-Type header set when providing Buffer data');
    } else if (typeof config.data === 'object') {
      config.data = Buffer.from(JSON.stringify(config.data));
      if (!('Content-Type' in config.headers)) config.headers['Content-Type'] = 'application/json;charset=utf-8';
    } else {
      throw new Error('Unknown data type');
    }
  }

  if (
    config.bunq.shouldVerifyResponseSignature &&
    !(config.bunq.asyncServerSignatureVerify || config.bunq.serverPublicKey)
  ) {
    throw new Error('Missing server key or verify function');
  }

  if (config.bunq.shouldSignRequest && config.data) {
    let signFunction = null;
    if (config.bunq.asyncClientSign) {
      signFunction = config.bunq.asyncClientSign;
    } else if (config.bunq.clientPrivateKey) {
      signFunction = signFunctionForPrivateKey(config.bunq.clientPrivateKey);
    } else {
      throw new Error('Missing client key or sign function');
    }

    const signData = config.data.toString('binary');
    const signature = await signFunction(signData);
    config.headers['X-Bunq-Client-Signature'] = signature;
  }

  const rateLimit = config.rateLimit[config.method] || config.rateLimit.common;
  if (rateLimit) {
    // This doneCallback() MUST be called as soon as we have a response (either success or error)
    config.doneCallback = await rateLimit(endpointWithoutQuery);
  }

  return config;
}

async function requestErrorInterceptor(error) {
  throw error;
}

export default [requestInterceptor, requestErrorInterceptor];
