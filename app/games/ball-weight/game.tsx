"use client";

import { useCallback, useRef, useState } from "react";
import { useGameShell } from "@/components/game-shell";
import {
  Countdown,
  Flash,
  GameHUD,
  RoundIntro,
  TimeBar,
  formatSec,
  useCountdown,
} from "@/components/game-ui";
import { Button } from "@/components/ui";

type Ball = { id: number; emoji: string };
type Comparison = { heavy: number; light: number }; // heavy 가 더 무거움

type Question = {
  balls: Ball[];
  /** 무거운 순서 (정답) — id 배열, 0번이 가장 무거움 */
  order: number[];
  comparisons: Comparison[];
  /** 제한시간 ms */
  limitMs: number;
};

const PALETTE = ["🔴", "🔵", "🟢", "🟡", "🟣"];
const QUESTION_TIME_MS = 40_000;
const TOTAL_QUESTIONS = 10;

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** 문항 번호(0-based)에 따른 공 개수 */
function ballCountFor(index: number): number {
  if (index < 4) return 3;
  if (index < 7) return 4;
  return 5;
}

function makeQuestion(index: number): Question {
  const n = ballCountFor(index);
  const balls: Ball[] = Array.from({ length: n }, (_, i) => ({
    id: i,
    emoji: PALETTE[i],
  }));

  // 비밀 전순서 (무거운 → 가벼운). order[0] 가 가장 무거움.
  const order = shuffle(balls.map((b) => b.id));

  // 인접 비교 체인(order[k] > order[k+1])은 전순서를 유일하게 결정한다.
  const chain: Comparison[] = [];
  for (let k = 0; k < n - 1; k++) {
    chain.push({ heavy: order[k], light: order[k + 1] });
  }

  // N>=4 부터 비인접 비교 1개 추가(혼동 유발 — 순서와 일관, 유일성 유지)
  const extra: Comparison[] = [];
  if (n >= 4) {
    // 거리 2 이상 떨어진 쌍 중 하나
    const i = Math.floor(Math.random() * (n - 2));
    const j = i + 2 + Math.floor(Math.random() * (n - i - 2));
    extra.push({ heavy: order[i], light: order[j] });
  }

  return {
    balls,
    order,
    comparisons: shuffle([...chain, ...extra]),
    limitMs: QUESTION_TIME_MS,
  };
}

type Phase = "intro" | "count" | "play" | "between";

