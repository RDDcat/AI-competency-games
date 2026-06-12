/**
 * 도형 회전하기 — 변환군·문제 생성 로직.
 *
 * 변환 상태는 이면군 D8(원소 16개)의 원소를 정수로 표현한다:
 *   St = { rot: 0~7, flip: boolean }
 *   = 도형에 적용된 변환 R(rot×45°) ∘ (flip ? 좌우반전 F : 항등)
 * CSS 로는 `rotate(rot*45deg) scaleX(flip ? -1 : 1)`
 * (CSS transform 은 오른쪽 함수가 먼저 적용되므로 "반전 후 회전"과 일치).
 */

export type Op = "rotL" | "rotR" | "flipH" | "flipV";

export type St = { rot: number; flip: boolean };

export type Cell = [number, number];

export type Shape =
  | { kind: "letter"; ch: string }
  | { kind: "tiles"; cells: Cell[]; w: number; h: number };

export type Problem = { round: 1 | 2; shape: Shape; target: St; par: number };

export const OPS: readonly Op[] = ["rotL", "rotR", "flipH", "flipV"];
export const ID: St = { rot: 0, flip: false };

/** 16변환 전부에서 비대칭인 알파벳만 사용 */
const LETTERS = ["F", "G", "J", "L", "P", "R"] as const;

function randInt(n: number): number {
  return Math.floor(Math.random() * n);
}

/**
 * 현재 변환 s 가 적용된 도형에 op 를 "화면에 보이는 도형 기준"으로 추가 적용
 * — 군 연산으로는 왼쪽 곱 op ∘ s.
 *
 * 유도 근거: F_h ∘ R(a) = R(−a) ∘ F_h,  F_v = R(180°) ∘ F_h
 * 손검증(비가환 확인):
 *   [flipH → rotR] : (0,F)→(0,T)→(1,T) = R45∘F
 *   [rotR → flipH] : (0,F)→(1,F)→(7,T) = R−45∘F = F∘R45  → 서로 다름 ✓
 *   flipV 2회: (0,F)→(4,T)→((12−4)%8=0,F) = 항등 ✓
 *   flipH 후 flipV: (0,F)→(0,T)→(4,F) = 180° 회전 ✓
 */
export function applyOp(s: St, op: Op): St {
  switch (op) {
    case "rotR":
      return { rot: (s.rot + 1) % 8, flip: s.flip };
    case "rotL":
      return { rot: (s.rot + 7) % 8, flip: s.flip };
    case "flipH":
      return { rot: (8 - s.rot) % 8, flip: !s.flip };
    case "flipV":
      return { rot: (12 - s.rot) % 8, flip: !s.flip };
  }
}

/** 입력 순서대로 합성한 군 원소 (항등에서 시작) — 목표 생성과 같은 규칙 */
export function composeSeq(ops: readonly Op[]): St {
  let s = ID;
  for (const op of ops) s = applyOp(s, op);
  return s;
}

/** 정수 키 0~15 — 비교는 epsilon 없이 정확히 */
export const stKey = (s: St): number => s.rot + (s.flip ? 8 : 0);

export const stEq = (a: St, b: St): boolean => stKey(a) === stKey(b);

export function cssTransform(s: St): string {
  return `rotate(${s.rot * 45}deg) scaleX(${s.flip ? -1 : 1})`;
}

/** BFS 최소 스텝(par) — 원소 16개, 생성원 4개(역원 포함 집합)라 항상 종료, 최대 거리 4 */
export function minSteps(target: St): number {
  const tk = stKey(target);
  if (tk === 0) return 0;
  const dist = new Map<number, number>([[0, 0]]);
  const queue: St[] = [ID];
  for (let i = 0; i < queue.length; i++) {
    const cur = queue[i];
    const d = dist.get(stKey(cur)) ?? 0;
    for (const op of OPS) {
      const nxt = applyOp(cur, op);
      const k = stKey(nxt);
      if (dist.has(k)) continue;
      if (k === tk) return d + 1;
      dist.set(k, d + 1);
      queue.push(nxt);
    }
  }
  return 8; // 군 구조상 도달 불가는 없음 — 방어값
}

