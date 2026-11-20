import type { Piece } from "@/lib/style/types";

const LONG_TOPS = /kurta|sherwani|bandhgala|pathani/i;
const SHORTS = /shorts/i;
const JACKETS = /blazer|jacket|suit|overshirt|bomber|nehru|bandhgala|sherwani|cardigan/i;

function shade(hex: string, amt: number): string {
  const n = parseInt(hex.slice(1), 16);
  const f = (c: number) => Math.max(0, Math.min(255, Math.round(c + amt * 255)));
  const r = f((n >> 16) & 255);
  const g = f((n >> 8) & 255);
  const b = f(n & 255);
  return `#${((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1)}`;
}

/**
 * A flat, original fashion-flat figure coloured with the outfit's actual pieces, so customers see
 * the combination instead of reading a list. Purely decorative: the piece list carries the content.
 */
export function OutfitFigure({ pieces, className }: { pieces: Piece[]; className?: string }) {
  const top = pieces.find((p) => p.slot === "top");
  const layer = pieces.find((p) => p.slot === "layer" && JACKETS.test(p.name)) ?? (LONG_TOPS.test(top?.name ?? "") ? undefined : pieces.find((p) => p.slot === "layer"));
  const bottom = pieces.find((p) => p.slot === "bottom");
  const shoes = pieces.find((p) => p.slot === "shoes");
  const longTop = LONG_TOPS.test(top?.name ?? "") || LONG_TOPS.test(layer?.name ?? "");
  const shorts = SHORTS.test(bottom?.name ?? "");

  const skin = "#c9a184";
  const topC = top?.colour.hex ?? "#dddddd";
  const layerC = layer?.colour.hex;
  const bottomC = bottom?.colour.hex ?? "#333333";
  const shoeC = shoes?.colour.hex ?? "#222222";
  const hemY = longTop ? 168 : 128;

  return (
    <svg viewBox="0 0 120 260" className={className} role="img" aria-label="Illustration of the outfit colours">
      {/* head & neck */}
      <circle cx="60" cy="22" r="13" fill={skin} />
      <rect x="55" y="33" width="10" height="9" fill={skin} />
      {/* arms (skin under sleeves) */}
      <path d="M26 52 L18 128 L26 130 L36 62Z" fill={skin} />
      <path d="M94 52 L102 128 L94 130 L84 62Z" fill={skin} />
      {/* legs */}
      {shorts ? (
        <>
          <rect x="41" y="150" width="17" height="80" fill={skin} />
          <rect x="62" y="150" width="17" height="80" fill={skin} />
        </>
      ) : null}
      {/* trousers */}
      <path d={shorts ? "M38 124 H82 L84 164 H62 L60 140 L58 164 H36Z" : "M38 124 H82 L82 236 H63 L60 150 L57 236 H38Z"} fill={bottomC} />
      <path d={shorts ? "M60 128 V150" : "M60 128 V150"} stroke={shade(bottomC, -0.12)} strokeWidth="1.2" />
      {/* shoes */}
      <path d="M36 234 H58 V244 H30 Q30 236 36 234Z" fill={shoeC} />
      <path d="M62 234 H84 Q90 236 90 244 H62Z" fill={shoeC} />
      {/* top: torso + sleeves */}
      <path d={`M40 42 H80 L96 52 L104 112 L92 115 L84 72 L84 ${hemY} H36 L36 72 L28 115 L16 112 L24 52Z`} fill={topC} />
      <path d="M52 42 L60 54 L68 42" fill="none" stroke={shade(topC, -0.18)} strokeWidth="1.4" />
      {/* layer: open jacket panels + sleeves */}
      {layerC ? (
        <>
          <path d={`M40 42 L56 42 L56 ${longTop ? hemY : 134} L34 ${longTop ? hemY : 134} L35 72 L27 120 L15 117 L23 51Z`} fill={layerC} />
          <path d={`M80 42 L64 42 L64 ${longTop ? hemY : 134} L86 ${longTop ? hemY : 134} L85 72 L93 120 L105 117 L97 51Z`} fill={layerC} />
          <path d="M56 42 L50 70 M64 42 L70 70" stroke={shade(layerC, -0.2)} strokeWidth="1.4" />
        </>
      ) : null}
    </svg>
  );
}
