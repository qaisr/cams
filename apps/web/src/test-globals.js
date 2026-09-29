/* global require, global */
// jsdom does not expose TextDecoder/TextEncoder or fetch web globals.
// Node 26 has these natively; copy them into globalThis so MSW v2 can find them.

const { TextDecoder, TextEncoder } = require('util');

if (typeof globalThis.TextDecoder === 'undefined') {
  globalThis.TextDecoder = TextDecoder;
}
if (typeof globalThis.TextEncoder === 'undefined') {
  globalThis.TextEncoder = TextEncoder;
}

// Node 26+ native fetch globals — copy into jsdom's globalThis.
const nodeFetch = ['fetch', 'Request', 'Response', 'Headers', 'ReadableStream', 'FormData', 'Blob'];
for (const name of nodeFetch) {
  if (typeof globalThis[name] === 'undefined' && typeof global[name] !== 'undefined') {
    globalThis[name] = global[name];
  }
}
