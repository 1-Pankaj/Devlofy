/**
 * Garden sprites — the palette and the hand-authored pixel art.
 *
 * The garden is drawn on a virtual grid where one pixel is one scene unit, and
 * every layer (sky, hills, soil, sprites) ends up as horizontal **runs** of one
 * colour. The component turns runs into SVG path data — one `<Path>` per
 * colour — so a full garden is a few dozen nodes, not a few thousand.
 *
 * Everything in this file is pure: no react-native, no three.js. That is what
 * lets `self-check.ts` compile it under Node and assert the art's invariants
 * (rectangular grids, every character priced in the palette, run merging).
 *
 * Light convention: the key light is the **moon, top-left** — every sprite
 * carries its highlight on the upper-left rim and its shade on the lower-right,
 * and the scenery hangs the moon in the same corner so the whole world agrees.
 * Every prop is outlined in `K` so it separates cleanly from soil, grass and
 * sky alike, and every prop ends on a dark contact line so nothing floats.
 *
 * The palette is shared across sprites: one character is one colour everywhere,
 * so a moss fleck on the log and a blade in the meadow are the same green. The
 * digits carry the sky furniture (0/1/2 moon, 3/4/5 sun, 6/7/8/9 water) because
 * those hues belong to no prop.
 */

// ── the palette ──────────────────────────────────────────────────────────────

/**
 * One character → one colour. Characters are chosen to be readable in the
 * source grids; '.' is always transparent and never needs an entry.
 */
export const PALETTE: Record<string, string> = {
  K: '#10131F', // outline / deepest shadow
  // foliage — five steps of green plus a sun-kissed sparkle
  O: '#0E2B1A', // canopy under-shadow (darkest leaf)
  D: '#16452A', // leaf deep
  L: '#256B36', // leaf shade
  G: '#2E8544', // leaf mid
  H: '#48A853', // leaf light
  J: '#7BC263', // leaf highlight
  j: '#A9DE7E', // sun-kissed sparkle
  // blossom
  P: '#F2C7D8', // petal pale
  p: '#E39CBE', // petal deep
  // wood — the trunk's four steps, then the props' three
  T: '#241608', // trunk outline
  t: '#3E2817', // trunk dark
  u: '#5C3B22', // trunk mid
  v: '#7A5230', // trunk light
  w: '#96693F', // bark highlight
  W: '#33210F', // wood dark (props)
  V: '#4C3319', // wood mid
  U: '#6A4926', // wood light
  // soil
  S: '#1C1207', // soil darkest
  s: '#2A1B0C', // soil dark
  x: '#3D2B16', // soil mid
  y: '#4C3720', // soil light
  z: '#5E4526', // clod highlight
  // stone
  R: '#232838', // stone dark
  r: '#353B54', // stone mid
  e: '#4A5270', // stone light
  E: '#606A94', // stone highlight
  // meadow ground
  g: '#1C3E2C', // band far
  h: '#245033', // band mid
  i: '#2C613C', // band near
  k: '#357447', // fleck light
  f: '#16301F', // fleck dark
  // blades
  l: '#4E9B52', // blade mid
  n: '#6FBF5E', // blade light
  // flora
  F: '#F5F2E6', // daisy white
  Y: '#F2C14E', // gold centre / beak / monarch wing
  M: '#C2452F', // amanita cap
  m: '#F0E8DC', // cap spot
  N: '#D9CDB4', // stem / gills
  Q: '#D96B8C', // rose petal / sunset cloud body
  X: '#A63A5C', // rose deep
  // lantern metal + flame
  I: '#2B2E45', // metal dark
  q: '#FF9D3B', // flame core / sunset lit edge
  Z: '#FFD98A', // flame bright
  // bird — a hedge sparrow: warm browns, pale breast
  A: '#54412F', // bird dark
  a: '#8A6A48', // bird mid
  b: '#C9A87C', // bird light
  // cloud (dusk) — moonlit
  C: '#32365C', // cloud body
  c: '#4A4F7C', // cloud lit edge
  o: '#262A4A', // cloud shade
  // moon (dusk) — body, crater, crater rim
  '0': '#F4F1E1',
  '1': '#DAD4BA',
  '2': '#BFB89C',
  // sun (gold) — rim, hot core
  '3': '#FFC866',
  '4': '#FF9D4E',
  '5': '#FFF3C4',
  // pond — water, lit surface, sparkle, depth
  '6': '#24406E',
  '7': '#46699C',
  '8': '#7FA0D0',
  '9': '#16304F',
};

