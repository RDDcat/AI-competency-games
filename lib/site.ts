/**
 * 사이트 전역 설정 단일 출처 (SEO·메타데이터·애널리틱스).
 * 도메인은 NEXT_PUBLIC_SITE_URL 환경변수로 덮어쓸 수 있고, 없으면 운영 도메인으로 폴백한다.
 */

/** canonical·sitemap·OG 절대경로의 기준 URL (끝 슬래시 제거) */
export const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.ai-interview-games.com"
).replace(/\/$/, "");

export const SITE_NAME = "역검 무제한 연습하기";

export const SITE_TITLE = "역검 무제한 연습하기 — AI 역량검사 전략게임 연습장";

export const SITE_DESCRIPTION =
  "잡다(JOBDA) AI 역량검사 신역검 전략게임 9종 + 구버전 6종을 브라우저에서 그대로 연습하세요. 게임별 공략 가이드 포함, 설치·가입 없음. 기록은 내 브라우저에만 저장됩니다.";

export const SITE_KEYWORDS = [
  "AI역량검사",
  "역검",
  "잡다",
  "JOBDA",
  "전략게임",
  "역량검사 연습",
  "역검 게임",
];

/** 제목 템플릿용 접미사 — 하위 페이지 title 에 자동으로 붙는다 */
export const TITLE_SUFFIX = "역검 무제한 연습하기";

/**
 * GA4 측정 ID (G-XXXXXXXXXX). gtag.js 가 이 ID 로 로드되어 추적을 시작한다.
 * 비워두면 GA4 스크립트가 로드되지 않는다(로컬·프리뷰에서 끄고 싶을 때).
 */
export const GA4_ID = "G-LKPH9254B1";

/**
 * Microsoft Clarity 프로젝트 ID. 행동 분석(히트맵·세션 녹화·클릭 추적)을 담당한다.
 * 비워두면 Clarity 스크립트가 로드되지 않는다(로컬·프리뷰에서 끄고 싶을 때).
 */
export const CLARITY_ID = "x9gw9ogjw0";
