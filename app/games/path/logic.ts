/**
 * 길 만들기 — 보드 물리(거울 반사) + 문제 생성기.
 * 컴포넌트와 분리해 순수 함수로 유지한다 (생성기 검증·시뮬레이션 재사용).
 */

export type Fence = "/" | "\\" | null;
/** 0=상 1=우 2=하 3=좌 */
export type Dir = 0 | 1 | 2 | 3;
/** 격자 가장자리 위치 — side: 0=상 1=우 2=하 3=좌, idx: 0..SIZE-1 */
export type Edge = { side: 0 | 1 | 2 | 3; idx: number };

export const SIZE = 6;
/** 무한 루프 방지 — 차당 최대 스텝 */
export const MAX_STEPS = SIZE * SIZE * 4; // 144

const DR = [-1, 0, 1, 0] as const;
const DC = [0, 1, 0, -1] as const;
/** '/' 반사: 상→우, 우→상, 하→좌, 좌→하 */
const SLASH_MAP: readonly Dir[] = [1, 0, 3, 2];
/** '\' 반사: 상→좌, 우→하, 하→우, 좌→상 */
const BACK_MAP: readonly Dir[] = [3, 2, 1, 0];

export type Sim = {
  /** 격자 안에서 지나간 칸 순서 (진입 칸 포함) */
  path: { r: number; c: number }[];
  /** 빠져나간 가장자리 — null 이면 144스텝 내 미탈출(이론상 발생 안 함) */
  exit: Edge | null;
  /** 반사가 일어난 울타리 칸 키("r,c") 집합 */
  usedFences: Set<string>;
  reflections: number;
};

export function edgeKey(e: Edge): string {
  return `${e.side}:${e.idx}`;
}

export function edgeEq(a: Edge, b: Edge): boolean {
  return a.side === b.side && a.idx === b.idx;
}

export function emptyBoard(): Fence[][] {
  return Array.from({ length: SIZE }, () => Array<Fence>(SIZE).fill(null));
}

export function countFences(board: Fence[][]): number {
  let n = 0;
  for (const row of board) for (const f of row) if (f !== null) n++;
  return n;
}

/** 가장자리 위치에서 격자로 들어오는 진입 칸·방향 */
export function entryOf(e: Edge): { r: number; c: number; dir: Dir } {
  switch (e.side) {
    case 0:
      return { r: 0, c: e.idx, dir: 2 };
    case 1:
      return { r: e.idx, c: SIZE - 1, dir: 3 };
    case 2:
      return { r: SIZE - 1, c: e.idx, dir: 0 };
    case 3:
      return { r: e.idx, c: 0, dir: 1 };
  }
}

function exitEdgeOf(r: number, c: number, dir: Dir): Edge {
  switch (dir) {
    case 0:
      return { side: 0, idx: c };
    case 1:
      return { side: 1, idx: r };
    case 2:
      return { side: 2, idx: c };
    case 3:
      return { side: 3, idx: r };
  }
}

/** 차 한 대를 시뮬레이션 — 각 칸에서 울타리가 있으면 반사 후 한 칸 전진 */
export function simulate(board: Fence[][], entry: Edge): Sim {
  let { r, c, dir } = entryOf(entry);
  const path: { r: number; c: number }[] = [];
  const usedFences = new Set<string>();
  let reflections = 0;
  for (let step = 0; step < MAX_STEPS; step++) {
    path.push({ r, c });
    const f = board[r][c];
    if (f !== null) {
      dir = (f === "/" ? SLASH_MAP : BACK_MAP)[dir];
      usedFences.add(`${r},${c}`);
      reflections++;
    }
    const nr = r + DR[dir];
    const nc = c + DC[dir];
    if (nr < 0 || nr >= SIZE || nc < 0 || nc >= SIZE) {
      return { path, exit: exitEdgeOf(r, c, dir), usedFences, reflections };
    }
    r = nr;
    c = nc;
  }
  return { path, exit: null, usedFences, reflections };
}

export type Puzzle = {
  /** index = 색 (0 노랑 / 1 파랑 / 2 빨강) */
  vehicles: { entry: Edge }[];
  /** index = 색, 차가 빠져나가야 하는 가장자리 위치 */
  customers: Edge[];
  /** 정답 울타리 수 — 생성 시 실제 반사에 관여한 울타리 개수 */
  answer: number;
};

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const ALL_CELLS: { r: number; c: number }[] = [];
const ALL_EDGES: Edge[] = [];
for (let r = 0; r < SIZE; r++)
  for (let c = 0; c < SIZE; c++) ALL_CELLS.push({ r, c });
for (const side of [0, 1, 2, 3] as const)
  for (let idx = 0; idx < SIZE; idx++) ALL_EDGES.push({ side, idx });

/**
 * 정답이 보장되는 문제 생성:
 * 울타리 2~5개 무작위 배치 → 차 1~3대 시뮬레이션 → 탈출 지점에 손님 배치.
 * 각 차는 반사 1회 이상(경로가 너무 짧으면 재생성), 탈출 지점은 서로·출발점과 겹치지 않아야 한다.
 */
export function generatePuzzle(): Puzzle {
  // 차 대수를 먼저 고정하고 그 안에서 재시도 — 매번 다시 뽑으면 쉬운 구성(1대)으로 분포가 쏠린다
  let vehicleCount = 1 + Math.floor(Math.random() * 3); // 1~3
  for (let attempt = 0; attempt < 450; attempt++) {
    if (attempt > 0 && attempt % 150 === 0 && vehicleCount > 1) vehicleCount--;
    const fenceCount = 2 + Math.floor(Math.random() * 4); // 2~5
    const board = emptyBoard();
    for (const cell of shuffle(ALL_CELLS).slice(0, fenceCount)) {
      board[cell.r][cell.c] = Math.random() < 0.5 ? "/" : "\\";
    }
    const entries = shuffle(ALL_EDGES).slice(0, vehicleCount);
    const sims = entries.map((e) => simulate(board, e));
    if (sims.some((s) => s.exit === null || s.reflections === 0)) continue;

    // 탈출 지점이 서로 겹치거나 어떤 차의 출발점과 겹치면 재생성
    const taken = new Set(entries.map(edgeKey));
    let valid = true;
    for (const s of sims) {
      const k = edgeKey(s.exit as Edge);
      if (taken.has(k)) {
        valid = false;
        break;
      }
      taken.add(k);
    }
    if (!valid) continue;

    const used = new Set<string>();
    for (const s of sims) for (const f of s.usedFences) used.add(f);
    if (used.size < 1) continue;

    return {
      vehicles: entries.map((entry) => ({ entry })),
      customers: sims.map((s) => s.exit as Edge),
      answer: used.size,
    };
  }

  // 폴백 (400회 실패는 사실상 불가) — 정답 1개짜리 고정 문제
  const board = emptyBoard();
  board[2][3] = "/";
  const entry: Edge = { side: 0, idx: 3 };
  const sim = simulate(board, entry);
  return { vehicles: [{ entry }], customers: [sim.exit as Edge], answer: 1 };
}
