'use strict';
// Data carried in a URL, for a static site that can't store it: JSON, gzipped (CompressionStream), base64url.
// Put it in the hash (#l=…) so it never reaches a server log and changing it doesn't reload the page.
const b64url = (bytes) => btoa(Array.from(bytes, (b) => String.fromCharCode(b)).join('')).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const pipe = (data, stream) => new Response(new Blob([data]).stream().pipeThrough(stream));

async function packLink(obj) {
  return b64url(new Uint8Array(await pipe(JSON.stringify(obj), new CompressionStream('gzip')).arrayBuffer()));
}
// The object back, or null when the link is broken (cut short, mistyped, not ours). The caller still validates its shape.
async function unpackLink(s) {
  try {
    const bytes = Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0));
    return JSON.parse(await pipe(bytes, new DecompressionStream('gzip')).text());
  } catch { return null; }
}

if (typeof module === 'object') module.exports = { packLink, unpackLink };
