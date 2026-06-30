/**
 * GA4 이벤트 추적 단일 출처.
 *
 * gtag.js(components/google-analytics.tsx)가 로드돼 있을 때만 동작하고,
 * 없으면(로컬·프리뷰에서 GA4_ID 비움, SSR) 조용히 no-op 한다. 모든 이벤트
 * 이름·파라미터를 여기서 일괄 정의하므로, 새 이벤트는 GA_EVENTS 에만 추가하면
 * 된다. 클릭 한 번으로 끝나는 링크형 이벤트는 data-ga 속성 + AnalyticsListener
 * 로 보내고(components/analytics-listener.tsx), 게임 상태 전환처럼 DOM 클릭이
 * 아닌 이벤트는 아래 헬퍼를 직접 호출한다.
 *
 * 참고: GA4 파라미터는 snake_case 권장. 페이지뷰는 GA4 향상된 측정이 자동
 * 집계하므로 여기서 다시 보내지 않는다(중복 방지).
 */

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
    dataLayer?: unknown[];
  }
}

/** 추적하는 모든 이벤트 이름. data 속성·리스너·헬퍼가 이 값을 공유한다. */
export const GA_EVENTS = {
  /** 게임 시작(첫 시작·다시 하기 모두) */
  gameStart: "game_start",
  /** 게임 완료 */
  gameComplete: "game_complete",
  /** 결과 화면 노출 */
  resultView: "result_view",
  /** 다시 하기 클릭 */
  retryClick: "retry_click",
  /** 공략 보기 클릭 */
  guideClick: "guide_click",
  /** 공유하기 */
  shareClick: "share_click",
  /** 오픈채팅·문의·북마크·광고 등 CTA 클릭 */
  ctaClick: "cta_click",
} as const;

export type GaEventName = (typeof GA_EVENTS)[keyof typeof GA_EVENTS];

type GaValue = string | number | boolean | undefined | null;
export type GaParams = Record<string, GaValue>;

/** undefined·null 파라미터를 떨궈 GA4 로 깔끔하게 보낸다 */
function clean(params: GaParams): Record<string, string | number | boolean> {
  const out: Record<string, string | number | boolean> = {};
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null) out[k] = v;
  }
  return out;
}

/** 모든 이벤트 전송의 단일 통로. gtag 가 없으면 아무 일도 하지 않는다. */
export function track(event: GaEventName, params: GaParams = {}): void {
  if (typeof window === "undefined") return;
  const gtag = window.gtag;
  if (typeof gtag !== "function") return;
  gtag("event", event, clean(params));
}

/* ──────────────── 게임 생명주기 헬퍼(직접 호출) ──────────────── */

type GameInfo = {
  slug: string;
  title?: string;
  category?: string;
  tier?: string;
};

/** 게임 시작 — retry=true 면 ‘다시 하기’로 시작한 판 */
export function trackGameStart(game: GameInfo, retry = false): void {
  track(GA_EVENTS.gameStart, {
    game_slug: game.slug,
    game_title: game.title,
    game_category: game.category,
    game_tier: game.tier,
    is_retry: retry,
  });
}

/** 게임 완료 — 점수·신기록 여부 함께 기록 */
export function trackGameComplete(p: {
  slug: string;
  title?: string;
  score: number;
  isBest: boolean;
  prevBest: number | null;
}): void {
  track(GA_EVENTS.gameComplete, {
    game_slug: p.slug,
    game_title: p.title,
    score: p.score,
    is_best: p.isBest,
    prev_best: p.prevBest,
  });
}

/** 결과 화면 노출 */
export function trackResultView(p: {
  slug: string;
  score: number;
  isBest: boolean;
}): void {
  track(GA_EVENTS.resultView, {
    game_slug: p.slug,
    score: p.score,
    is_best: p.isBest,
  });
}

/** 다시 하기 클릭 */
export function trackRetry(p: { slug: string; source?: string }): void {
  track(GA_EVENTS.retryClick, {
    game_slug: p.slug,
    source: p.source ?? "result",
  });
}

/** 공유하기 — method: web_share | clipboard | unsupported */
export function trackShare(p: {
  slug: string;
  score?: number;
  method: "web_share" | "clipboard" | "unsupported";
}): void {
  track(GA_EVENTS.shareClick, {
    game_slug: p.slug,
    score: p.score,
    method: p.method,
  });
}

/* ──────────────── 링크형 헬퍼(직접 호출용; 보통은 data-ga 사용) ──────────────── */

/** 공략 보기 클릭 — source: 클릭 위치, slug: 대상 게임(있을 때) */
export function trackGuideClick(p: { source: string; slug?: string }): void {
  track(GA_EVENTS.guideClick, { source: p.source, game_slug: p.slug });
}

/** CTA 클릭 — type: openchat·official_tutorial·bookmark·ad 등, location: 클릭 위치 */
export function trackCtaClick(p: {
  type: string;
  location: string;
  url?: string;
}): void {
  track(GA_EVENTS.ctaClick, {
    cta_type: p.type,
    location: p.location,
    url: p.url,
  });
}
