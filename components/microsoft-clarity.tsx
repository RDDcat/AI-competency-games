import Script from "next/script";
import { CLARITY_ID } from "@/lib/site";

/**
 * Microsoft Clarity 연동(공식 tag 스니펫). lib/site.ts 의 CLARITY_ID 가
 * 채워졌을 때만 로드된다. GA4(집계 지표)와 역할을 분담해, 히트맵·세션 녹화·
 * rage click 등 행동 분석을 담당한다.
 */
export function MicrosoftClarity() {
  if (!CLARITY_ID) return null;
  return (
    <Script id="ms-clarity-init" strategy="afterInteractive">
      {`(function(c,l,a,r,i,t,y){
    c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};
    t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;
    y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);
})(window, document, "clarity", "script", "${CLARITY_ID}");`}
    </Script>
  );
}
