/** Original decorative still life (abstract flacons). Not a depiction of any real product. */
export function HeroArt({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 560 640" className={className} role="img" aria-label="Decorative illustration of abstract perfume flacons">
      <defs>
        <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#efe6d6" />
          <stop offset="1" stopColor="#e2d5bf" />
        </linearGradient>
        <linearGradient id="glassA" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#2b2420" />
          <stop offset="0.55" stopColor="#4a3a2c" />
          <stop offset="1" stopColor="#1b1715" />
        </linearGradient>
        <linearGradient id="glassB" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#f5ecdc" stopOpacity="0.95" />
          <stop offset="1" stopColor="#d9c39a" stopOpacity="0.9" />
        </linearGradient>
        <linearGradient id="glassC" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#8a6a3c" />
          <stop offset="0.5" stopColor="#c19a5b" />
          <stop offset="1" stopColor="#7a5c33" />
        </linearGradient>
        <linearGradient id="cap" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#9c7d45" />
          <stop offset="0.5" stopColor="#e3cc94" />
          <stop offset="1" stopColor="#8b6d3b" />
        </linearGradient>
        <linearGradient id="shine" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#fff" stopOpacity="0" />
          <stop offset="0.5" stopColor="#fff" stopOpacity="0.35" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
        <radialGradient id="glow" cx="0.5" cy="0.35" r="0.6">
          <stop offset="0" stopColor="#fbf6ec" />
          <stop offset="1" stopColor="#fbf6ec" stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width="560" height="640" fill="url(#bg)" />
      <circle cx="300" cy="230" r="240" fill="url(#glow)" />
      <path d="M0 470 H560 V640 H0 Z" fill="#d6c6ab" />
      <path d="M0 470 H560" stroke="#b39457" strokeWidth="1" opacity="0.6" />
      <circle cx="400" cy="150" r="64" fill="none" stroke="#b39457" strokeWidth="1" opacity="0.5" />

      {/* tall dark flacon */}
      <ellipse cx="230" cy="474" rx="92" ry="12" fill="#000" opacity="0.18" />
      <rect x="150" y="210" width="160" height="262" rx="14" fill="url(#glassA)" />
      <rect x="166" y="226" width="22" height="230" rx="8" fill="url(#shine)" opacity="0.6" />
      <rect x="196" y="176" width="68" height="36" rx="3" fill="#2a221d" />
      <rect x="184" y="112" width="92" height="66" rx="4" fill="url(#cap)" />
      <path d="M190 330 H270" stroke="#c9ad74" strokeWidth="0.8" opacity="0.8" />
      <path d="M200 342 H260" stroke="#c9ad74" strokeWidth="0.8" opacity="0.5" />

      {/* round pale flacon */}
      <ellipse cx="392" cy="478" rx="78" ry="10" fill="#000" opacity="0.14" />
      <rect x="320" y="330" width="146" height="146" rx="73" fill="url(#glassB)" stroke="#c9b083" strokeWidth="1" />
      <rect x="370" y="300" width="46" height="34" rx="3" fill="url(#cap)" />
      <path d="M346 380 q20 -24 46 -26" stroke="#fff" strokeOpacity="0.7" strokeWidth="6" strokeLinecap="round" fill="none" />

      {/* small amber flacon */}
      <ellipse cx="96" cy="478" rx="52" ry="8" fill="#000" opacity="0.14" />
      <path d="M58 360 h76 l10 24 v84 a8 8 0 0 1 -8 8 h-80 a8 8 0 0 1 -8 -8 v-84 z" fill="url(#glassC)" />
      <rect x="80" y="322" width="32" height="40" rx="3" fill="#2a221d" />
      <rect x="66" y="380" width="10" height="80" rx="4" fill="url(#shine)" opacity="0.5" />
    </svg>
  );
}
