"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useGameShell } from "@/components/game-shell";
import {
  Countdown,
  GameHUD,
  RoundIntro,
  TimeBar,
} from "@/components/game-ui";
import { KeyCap } from "@/components/ui";

/**
 * 마법약 만들기 — 확률 학습(probabilistic classification) 게임.
 * 14가지 재료 조합마다 지배색(빨강/파랑)이 비밀 배정되고,
 * 실제 결과는 지배색 80% / 반대색 20% 로 추첨된다.
 * 피드백을 누적 학습해 재등장 조합의 적중률을 끌어올리는 것이 목표.
 */

const INGREDIENTS = ["🍄", "💎", "🌸", "🪶"] as const;
const TOTAL = 50;
const LIMIT_MS = 3000;
const REVEAL_MS = 500; // 응답 후 결과 표시 시간
const GAP_MS = 200; // 미응답(타임아웃) 시 피드백 없이 넘어가는 짧은 간격

type Color = "red" | "blue";
type Phase = "intro" | "countdown" | "question" | "reveal" | "finished";

type Question = {
  /** 비트마스크 1~14 — 재료 1~3장 조합 14가지 */
  mask: number;
  /** 이번 문항의 실제 결과색 (지배색 80% / 반대색 20%) */
  result: Color;
  /** 이 조합의 첫 등장(탐색 문항) 여부 — 채점 제외 */
  isFirst: boolean;
};

type Answer = { pick: Color | null; correct: boolean };

function shuffle<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function maskIngredients(mask: number): string[] {
  return INGREDIENTS.filter((_, i) => (mask >> i) & 1);
}

/** 플레이마다 새로 생성: 지배색 배정 + 셔플백 출제 순서 + 결과색 추첨 */
function generateGame(): Question[] {
  // 마스크 1~14 = 1장(4) + 2장(6) + 3장(4) 조합 전부 (15 = 4장 전부는 제외)
  const combos = Array.from({ length: 14 }, (_, i) => i + 1);

  // 조합별 지배색 50:50 독립 배정
  const dominant = new Map<number, Color>();
  for (const m of combos) dominant.set(m, Math.random() < 0.5 ? "red" : "blue");

  // 셔플백: 14조합 × 3회 = 42문항 셔플 → 잔여 8문항은 랜덤 조합
  const bag = shuffle([...combos, ...combos, ...combos]);
  while (bag.length < TOTAL) {
    bag.push(combos[Math.floor(Math.random() * combos.length)]);
  }
  const order = bag.slice(0, TOTAL);

  const seen = new Set<number>();
  return order.map((mask) => {
    const dom = dominant.get(mask) ?? "red";
    const flip = Math.random() >= 0.8;
    const result: Color = flip ? (dom === "red" ? "blue" : "red") : dom;
    const isFirst = !seen.has(mask);
    seen.add(mask);
    return { mask, result, isFirst };
  });
}