/** Resolve one grid character to its colour ('.' and unknown stay null). */
export function colorOf(ch: string): string | null {
  if (ch === '.' || ch === ' ') return null;
  return PALETTE[ch] ?? null;
}

// ── sprites ──────────────────────────────────────────────────────────────────

export type Sprite = {
  readonly rows: readonly string[];
  readonly w: number;
  readonly h: number;
};

/** Build a sprite, refusing ragged grids loudly (a bug here is invisible later). */
export function makeSprite(rows: readonly string[]): Sprite {
  const w = rows[0]?.length ?? 0;
  for (const row of rows) {
    if (row.length !== w) {
      throw new Error(`ragged sprite row: expected ${w}, got ${row.length} in "${row}"`);
    }
  }
  return { rows, w, h: rows.length };
}

/** A horizontal run of one colour: pixels [col, col+len) on `row`. */
export type Run = {
  row: number;
  col: number;
  len: number;
  color: string;
};

/**
 * Merge a sprite's pixels into horizontal runs, left-to-right, top-to-bottom.
 * Optional `flip` mirrors the grid (props facing either way share one grid).
 */
export function spriteRuns(sprite: Sprite, flip = false): Run[] {
  const runs: Run[] = [];
  for (let row = 0; row < sprite.h; row += 1) {
    const source = sprite.rows[row];
    const line = flip ? [...source].reverse().join('') : source;
    let col = 0;
    while (col < line.length) {
      const ch = line[col];
      let len = 1;
      while (col + len < line.length && line[col + len] === ch) len += 1;
      const color = colorOf(ch);
      if (color) runs.push({ row, col, len, color });
      col += len;
    }
  }
  return runs;
}

/** Offset runs to a sprite's top-left corner (col, row are in scene units). */
export function placeRuns(runs: Run[], col: number, row: number, scale = 1): Run[] {
  return runs.map((run) => ({
    row: Math.round(row + run.row * scale),
    col: Math.round(col + run.col * scale),
    len: Math.max(1, Math.round(run.len * scale)),
    color: run.color,
  }));
}

/**
 * Compile runs into SVG path data — one entry **per colour** (an SVG path has
 * a single fill), each containing one rectangle subpath per run, in scene
 * units (1 unit = 1 pixel of the virtual grid). Merging neighbouring runs
 * first keeps every path as short as possible.
 */
export function runsToPaths(runs: Run[]): { color: string; d: string }[] {
  const byColor = new Map<string, Run[]>();
  for (const run of runs) {
    const bucket = byColor.get(run.color);
    if (bucket) bucket.push(run);
    else byColor.set(run.color, [run]);
  }
  const out: { color: string; d: string }[] = [];
  for (const [color, bucket] of byColor) {
    let d = '';
    for (const run of mergeRuns(bucket)) {
      d += `M${run.col} ${run.row}h${run.len}v1h-${run.len}z`;
    }
    out.push({ color, d });
  }
  return out;
}

/** Merge runs of one colour that continue each other on the same row. */
export function mergeRuns(runs: Run[]): Run[] {
  if (runs.length < 2) return runs;
  const sorted = [...runs].sort((a, b) => a.row - b.row || a.col - b.col);
  const out: Run[] = [sorted[0]];
  for (let k = 1; k < sorted.length; k += 1) {
    const last = out[out.length - 1];
    const run = sorted[k];
    if (run.row === last.row && run.col === last.col + last.len) {
      out[out.length - 1] = { ...last, len: last.len + run.len };
    } else {
      out.push(run);
    }
  }
  return out;
}

// ── the hand-authored props ──────────────────────────────────────────────────
// Every grid is drawn pixel by pixel: a K outline around the whole silhouette,
// highlight on the upper-left rim, shade on the lower-right, and a dark
// contact line under the base so nothing floats. Names match `props.ts` so
// the placement layer stays data and the art stays art.

/** A tuft of meadow grass — five blades, moonlit tips, a dark base. */
export const SPRITE_GRASS = makeSprite([
  '.n...n.',
  '.n.n.n.',
  'lnn.nnl',
  'llnnnll',
  '.lfffl.',
]);

/**
 * A daisy patch — the 3-day streak trophy. Two open faces with layered
 * petals, leafed stems, and a shadowed grass base so it sits in the meadow.
 */
export const SPRITE_FLOWERS = makeSprite([
  '...F.............',
  '..FFF............',
  '.FFYFF........F..',
  '..FFF.......FFF..',
  '...F......FFYFF..',
  '...l.......FFF...',
  '..nln.......F....',
  '...ln......l.....',
  '...l.......l.....',
  '...l......nl.....',
  '..llf......llf...',
  '..fff......fff...',
]);