/** 랜덤 시퀀스를 항등에 적용해 목표 생성. 항등이 되면(상쇄) 다시 뽑는다. */
function makeTarget(minLen: number, maxLen: number): { target: St; par: number } {
  for (;;) {
    const len = minLen + randInt(maxLen - minLen + 1);
    let s = ID;
    for (let i = 0; i < len; i++) s = applyOp(s, OPS[randInt(OPS.length)]);
    if (stKey(s) !== 0) return { target: s, par: minSteps(s) };
  }
}

/* ───────────── 폴리오미노 (2라운드 타일 패턴) ───────────── */

function normalizeCells(cells: Cell[]): { cells: Cell[]; w: number; h: number } {
  const minX = Math.min(...cells.map((c) => c[0]));
  const minY = Math.min(...cells.map((c) => c[1]));
  const maxX = Math.max(...cells.map((c) => c[0]));
  const maxY = Math.max(...cells.map((c) => c[1]));
  const shifted = cells
    .map(([x, y]): Cell => [x - minX, y - minY])
    .sort((a, b) => a[1] - b[1] || a[0] - b[0]);
  return { cells: shifted, w: maxX - minX + 1, h: maxY - minY + 1 };
}

const cellsKey = (cells: Cell[]): string =>
  normalizeCells(cells)
    .cells.map(([x, y]) => `${x},${y}`)
    .join(";");

/**
 * D4 의 8개 점 변환 — 격자 도형의 대칭은 이 8개만 가능하다
 * (45° 홀수 회전은 정사각 타일을 마름모로 만들어 격자 도형과 절대 겹치지 않음).
 * 따라서 이 8개에서 비대칭이면 16변환 전체에서 stabilizer 가 자명하고,
 * 군 원소 ↔ 보이는 모습이 1:1 이라 "보기엔 맞는데 오답" 케이스가 없다.
 */
const D4_MAPS: ((c: Cell) => Cell)[] = [
  ([x, y]) => [x, y],
  ([x, y]) => [-y, x],
  ([x, y]) => [-x, -y],
  ([x, y]) => [y, -x],
  ([x, y]) => [-x, y],
  ([x, y]) => [y, x],
  ([x, y]) => [x, -y],
  ([x, y]) => [-y, -x],
];

function isAsymmetric(cells: Cell[]): boolean {
  const base = cellsKey(cells);
  for (let i = 1; i < D4_MAPS.length; i++) {
    if (cellsKey(cells.map(D4_MAPS[i])) === base) return false;
  }
  return true;
}

/** 인접 칸 랜덤 성장으로 연결된 4~6칸 생성 */
function growCells(n: number): Cell[] {
  const cells: Cell[] = [[0, 0]];
  const seen = new Set(["0,0"]);
  const dirs: Cell[] = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ];
  while (cells.length < n) {
    const [bx, by] = cells[randInt(cells.length)];
    const [dx, dy] = dirs[randInt(4)];
    const k = `${bx + dx},${by + dy}`;
    if (!seen.has(k)) {
      seen.add(k);
      cells.push([bx + dx, by + dy]);
    }
  }
  return cells;
}

/** 대칭형이면 다시 생성 — 일자형(회전 대칭) 등은 자동 탈락 */
function makePolyomino(): { cells: Cell[]; w: number; h: number } {
  for (;;) {
    const grown = growCells(4 + randInt(3));
    if (isAsymmetric(grown)) return normalizeCells(grown);
  }
}

/** 매 문제 새로 생성 — R1: 알파벳·1~3스텝, R2: 타일·2~4스텝 */
export function makeProblem(round: 1 | 2): Problem {
  const { target, par } = round === 1 ? makeTarget(1, 3) : makeTarget(2, 4);
  const shape: Shape =
    round === 1
      ? { kind: "letter", ch: LETTERS[randInt(LETTERS.length)] }
      : { kind: "tiles", ...makePolyomino() };
  return { round, shape, target, par };
}
