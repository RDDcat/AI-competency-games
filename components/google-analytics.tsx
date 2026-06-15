import Script from "next/script";
import { GA4_ID } from "@/lib/site";

/**
 * GA4 직접 연동(gtag.js). lib/site.ts 의 GA4_ID 가 채워졌을 때만 로드된다.
 * App Router 클라이언트 내비게이션 페이지뷰는 GA4 향상된 측정(Enhanced
 * Measurement)의 '브라우저 기록 변경 기반 페이지 변경'이 자동 집계한다.
 */
export function GoogleAnalytics() {
  if (!GA4_ID) return null;
  return (
    <>
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${GA4_ID}`}
        strategy="afterInteractive"
      />
      <Script id="ga4-init" strategy="afterInteractive">
        {`window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
gtag('js', new Date());
gtag('config', '${GA4_ID}');`}
      </Script>
    </>
  );
}
