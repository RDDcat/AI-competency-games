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

/**
 * 모든 게임 기록을 훑어 가장 최근에 플레이한 게임을 돌려준다.
 * 재방문자에게 "이어서 연습하기"를 제안할 때 사용. 기록이 없으면 null.
 */
export function lastPlayed(): { slug: string; at: string } | null {
  if (typeof window === "undefined") return null;
  let latest: { slug: string; at: string } | null = null;
  try {
    for (let i = 0; i < window.localStorage.length; i++) {
      const k = window.localStorage.key(i);
      if (!k || !k.startsWith("yga:")) continue;
      const slug = k.slice(4);
      // 기록은 최신순으로 저장되므로 첫 항목이 가장 최근
      const at = loadHistory(slug)[0]?.at;
      if (!at) continue;
      // ISO 문자열은 사전식 비교가 곧 시간순 비교
      if (!latest || at > latest.at) latest = { slug, at };
    }
  } catch {
    return null;
  }
  return latest;
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
