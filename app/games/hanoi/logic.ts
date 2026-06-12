// Tower of London 형 퍼즐 — 기둥 3개(각 수용량 cap), 색 공은 크기 구분 없음.
// 맨 위 공만 옮길 수 있고, 목표 배치를 최소 이동으로 만든다.

export type Pegs = number[][]; // [peg0, peg1, peg2], 각 배열은 bottom→top, 값은 공 id
export const CAP = 3;
export const PEG_COUNT = 3;

function key(p: Pegs): string {
  return p.map((s) => s.join(",")).join("|");
}

export function pegsEqual(a: Pegs, b: Pegs): boolean {
  return key(a) === key(b);
}

export function clonePegs(p: Pegs): Pegs {
  return p.map((s) => [...s]);
}

function neighbors(state: Pegs, cap: number): Pegs[] {
  const out: Pegs[] = [];
  for (let from = 0; from < PEG_COUNT; from++) {
    if (state[from].length === 0) continue;
    for (let to = 0; to < PEG_COUNT; to++) {
      if (to === from || state[to].length >= cap) continue;
      const ns = clonePegs(state);
      const ball = ns[from].pop()!;
      ns[to].push(ball);
      out.push(ns);
    }
  }
  return out;
}

/** start → goal 최소 이동 수. 도달 불가면 null. */
export function bfsMinMoves(start: Pegs, goal: Pegs, cap = CAP): number | null {
  const goalKey = key(goal);
  if (key(start) === goalKey) return 0;
  const visited = new Set<string>([key(start)]);
  let frontier: Pegs[] = [start];
  let dist = 0;
  while (frontier.length > 0) {
    dist++;
    const next: Pegs[] = [];
    for (const state of frontier) {
      for (const ns of neighbors(state, cap)) {
        const k = key(ns);
        if (k === goalKey) return dist;
        if (!visited.has(k)) {
          visited.add(k);
          next.push(ns);
        }
      }
    }
    frontier = next;
  }
  return null;
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function randomConfig(n: number, cap = CAP): Pegs {
  const ids = shuffle(Array.from({ length: n }, (_, i) => i));
  const pegs: Pegs = [[], [], []];
  for (const id of ids) {
    const choices = [0, 1, 2].filter((p) => pegs[p].length < cap);
    const p = choices[Math.floor(Math.random() * choices.length)];
    pegs[p].push(id);
  }
  return pegs;
}

export type HanoiQuestion = {
  n: number;
  start: Pegs;
  goal: Pegs;
  minMoves: number;
};

/** 도달 가능하고 최소 이동이 minMin 이상인 문항을 생성 */
export function makeHanoiQuestion(n: number, minMin = 2): HanoiQuestion {
  for (let attempt = 0; attempt < 200; attempt++) {
    const start = randomConfig(n);
    const goal = randomConfig(n);
    if (pegsEqual(start, goal)) continue;
    const m = bfsMinMoves(start, goal);
    if (m !== null && m >= minMin) {
      return { n, start, goal, minMoves: m };
    }
  }
  // 폴백: 한 공만 옮기면 되는 자명한 문항
  const start = randomConfig(n);
  const goal = clonePegs(start);
  // 맨 위 공 하나를 다른 빈/여유 기둥으로 이동
  for (let from = 0; from < PEG_COUNT; from++) {
    if (goal[from].length === 0) continue;
    for (let to = 0; to < PEG_COUNT; to++) {
      if (to !== from && goal[to].length < CAP) {
        goal[to].push(goal[from].pop()!);
        return { n, start, goal, minMoves: 1 };
      }
    }
  }
  return { n, start, goal, minMoves: 0 };
}
