import { ImageResponse } from "next/og";
import { SITE_NAME, SITE_URL } from "@/lib/site";

export const alt = "역검 아케이드 — AI 역량검사 전략게임 연습장";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// satori 는 한글 글리프 렌더에 폰트 데이터가 필요하다. 정적 Gothic A1 을 빌드 시 가져온다.
// 네트워크 실패 시 null 을 반환해 빌드가 깨지지 않도록 한다(폴백: 기본 폰트).
const FONT_BASE = "https://github.com/google/fonts/raw/main/ofl/gothica1";

async function loadFont(file: string): Promise<ArrayBuffer | null> {
  try {
    const res = await fetch(`${FONT_BASE}/${file}`);
    if (!res.ok) return null;
    return await res.arrayBuffer();
  } catch {
    return null;
  }
}

export default async function Image() {
  const [bold, medium] = await Promise.all([
    loadFont("GothicA1-Bold.ttf"),
    loadFont("GothicA1-Medium.ttf"),
  ]);

  const fonts = [
    bold && { name: "GothicA1", data: bold, weight: 700 as const, style: "normal" as const },
    medium && { name: "GothicA1", data: medium, weight: 500 as const, style: "normal" as const },
  ].filter(Boolean) as {
    name: string;
    data: ArrayBuffer;
    weight: 700 | 500;
    style: "normal";
  }[];

  const host = SITE_URL.replace(/^https?:\/\//, "");

  return new ImageResponse(
    (
      <div
        style={{
          height: "100%",
          width: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "#ffffff",
          padding: "76px 84px",
          fontFamily: "GothicA1",
        }}
      >
        {/* 브랜드 마크 */}
        <div style={{ display: "flex", alignItems: "center", gap: 22 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: 84,
              height: 84,
              borderRadius: 24,
              background: "#111111",
              color: "#ffffff",
              fontSize: 46,
              fontWeight: 700,
            }}
          >
            역
          </div>
          <div
            style={{
              display: "flex",
              fontSize: 40,
              fontWeight: 700,
              color: "#111111",
              letterSpacing: "-0.02em",
            }}
          >
            {SITE_NAME}
          </div>
        </div>

        {/* 헤드라인 */}
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div
            style={{
              display: "flex",
              width: 72,
              height: 8,
              borderRadius: 9999,
              background: "#3b82f6",
              marginBottom: 28,
            }}
          />
          <div
            style={{
              display: "flex",
              fontSize: 80,
              fontWeight: 700,
              color: "#111111",
              lineHeight: 1.12,
              letterSpacing: "-0.03em",
            }}
          >
            AI 역량검사 게임,
          </div>
          <div
            style={{
              display: "flex",
              fontSize: 80,
              fontWeight: 700,
              color: "#111111",
              lineHeight: 1.12,
              letterSpacing: "-0.03em",
            }}
          >
            실전 전에 마음껏 연습
          </div>
          <div
            style={{
              display: "flex",
              marginTop: 28,
              fontSize: 34,
              fontWeight: 500,
              color: "#6b7280",
              letterSpacing: "-0.01em",
            }}
          >
            신역검 9종 · 구버전 6종 · 게임별 공략 가이드
          </div>
        </div>

        {/* 푸터 */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            fontSize: 26,
            fontWeight: 500,
          }}
        >
          <div style={{ display: "flex", color: "#898989" }}>
            가입 없음 · 기록은 내 브라우저에만
          </div>
          <div style={{ display: "flex", color: "#111111" }}>{host}</div>
        </div>
      </div>
    ),
    { ...size, fonts },
  );
}
