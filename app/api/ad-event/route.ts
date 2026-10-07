import { isSameOriginRequest, parseAdEvent } from "@/lib/house-ad";

const TIMEOUT_MS = 3000;

// 클라이언트 노출·클릭 → 플랫폼 /v1/events 중계. 타 출처 403, 입력 형식 오류 400, 플랫폼 실패는 204 로 숨긴다(서버 로그만).
export async function POST(request: Request) {
  const sameOrigin = isSameOriginRequest({
    secFetchSite: request.headers.get("sec-fetch-site"),
    origin: request.headers.get("origin"),
    host: request.headers.get("host"),
  });
  if (!sameOrigin) return new Response(null, { status: 403 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return new Response(null, { status: 400 });
  }
  const ev = parseAdEvent(body);
  if (!ev) return new Response(null, { status: 400 });

  const base = process.env.PLATFORM_URL;
  const key = process.env.PLATFORM_KEY;
  if (!base || !key) return new Response(null, { status: 204 });

  try {
    const res = await fetch(`${base.replace(/\/+$/, "")}/v1/events`, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        event_id: `${ev.type}:${ev.viewId}:${ev.campaignId}`,
        service: "yeokgeom",
        zone: "service",
        type: ev.type,
        occurred_at: new Date().toISOString(),
        payload: { slot: ev.slot, campaign_id: ev.campaignId },
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
      cache: "no-store",
    });
    if (!res.ok) console.error(`[ad-event] platform event relay failed: HTTP ${res.status}`);
  } catch (err) {
    console.error(`[ad-event] platform event relay error: ${err instanceof Error ? err.name : "unknown"}`);
  }
  return new Response(null, { status: 204 });
}
