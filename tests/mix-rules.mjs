/** The mix rules on one level's measured row (scripts/mix-check.mjs,
 * tests/mix.test.mjs): `m` is the current era, `row` the whole level row (its
 * `rev8` era for the revision-nine comparisons). dB / LU from BS.1770
 * integrated loudness. */
export function rules(m, row = {}) {
  const r8 = row.rev8;
  return [
    // The bed ceiling: the sky is air, far under Diana's notes and the soundtrack, with no held tone in it.
    ["sky at least 18 dB under Diana's notes", m.sky <= m.diana - 18],
    ["sky at least 8 dB under the soundtrack", m.tune == null || m.sky <= m.tune - 8],
    ["sky has no sharp partials (no held tone)", (m.skyPartials ?? 0) <= 2],
    // The soundtrack: present, under Diana's notes.
    // (Revision nine took Diana's notes 2 dB down with the SFX: 3 dB is the floor.)
    ["soundtrack 3-12 dB under Diana's notes", m.tune != null && m.tune <= m.diana - 3 && m.tune >= m.diana - 12],
    // Revision nine: the bodies (every cue and the air) 3-5 dB under revision
    // eight's, and Diana's notes come down with them by less.
    ["bodies 3-5 dB under revision eight's", !r8?.sfx || (m.sfx <= r8.sfx - 3 && m.sfx >= r8.sfx - 5.5)],
    // (Her notes keep their bus level; only their softer timbres move them.)
    ["Diana's notes never louder, at most 3 dB under revision eight's", !r8?.diana || (m.diana <= r8.diana + 0.3 && m.diana >= r8.diana - 3)],
    // Her own notes' tails no longer drone through her gaps.
    ["notes' wash in her gaps at least 8 dB under her notes", m.washInGaps == null || m.washInGaps <= m.dianaDry - 8],
    // The glide whistle and the air are breaths, not a flute.
    ["whistle at least 12 dB under Diana's notes", m.whistle == null || !Number.isFinite(m.whistle) || m.whistle <= m.diana - 12],
    // No clipping; the door in line with the level.
    ["sample peak at or under -1 dBFS", m.peak <= -1],
    ["door within 2.5 LU of the run", Math.abs(m.doorOverRun) <= 2.5],
  ];
}
