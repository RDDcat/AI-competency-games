"use client";

import { useEffect } from "react";
import { track, type GaEventName } from "@/lib/analytics";

/**
 * data-ga 속성을 단 링크·버튼의 클릭을 한 곳에서 GA4 이벤트로 보낸다.
 * 덕분에 네비·푸터·홈·공략 같은 서버 컴포넌트도 onClick 없이 data 속성만으로
 * 추적된다(클라이언트 경계를 늘리지 않음).
 *
 *   <Link data-ga="guide_click" data-ga-source="nav">공략 가이드</Link>
 *   <a data-ga="cta_click" data-ga-cta-type="openchat" data-ga-location="nav">…</a>
 *
 *   data-ga          → 이벤트 이름(GA_EVENTS 값)
 *   data-ga-<key>    → 이벤트 파라미터. camelCase 는 snake_case 로 변환되어
 *                      전송된다(예: data-ga-cta-type → cta_type).
 *
 * 캡처 단계에서 듣고 closest('[data-ga]') 로 올라가므로, 링크 안의 아이콘·span
 * 을 클릭해도 정확히 잡힌다. 내부 이동은 클라이언트 네비라 언로드가 없고, 외부
 * 링크는 target=_blank 라 페이지가 살아 있어 이벤트 전송이 보장된다.
 */
export function AnalyticsListener() {
  useEffect(() => {
    function onClick(e: MouseEvent) {
      const target = e.target as HTMLElement | null;
      const el = target?.closest<HTMLElement>("[data-ga]");
      if (!el) return;
      const event = el.dataset.ga;
      if (!event) return;

      const params: Record<string, string> = {};
      for (const [k, v] of Object.entries(el.dataset)) {
        if (k === "ga" || !k.startsWith("ga") || v == null) continue;
        // gaSource → source, gaCtaType → cta_type
        const key = k
          .slice(2)
          .replace(/^[A-Z]/, (c) => c.toLowerCase())
          .replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`);
        params[key] = v;
      }
      track(event as GaEventName, params);
    }

    document.addEventListener("click", onClick, { capture: true });
    return () =>
      document.removeEventListener("click", onClick, { capture: true });
  }, []);

  return null;
}
