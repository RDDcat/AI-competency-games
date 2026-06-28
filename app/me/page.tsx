import type { Metadata } from "next";
import MyRecords from "@/components/my-records";

export const metadata: Metadata = {
  title: "내 플레이 정보",
  description:
    "이 브라우저에 저장된 게임별 최고 기록과 플레이 로그를 확인하세요.",
  // 개인 기록 페이지 — 크롤러에는 빈 페이지이므로 색인 제외
  robots: { index: false, follow: true },
  alternates: { canonical: "/me" },
};

export default function MePage() {
  return (
    <main className="mx-auto w-full max-w-4xl px-6 py-12">
      <header className="mb-10">
        <h1 className="display-lg">내 플레이 정보</h1>
        <p className="mt-3 text-base leading-relaxed text-body">
          이 기기(브라우저)에 저장된 기록입니다. 다른 기기나 시크릿 모드에는
          보이지 않아요.
        </p>
      </header>
      <MyRecords />
    </main>
  );
}
