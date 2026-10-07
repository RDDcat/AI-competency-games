"use client";

import { useEffect, useRef, useState } from "react";
import { pickWeighted, sendAdEvent, withUtm, type HouseAd } from "@/lib/house-ad";
import { trackCtaClick, trackHouseAdView } from "@/lib/analytics";

/** 결과 화면 1회 표시당 고정되는 노출 ID (/api/ad-event viewId 형식: 영숫자·하이픈 8~64자). */
function newViewId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  // 비보안 컨텍스트(http LAN 등) 폴백
  return `v-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

/**
 * 결과 화면 하우스 배너. fail-open — 캠페인이 없거나 조회가 실패하면 아무것도 그리지 않는다.
 * 노출은 배너가 실제로 그려진 뒤 1회만 (StrictMode 이중 effect 는 ref 로 막는다).
 */
export function HouseAdBanner() {
  const [ad, setAd] = useState<HouseAd | null>(null);
  const viewIdRef = useRef<string | null>(null);
  const impressionSentRef = useRef(false);

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/house-ad", { signal: controller.signal })
      .then((res) => (res.ok ? res.json() : null))
      .then((json: unknown) => {
        if (controller.signal.aborted) return;
        const campaigns = (json as { campaigns?: unknown } | null)?.campaigns;
        if (!Array.isArray(campaigns)) return;
        setAd(pickWeighted(campaigns as HouseAd[], Math.random()));
      })
      .catch(() => {});
    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (!ad || impressionSentRef.current) return;
    impressionSentRef.current = true;
    viewIdRef.current ??= newViewId();
    sendAdEvent({ type: "ad.impression", campaignId: ad.id, viewId: viewIdRef.current });
    trackHouseAdView({ campaignId: ad.id });
  }, [ad]);

  if (!ad) return null;

  const href = withUtm(ad.target_url, ad.id);

  function handleClick() {
    if (!ad) return;
    viewIdRef.current ??= newViewId();
    sendAdEvent({ type: "ad.click", campaignId: ad.id, viewId: viewIdRef.current });
    trackCtaClick({ type: "ad", location: "result", url: href });
  }

  return (
    <aside className="mx-auto mt-4 max-w-xl" aria-label="광고">
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        onClick={handleClick}
        className="block rounded-2xl border border-hairline bg-canvas p-5 text-left shadow-[0_4px_12px_rgba(0,0,0,0.08)] transition-colors hover:bg-surface-soft"
      >
        <span className="inline-flex items-center rounded-full bg-surface-card px-2 py-0.5 text-[11px] font-medium text-muted-soft">
          광고
        </span>
        <p className="mt-2 text-base font-semibold text-ink">{ad.title}</p>
        <p className="mt-1 text-sm text-body">{ad.body}</p>
        <span className="mt-4 inline-flex h-10 w-full items-center justify-center rounded-lg bg-primary px-5 text-sm font-semibold text-on-dark sm:w-auto">
          {ad.cta}
        </span>
      </a>
    </aside>
  );
}
