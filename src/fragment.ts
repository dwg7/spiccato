// URL fragment codec for Map Intent hand-off and live state reflection.
//
// Distinct from hfu/faceless-cartographer's `#intent=` (DECISIONS.md D32
// there): this repo's whole premise (DECISIONS.md D2) is that URL state is
// the default, not a one-shot, opt-in exception -- so the payload format is
// deliberately incompatible and namespaced under its own hash key (`#m=`)
// rather than reusing `#intent=`. Pasting a spiccato link into
// faceless-cartographer, or vice versa, fails cleanly (unrecognized key /
// undecodable payload) rather than silently misrendering.
//
// Payload = <format-char><base64url(bytes)>. The format char makes the
// wire format self-describing so a decoder never has to guess:
//   "z" -- bytes are raw DEFLATE (CompressionStream('deflate-raw')) of the
//          UTF-8 YAML text. This is the format encodeIntentFragment
//          produces whenever the browser supports CompressionStream
//          (all evergreen browsers as of 2026) -- see DECISIONS.md D3 for
//          the size-reduction rationale and benchmark.
//   "p" -- bytes are plain UTF-8 YAML text, no compression. Used only as a
//          fallback when CompressionStream is unavailable. A decoder must
//          still understand "z" even if its own browser can't produce it,
//          so decoding "z" degrades to a clear failure (null) rather than
//          a crash when DecompressionStream is missing.
const HASH_PREFIX = '#m=';
const FORMAT_DEFLATE = 'z';
const FORMAT_PLAIN = 'p';

// Pinned to the ArrayBuffer-backed variant throughout (rather than the bare,
// SharedArrayBuffer-permitting `Uint8Array`) -- that's what `Uint8Array.from`
// and `new Uint8Array(n)` always produce, and it's what BufferSource-typed
// DOM APIs (CompressionStream et al.) require under the browser SPA's DOM
// lib. This module now also type-checks under mcp/'s @types/node and
// worker/'s @cloudflare/workers-types (DECISIONS.md D10); those declare
// TextEncoder.encode()'s return as the wider Uint8Array<ArrayBufferLike>, so
// the one call site that crosses that boundary (encodeIntentFragment below)
// asserts it into Bytes explicitly rather than loosening this alias for
// every call site in the module.
type Bytes = Uint8Array<ArrayBuffer>;

function toBase64Url(bytes: Bytes): string {
  let binary = '';
  bytes.forEach((b) => {
    binary += String.fromCharCode(b);
  });
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(payload: string): Bytes {
  const base64 = payload.replace(/-/g, '+').replace(/_/g, '/');
  const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
  const binary = atob(padded);
  return Uint8Array.from(binary, (c) => c.charCodeAt(0));
}

async function readAllChunks(readable: ReadableStream<Uint8Array>): Promise<Bytes> {
  const chunks: Uint8Array[] = [];
  const reader = readable.getReader();
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
  }
  const total = chunks.reduce((n, c) => n + c.length, 0);
  const out: Bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.length;
  }
  return out;
}

async function deflateRaw(bytes: Bytes): Promise<Bytes> {
  const cs = new CompressionStream('deflate-raw');
  const writer = cs.writable.getWriter();
  // Fire-and-forget: the write/close pair only needs to happen before the
  // reader drains readAllChunks below, not be awaited itself.
  void writer.write(bytes).then(() => writer.close());
  return readAllChunks(cs.readable);
}

async function inflateRaw(bytes: Bytes): Promise<Bytes> {
  const ds = new DecompressionStream('deflate-raw');
  const writer = ds.writable.getWriter();
  void writer.write(bytes).then(() => writer.close());
  return readAllChunks(ds.readable);
}

// Encodes Map Intent YAML text as the string to append after `#m=`. Callers
// prepend the prefix themselves. Always succeeds -- degrades to the
// uncompressed "p" format if CompressionStream isn't available or fails.
export async function encodeIntentFragment(yaml: string): Promise<string> {
  const bytes = new TextEncoder().encode(yaml) as Bytes;
  if (typeof CompressionStream !== 'undefined') {
    try {
      const compressed = await deflateRaw(bytes);
      return FORMAT_DEFLATE + toBase64Url(compressed);
    } catch {
      // Fall through to the plain format below.
    }
  }
  return FORMAT_PLAIN + toBase64Url(bytes);
}

// Takes the full location.hash (including the leading "#"). Returns the
// decoded YAML text, or null if there's nothing usable -- wrong prefix, an
// empty/malformed payload, an unknown format char, or a browser missing
// DecompressionStream for a "z" payload -- so callers can fall back to the
// paste form in every "not a usable fragment" case alike.
export async function decodeIntentFragment(hash: string): Promise<string | null> {
  if (!hash.startsWith(HASH_PREFIX)) return null;
  const payload = hash.slice(HASH_PREFIX.length);
  if (payload.length < 2) return null;
  const format = payload[0];
  const body = payload.slice(1);
  try {
    const bytes = fromBase64Url(body);
    if (format === FORMAT_DEFLATE) {
      if (typeof DecompressionStream === 'undefined') return null;
      const inflated = await inflateRaw(bytes);
      return new TextDecoder().decode(inflated);
    }
    if (format === FORMAT_PLAIN) {
      return new TextDecoder().decode(bytes);
    }
    return null;
  } catch {
    return null;
  }
}
