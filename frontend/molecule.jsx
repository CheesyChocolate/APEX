// Tiny skeletal-formula renderer.
//
// We don't parse real chemistry — we keep 8 hand-drawn motifs and assign one
// deterministically per SMILES via hash. Each motif is a clean 2D line
// sketch that reads as "a molecule" at thumbnail size, with thicker bonds
// and clearly placed heteroatom labels (O, N, F, Cl, OH).
//
// Drawn at viewBox 100×64; consumer sizes via width/height.

const __BOND  = '#1A2128';
const __BOND_W = 1.4;
const __ATOM_BG = 'currentColor'; // overridden via prop

// Each motif draws into a 100×64 viewBox.
// Use plain SVG strings (returned as React fragments) for compactness.

function MotifAspirin() {
  // Benzene + ester + carboxylic
  return (
    <g fill="none" stroke={__BOND} strokeWidth={__BOND_W} strokeLinecap="round">
      {/* hexagon */}
      <path d="M30 18 L44 18 L51 30 L44 42 L30 42 L23 30 Z" />
      {/* double bonds inside */}
      <path d="M31 22 L43 22" />
      <path d="M48 30 L42 38" />
      <path d="M25 30 L31 38" strokeWidth={__BOND_W * 0.9} />
      {/* COOH */}
      <path d="M51 30 L60 26" />
      <path d="M60 26 L66 30" />
      <path d="M60 26 L60 18" />
      <text x="66" y="33" fontFamily="IBM Plex Mono, monospace" fontSize="9" fill={__BOND} stroke="none">OH</text>
      <text x="56" y="16" fontFamily="IBM Plex Mono, monospace" fontSize="9" fill={__BOND} stroke="none">O</text>
      {/* OAc */}
      <path d="M44 42 L51 50" />
      <text x="51" y="56" fontFamily="IBM Plex Mono, monospace" fontSize="9" fill={__BOND} stroke="none">O</text>
      <path d="M58 50 L66 46" />
      <text x="66" y="50" fontFamily="IBM Plex Mono, monospace" fontSize="9" fill={__BOND} stroke="none">CH₃</text>
    </g>
  );
}

function MotifBicycle() {
  // Caffeine-like fused 6/5 with N's
  return (
    <g fill="none" stroke={__BOND} strokeWidth={__BOND_W} strokeLinecap="round">
      {/* 6-ring */}
      <path d="M20 22 L34 22 L41 32 L34 42 L20 42 L13 32 Z" />
      {/* double bonds */}
      <path d="M22 25 L32 25" />
      <path d="M36 32 L32 38" />
      {/* 5-ring fused right */}
      <path d="M41 32 L52 26 L60 32 L55 42 L41 32" />
      <path d="M51 28 L57 32" />
      {/* labels */}
      <text x="9"  y="35" fontFamily="IBM Plex Mono, monospace" fontSize="9" fill={__BOND} stroke="none">N</text>
      <text x="33" y="49" fontFamily="IBM Plex Mono, monospace" fontSize="9" fill={__BOND} stroke="none">N</text>
      <text x="60" y="35" fontFamily="IBM Plex Mono, monospace" fontSize="9" fill={__BOND} stroke="none">N</text>
      <text x="50" y="22" fontFamily="IBM Plex Mono, monospace" fontSize="9" fill={__BOND} stroke="none">N</text>
      {/* methyls */}
      <path d="M13 32 L6 28" />
      <path d="M55 42 L62 48" />
      <path d="M20 22 L20 14" />
    </g>
  );
}

function MotifAniline() {
  return (
    <g fill="none" stroke={__BOND} strokeWidth={__BOND_W} strokeLinecap="round">
      <path d="M34 18 L48 18 L55 30 L48 42 L34 42 L27 30 Z" />
      <path d="M35 22 L47 22" />
      <path d="M52 30 L46 38" />
      <path d="M29 30 L35 38" strokeWidth={__BOND_W * 0.9} />
      <path d="M27 30 L18 30" />
      <text x="8" y="33" fontFamily="IBM Plex Mono, monospace" fontSize="9" fill={__BOND} stroke="none">NH₂</text>
      <path d="M55 30 L64 30" />
      <text x="64" y="33" fontFamily="IBM Plex Mono, monospace" fontSize="9" fill={__BOND} stroke="none">F</text>
      <path d="M48 42 L48 50" />
      <text x="44" y="58" fontFamily="IBM Plex Mono, monospace" fontSize="9" fill={__BOND} stroke="none">OH</text>
    </g>
  );
}

function MotifSteroid() {
  // 3 fused 6-rings — steroid-y silhouette
  return (
    <g fill="none" stroke={__BOND} strokeWidth={__BOND_W} strokeLinecap="round">
      <path d="M14 30 L24 24 L34 30 L34 42 L24 48 L14 42 Z" />
      <path d="M34 30 L44 24 L54 30 L54 42 L44 48 L34 42" />
      <path d="M54 30 L64 24 L74 30 L74 42 L64 48 L54 42" />
      {/* methyls + OH */}
      <path d="M24 24 L24 16" />
      <path d="M44 24 L44 16" />
      <path d="M74 30 L82 26" />
      <text x="80" y="24" fontFamily="IBM Plex Mono, monospace" fontSize="9" fill={__BOND} stroke="none">OH</text>
      <path d="M14 30 L8 26" />
      <text x="0" y="29" fontFamily="IBM Plex Mono, monospace" fontSize="9" fill={__BOND} stroke="none">HO</text>
    </g>
  );
}

