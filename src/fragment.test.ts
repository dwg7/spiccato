import { describe, expect, it } from 'vitest';
import { decodeIntentFragment, encodeIntentFragment } from './fragment.ts';

describe('encodeIntentFragment / decodeIntentFragment', () => {
  it('round-trips ASCII YAML', async () => {
    const yaml = 'spec_version: "map-intent/v2"\ngoal: "a test"\n';
    const hash = '#m=' + (await encodeIntentFragment(yaml));
    expect(await decodeIntentFragment(hash)).toBe(yaml);
  });

  it('round-trips YAML containing Japanese characters', async () => {
    const yaml = 'goal: "対象地域における土砂災害警戒区域の分布を示す。"\n';
    const hash = '#m=' + (await encodeIntentFragment(yaml));
    expect(await decodeIntentFragment(hash)).toBe(yaml);
  });

  it('round-trips YAML containing quotes and colons', async () => {
    const yaml = 'goal: "he said \\"hi: there\\""\ncolon: "a:b"\n';
    const hash = '#m=' + (await encodeIntentFragment(yaml));
    expect(await decodeIntentFragment(hash)).toBe(yaml);
  });

  it('produces a payload containing a format char plus only URL-safe base64url characters', async () => {
    const yaml = 'goal: "lots of + and / and = triggering bytes ÿþý"\n';
    const encoded = await encodeIntentFragment(yaml);
    expect(encoded).toMatch(/^[zp][A-Za-z0-9\-_]+$/);
  });

  it('compresses realistically-sized YAML smaller than plain base64url would be', async () => {
    const yaml = 'goal: "'.padEnd(50, 'x') + '"\n'.repeat(1) + 'repeated: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"\n'.repeat(20);
    const encoded = await encodeIntentFragment(yaml);
    expect(encoded[0]).toBe('z');
    const plainLength = btoa(unescape(encodeURIComponent(yaml))).length;
    expect(encoded.length).toBeLessThan(plainLength);
  });

  it('returns null for an empty hash', async () => {
    expect(await decodeIntentFragment('')).toBeNull();
  });

  it('returns null for a bare "#"', async () => {
    expect(await decodeIntentFragment('#')).toBeNull();
  });

  it('returns null when the hash lacks the "#m=" prefix', async () => {
    expect(await decodeIntentFragment('#foo=bar')).toBeNull();
  });

  it('returns null when the hash uses faceless-cartographer\'s "#intent=" prefix', async () => {
    expect(await decodeIntentFragment('#intent=eyJhIjoxfQ')).toBeNull();
  });

  it('returns null for "#m=" with no payload', async () => {
    expect(await decodeIntentFragment('#m=')).toBeNull();
  });

  it('returns null for "#m=" with only a format char and no body', async () => {
    expect(await decodeIntentFragment('#m=z')).toBeNull();
  });

  it('returns null for an unknown format char', async () => {
    expect(await decodeIntentFragment('#m=xAAAA')).toBeNull();
  });

  it('returns null for malformed base64 in the body', async () => {
    expect(await decodeIntentFragment('#m=pnot@@valid!!')).toBeNull();
  });
});