export default function Game() {
  const { finish } = useGameShell();
  const questions = useMemo(generateGame, []);

  const [phase, setPhase] = useState<Phase>("intro");
  const [index, setIndex] = useState(0);
  const [lastPick, setLastPick] = useState<Color | null>(null);
  const [remaining, setRemaining] = useState(LIMIT_MS);

  const answersRef = useRef<Answer[]>([]);
  const processedRef = useRef(-1); // 같은 문항 이중 처리(클릭 vs 타임아웃 경합) 방지
  const finishedRef = useRef(false); // finish 정확히 1회 가드

  const q = questions[index];

  const finishGame = useCallback(() => {
    if (finishedRef.current) return;
    finishedRef.current = true;

    const answers = answersRef.current;
    let scoredTotal = 0; // 재등장 문항 수 (채점 대상)
    let scoredHit = 0; // 재등장 문항 적중 수
    let explore = 0; // 탐색(첫 등장) 문항 수
    let timeouts = 0;
    let streak = 0;
    let maxStreak = 0;
    let firstHalfHit = 0;
    let secondHalfHit = 0;

    answers.forEach((a, i) => {
      const qu = questions[i];
      if (a.pick === null) timeouts++;
      if (qu.isFirst) {
        explore++;
      } else {
        scoredTotal++;
        if (a.correct) scoredHit++;
      }
      if (a.correct) {
        streak++;
        if (streak > maxStreak) maxStreak = streak;
        if (i < TOTAL / 2) firstHalfHit++;
        else secondHalfHit++;
      } else {
        streak = 0;
      }
    });

    const raw = scoredTotal > 0 ? Math.round((scoredHit / scoredTotal) * 100) : 0;
    const score = Math.max(0, Math.min(100, Number.isFinite(raw) ? raw : 0));
    const half = TOTAL / 2;
    const pct = (h: number) => Math.round((h / half) * 100);

    finish({
      score,
      label: `적중 ${scoredHit}/${scoredTotal} (탐색 ${explore}문항 제외)`,
      detail: [
        { name: "전반 25문항 적중률", value: `${firstHalfHit}/${half} (${pct(firstHalfHit)}%)` },
        { name: "후반 25문항 적중률", value: `${secondHalfHit}/${half} (${pct(secondHalfHit)}%)` },
        { name: "탐색 문항 (채점 제외)", value: `${explore}문항` },
        { name: "최다 연속 적중", value: `${maxStreak}문항` },
        { name: "미응답 (3초 초과)", value: `${timeouts}문항` },
      ],
    });
  }, [finish, questions]);

  /** 응답 확정 — pick=null 은 타임아웃(미응답) */
  const settle = useCallback(
    (pick: Color | null) => {
      if (phase !== "question") return;
      if (processedRef.current === index || finishedRef.current) return;
      processedRef.current = index;
      const correct = pick !== null && pick === questions[index].result;
      answersRef.current.push({ pick, correct });
      setLastPick(pick);
      setPhase("reveal");
    },
    [phase, index, questions],
  );

  // 문항 제한시간 — 문항마다 리셋되도록 index 에 종속
  useEffect(() => {
    if (phase !== "question") return;
    setRemaining(LIMIT_MS);
    const startedAt = Date.now();
    const id = setInterval(() => {
      const left = LIMIT_MS - (Date.now() - startedAt);
      if (left <= 0) {
        clearInterval(id);
        setRemaining(0);
        settle(null);
      } else {
        setRemaining(left);
      }
    }, 50);
    return () => clearInterval(id);
  }, [phase, index, settle]);

  // 결과 표시 후 다음 문항 / 종료
  useEffect(() => {
    if (phase !== "reveal") return;
    const wait = lastPick === null ? GAP_MS : REVEAL_MS;
    const t = setTimeout(() => {
      if (index + 1 >= TOTAL) {
        setPhase("finished");
        finishGame();
      } else {
        setIndex(index + 1);
        setPhase("question");
      }
    }, wait);
    return () => clearTimeout(t);
  }, [phase, index, lastPick, finishGame]);

  // 키보드: ← 빨간 약 / → 파란 약
  useEffect(() => {
    if (phase !== "question") return;
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat) return;
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        settle("red");
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        settle("blue");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [phase, settle]);

  if (phase === "intro") {
    return (
      <RoundIntro
        title="마법약 만들기"
        lines={[
          `재료 카드 조합이 나오면 3초 안에 어떤 약이 될지 예측하세요. 총 ${TOTAL}문항.`,
          "각 조합에는 숨겨진 지배색이 있고, 결과는 지배색 80% · 반대색 20%로 나옵니다.",
          "결과는 확률입니다 — 한 번 틀렸다고 외운 색을 뒤집지 마세요.",
          "처음 보는 조합은 탐색 문항이라 채점에서 제외됩니다. 모르면 한 색으로 통일해 찍고, 틀린 조합만 외우세요.",
        ]}
        keys={[
          { key: "←", action: "빨간 약" },
          { key: "→", action: "파란 약" },
        ]}
        startLabel="시작"
        onStart={() => setPhase("countdown")}
      />
    );
  }

  if (phase === "countdown") {
    return (
      <Countdown
        onDone={() => {
          setIndex(0);
          setPhase("question");
        }}
      />
    );
  }

  if (phase === "finished") {
    return <div className="min-h-[24rem]" />;
  }

  const ingredients = maskIngredients(q.mask);
  const showFeedback = phase === "reveal" && lastPick !== null;
  const predicted = showFeedback && lastPick === q.result;

  return (
    <div>
      <GameHUD
        left={`문항 ${index + 1}/${TOTAL}`}
        right={`${(remaining / 1000).toFixed(1)}초`}
      />
      <TimeBar remaining={remaining} total={LIMIT_MS} />

      <div className="mt-6 flex min-h-[24rem] flex-col items-center">
        <p className="mb-6 text-sm font-medium text-muted">어떤 약이 될까요?</p>

        {/* 재료 카드 테이블 */}
        <div className="flex items-center justify-center gap-4">
          {ingredients.map((emoji, i) => (
            <div
              key={i}
              className="flex h-28 w-24 items-center justify-center rounded-xl border border-hairline bg-surface-card text-5xl shadow-[0_1px_2px_rgba(0,0,0,0.05)]"
            >
              {emoji}
            </div>
          ))}
        </div>

        {/* 피드백 영역 — 높이 고정으로 레이아웃 점프 방지 */}
        <div className="mt-6 flex h-24 flex-col items-center justify-center">
          {showFeedback && (
            <>
              <p
                className={`text-sm font-semibold ${
                  predicted ? "text-success" : "text-error"
                }`}
              >
                {predicted ? "예측 성공!" : "예측 실패"}
              </p>
              <p className="mt-1 text-4xl">
                {q.result === "red" ? "🔴" : "🔵"}
                <span className="ml-1">🧪</span>
              </p>
              <p className="mt-1 text-[13px] text-muted">
                {q.result === "red" ? "빨간 약이 되었습니다" : "파란 약이 되었습니다"}
              </p>
            </>
          )}
        </div>

        {/* 선택 버튼 */}
        <div className="mt-auto flex w-full max-w-md gap-3">
          <button
            onClick={() => settle("red")}
            disabled={phase !== "question"}
            className="flex h-14 flex-1 items-center justify-center gap-2 rounded-lg border border-hairline bg-canvas text-[15px] font-semibold text-ink transition-colors active:bg-surface-soft disabled:opacity-50"
          >
            🔴 빨간 약 <KeyCap>←</KeyCap>
          </button>
          <button
            onClick={() => settle("blue")}
            disabled={phase !== "question"}
            className="flex h-14 flex-1 items-center justify-center gap-2 rounded-lg border border-hairline bg-canvas text-[15px] font-semibold text-ink transition-colors active:bg-surface-soft disabled:opacity-50"
          >
            🔵 파란 약 <KeyCap>→</KeyCap>
          </button>
        </div>
      </div>
    </div>
  );
}