function MotifHetero5() {
  // 5-membered heterocycle with chain
  return (
    <g fill="none" stroke={__BOND} strokeWidth={__BOND_W} strokeLinecap="round">
      <path d="M30 20 L44 16 L52 28 L42 40 L28 34 Z" />
      <path d="M32 23 L42 20" />
      <path d="M48 28 L42 36" />
      <text x="20" y="24" fontFamily="IBM Plex Mono, monospace" fontSize="9" fill={__BOND} stroke="none">S</text>
      <path d="M52 28 L62 26 L70 32" />
      <text x="70" y="35" fontFamily="IBM Plex Mono, monospace" fontSize="9" fill={__BOND} stroke="none">Cl</text>
      <path d="M28 34 L20 42" />
      <path d="M20 42 L12 38" />
      <path d="M44 16 L44 8" />
      <text x="40" y="6" fontFamily="IBM Plex Mono, monospace" fontSize="9" fill={__BOND} stroke="none">O</text>
    </g>
  );
}

function MotifChainRing() {
  // Hexagon + long alkyl chain
  return (
    <g fill="none" stroke={__BOND} strokeWidth={__BOND_W} strokeLinecap="round">
      <path d="M52 18 L66 18 L73 30 L66 42 L52 42 L45 30 Z" />
      <path d="M53 22 L65 22" />
      <path d="M70 30 L64 38" />
      <path d="M47 30 L53 38" strokeWidth={__BOND_W * 0.9} />
      {/* zigzag chain */}
      <path d="M45 30 L36 24 L28 30 L20 24 L12 30 L4 24" />
      <text x="73" y="33" fontFamily="IBM Plex Mono, monospace" fontSize="9" fill={__BOND} stroke="none">Br</text>
    </g>
  );
}

function MotifPiperazine() {
  // 6-ring with two N's (piperazine), substituted
  return (
    <g fill="none" stroke={__BOND} strokeWidth={__BOND_W} strokeLinecap="round">
      <path d="M30 18 L44 18 L51 30 L44 42 L30 42 L23 30 Z" />
      <text x="13"  y="33" fontFamily="IBM Plex Mono, monospace" fontSize="9" fill={__BOND} stroke="none">N</text>
      <text x="50"  y="33" fontFamily="IBM Plex Mono, monospace" fontSize="9" fill={__BOND} stroke="none">N</text>
      <path d="M23 30 L14 30" />
      <path d="M51 30 L60 30" />
      {/* phenyl pendant */}
      <path d="M60 30 L70 24 L82 24 L88 34 L82 44 L70 44 L64 38" />
      <path d="M72 27 L80 27" />
      <path d="M84 34 L80 41" />
      {/* methyl */}
      <path d="M30 18 L24 12" />
      <path d="M44 42 L50 48" />
    </g>
  );
}

function MotifNaphthalene() {
  // Two fused benzenes (naphthalene) with substituents
  return (
    <g fill="none" stroke={__BOND} strokeWidth={__BOND_W} strokeLinecap="round">
      <path d="M20 22 L32 22 L38 32 L32 42 L20 42 L14 32 Z" />
      <path d="M38 32 L50 22 L62 22 L68 32 L62 42 L50 42 L38 32" />
      <path d="M22 25 L30 25" />
      <path d="M16 32 L22 39" strokeWidth={__BOND_W * 0.9} />
      <path d="M52 25 L60 25" />
      <path d="M64 32 L60 38" />
      {/* substituents */}
      <path d="M14 32 L4 32" />
      <text x="-2" y="35" fontFamily="IBM Plex Mono, monospace" fontSize="9" fill={__BOND} stroke="none">HO</text>
      <path d="M68 32 L78 32" />
      <text x="78" y="35" fontFamily="IBM Plex Mono, monospace" fontSize="9" fill={__BOND} stroke="none">NH₂</text>
      <path d="M32 22 L32 14" />
    </g>
  );
}

const MOTIFS = [
  MotifAspirin,
  MotifBicycle,
  MotifAniline,
  MotifSteroid,
  MotifHetero5,
  MotifChainRing,
  MotifPiperazine,
  MotifNaphthalene,
];

function Molecule({ smiles, size = 72, height, className = '', tint = false }) {
  const idx = (window.hash32(smiles || 'x') % MOTIFS.length);
  const Motif = MOTIFS[idx];
  const w = size;
  const h = height || Math.round(size * 0.64);
  return (
    <div
      className={'mol ' + className}
      style={{
        width: w,
        height: h,
        background: tint ? 'var(--surface-2)' : 'var(--surface)',
        border: '1px solid var(--hair)',
        borderRadius: 'var(--r-sm)',
        display: 'inline-block',
        overflow: 'hidden',
        flex: 'none',
      }}
    >
      <svg viewBox="0 0 100 64" width="100%" height="100%" preserveAspectRatio="xMidYMid meet">
        <Motif />
      </svg>
    </div>
  );
}

Object.assign(window, { Molecule });
