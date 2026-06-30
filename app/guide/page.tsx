import Link from "next/link";
import type { Metadata } from "next";
import {
  ACCA_GAMES,
  LEGACY_GAMES,
  CATEGORY_TONE,
  type GameMeta,
} from "@/lib/games";
import { SITE_NAME } from "@/lib/site";
import { Badge } from "@/components/ui";

export const metadata: Metadata = {
  title: "공략 가이드",
  description:
    "잡다(JOBDA) AI 역량검사 신역검 전략게임 9종 + 구버전 6종의 게임별 공략 가이드 모음. 게임 방법과 핵심 공략을 한 곳에서 확인하고 바로 연습하세요.",
  keywords: [
    "역검 공략",
    "AI역량검사 공략",
    "잡다 공략",
    "전략게임 공략",
    "역검",
    "AI역량검사",
  ],
  alternates: { canonical: "/guide" },
  openGraph: {
    type: "website",
    locale: "ko_KR",
    siteName: SITE_NAME,
    url: "/guide",
    title: "역검 게임 공략 가이드 — 역검 무제한 연습하기",
    description:
      "신역검 9종 + 구버전 6종 게임별 공략 가이드 모음. 게임 방법과 핵심 공략 정리.",
    images: ["/opengraph-image"],
  },
};

export default function GuideHub() {
  return (
    <main className="mx-auto w-full max-w-6xl px-6 py-16">
      <header className="mb-12">
        <h1 className="display-lg">역검 게임 공략 가이드</h1>
        <p className="mt-4 max-w-2xl text-base leading-relaxed">
          잡다(JOBDA) AI 역량검사(ACCA)에 출제되는 게임별 공략입니다. 게임
          방법과 핵심 공략을 먼저 읽고 시작하면 같은 시간을 연습해도 점수가
          빠르게 오릅니다.
        </p>
      </header>

      <section className="mb-14">
        <h2 className="display-sm mb-6">신역검 전략게임 9종</h2>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {ACCA_GAMES.map((g) => (
            <GuideCard key={g.slug} game={g} />
          ))}
        </div>
      </section>

      <section>
        <h2 className="display-sm mb-6">구버전 게임 6종</h2>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {LEGACY_GAMES.map((g) => (
            <GuideCard key={g.slug} game={g} />
          ))}
        </div>
      </section>
    </main>
  );
}

function GuideCard({ game }: { game: GameMeta }) {
  return (
    <Link
      href={`/guide/${game.slug}`}
      data-ga="guide_click"
      data-ga-source="guide_hub"
      data-ga-slug={game.slug}
      className="group flex flex-col rounded-xl bg-surface-card p-6 transition-shadow hover:shadow-[0_4px_12px_rgba(0,0,0,0.08)]"
    >
      <div className="mb-3 flex items-center gap-2">
        <span className="text-xl">{game.emoji}</span>
        <Badge tone={CATEGORY_TONE[game.category]}>{game.category}</Badge>
      </div>
      <h3 className="text-base font-semibold tracking-[-0.01em] text-ink">
        {game.title} 공략
      </h3>
      <p className="mt-2 flex-1 text-sm leading-relaxed text-body">
        {game.summary}
      </p>
      <span className="mt-4 text-sm font-semibold text-ink">
        공략 보기{" "}
        <span className="inline-block transition-transform group-hover:translate-x-0.5">
          →
        </span>
      </span>
    </Link>
  );
}