/** A rose patch — the 7-day streak's deeper pink. Same bones, hotter petals. */
export const SPRITE_FLOWERS_2 = makeSprite([
  '...Q.............',
  '..QpQ............',
  '.QpXpQ........Q..',
  '..QpQ.......QQQ..',
  '...Q......QpXpQ..',
  '...l.......QQQ...',
  '..nln.......Q....',
  '...ln......l.....',
  '...l.......l.....',
  '...l......nl.....',
  '..llf......llf...',
  '..fff......fff...',
]);

/**
 * Amanita cluster — one per two hours of focus, up to three. A big outlined
 * cap with a small companion behind, gill lines under every cap, spots that
 * avoid the rim, and a shared soil shadow.
 */
export const SPRITE_MUSHROOMS = makeSprite([
  '....KKKKK......',
  '..KKMmMMMKK....',
  '.KMmMMmMMMMK...',
  '.KMMMMmMMMMK...',
  '..KKKKKKKKK....',
  '....KNNNK..KKK.',
  '....KNNNK.KMMmK',
  '....KNNNK..KKK.',
  '..f.KNNNK..KNK.',
  '.ff.KKKKK..KKK.',
  '.ffff.....ffff.',
]);

/** One moss-topped boulder — outlined, moonlit from the left. */
export const SPRITE_ROCK = makeSprite([
  '...KKKKKK...',
  '..KGGeEErK..',
  '.KGerrreRRK.',
  'KeerrrrRRRRK',
  'KerrrrrRRRRK',
  'KrrrrrRRRRRK',
  '.KrrrRRRRRK.',
  '..KKKKKKKK..',
]);

/** A scatter of three stones — one large, one small, one pebble. */
export const SPRITE_ROCKS = makeSprite([
  '...KKKKK..........',
  '..KGeEerK.........',
  '.KGerrrRK...KKK...',
  'KGeerrrRRK..KeEK..',
  'KerrrrrRRRK.KerRK.',
  'KrrrrrRRRRK..KrK..',
  '.KrrrRRRRRK..KKK..',
  '..KKKKKKKKK..KKK..',
  '.f..fff......fff..',
]);

/** A stacked cairn — six hours of depth, four stones, balanced off-centre. */
export const SPRITE_CAIRN = makeSprite([
  '.....KKKK...',
  '....KeEeK...',
  '....KerrK...',
  '...KKKKKK...',
  '..KeEEerRK..',
  '..KerrrRRK..',
  '..KrrrRRRK..',
  '.KKKKKKKKK..',
  '.KeEEerrrRK.',
  '.KerrrRRRRK.',
  '.KrrrRRRRRK.',
  'KKKKKKKKKKK.',
  'KeEErrrrRRRK',
  'KKKKKKKKKKKK',
  '.ffffffffff.',
]);

/** The focus lantern at rest — a small flame in the glass, hook on top. */
export const SPRITE_LANTERN = makeSprite([
  '.....K.....',
  '....KIK....',
  '..KKIIIKK..',
  '.KeIIIIIeK.',
  '..KIqqqIK..',
  '..KIqZqIK..',
  '..KIqZqIK..',
  '..KIqqqIK..',
  '..KIqqqIK..',
  '..KIIIIIK..',
  '...KeIeK...',
  '...KIIIK...',
  '....KKK....',
]);

/** The focus lantern while a block runs — the glass burns full. */
export const SPRITE_LANTERN_LIT = makeSprite([
  '.....K.....',
  '....KIK....',
  '..KKIIIKK..',
  '.KeIIIIIeK.',
  '..KIqZqIK..',
  '..KIZZZIK..',
  '..KIZZZIK..',
  '..KIZZZIK..',
  '..KIqZqIK..',
  '..KIIIIIK..',
  '...KeIeK...',
  '...KIIIK...',
  '....KKK....',
]);

/**
 * A fallen log, cut face to the left: an outlined face with growth rings,
 * bark cracks down the body, moss along the spine, one small tenant on top.
 */
export const SPRITE_LOG = makeSprite([
  '.............MmM....',
  '....GGGGHGG..KN.....',
  'KeeUVUVKVVKVVKVVKVVK',
  'KeUVVVKVVKVVwKVKVVKV',
  'KeUVVVKVVKVVKVVKVVKV',
  'KeUVVVKVVKVVKVVKVVKV',
  'KeeUVUVVVUVVUUVVUVKK',
  '.KKKKKKKKKKKKKKKKKK.',
]);