export default function Game() {
  const { finish } = useGameShell();
  const [phase, setPhase] = useState<Phase>("intro");
  const [qIndex, setQIndex] = useState(0);
  const [question, setQuestion] = useState<Question | null>(null);
  const [slots, setSlots] = useState<number[]>([]); // 사용자가 채운 무거운 순서
  const [flash, setFlash] = useState<boolean | null>(null);

  const finishedRef = useRef(false);
  // 채점 누적
  const resultsRef = useRef<
    { n: number; correct: boolean; elapsedMs: number; limitMs: number }[]
  >([]);

  const startQuestion = useCallback((index: number) => {
    setQuestion(makeQuestion(index));
    setSlots([]);
    setFlash(null);
    setPhase("play");
  }, []);

  const remaining = useCountdown(
    question?.limitMs ?? QUESTION_TIME_MS,
    phase === "play",
    () => handleSubmit(true),
  );

  const advance = useCallback(() => {
    const next = qIndex + 1;
    if (next >= TOTAL_QUESTIONS) {
      if (finishedRef.current) return;
      finishedRef.current = true;
      const rs = resultsRef.current;
      const correctCount = rs.filter((r) => r.correct).length;
      const correctRate = rs.length ? correctCount / rs.length : 0;
      // 속도점수: 정답 문항의 평균 잔여시간 비율
      const correctRs = rs.filter((r) => r.correct);
      const speed =
        correctRs.length > 0
          ? correctRs.reduce(
              (s, r) => s + (r.limitMs - r.elapsedMs) / r.limitMs,
              0,
            ) / correctRs.length
          : 0;
      const score = Math.round(correctRate * 80 + speed * 20);

      const byBand = (lo: number, hi: number) => {
        const band = rs.filter((r) => r.n >= lo && r.n <= hi);
        const c = band.filter((r) => r.correct).length;
        return `${c}/${band.length}`;
      };
      const avgTime =
        rs.length > 0
          ? rs.reduce((s, r) => s + r.elapsedMs, 0) / rs.length / 1000
          : 0;

      finish({
        score: Math.max(0, Math.min(100, score)),
        label: `정답 ${correctCount}/${TOTAL_QUESTIONS}`,
        detail: [
          { name: "3공 문항 정답", value: byBand(3, 3) },
          { name: "4공 문항 정답", value: byBand(4, 4) },
          { name: "5공 문항 정답", value: byBand(5, 5) },
          { name: "평균 풀이 시간", value: `${avgTime.toFixed(1)}초` },
        ],
      });
      return;
    }
    setQIndex(next);
    startQuestion(next);
  }, [qIndex, finish, startQuestion]);

  const handleSubmit = useCallback(
    (timedOut: boolean) => {
      setPhase((cur) => {
        if (cur !== "play") return cur; // 중복 제출/만료 방지
        const q = question;
        if (!q) return cur;
        const elapsedMs = q.limitMs - remaining;
        const correct =
          !timedOut &&
          slots.length === q.order.length &&
          slots.every((id, i) => id === q.order[i]);
        resultsRef.current.push({
          n: q.balls.length,
          correct,
          elapsedMs: Math.max(0, Math.min(q.limitMs, elapsedMs)),
          limitMs: q.limitMs,
        });
        setFlash(correct);
        window.setTimeout(() => advance(), 900);
        return "between";
      });
    },
    [question, remaining, slots, advance],
  );

  const placeBall = (id: number) => {
    if (phase !== "play") return;
    setSlots((s) => (s.includes(id) ? s : [...s, id]));
  };
  const removeSlot = (slotIdx: number) => {
    if (phase !== "play") return;
    setSlots((s) => s.filter((_, i) => i !== slotIdx));
  };

  if (phase === "intro") {
    return (
      <RoundIntro
        title="공 무게 비교하기"
        lines={[
          "양팔저울 비교 결과들을 종합해 공을 무거운 순서대로 배열하세요.",
          "공을 클릭해 슬롯을 채우고, 채운 슬롯을 클릭하면 다시 뺄 수 있습니다.",
          "총 10문항, 문항당 40초. 완전히 맞아야 정답입니다.",
          "💡 저울을 부등호 체인(A>B>C)으로 변환해 머릿속에 적으세요.",
        ]}
        onStart={() => setPhase("count")}
      />
    );
  }

  if (phase === "count") {
    return <Countdown onDone={() => startQuestion(0)} />;
  }

  if (!question) return null;

  const available = question.balls.filter((b) => !slots.includes(b.id));

  return (
    <div className="min-h-[24rem]">
      <GameHUD
        left={`${qIndex + 1} / ${TOTAL_QUESTIONS}문항 · 공 ${question.balls.length}개`}
        right={formatSec(remaining)}
      />
      <div className="mb-4">
        <TimeBar remaining={remaining} total={question.limitMs} />
      </div>

      {/* 저울 비교 결과들 */}
      <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
        {question.comparisons.map((c, i) => {
          const heavy = question.balls.find((b) => b.id === c.heavy)!;
          const light = question.balls.find((b) => b.id === c.light)!;
          return (
            <div
              key={i}
              className="flex items-center justify-center gap-3 rounded-lg bg-surface-card px-4 py-3"
            >
              <span className="text-2xl">{heavy.emoji}</span>
              <span className="flex flex-col items-center text-muted">
                <span className="text-[11px] leading-none">무겁다</span>
                <span className="text-lg leading-none">&gt;</span>
              </span>
              <span className="text-2xl">{light.emoji}</span>
            </div>
          );
        })}
      </div>

      {/* 정답 슬롯 (무거운 순서) */}
      <p className="mb-2 text-sm font-medium text-ink">무거운 순서대로 배열</p>
      <div className="mb-5 flex flex-wrap gap-2">
        {Array.from({ length: question.balls.length }).map((_, i) => {
          const id = slots[i];
          return (
            <button
              key={i}
              onClick={() => id !== undefined && removeSlot(i)}
              className={`flex h-14 w-14 items-center justify-center rounded-lg border text-2xl transition-colors ${
                id !== undefined
                  ? "border-ink bg-canvas"
                  : "border-dashed border-hairline bg-surface-soft"
              }`}
            >
              {id !== undefined ? (
                question.balls.find((b) => b.id === id)!.emoji
              ) : (
                <span className="text-sm text-muted-soft">{i + 1}위</span>
              )}
            </button>
          );
        })}
      </div>

      {/* 남은 공 */}
      <p className="mb-2 text-sm font-medium text-muted">눌러서 배치</p>
      <div className="mb-6 flex flex-wrap gap-2">
        {available.length === 0 ? (
          <span className="text-sm text-muted-soft">모든 공을 배치했습니다</span>
        ) : (
          available.map((b) => (
            <button
              key={b.id}
              onClick={() => placeBall(b.id)}
              className="flex h-14 w-14 items-center justify-center rounded-lg bg-surface-card text-2xl transition-transform hover:scale-105"
            >
              {b.emoji}
            </button>
          ))
        )}
      </div>

      <div className="flex items-center justify-between">
        <Flash ok={flash} />
        <Button
          onClick={() => handleSubmit(false)}
          disabled={slots.length !== question.balls.length || phase !== "play"}
        >
          제출
        </Button>
      </div>
    </div>
  );
}
