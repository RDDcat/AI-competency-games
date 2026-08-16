/**
 * 마법약 재료 아이콘 4종.
 *
 * 잡다 원본의 ‘연두 카드 위 초록 허브 일러스트’ 톤은 그대로 따르되, 도안은 일부러
 * 다르게 그렸다 — 실물과 같은 그림을 외우는 게 아니라 ‘조합 → 색’ 매핑을 학습하는 것이
 * 목적이므로, 같은 계열·다른 도안이어야 연습이 실전으로 전이된다.
 *
 * 4종은 3초 안에 구분돼야 하므로 실루엣이 서로 겹치지 않게 잡았다:
 *  고사리 = 깃털형(중앙 줄기 + 좌우 소엽) · 세잎풀 = 넓은 잎 세 장
 *  클로버 = 방사형 네 잎 · 풀잎 = 가늘고 긴 잎 네 장
 */

const LEAF = "#57a862";
const LEAF_DEEP = "#3d8a51";
const VEIN = "#2f6f42";

type IconProps = { className?: string };

const SVG_PROPS = {
  viewBox: "0 0 64 64",
  "aria-hidden": true,
  focusable: "false",
} as const;

/** 고사리 — 중앙 줄기에 소엽이 위쪽으로 짝지어 붙는 깃털형 */
export function Fern({ className }: IconProps) {
  const leaflets = [
    { y: 52, r: 13.5 },
    { y: 44, r: 12 },
    { y: 36, r: 10.2 },
    { y: 28, r: 8.2 },
    { y: 21, r: 6 },
  ];
  return (
    <svg {...SVG_PROPS} className={className}>
      <path
        d="M32 61V13"
        stroke={VEIN}
        strokeWidth="2.6"
        strokeLinecap="round"
        fill="none"
      />
      {leaflets.map(({ y, r }) => (
        <g key={y}>
          {/* 회전 중심을 줄기 위에 두어 소엽 안쪽 끝이 줄기에 붙게 한다 */}
          <ellipse
            cx={32 - r}
            cy={y}
            rx={r}
            ry={r * 0.34}
            fill={LEAF}
            transform={`rotate(30 32 ${y})`}
          />
          <ellipse
            cx={32 + r}
            cy={y}
            rx={r}
            ry={r * 0.34}
            fill={LEAF_DEEP}
            transform={`rotate(-30 32 ${y})`}
          />
        </g>
      ))}
      <ellipse cx="32" cy="14" rx="3.4" ry="5.4" fill={LEAF} />
    </svg>
  );
}

/** 세잎풀 — 한 점에서 부챗살처럼 벌어지는 넓은 잎 세 장 */
const BROAD_LEAF = "M0 0C10 -8 14 -20 0 -33C-14 -20 -10 -8 0 0Z";

export function ThreeLeaf({ className }: IconProps) {
  return (
    <svg {...SVG_PROPS} className={className}>
      <path
        d="M32 61V44"
        stroke={VEIN}
        strokeWidth="2.6"
        strokeLinecap="round"
        fill="none"
      />
      {/* 옆 잎은 ±54° 로 충분히 벌려야 가운데 잎에 가려 한 장처럼 보이지 않는다 */}
      <path
        d={BROAD_LEAF}
        fill={LEAF_DEEP}
        transform="translate(32 46) rotate(-54) scale(0.95)"
      />
      <path
        d={BROAD_LEAF}
        fill={LEAF_DEEP}
        transform="translate(32 46) rotate(54) scale(0.95)"
      />
      <g transform="translate(32 46) scale(1.18)">
        <path d={BROAD_LEAF} fill={LEAF} />
        <path
          d="M0 -4V-28"
          stroke={VEIN}
          strokeWidth="1.5"
          strokeLinecap="round"
          fill="none"
        />
      </g>
    </svg>
  );
}

/** 클로버 — 중심에서 90°씩 돌아가는 하트형 잎 네 장 */
const CLOVER_LOBE =
  "M0 0C-3 -6 -12 -8 -12 -16C-12 -22 -6 -25 0 -20C6 -25 12 -22 12 -16C12 -8 3 -6 0 0Z";

export function Clover({ className }: IconProps) {
  return (
    <svg {...SVG_PROPS} className={className}>
      <path
        d="M32 61C32 54 31 51 29 48"
        stroke={VEIN}
        strokeWidth="2.6"
        strokeLinecap="round"
        fill="none"
      />
      {[0, 90, 180, 270].map((deg, i) => (
        <path
          key={deg}
          d={CLOVER_LOBE}
          fill={i % 2 === 0 ? LEAF : LEAF_DEEP}
          transform={`translate(32 27) rotate(${deg}) scale(0.92)`}
        />
      ))}
      <circle cx="32" cy="27" r="2.4" fill={VEIN} />
    </svg>
  );
}

/** 풀잎 — 밑동 한 점에서 뻗는 가늘고 긴 잎 네 장 */
const BLADE = "M-5 0C-4.6 -20 -3 -34 0 -47C3 -34 4.6 -20 5 0Z";

export function Grass({ className }: IconProps) {
  const blades = [
    { rot: -40, scale: 0.78, fill: LEAF_DEEP },
    { rot: -20, scale: 0.94, fill: LEAF },
    { rot: -3, scale: 1, fill: LEAF_DEEP },
    { rot: 17, scale: 0.92, fill: LEAF },
    { rot: 38, scale: 0.8, fill: LEAF_DEEP },
  ];
  return (
    <svg {...SVG_PROPS} className={className}>
      {blades.map(({ rot, scale, fill }) => (
        <path
          key={rot}
          d={BLADE}
          fill={fill}
          transform={`translate(32 61) rotate(${rot}) scale(${scale})`}
        />
      ))}
    </svg>
  );
}
