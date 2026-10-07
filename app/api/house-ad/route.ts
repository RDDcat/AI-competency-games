import { HOUSE_AD_SLOT, parseCampaigns, type HouseAd } from "@/lib/house-ad";

// 플랫폼 광고 설정을 5분 단위로 재검증 캐시 (Cache Components 미사용 → 라우트 세그먼트 revalidate 가 단일 캐시).
export const revalidate = 300;

const TIMEOUT_MS = 3000;

// fail-open: 어떤 실패든 빈 목록 200. PLATFORM_KEY 는 서버에서만 쓰고 응답·로그에 넣지 않는다.
export async function GET() {
  return Response.json({ campaigns: await loadCampaigns() });
}

async function loadCampaigns(): Promise<HouseAd[]> {
  const base = process.env.PLATFORM_URL;
  const key = process.env.PLATFORM_KEY;
  if (!base || !key) return [];
  try {
    const res = await fetch(`${base.replace(/\/+$/, "")}/v1/ads/${HOUSE_AD_SLOT}`, {
      headers: { Authorization: `Bearer ${key}` },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) {
      console.error(`[house-ad] platform ads fetch failed: HTTP ${res.status}`);
      return [];
    }
    return parseCampaigns(await res.json());
  } catch (err) {
    console.error(`[house-ad] platform ads fetch error: ${err instanceof Error ? err.name : "unknown"}`);
    return [];
  }
}
