"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useGameShell } from "@/components/game-shell";
import {
  Countdown,
  GameHUD,
  RoundIntro,
  TimeBar,
  formatSec,
  useCountdown,
} from "@/components/game-ui";
import { Button } from "@/components/ui";
import {
  CAP,
  clonePegs,
  makeHanoiQuestion,
  pegsEqual,
  type HanoiQuestion,
  type Pegs,
} from "./logic";

const BALL_EMOJI = ["🔴", "🔵", "🟢", "🟡", "🟣"];
const QUESTION_TIME_MS = 60_000;
const TOTAL_QUESTIONS = 8;

function ballCountFor(index: number): number {
  if (index < 3) return 3;
  if (index < 6) return 4;
  return 5;
}

type Phase = "intro" | "count" | "play" | "between";
type QResult = {
  success: boolean;
  optimal: boolean;
  efficiency: number; // 0~1
  planMs: number;
};

export default function Game() {
  const { finish } = useGameShell();
  const [phase, setPhase] = useState<Phase>("intro");
  const [qIndex, setQIndex] = useState(0);
  const [q, setQ] = useState<HanoiQuestion | null>(null);
  const [pegs, setPegs] = useState<Pegs>([[], [], []]);
  const [held, setHeld] = useState<number | null>(null); // 들고 있는 출발 기둥
  const [moves, setMoves] = useState(0);
  const [done, setDone] = useState(false); // 이번 문항 성공 표시

  const finishedRef = useRef(false);
  const resultsRef = useRef<QResult[]>([]);
  const startTimeRef = useRef(0);
  const firstMoveRef = useRef<number | null>(null);

  const startQuestion = useCallback((index: number) => {
    const question = makeHanoiQuestion(ballCountFor(index));
    setQ(question);
    setPegs(clonePegs(question.start));
    setHeld(null);
    setMoves(0);
    setDone(false);
    startTimeRef.current = Date.now();
    firstMoveRef.current = null;
    setPhase("play");
  }, []);

  const recordAndAdvance = useCallback(
    (result: QResult) => {
      resultsRef.current.push(result);
      setPhase("between");
      const next = qIndex + 1;
      window.setTimeout(() => {
        if (next >= TOTAL_QUESTIONS) {
          if (finishedRef.current) return;
          finishedRef.current = true;
          const rs = resultsRef.current;
          const successes = rs.filter((r) => r.success);
          const avgScore =
            rs.length > 0
              ? rs.reduce((s, r) => s + (r.success ? r.efficiency : 0), 0) /
                rs.length
              : 0;
          const optimalCount = rs.filter((r) => r.optimal).length;
          const avgEff =
            successes.length > 0
              ? successes.reduce((s, r) => s + r.efficiency, 0) /
                successes.length
              : 0;
          const avgPlan =
            successes.length > 0
              ? successes.reduce((s, r) => s + r.planMs, 0) /
                successes.length /
                1000
              : 0;
          finish({
            score: Math.max(0, Math.min(100, Math.round(avgScore * 100))),
            label: `성공 ${successes.length}/${TOTAL_QUESTIONS}`,
            detail: [
              { name: "성공 문항", value: `${successes.length}/${TOTAL_QUESTIONS}` },
              { name: "최소 이동 달성", value: `${optimalCount}회` },
              { name: "평균 이동 효율", value: `${Math.round(avgEff * 100)}%` },
              { name: "평균 계획 시간", value: `${avgPlan.toFixed(1)}초` },
            ],
          });
          return;
        }
        setQIndex(next);
        startQuestion(next);
      }, 1000);
    },
    [qIndex, finish, startQuestion],
  );

  // 시간 초과 = 실패
  const remaining = useCountdown(QUESTION_TIME_MS, phase === "play", () => {
    setPhase((cur) => {
      if (cur !== "play") return cur;
      recordAndAdvance({ success: false, optimal: false, efficiency: 0, planMs: 0 });
      return "between";
    });
  });

  const handlePeg = useCallback(
    (pegIdx: number) => {
      if (phase !== "play") return;
      if (held === null) {
        // 공 들기 — 비어있으면 무시
        if (pegs[pegIdx].length === 0) return;
        setHeld(pegIdx);
        return;
      }
      // 내려놓기
      if (pegIdx === held) {
        setHeld(null); // 같은 기둥 클릭 = 취소
        return;
      }
      if (pegs[pegIdx].length >= CAP) {
        setHeld(null); // 가득 참 = 취소
        return;
      }
      const next = clonePegs(pegs);
      const ball = next[held].pop()!;
      next[pegIdx].push(ball);
      setHeld(null);
      const moveCount = moves + 1;
      setMoves(moveCount);
      setPegs(next);
      if (firstMoveRef.current === null) {
        firstMoveRef.current = Date.now();
      }

      // 성공 판정
      if (q && pegsEqual(next, q.goal)) {
        setDone(true);
        const efficiency = Math.min(1, q.minMoves / moveCount);
        const planMs = (firstMoveRef.current ?? Date.now()) - startTimeRef.current;
        recordAndAdvance({
          success: true,
          optimal: moveCount === q.minMoves,
          efficiency,
          planMs,
        });
      }
    },
    [phase, held, pegs, moves, q, recordAndAdvance],
  );

  const reset = useCallback(() => {
    if (!q || phase !== "play") return;
    setPegs(clonePegs(q.start));
    setHeld(null);
    setMoves(0);
  }, [q, phase]);

  // 키보드 1/2/3
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat) return;
      if (e.key === "1") handlePeg(0);
      else if (e.key === "2") handlePeg(1);
      else if (e.key === "3") handlePeg(2);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [handlePeg]);

  if (phase === "intro") {
    return (
      <RoundIntro
        title="공 옮기기 (하노이의 탑)"
        lines={[
          "기둥 사이에서 공을 옮겨 목표 배치를 최소 이동으로 만드세요.",
          "기둥을 클릭(또는 1·2·3 키)해 맨 위 공을 들고, 다른 기둥을 클릭해 내려놓습니다.",
          "각 기둥은 최대 3개까지. 총 8문항, 문항당 60초.",
          "💡 첫 수를 두기 전에 전체 경로를 머릿속으로 완성하세요 — 계획 시간도 측정됩니다.",
        ]}
        keys={[
          { key: "1", action: "왼쪽 기둥" },
          { key: "2", action: "가운데 기둥" },
          { key: "3", action: "오른쪽 기둥" },
        ]}
        onStart={() => setPhase("count")}
      />
    );
  }

  if (phase === "count") {
    return <Countdown onDone={() => startQuestion(0)} />;
  }

  if (!q) return null;

  return (
    <div className="min-h-[24rem]">
      <GameHUD
        left={`${qIndex + 1} / ${TOTAL_QUESTIONS}문항 · 이동 ${moves}회 (최소 ${q.minMoves})`}
        right={formatSec(remaining)}
      />
      <div className="mb-6">
        <TimeBar remaining={remaining} total={QUESTION_TIME_MS} />
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_auto]">
        {/* 현재 보드 */}
        <div>
          <p className="mb-3 text-sm font-medium text-ink">현재 배치</p>
          <PegBoard
            pegs={pegs}
            held={held}
            interactive={phase === "play"}
            onPeg={handlePeg}
          />
          {done && (
            <p className="mt-4 text-center text-sm font-semibold text-success">
              성공! 🎉
            </p>
          )}
        </div>

        {/* 목표 */}
        <div className="lg:w-56">
          <p className="mb-3 text-sm font-medium text-muted">목표 배치</p>
          <PegBoard pegs={q.goal} held={null} interactive={false} compact />
        </div>
      </div>

      <div className="mt-6 flex items-center justify-between">
        <p className="text-[13px] text-muted-soft">
          {held === null
            ? "기둥을 눌러 맨 위 공을 드세요"
            : `${held + 1}번 기둥의 공을 들었습니다 — 내려놓을 기둥을 누르세요`}
        </p>
        <Button variant="secondary" onClick={reset} disabled={phase !== "play"}>
          처음부터
        </Button>
      </div>
    </div>
  );
}

