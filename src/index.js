import { create as createAxios } from 'axios';
import deepMerge from './deepMerge.js';
import { name as packageName, version as packageVersion } from '../package.json';
import requestInterceptors from './requestInterceptors.js';
import responseInterceptors from './responseInterceptors.js';

const defaults = {
  responseType: 'arraybuffer',
  headers: {
    common: {
      'Cache-Control': 'no-cache',
      'User-Agent': `${packageName}/${packageVersion}`,
    },
  },
  rateLimit: {},
  bunq: {
    language: 'en_US',
    region: 'en_US',
    geoLocation: '0 0 0 0 000',
    shouldSignRequest: true,
    shouldVerifyResponseSignature: true,
    // clientPrivateKey: forgePrivateKey
    // asyncClientSign: async (data: string) => signature: base64string,
    // serverPublicKey: forgePublicKey
    // asyncServerSignatureVerify: async (data: string, signature: base64string) => isValid: bool
    // token: string (either installation-token or session-token)
    // attachmentDescription: string (needed for binary POST requests for attachments)
  },
};

export default function (instanceConfig = {}) {
  const instance = createAxios(deepMerge(instanceConfig, defaults));
  instance.interceptors.request.use(...requestInterceptors);
  instance.interceptors.response.use(...responseInterceptors);
  return instance;
}
