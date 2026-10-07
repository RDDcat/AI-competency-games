// 하우스 배너 (역검 결과 화면) — 순수 함수. 서버 라우트·클라이언트 공용.

export const HOUSE_AD_SLOT = "yeokgeom-result";

export type HouseAd = {
  id: number;
  title: string;
  body: string;
  cta: string;
  target_url: string;
  weight: number;
};

export type AdEventType = "ad.impression" | "ad.click";

export type AdEvent = {
  type: AdEventType;
  slot: typeof HOUSE_AD_SLOT;
  campaignId: number;
  viewId: string;
};

const AD_EVENT_TYPES: readonly string[] = ["ad.impression", "ad.click"];
const VIEW_ID_RE = /^[A-Za-z0-9-]{8,64}$/;

/** rand(0..1) 로 가중치 비례 선택. 후보가 없거나 가중치 합이 0 이하면 null. */
export function pickWeighted(ads: HouseAd[], rand: number): HouseAd | null {
  const pool = ads.filter((a) => Number.isFinite(a.weight) && a.weight > 0);
  const total = pool.reduce((sum, a) => sum + a.weight, 0);
  if (pool.length === 0 || total <= 0) return null;
  let point = rand * total;
  for (const a of pool) {
    if (point < a.weight) return a;
    point -= a.weight;
  }
  return pool[pool.length - 1];
}

/** 기존 쿼리는 보존하고 UTM 3종은 덮어쓴다. */
export function withUtm(url: string, campaignId: number): string {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return url;
  }
  u.searchParams.set("utm_source", "yeokgeom");
  u.searchParams.set("utm_medium", "house_ad");
  u.searchParams.set("utm_campaign", `c${campaignId}`);
  return u.toString();
}

/** 클라이언트 → /api/ad-event 입력 검증. 형식이 하나라도 어긋나면 null. */
export function parseAdEvent(body: unknown): AdEvent | null {
  if (typeof body !== "object" || body === null || Array.isArray(body)) return null;
  const { type, slot, campaignId, viewId } = body as Record<string, unknown>;
  if (typeof type !== "string" || !AD_EVENT_TYPES.includes(type)) return null;
  if (slot !== HOUSE_AD_SLOT) return null;
  if (typeof campaignId !== "number" || !Number.isInteger(campaignId) || campaignId <= 0) return null;
  if (typeof viewId !== "string" || !VIEW_ID_RE.test(viewId)) return null;
  return { type: type as AdEventType, slot: HOUSE_AD_SLOT, campaignId, viewId };
}

/** 플랫폼 /v1/ads 응답에서 형식이 맞는 캠페인만 추린다 (https 링크·양의 정수 가중치). */
export function parseCampaigns(json: unknown): HouseAd[] {
  if (typeof json !== "object" || json === null) return [];
  const list = (json as { campaigns?: unknown }).campaigns;
  if (!Array.isArray(list)) return [];
  const out: HouseAd[] = [];
  for (const c of list) {
    if (typeof c !== "object" || c === null) continue;
    const { id, title, body, cta, target_url, weight } = c as Record<string, unknown>;
    if (typeof id !== "number" || !Number.isInteger(id)) continue;
    if (typeof title !== "string" || typeof body !== "string" || typeof cta !== "string") continue;
    if (typeof target_url !== "string" || !isHttpsUrl(target_url)) continue;
    if (typeof weight !== "number" || !Number.isInteger(weight) || weight <= 0) continue;
    out.push({ id, title, body, cta, target_url, weight });
  }
  return out;
}

function isHttpsUrl(url: string): boolean {
  try {
    return new URL(url).protocol === "https:";
  } catch {
    return false;
  }
}

/**
 * /api/ad-event 동일 출처 검사. Sec-Fetch-Site 가 있으면 same-origin 이어야 하고,
 * Origin 이 있으면 그 host 가 요청 Host 와 같아야 한다. 둘 다 없으면(구형 클라이언트) 허용.
 */
export function isSameOriginRequest(headers: {
  secFetchSite?: string | null;
  origin?: string | null;
  host?: string | null;
}): boolean {
  const { secFetchSite, origin, host } = headers;
  if (secFetchSite != null && secFetchSite !== "same-origin") return false;
  if (origin != null) {
    if (!host) return false;
    let originHost: string;
    try {
      originHost = new URL(origin).host;
    } catch {
      return false;
    }
    if (originHost.toLowerCase() !== host.toLowerCase()) return false;
  }
  return true;
}

type AdEventTransport = {
  sendBeacon?: (url: string, data: Blob) => boolean;
  fetch?: (url: string, init: RequestInit) => Promise<unknown>;
};

/**
 * 클라이언트 → /api/ad-event 전송. sendBeacon(JSON Blob) 우선, 없거나 false 면 fetch keepalive.
 * 실패는 전부 조용히 삼킨다 (fail-open, 콘솔 에러 없음).
 */
export function sendAdEvent(
  ev: { type: AdEventType; campaignId: number; viewId: string },
  transport: AdEventTransport = defaultTransport(),
): void {
  const body = JSON.stringify({ type: ev.type, slot: HOUSE_AD_SLOT, campaignId: ev.campaignId, viewId: ev.viewId });
  try {
    if (transport.sendBeacon?.("/api/ad-event", new Blob([body], { type: "application/json" }))) return;
  } catch {
    // 폴백으로 진행
  }
  try {
    transport
      .fetch?.("/api/ad-event", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
        keepalive: true,
      })
      ?.catch(() => {});
  } catch {
    // 무시
  }
}

function defaultTransport(): AdEventTransport {
  if (typeof navigator === "undefined") return {};
  return {
    sendBeacon: typeof navigator.sendBeacon === "function" ? (u, d) => navigator.sendBeacon(u, d) : undefined,
    fetch: typeof fetch === "function" ? (u, i) => fetch(u, i) : undefined,
  };
}