function PegBoard({
  pegs,
  held,
  interactive,
  onPeg,
  compact = false,
}: {
  pegs: Pegs;
  held: number | null;
  interactive: boolean;
  onPeg?: (i: number) => void;
  compact?: boolean;
}) {
  const slot = compact ? "h-8 w-8 text-lg" : "h-12 w-12 text-2xl";
  const pegH = compact ? "min-h-[7.5rem]" : "min-h-[11rem]";
  return (
    <div className="grid grid-cols-3 gap-3">
      {pegs.map((stack, i) => (
        <button
          key={i}
          disabled={!interactive}
          onClick={() => onPeg?.(i)}
          className={`flex ${pegH} flex-col-reverse items-center gap-1.5 rounded-xl border p-2 transition-colors ${
            held === i
              ? "border-ink bg-surface-soft"
              : interactive
                ? "border-hairline bg-surface-card hover:border-ink"
                : "border-hairline bg-surface-card"
          }`}
        >
          {/* 바닥 라벨 */}
          <span className="mt-1 text-[11px] text-muted-soft">{i + 1}</span>
          {stack.map((ball, depth) => {
            const isTop = depth === stack.length - 1;
            return (
              <span
                key={ball}
                className={`flex ${slot} items-center justify-center rounded-full ${
                  held === i && isTop ? "ring-2 ring-ink ring-offset-1" : ""
                }`}
              >
                {BALL_EMOJI[ball]}
              </span>
            );
          })}
        </button>
      ))}
    </div>
  );
}
