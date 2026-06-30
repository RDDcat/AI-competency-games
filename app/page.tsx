import Link from "next/link";
import {
  ACCA_GAMES,
  CATEGORY_TONE,
  LEGACY_GAMES,
  type GameMeta,
} from "@/lib/games";
import { Badge, KeyCap, LinkButton } from "@/components/ui";
import BestChip from "@/components/best-chip";
import HomeHeroCta from "@/components/home-hero-cta";

export default function Home() {
  return (
    <>
      {/* ───────── 히어로 ───────── */}
      <section className="mx-auto grid w-full max-w-6xl items-center gap-12 px-6 py-24 lg:grid-cols-12">
        <div className="lg:col-span-7">
          <Badge>비공식 연습장 · 가입 없음 · 기록은 내 브라우저에만</Badge>
          <h1 className="display-xl mt-5">
            AI 역량검사 게임,
            <br />
            마음껏 연습하세요
          </h1>
          <p className="mt-5 max-w-xl text-lg leading-relaxed">
            국내 게임형 역량검사를 사실상 독점한 잡다(JOBDA) 신역검 전략게임
            9종과 구버전 게임 6종을 그대로 재현했습니다. 게임마다{" "}
            <strong className="font-semibold text-ink">공략 가이드를 먼저 읽고</strong>{" "}
            시작합니다.
          </p>
          <div className="mt-8">
            <HomeHeroCta />
          </div>
          <p className="mt-6 text-[13px] text-muted-soft">
            세부 수치는 실제와 다를 수 있음
          </p>
        </div>

        {/* 제품 UI 조각 목업 카드 */}
        <div className="lg:col-span-5">
          <HeroMockup />
        </div>
      </section>

      {/* ───────── 신역검 9종 ───────── */}
      <section id="games" className="scroll-mt-20 border-t border-hairline-soft bg-surface-soft/60">
        <div className="mx-auto w-full max-w-6xl px-6 py-24">
          <h2 className="display-lg">신역검 전략게임 9종</h2>
          <p className="mt-3 max-w-2xl text-base leading-relaxed">
            현행 잡다 AI역량검사(ACCA)에 출제되는 게임 전부입니다. 기억력 ·
            인지력 · 분석력 3개 영역을 시험합니다
          </p>
          <div className="mt-10 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {ACCA_GAMES.map((g) => (
              <GameCard key={g.slug} game={g} />
            ))}
          </div>
        </div>
      </section>

      {/* ───────── 구버전 6종 ───────── */}
      <section id="legacy" className="scroll-mt-20 mx-auto w-full max-w-6xl px-6 py-24">
        <h2 className="display-md">구버전 게임 6종</h2>
        <p className="mt-3 max-w-2xl text-base leading-relaxed">
          구 AI면접·구역검(ACC)에서 출제되던 게임 중 룰이 확실하게 확인된
          것들입니다. 일부 기업은 아직 구버전을 사용합니다.
        </p>
        <div className="mt-10 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {LEGACY_GAMES.map((g) => (
            <GameCard key={g.slug} game={g} variant="outline" />
          ))}
        </div>
      </section>

      {/* ───────── 공통 원칙 ───────── */}
      <section id="about" className="border-t border-hairline-soft bg-surface-soft/60">
        <div className="mx-auto w-full max-w-6xl px-6 py-24">
          <h2 className="display-md">모든 게임에 통하는 3가지 원칙</h2>
          <div className="mt-10 grid gap-6 lg:grid-cols-3">
            <PrincipleCard
              n="1"
              title="규칙이 반전되는 순간을 조심"
              body="가위바위보 2라운드(져야 이김), 약속 정하기 4라운드(아무도 안 탄 번호), 글자-숫자 분류의 규칙 전환 — 감점은 대부분 규칙이 뒤집히는 순간에 몰립니다. 전환 직후 한 박자만 침착하면 됩니다."
            />
            <PrincipleCard
              n="2"
              title="정확도·속도·효율이 함께 측정"
              body="점수만이 아니라 클릭 수(도형 회전·길 만들기), 응답 시간, 실수 후 회복 패턴까지 기록됩니다. 시행착오 클릭 연타보다 머릿속으로 계획을 끝내고 실행하는 쪽이 항상 유리합니다."
            />
            <PrincipleCard
              n="3"
              title="포기하지 않는 것 자체가 점수"
              body="최고 난도인 도형 순서 기억하기는 점수 분포 최하단에 사람이 몰려 있습니다. 흐름을 놓치면 그 자리에서 새로 시작하세요 — 끝까지 응답하는 것만으로 상대 우위입니다."
            />
          </div>
        </div>
      </section>

      {/* ───────── CTA 밴드 ───────── */}
      <section className="mx-auto w-full max-w-6xl px-6 pb-24 pt-24">
        <div className="rounded-2xl bg-surface-card px-8 py-12 text-center">
          <h2 className="display-sm">충분히 연습했다면, 실전 감각은 공식 응시로</h2>
          <p className="mx-auto mt-3 max-w-xl text-base leading-relaxed">
            잡다에서는 공식 튜토리얼과 무료 실전 응시를 제공합니다.
            <br />
            이곳에서 룰과 공략을 익힌 뒤 공식 환경에서 마무리하세요.
          </p>
          <div className="mt-7 flex flex-wrap justify-center gap-3">
            <LinkButton
              href="https://jobda.acca.ai/tutorial"
              data-ga="cta_click"
              data-ga-cta-type="official_tutorial"
              data-ga-location="home_cta"
            >
              잡다 공식 튜토리얼
            </LinkButton>
            <LinkButton
              variant="secondary"
              href="https://www.youtube.com/playlist?list=PLRvhT8gNnOeoZNbmGq7GjImm7CC7e7-XU"
              data-ga="cta_click"
              data-ga-cta-type="official_video"
              data-ga-location="home_cta"
            >
              공식 공략 영상 시리즈
            </LinkButton>
          </div>
        </div>
      </section>
    </>
  );
}

