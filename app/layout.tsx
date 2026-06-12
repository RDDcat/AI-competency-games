import type { Metadata } from "next";
import "./globals.css";
import NavBar from "@/components/nav-bar";
import Footer from "@/components/footer";

export const metadata: Metadata = {
  title: "역검 아케이드 — AI 역량검사 전략게임 연습장",
  description:
    "잡다(JOBDA) AI 역량검사 신역검 전략게임 9종 + 구버전 6종을 브라우저에서 그대로 연습하세요. 게임별 공략 가이드 포함, 설치·가입 없음. 기록은 내 브라우저에만 저장됩니다.",
  keywords: [
    "AI역량검사",
    "역검",
    "잡다",
    "JOBDA",
    "전략게임",
    "역량검사 연습",
    "역검 게임",
  ],
  openGraph: {
    title: "역검 아케이드 — AI 역량검사 전략게임 연습장",
    description:
      "신역검 9종 + 구버전 6종 전략게임을 그대로 재현. 게임별 공략 가이드를 보고 바로 연습하세요.",
    locale: "ko_KR",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" className="h-full antialiased">
      <head>
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css"
        />
      </head>
      <body className="flex min-h-full flex-col bg-canvas text-body">
        <NavBar />
        <div className="flex-1">{children}</div>
        <Footer />
      </body>
    </html>
  );
}
