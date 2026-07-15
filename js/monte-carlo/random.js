/** Deterministic uint32 PRNG and normal variates for repeatable fixed-seed runs. */
export function createSeededRandom(seed) {
  if (!Number.isInteger(seed) || seed < 0 || seed > 0xffffffff) {
    throw codedError("INVALID_SEED", "A Monte Carlo seed must be a uint32 integer.");
  }
  let state = seed >>> 0;
  let spare = null;
  const next = () => {
    state = (state + 0x6D2B79F5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
  return Object.freeze({
    next,
    normal() {
      if (spare !== null) { const value = spare; spare = null; return value; }
      let u = next(); let v = next();
      // Box-Muller is undefined at zero; the PRNG can legitimately emit it.
      while (u === 0) u = next();
      while (v === 0) v = next();
      const radius = Math.sqrt(-2 * Math.log(u));
      const angle = 2 * Math.PI * v;
      spare = radius * Math.sin(angle);
      return radius * Math.cos(angle);
    }
  });
}

function codedError(code, message) { const error = new RangeError(message); error.code = code; return error; }