/** A cut stump — an outlined wood-ring face, bark streaks, roots flaring. */
export const SPRITE_STUMP = makeSprite([
  '...KKKKKKK...',
  '..KeuwwwueK..',
  '.KeuwutwueK..',
  '.KuuwutwuuK..',
  '.KeuuuuuueK..',
  '.KVtVVtVVVtK.',
  '.KVVVtVVVVK..',
  'KVtVVVVVVVKKK',
  'KVtVVVVVVVVKK',
  '..ffffffffff.',
]);

/** A young fern — fronds arcing out of a soil-cupped crown. */
export const SPRITE_FERN = makeSprite([
  '.J....l....J.',
  '.nJ...l...Jn.',
  '..nJ..l..Jn..',
  '..lnJ.l.Jnl..',
  '...nlJlJln...',
  '....lJlJl....',
  '....JlJlJ....',
  '...JHJlJHJ...',
  '...xysxy.....',
]);

/** A garden bench — two rails, three posts, a seat, and three feet. */
export const SPRITE_BENCH = makeSprite([
  '..KKKKKKKKKKKKKKKKKKKK..',
  '.KUUUUUUUUUUUUUUUUUUUUK.',
  '.KVVVVVVVVVVVVVVVVVVVVK.',
  '.K.VVV.....VVV....VVV.K.',
  '.K.VVV.....VVV....VVV.K.',
  '.K.VVV.....VVV....VVV.K.',
  '.K.VVV.....VVV....VVV.K.',
  'KUUUUUUUUUUUUUUUUUUUUUUK',
  'KVVVVVVVVVVVVVVVVVVVVVVK',
  '.K.VVV.....VVV....VVV.K.',
  '.K.VVV.....VVV....VVV.K.',
  '.K.VVV.....VVV....VVV.K.',
  '...WWW.....WWW....WWW...',
]);

/**
 * The signpost's post — the arrow plates that carry one project each are drawn
 * as data beside it (`garden-scene`), so the count is live, not painted. A
 * pointed cap, bark-grained post, and a flared foot.
 */
export const SPRITE_SIGNPOST = makeSprite([
  '.......K.......',
  '......KVK......',
  '.....KVtVK.....',
  '.....KutuK.....',
  '.....KutvK.....',
  '.....KvuUK.....',
  '.....KutuK.....',
  '.....KvtvK.....',
  '.....KuUuK.....',
  '.....KvtuK.....',
  '.....KutvK.....',
  '.....KvuUK.....',
  '.....KutuK.....',
  '.....KvtvK.....',
  '.....KuUuK.....',
  '.....KvtuK.....',
  '.....KutuK.....',
  '....KuuttvK....',
  '...KuuttttvK...',
  '...fffffffff...',
]);

/** The sparrow, perched — the 5-day streak visitor. Frame A: at rest. */
export const SPRITE_BIRD = makeSprite([
  '...KKK....',
  '..KAAAK...',
  '..KAKAAK..',
  '..KAAAAKY.',
  '.KAbaAAAK.',
  '.KAaaaAAK.',
  '.KAAAAAK..',
  '..KKKKK...',
  '...K.K....',
]);

/** Frame B: the head comes up, the beak points at the sky. */
export const SPRITE_BIRD_LOOK = makeSprite([
  '...KKKY...',
  '..KAAAK...',
  '..KAKAAK..',
  '..KAAAAK..',
  '.KAbaAAAK.',
  '.KAaaaAAK.',
  '.KAAAAAK..',
  '..KKKKK...',
  '...K.K....',
  '..........',
]);

/** Frame C: a peck — the beak drops to the ground line. */
export const SPRITE_BIRD_PECK = makeSprite([
  '...KKK....',
  '..KAAAK...',
  '..KAKAAK..',
  '..KAAAAKY.',
  '.KAbaaAAK.',
  '.KAAAaAK..',
  '..KAAAK...',
  '...K.K....',
  '...K.K....',
  '..........',
]);

/** The seed stage — a shiny seed settled into a fresh mound, grass beside. */
export const SPRITE_SEED = makeSprite([
  '.....j........',
  '........v.....',
  '.......uv.....',
  '.n.s.uvvu.s.n.',
  'nnssxuvvuxssnn',
  '.sxyyyyyyss...',
  '..syyyyyss....',
  '...ssyyss.....',
  '....ssss......',
]);

/** The sprout — cotyledons open, a third leaf on its way, soil mounded. */
export const SPRITE_SPROUT = makeSprite([
  '...JH....HJ...',
  '..JGHJ..JHGJ..',
  '..JGGHJJHGGJ..',
  '...JGGHJHGGJ..',
  '....JGGHHGGJ..',
  '.....JJGGJJ...',
  '......lGGl....',
  '......lG......',
  '......lG......',
  '.....lxGl.....',
  '....xyllyx....',
  '...xyylyyyx...',
  '..sxyyyyyyss..',
  '...ssyyyyss...',
  '....ssssss....',
]);

