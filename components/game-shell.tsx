"use client";

import Link from "next/link";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { CATEGORY_TONE, getGame } from "@/lib/games";
import { bestScore, saveResult, type GameResult } from "@/lib/storage";
import { Badge, Button, KeyCap, LinkButton } from "@/components/ui";

type ShellApi = {
  /** 게임이 끝났을 때 결과를 보고한다 */
  finish: (result: GameResult) => void;
  /** 게임을 중단하고 안내 화면으로 돌아간다 */
  quit: () => void;
};

const ShellContext = createContext<ShellApi | null>(null);

/** 게임 컴포넌트에서 셸 API 를 가져온다 */
export function useGameShell(): ShellApi {
  const api = useContext(ShellContext);
  if (!api) throw new Error("useGameShell must be used inside <GameShell>");
  return api;
}

type Phase = "intro" | "playing" | "done";

export default function GameShell({
  slug,
  children,
}: {
  slug: string;
  children: ReactNode;
}) {
  const game = getGame(slug);
  const [phase, setPhase] = useState<Phase>("intro");
  const [runId, setRunId] = useState(0);
  const [result, setResult] = useState<GameResult | null>(null);
  const [isBest, setIsBest] = useState(false);
  const [prevBest, setPrevBest] = useState<number | null>(null);
  const [best, setBest] = useState<number | null>(null);

  useEffect(() => {
    setBest(bestScore(slug));
  }, [slug, phase]);

  const finish = useCallback(
    (r: GameResult) => {
      const { isBest: nowBest, prevBest: prev } = saveResult(slug, r);
      setResult(r);
      setIsBest(nowBest);
      setPrevBest(prev);
      setPhase("done");
    },
    [slug],
  );

  const quit = useCallback(() => setPhase("intro"), []);

  const start = useCallback(() => {
    setRunId((id) => id + 1);
    setResult(null);
    setPhase("playing");
  }, []);

  const api = useMemo(() => ({ finish, quit }), [finish, quit]);

  return (
    <main className="mx-auto w-full max-w-5xl px-6 py-10">
      {/* 상단 경로 + 메타 */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link
            href="/#games"
            className="text-sm font-medium text-muted hover:text-ink"
          >
            ← 게임 목록
          </Link>
          <span className="text-hairline">|</span>
          <span className="text-xl">{game.emoji}</span>
          <h1 className="text-lg font-semibold tracking-[-0.01em] text-ink">
            {game.title}
          </h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={CATEGORY_TONE[game.category]}>{game.category}</Badge>
          <Badge>{game.tier}</Badge>
          <Badge>
            난이도 {"●".repeat(game.difficulty)}
            {"○".repeat(5 - game.difficulty)}
          </Badge>
        </div>
      </div>

      {phase === "intro" && (
        <IntroScreen game={game} best={best} onStart={start} />
      )}

      {phase === "playing" && (
        <div key={runId} className="rounded-2xl border border-hairline bg-canvas p-4 shadow-[0_4px_12px_rgba(0,0,0,0.08)] sm:p-8">
          <div className="mb-4 flex items-center justify-between">
            <p className="text-[13px] font-medium text-muted-soft">
              {game.measures}
            </p>
            <button
              onClick={quit}
              className="text-[13px] font-medium text-muted hover:text-error"
            >
              그만두기
            </button>
          </div>
          <ShellContext.Provider value={api}>{children}</ShellContext.Provider>
        </div>
      )}

      {phase === "done" && result && (
        <ResultScreen
          result={result}
          isBest={isBest}
          prevBest={prevBest}
          onRetry={start}
          onIntro={quit}
        />
      )}
    </main>
  );
}

function IntroScreen({
  game,
  best,
  onStart,
}: {
  game: ReturnType<typeof getGame>;
  best: number | null;
  onStart: () => void;
}) {
  return (
    <div className="grid gap-6 lg:grid-cols-5">
      {/* 공략 가이드 — 사용자 요구사항: 게임 시작 전에 팁 먼저 */}
      <section className="lg:col-span-3 rounded-2xl bg-surface-card p-8">
        <h2 className="display-sm mb-1">시작 전 공략 가이드</h2>
        <p className="mb-5 text-sm text-muted">
          측정 역량: {game.measures}
        </p>
        <ol className="space-y-3">
          {game.tips.map((tip, i) => (
            <li key={i} className="flex gap-3 text-[15px] leading-relaxed">
              <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-canvas text-[13px] font-semibold text-ink shadow-[0_1px_2px_rgba(0,0,0,0.05)]">
                {i + 1}
              </span>
              <span>{tip}</span>
            </li>
          ))}
        </ol>
      </section>

      {/* 게임 방법 + 시작 */}
      <section className="lg:col-span-2 flex flex-col rounded-2xl border border-hairline bg-canvas p-8 shadow-[0_1px_2px_rgba(0,0,0,0.05)]">
        <h2 className="mb-4 text-lg font-semibold tracking-[-0.01em] text-ink">
          게임 방법
        </h2>
        <ul className="mb-5 space-y-2.5 text-sm leading-relaxed">
          {game.howTo.map((line, i) => (
            <li key={i} className="flex gap-2">
              <span className="text-muted-soft">·</span>
              <span>{line}</span>
            </li>
          ))}
        </ul>

        {game.keys && (
          <div className="mb-5 flex flex-wrap items-center gap-x-4 gap-y-2">
            {game.keys.map((k) => (
              <span key={k.key} className="inline-flex items-center gap-1.5 text-[13px] text-muted">
                <KeyCap>{k.key}</KeyCap> {k.action}
              </span>
            ))}
          </div>
        )}

        <div className="mt-auto space-y-3 border-t border-hairline-soft pt-5">
          <p className="text-[13px] text-muted-soft">
            예상 소요 약 {game.minutes}분
            {best !== null && (
              <>
                {" · "}내 최고 기록 <strong className="text-ink">{best}점</strong>
              </>
            )}
          </p>
          <Button onClick={onStart} className="w-full">
            게임 시작하기
          </Button>
        </div>
      </section>
    </div>
  );
}

function ResultScreen({
  result,
  isBest,
  prevBest,
  onRetry,
  onIntro,
}: {
  result: GameResult;
  isBest: boolean;
  prevBest: number | null;
  onRetry: () => void;
  onIntro: () => void;
}) {
  return (
    <div className="mx-auto max-w-xl">
      <section className="rounded-2xl border border-hairline bg-canvas p-8 text-center shadow-[0_4px_12px_rgba(0,0,0,0.08)]">
        <p className="mb-2 text-sm font-medium text-muted">결과</p>
        <p className="display-xl">{result.score}점</p>
        {result.label && <p className="mt-2 text-base text-body">{result.label}</p>}
        <p className="mt-3 text-sm">
          {isBest ? (
            <span className="font-semibold text-success">
              🎉 신기록입니다{prevBest !== null && ` (이전 최고 ${prevBest}점)`}
            </span>
          ) : (
            prevBest !== null && (
              <span className="text-muted">내 최고 기록 {prevBest}점</span>
            )
          )}
        </p>

        {result.detail && result.detail.length > 0 && (
          <dl className="mt-6 divide-y divide-hairline-soft rounded-xl bg-surface-soft px-5 text-left">
            {result.detail.map((d) => (
              <div key={d.name} className="flex items-center justify-between py-3 text-sm">
                <dt className="text-muted">{d.name}</dt>
                <dd className="font-semibold text-ink">{d.value}</dd>
              </div>
            ))}
          </dl>
        )}

        <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Button onClick={onRetry}>다시 하기</Button>
          <Button variant="secondary" onClick={onIntro}>
            공략 다시 보기
          </Button>
          <LinkButton variant="secondary" href="/#games">
            다른 게임 하기
          </LinkButton>
        </div>
        <p className="mt-5 text-[12px] text-muted-soft">
          기록은 이 브라우저의 로컬 저장소에만 저장됩니다.
        </p>
      </section>
    </div>
  );
}
