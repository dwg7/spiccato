// Deterministic place-name -> bbox resolution via GSI's own geocoder, no LLM
// involved. Deliberately separate from the LLM keyword-extraction step
// (llm.ts): DECISIONS.md D16 found the on-device model unreliable even at
// extracting a single search keyword, so asking it to also extract a place
// name would compound that risk. The area-name field is user-typed instead
// (see openweb/main.ts) -- a human types a place name reliably in the time
// it'd take to explain the task to a 0.5B model.
const GEOCODE_URL = 'https://msearch.gsi.go.jp/address-search/AddressSearch';

// Half-width of the padded box in degrees. DECISIONS.md D17 (2026-08-07
// reversal): a bbox is a best-effort guess the user can pan/zoom to correct,
// not something to fabricate carefully -- err wide rather than narrow, since
// a too-tight box can crop the area of interest out entirely.
const PAD_DEGREES = 0.15;

interface GsiAddressSearchHit {
  geometry?: { coordinates?: [number, number] };
}

// Returns null on no match or network failure -- callers should treat that
// as "couldn't resolve the area" and fall back to omitting bbox (D17), not
// as an error to surface loudly.
export async function geocodeAreaName(name: string): Promise<[number, number, number, number] | null> {
  const trimmed = name.trim();
  if (trimmed === '') return null;

  const res = await fetch(`${GEOCODE_URL}?q=${encodeURIComponent(trimmed)}`);
  if (!res.ok) return null;

  const results = (await res.json()) as GsiAddressSearchHit[];
  const coords = results[0]?.geometry?.coordinates;
  if (!coords || coords.length !== 2) return null;

  const [lon, lat] = coords;
  return [lon - PAD_DEGREES, lat - PAD_DEGREES, lon + PAD_DEGREES, lat + PAD_DEGREES];
}
