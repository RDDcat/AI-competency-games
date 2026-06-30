import Link from "next/link";
import { notFound } from "next/navigation";
import {
  GAMES,
  getGame,
  guideMetadata,
  CATEGORY_TONE,
} from "@/lib/games";
import { SITE_URL } from "@/lib/site";
import { Badge, KeyCap, LinkButton } from "@/components/ui";

// 정의된 게임 slug 만 빌드/서빙하고 나머지는 404
export const dynamicParams = false;

export function generateStaticParams() {
  return GAMES.map((g) => ({ slug: g.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  if (!GAMES.some((g) => g.slug === slug)) return {};
  return guideMetadata(slug);
}

export default async function GuidePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  if (!GAMES.some((g) => g.slug === slug)) notFound();
  const game = getGame(slug);

  const idx = GAMES.findIndex((g) => g.slug === slug);
  const prev = idx > 0 ? GAMES[idx - 1] : null;
  const next = idx < GAMES.length - 1 ? GAMES[idx + 1] : null;

  // 검색결과 빵부스러기 표시용 구조화 데이터
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "홈", item: `${SITE_URL}/` },
      {
        "@type": "ListItem",
        position: 2,
        name: "공략 가이드",
        item: `${SITE_URL}/guide`,
      },
      {
        "@type": "ListItem",
        position: 3,
        name: `${game.title} 공략`,
        item: `${SITE_URL}/guide/${slug}`,
      },
    ],
  };

  return (
    <main className="mx-auto w-full max-w-3xl px-6 py-12">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      {/* 빵부스러기 */}
      <nav className="mb-6 flex flex-wrap items-center gap-1.5 text-[13px] text-muted">
        <Link href="/" className="hover:text-ink">
          홈
        </Link>
        <span className="text-hairline">/</span>
        <Link href="/guide" className="hover:text-ink">
          공략 가이드
        </Link>
        <span className="text-hairline">/</span>
        <span className="text-ink">{game.title}</span>
      </nav>

      <header className="mb-10">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <span className="text-2xl">{game.emoji}</span>
          <Badge tone={CATEGORY_TONE[game.category]}>{game.category}</Badge>
          <Badge>{game.tier}</Badge>
        </div>
        <h1 className="display-lg">{game.title} 공략</h1>
        <p className="mt-4 text-base leading-relaxed text-body">{game.summary}</p>
        <dl className="mt-5 flex flex-wrap gap-x-6 gap-y-2 text-sm">
          <div>
            <dt className="inline text-muted-soft">측정 역량 </dt>
            <dd className="inline font-medium text-ink">{game.measures}</dd>
          </div>
          <div>
            <dt className="inline text-muted-soft">난이도 </dt>
            <dd className="inline font-medium text-ink">
              {"●".repeat(game.difficulty)}
              {"○".repeat(5 - game.difficulty)}
            </dd>
          </div>
          <div>
            <dt className="inline text-muted-soft">예상 소요 </dt>
            <dd className="inline font-medium text-ink">약 {game.minutes}분</dd>
          </div>
        </dl>
        <div className="mt-7">
          <LinkButton href={`/games/${slug}`} className="h-11 px-6">
            이 게임 바로 연습하기 →
          </LinkButton>
        </div>
      </header>

      {/* 게임 방법 */}
      <section className="mb-12">
        <h2 className="display-sm mb-5">게임 방법</h2>
        <ul className="space-y-2.5 text-[15px] leading-relaxed">
          {game.howTo.map((line, i) => (
            <li key={i} className="flex gap-2">
              <span className="text-muted-soft">·</span>
              <span>{line}</span>
            </li>
          ))}
        </ul>
        {game.keys && (
          <div className="mt-6 flex flex-wrap items-center gap-x-4 gap-y-2">
            {game.keys.map((k) => (
              <span
                key={k.key}
                className="inline-flex items-center gap-1.5 text-[13px] text-muted"
              >
                <KeyCap>{k.key}</KeyCap> {k.action}
              </span>
            ))}
          </div>
        )}
      </section>

      {/* 핵심 공략 */}
      <section className="mb-12">
        <h2 className="display-sm mb-5">핵심 공략 {game.tips.length}가지</h2>
        <ol className="space-y-4">
          {game.tips.map((tip, i) => (
            <li
              key={i}
              className="flex gap-3 rounded-xl bg-surface-card p-5 text-[15px] leading-relaxed"
            >
              <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-canvas text-[13px] font-semibold text-ink shadow-[0_1px_2px_rgba(0,0,0,0.05)]">
                {i + 1}
              </span>
              <span>{tip}</span>
            </li>
          ))}
        </ol>
      </section>

      {/* CTA */}
      <section className="mb-12 rounded-2xl bg-surface-card px-6 py-9 text-center">
        <h2 className="text-lg font-semibold tracking-[-0.01em] text-ink">
          공략을 읽었다면, 바로 연습해보세요
        </h2>
        <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-muted">
          가입·설치 없이 무제한 연습. 점수 기록은 내 브라우저에만 저장됩니다.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <LinkButton href={`/games/${slug}`}>{game.title} 연습하기</LinkButton>
          <LinkButton
            variant="secondary"
            href="/guide"
            data-ga="guide_click"
            data-ga-source="guide_detail"
          >
            다른 게임 공략 보기
          </LinkButton>
        </div>
      </section>

      {/* 이전/다음 공략 — 내부 링크 */}
      <nav className="flex items-stretch justify-between gap-3 border-t border-hairline-soft pt-6">
        {prev ? (
          <Link
            href={`/guide/${prev.slug}`}
            data-ga="guide_click"
            data-ga-source="guide_detail_nav"
            data-ga-slug={prev.slug}
            className="flex-1 rounded-xl border border-hairline p-4 transition-colors hover:bg-surface-soft"
          >
            <span className="text-[12px] text-muted-soft">← 이전 공략</span>
            <span className="mt-1 block text-sm font-semibold text-ink">
              {prev.emoji} {prev.title}
            </span>
          </Link>
        ) : (
          <span className="flex-1" />
        )}
        {next ? (
          <Link
            href={`/guide/${next.slug}`}
            data-ga="guide_click"
            data-ga-source="guide_detail_nav"
            data-ga-slug={next.slug}
            className="flex-1 rounded-xl border border-hairline p-4 text-right transition-colors hover:bg-surface-soft"
          >
            <span className="text-[12px] text-muted-soft">다음 공략 →</span>
            <span className="mt-1 block text-sm font-semibold text-ink">
              {next.title} {next.emoji}
            </span>
          </Link>
        ) : (
          <span className="flex-1" />
        )}
      </nav>
    </main>
  );
}
