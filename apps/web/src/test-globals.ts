// jsdom does not expose TextDecoder/TextEncoder; required by MSW v2.
import { TextDecoder, TextEncoder } from 'node:util';

if (typeof globalThis.TextDecoder === 'undefined') {
  globalThis.TextDecoder = TextDecoder;
}
if (typeof globalThis.TextEncoder === 'undefined') {
  globalThis.TextEncoder = TextEncoder;
}