/** A monarch, wings open — golden hour's visitor around the flowers. */
export const SPRITE_BUTTERFLY = makeSprite([
  'qY...Yq',
  'YYY.YYY',
  'qYYKYYq',
  '.qYKYq.',
  '..qKq..',
]);

/** The monarch mid-beat — wings folded to a blade. */
export const SPRITE_BUTTERFLY_CLOSED = makeSprite([
  '...K...',
  '..qYq..',
  '..YYY..',
  '..qKq..',
  '...K...',
]);

/** Cattails at the pond's edge — two brown seed heads over leaned leaves. */
export const SPRITE_REEDS = makeSprite([
  '..u....u..',
  '..uu...uu.',
  '..uu...uu.',
  '..uu...uu.',
  '..V....V..',
  '..V..n.V..',
  '.nV....Vn.',
  '.nV..n.V..',
  '..V.n..Vn.',
  '..V....V..',
  '..V...nV..',
  '..x....x..',
  '..x....x..',
]);

/** A lily pad on the pond — round, notched, lit from the upper left. */
export const SPRITE_LILYPAD = makeSprite([
  '..GGGG...',
  '.GJJGGG..',
  '.GJJGGGG.',
  '..GGGGG..',
  '...GGG...',
]);

/** A lily pad in flower — the pond earns it too. */
export const SPRITE_LILYPAD_FLOWER = makeSprite([
  '....F....',
  '...FYF...',
  '....F....',
  '..GGGGG..',
  '.GGJJGGG.',
  '...GGG...',
]);

/** Clouds — moonlit bodies, one lit edge toward the moon, shade below. */
export const SPRITE_CLOUD_1 = makeSprite([
  '........cc..........',
  '......ccCCcc..cc....',
  '..ccCCCCCCCCCCCCcc..',
  '.CCCCCCCCCCCCCCCCCC.',
  '.oooooooooooooooooo.',
  '...oo..........oo...',
]);

export const SPRITE_CLOUD_2 = makeSprite([
  '....cc.......',
  '..ccCCCcc....',
  '.CCCCCCCCCc..',
  '.CCCCCCCCCCC.',
  '..ooooooooo..',
]);

/** Clouds at golden hour — the same shapes, lit rose by the low sun. */
export const SPRITE_CLOUD_1G = makeSprite([
  '........PP..........',
  '......PPQQQQ..PP....',
  '..PPQQQQQQQQQQQQXX..',
  '.QQQQQQQQQQQQQQQQQQ.',
  '.XXXXXXXXXXXXXXXXXX.',
  '...XX..........XX...',
]);

export const SPRITE_CLOUD_2G = makeSprite([
  '....PP.......',
  '..PPQQQpp....',
  '.QQQQQQQQQXX.',
  '.QQQQQQQQQQQ.',
  '..XXXXXXXXX..',
]);

/** The moon — twilight's lamp, craters kept off the limb. */
export const SPRITE_MOON = makeSprite([
  '....00000....',
  '..000000000..',
  '.00000222000.',
  '0000000111000',
  '0000000111000',
  '0000110111000',
  '0000110000000',
  '0000000110000',
  '0000000110000',
  '.00000000000.',
  '..000000000..',
  '....00000....',
]);

/** The low sun — a hot core, a rim that bleeds into the gold sky. */
export const SPRITE_SUN = makeSprite([
  '.....44444.....',
  '...445555544...',
  '..45555555554..',
  '.4555555555554.',
  '.4555555555554.',
  '455555555555554',
  '455555555555554',
  '.4555555555554.',
]);

/** Every prop the placement layer can ask for, and its art. */
export const PROP_SPRITES = {
  rock: SPRITE_ROCK,
  rocks: SPRITE_ROCKS,
  grass: SPRITE_GRASS,
  fern: SPRITE_FERN,
  log: SPRITE_LOG,
  stump: SPRITE_STUMP,
  mushrooms: SPRITE_MUSHROOMS,
  flowers: SPRITE_FLOWERS,
  flowers2: SPRITE_FLOWERS_2,
  cairn: SPRITE_CAIRN,
  lantern: SPRITE_LANTERN,
  bird: SPRITE_BIRD,
  bench: SPRITE_BENCH,
  signpost: SPRITE_SIGNPOST,
} as const;

export type SpriteProp = keyof typeof PROP_SPRITES;
