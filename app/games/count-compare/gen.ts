/**
 * 개수 비교하기 — 문항 생성기.
 * 플레이마다 새로 생성하며, 좌/우 개수가 반드시 달라 정답이 항상 존재한다.
 */

export const TOTAL = 46;

/** 배치 계산용 가상 구역 크기 (렌더 시 % 로 환산) */
export const ZONE_W = 240;
export const ZONE_H = 320;

export type PlacedWord = { x: number; y: number; size: number };

export type Question = {
  leftText: string;
  rightText: string;
  left: PlacedWord[];
  right: PlacedWord[];
  /** 단어가 더 많은 쪽 = 정답 */
  more: "L" | "R";
  /** 0 쉬움(1~15) · 1 중간(16~32) · 2 어려움(33~46) */
  band: 0 | 1 | 2;
  /** 적은 쪽 글자를 크게 만든 착시 문항 여부 */
  illusion: boolean;
};

/** 긍정/부정 단어 쌍 — 시각 대비용일 뿐 정답과 무관 */
const PAIRS: ReadonlyArray<readonly [string, string]> = [
  ["자유", "억압"],
  ["행복", "슬픔"],
  ["희망", "절망"],
  ["성공", "실패"],
  ["사랑", "미움"],
  ["평화", "전쟁"],
  ["용기", "공포"],
  ["기쁨", "분노"],
];

/** 구간별 두 쪽 개수 비율 범위 — 뒤로 갈수록 좁아져 어려움 */
const BAND_RATIO: ReadonlyArray<readonly [number, number]> = [
  [1.4, 1.8],
  [1.25, 1.45],
  [1.1, 1.3],
];

function rand(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

function randInt(min: number, max: number): number {
  return Math.floor(rand(min, max + 1));
}

export function bandOf(index: number): 0 | 1 | 2 {
  if (index < 15) return 0;
  if (index < 32) return 1;
  return 2;
}

type Box = { x: number; y: number; w: number; h: number };

/** 두 박스의 겹침 면적 / 작은 박스 면적 */
function overlapRatio(a: Box, b: Box): number {
  const ix = Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x));
  const iy = Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));
  const inter = ix * iy;
  if (inter <= 0) return 0;
  return inter / Math.min(a.w * a.h, b.w * b.h);
}

/**
 * 구역 안에 단어 박스를 배치.
 * 겹침 30% 이하 위치를 우선 탐색하고, 못 찾으면 시도 중 최소 겹침 위치를 채택
 * (항상 종료 보장). 박스는 구역 경계를 벗어나지 않는다.
 */
function placeWords(sizes: number[]): PlacedWord[] {
  const boxes: Box[] = [];
  const out: PlacedWord[] = [];
  for (const size of sizes) {
    const w = size * 2.15; // 한글 2글자 폭 근사
    const h = size * 1.3;
    let best: Box = { x: rand(0, ZONE_W - w), y: rand(0, ZONE_H - h), w, h };
    let bestWorst = Number.POSITIVE_INFINITY;
    for (let t = 0; t < 70; t++) {
      const cand: Box = {
        x: rand(0, ZONE_W - w),
        y: rand(0, ZONE_H - h),
        w,
        h,
      };
      let worst = 0;
      for (const b of boxes) worst = Math.max(worst, overlapRatio(cand, b));
      if (worst < bestWorst) {
        bestWorst = worst;
        best = cand;
      }
      if (worst <= 0.3) break;
    }
    boxes.push(best);
    out.push({ x: best.x, y: best.y, size });
  }
  return out;
}

function makeSizes(count: number, kind: "any" | "big" | "small"): number[] {
  const lo = kind === "big" ? 22 : 14;
  const hi = kind === "small" ? 20 : 30;
  return Array.from({ length: count }, () => randInt(lo, hi));
}

export function makeQuestion(index: number): Question {
  const band = bandOf(index);
  const [rMin, rMax] = BAND_RATIO[band];
  const ratio = rand(rMin, rMax);

  // 적은 쪽 8~floor(22/ratio) → 많은 쪽 round(low*ratio) ≤ 22, 항상 low 보다 큼
  const low = randInt(8, Math.max(8, Math.floor(22 / ratio)));
  const high = Math.min(22, Math.max(low + 1, Math.round(low * ratio)));

  const more: "L" | "R" = Math.random() < 0.5 ? "L" : "R";
  const illusion = Math.random() < 0.3;

  const pair = PAIRS[randInt(0, PAIRS.length - 1)];
  const flip = Math.random() < 0.5;
  const leftText = flip ? pair[1] : pair[0];
  const rightText = flip ? pair[0] : pair[1];

  const leftCount = more === "L" ? high : low;
  const rightCount = more === "R" ? high : low;

  // 착시 문항: 적은 쪽 글자를 크게, 많은 쪽 글자를 작게
  const leftKind: "any" | "big" | "small" = !illusion
    ? "any"
    : leftCount < rightCount
      ? "big"
      : "small";
  const rightKind: "any" | "big" | "small" = !illusion
    ? "any"
    : rightCount < leftCount
      ? "big"
      : "small";

  return {
    leftText,
    rightText,
    left: placeWords(makeSizes(leftCount, leftKind)),
    right: placeWords(makeSizes(rightCount, rightKind)),
    more,
    band,
    illusion,
  };
}

export function makeQuestions(): Question[] {
  return Array.from({ length: TOTAL }, (_, i) => makeQuestion(i));
}