function GameCard({
  game,
  variant = "filled",
}: {
  game: GameMeta;
  variant?: "filled" | "outline";
}) {
  const surface =
    variant === "filled"
      ? "bg-surface-card"
      : "border border-hairline bg-canvas shadow-[0_1px_2px_rgba(0,0,0,0.05)]";
  return (
    <Link
      href={`/games/${game.slug}`}
      className={`group flex flex-col rounded-xl p-8 transition-shadow hover:shadow-[0_4px_12px_rgba(0,0,0,0.08)] ${surface}`}
    >
      <div className="mb-4 flex items-center justify-between">
        <span className="flex h-11 w-11 items-center justify-center rounded-full bg-canvas text-xl shadow-[0_1px_2px_rgba(0,0,0,0.05)]">
          {game.emoji}
        </span>
        <BestChip slug={game.slug} />
      </div>
      <h3 className="text-lg font-semibold tracking-[-0.01em] text-ink">
        {game.title}
      </h3>
      <p className="mt-2 flex-1 text-sm leading-relaxed">{game.summary}</p>
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Badge tone={CATEGORY_TONE[game.category]}>{game.category}</Badge>
        <span className="text-[12px] text-muted-soft">
          난이도 {"●".repeat(game.difficulty)}
          {"○".repeat(5 - game.difficulty)} · 약 {game.minutes}분
        </span>
      </div>
      <span className="mt-5 text-sm font-semibold text-ink">
        플레이 <span className="inline-block transition-transform group-hover:translate-x-0.5">→</span>
      </span>
    </Link>
  );
}

function PrincipleCard({ n, title, body }: { n: string; title: string; body: string }) {
  return (
    <div className="rounded-xl bg-surface-card p-8">
      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-canvas text-sm font-bold text-ink shadow-[0_1px_2px_rgba(0,0,0,0.05)]">
        {n}
      </span>
      <h3 className="mt-4 text-lg font-semibold tracking-[-0.01em] text-ink">{title}</h3>
      <p className="mt-2 text-sm leading-relaxed">{body}</p>
    </div>
  );
}

/** 히어로 우측 — 실제 게임 UI 조각을 보여주는 목업 카드 (N-back 게임) */
function HeroMockup() {
  return (
    <div className="rounded-2xl border border-hairline bg-canvas p-6 shadow-[0_4px_12px_rgba(0,0,0,0.08)]">
      <div className="mb-4 flex items-center justify-between">
        <span className="text-sm font-semibold text-ink">🔷 도형 순서 기억하기</span>
        <span className="rounded-full bg-surface-card px-2.5 py-0.5 text-[12px] font-medium">
          2-back
        </span>
      </div>
      <div className="mb-4 flex items-center justify-between rounded-lg bg-surface-soft px-4 py-2 text-[13px] font-medium">
        <span>남은 문항 23</span>
        <span className="tabular-nums">00:42</span>
      </div>
      <div className="mb-5 flex items-center justify-center gap-3 py-4">
        <div className="flex h-16 w-16 items-center justify-center rounded-lg bg-surface-card text-2xl opacity-40">
          ⬜
        </div>
        <div className="flex h-24 w-24 items-center justify-center rounded-xl border-2 border-ink bg-canvas text-4xl shadow-[0_4px_12px_rgba(0,0,0,0.08)]">
          ⭐
        </div>
        <div className="flex h-16 w-16 items-center justify-center rounded-lg bg-surface-card text-2xl opacity-40">
          🔺
        </div>
      </div>
      <div className="flex items-center justify-center gap-4 border-t border-hairline-soft pt-4 text-[13px] text-muted">
        <span className="inline-flex items-center gap-1.5">
          <KeyCap>Space</KeyCap> 다름
        </span>
        <span className="inline-flex items-center gap-1.5">
          <KeyCap>←</KeyCap> 2번째 전
        </span>
        <span className="inline-flex items-center gap-1.5">
          <KeyCap>→</KeyCap> 3번째 전
        </span>
      </div>
    </div>
  );
}
