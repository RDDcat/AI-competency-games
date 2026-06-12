/**
 * 로컬 기록 저장 — DB 없이 localStorage 만 사용한다.
 * 키 네임스페이스: yga:<slug>
 */

export type GameResult = {
  /** 0~100 표준화 점수 (게임별 자체 환산) */
  score: number;
  /** 점수 옆에 보여줄 보조 라벨 (예: "정답 18/24") */
  label?: string;
  /** 결과 화면 상세 행 */
  detail?: { name: string; value: string }[];
  /** ISO 일시 — saveResult 가 채움 */
  at?: string;
};

const key = (slug: string) => `yga:${slug}`;
const HISTORY_LIMIT = 30;

export function loadHistory(slug: string): GameResult[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(key(slug));
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function bestScore(slug: string): number | null {
  const history = loadHistory(slug);
  if (history.length === 0) return null;
  return Math.max(...history.map((h) => h.score));
}

export function playCount(slug: string): number {
  return loadHistory(slug).length;
}

/** 결과를 저장하고, 신기록 여부와 이전 최고점을 돌려준다. */
export function saveResult(
  slug: string,
  result: GameResult,
): { isBest: boolean; prevBest: number | null } {
  const prevBest = bestScore(slug);
  const entry: GameResult = { ...result, at: new Date().toISOString() };
  try {
    const history = [entry, ...loadHistory(slug)].slice(0, HISTORY_LIMIT);
    window.localStorage.setItem(key(slug), JSON.stringify(history));
  } catch {
    // 저장 실패(시크릿 모드 등)는 조용히 무시 — 게임 진행에 영향 없음
  }
  return { isBest: prevBest === null || result.score > prevBest, prevBest };
}
