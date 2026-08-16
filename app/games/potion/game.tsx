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
import { Clover, Fern, Grass, ThreeLeaf } from "./herbs";

/**
 * 마법약 만들기 — 확률 학습(probabilistic classification) + 규칙 반전(reversal learning) 게임.
 *
 * 잡다 원본에 맞춘 구성
 *  - 재료 카드 4장이 2×2 그리드에 고정 배치되고, 매 문항 그중 1~3장만 앞면으로 공개된다.
 *    (1장 공개 4가지 + 2장 6가지 + 3장 4가지 = 14가지 조합)
 *  - 카드 위치가 고정이므로 ‘어느 자리가 뒷면인가’ 자체가 조합의 단서가 된다.
 *  - 조합마다 지배색이 비밀 배정되고, 실제 결과는 지배색 80% / 반대색 20% 추첨.
 *  - 진행 중 한 번, 예고 없이 레시피가 부분 수정된다 — 14가지 중 일부의 지배색만 뒤집힌다.
 *    전체 반전이 아니므로 “한 조합이 뒤집혔다 → 전부 뒤집자”는 오히려 감점이다.
 */

/** 카드 자리는 고정 — 배열 순서가 곧 2×2 그리드 위치(좌상·우상·좌하·우하)이자 마스크 비트 순서 */
const INGREDIENTS = [
  { name: "고사리", Icon: Fern },
  { name: "세잎풀", Icon: ThreeLeaf },
  { name: "클로버", Icon: Clover },
  { name: "풀잎", Icon: Grass },
] as const;

const TOTAL = 60;
const LIMIT_MS = 3000;
const REVEAL_MS = 500; // 응답 후 결과 표시 시간
const TIMEOUT_REVEAL_MS = 800; // 미응답이어도 제조 결과는 보여준다(학습 기회 보존)
const DOMINANT_P = 0.8; // 지배색이 나올 확률

// 레시피 수정 — 시점과 범위를 모두 랜덤화해 “몇 번쯤에 바뀐다”를 외울 수 없게 한다.
// 수정 전/후 두 구간 모두 28문항 이상이어야 14조합을 각 2회 이상 만날 수 있어
// (탐색 1회 + 채점 1회 이상) 시점 범위를 28~32 로 제한한다.
const CHANGE_MIN = 28;
const CHANGE_MAX = 32;
const FLIP_MIN = 5;
const FLIP_MAX = 9;

type Color = "red" | "blue";
type Phase = "intro" | "countdown" | "question" | "reveal" | "finished";

type Question = {
  /** 비트마스크 1~14 — 앞면으로 공개되는 재료 조합 14가지 */
  mask: number;
  /** 이번 문항의 실제 결과색 (지배색 80% / 반대색 20%) */
  result: Color;
  /** 채점 대상 여부 — 조합 첫 등장, 그리고 ‘수정된 조합’의 수정 후 첫 등장은 제외 */
  scored: boolean;
  /** 레시피 수정 이후 문항인지 */
  afterChange: boolean;
  /** 이번 레시피 수정으로 지배색이 뒤집힌 조합인지 */
  flipped: boolean;
};

type Deal = {
  questions: Question[];
  /** 레시피가 수정되는 문항 인덱스(0-based) */
  changeAt: number;
  /** 이번 수정으로 뒤집힌 조합 수 */
  flipCount: number;
};

type Answer = { pick: Color | null; correct: boolean };

function shuffle<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function other(c: Color): Color {
  return c === "red" ? "blue" : "red";
}

function randInt(min: number, max: number): number {
  return min + Math.floor(Math.random() * (max - min + 1));
}

/**
 * n문항 블록 배분 — 14조합을 섞은 묶음을 이어 붙여 잘라내므로
 * 블록 안에서 조합별 등장 횟수 차이가 1을 넘지 않는다.
 * (수정 전/후 각 구간에서 모든 조합을 최소 2회 만나게 하는 것이 목적)
 */
function dealBlock(combos: number[], n: number): number[] {
  const out: number[] = [];
  while (out.length < n) out.push(...shuffle([...combos]));
  return shuffle(out.slice(0, n));
}

/** 플레이마다 새로 생성: 지배색 배정 + 레시피 수정 지점·범위 + 출제 순서 + 결과색 추첨 */
function generateGame(): Deal {
  // 마스크 1~14 = 1장(4) + 2장(6) + 3장(4) 조합 전부 (15 = 4장 전부는 제외)
  const combos = Array.from({ length: 14 }, (_, i) => i + 1);

  // 조합별 지배색 50:50 독립 배정
  const dominant = new Map<number, Color>();
  for (const m of combos) dominant.set(m, Math.random() < 0.5 ? "red" : "blue");

  // 레시피 수정 — 어느 시점에, 어떤 조합이 바뀔지 모두 랜덤
  const changeAt = randInt(CHANGE_MIN, CHANGE_MAX);
  const flipCount = randInt(FLIP_MIN, FLIP_MAX);
  const flippedSet = new Set(shuffle([...combos]).slice(0, flipCount));

  // 수정 전/후를 별도 블록으로 배분해 두 구간 모두에서 학습이 가능하도록 한다
  const order = [
    ...dealBlock(combos, changeAt),
    ...dealBlock(combos, TOTAL - changeAt),
  ];

  const seen = new Set<number>();
  const seenAfter = new Set<number>();

  const questions = order.map((mask, i) => {
    const afterChange = i >= changeAt;
    const isFlipped = flippedSet.has(mask);
    const base = dominant.get(mask) ?? "red";
    const dom: Color = afterChange && isFlipped ? other(base) : base;
    const result: Color = Math.random() < DOMINANT_P ? dom : other(dom);

    const firstEver = !seen.has(mask);
    seen.add(mask);
    const firstAfter = afterChange && !seenAfter.has(mask);
    if (afterChange) seenAfter.add(mask);

    // 알 방법이 없는 문항은 채점에서 뺀다: 조합 첫 등장 + 바뀐 조합의 수정 후 첫 등장
    const scored = !firstEver && !(firstAfter && isFlipped);

    return { mask, result, scored, afterChange, flipped: isFlipped };
  });

  return { questions, changeAt, flipCount };
}

/** 뒷면 카드 — 아직 공개되지 않은 재료 자리 */
function CardBack() {
  return (
    <svg
      viewBox="0 0 160 112"
      preserveAspectRatio="none"
      className="h-full w-full"
      aria-hidden="true"
    >
      <rect width="160" height="112" fill="#c2c8d1" />
      <path d="M0 60c26-18 52 6 80-2s54-24 80-12v66H0z" fill="#d7dbe1" />
      <path d="M0 84c30-14 50 8 82 2s48-18 78-8v34H0z" fill="#edeff2" />
    </svg>
  );
}

export default function Game() {
  const { finish } = useGameShell();
  const { questions, changeAt, flipCount } = useMemo(generateGame, []);

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
    let preTotal = 0; // 수정 전 채점 문항
    let preHit = 0;
    let reTotal = 0; // 수정 후 · 바뀐 조합 (재학습)
    let reHit = 0;
    let keepTotal = 0; // 수정 후 · 그대로인 조합 (유지)
    let keepHit = 0;
    let explore = 0; // 채점 제외 문항
    let timeouts = 0;
    let streak = 0;
    let maxStreak = 0;

    answers.forEach((a, i) => {
      const qu = questions[i];
      if (a.pick === null) timeouts++;

      if (!qu.scored) {
        explore++;
      } else if (!qu.afterChange) {
        preTotal++;
        if (a.correct) preHit++;
      } else if (qu.flipped) {
        reTotal++;
        if (a.correct) reHit++;
      } else {
        keepTotal++;
        if (a.correct) keepHit++;
      }

      if (a.correct) {
        streak++;
        if (streak > maxStreak) maxStreak = streak;
      } else {
        streak = 0;
      }
    });

    const scoredTotal = preTotal + reTotal + keepTotal;
    const scoredHit = preHit + reHit + keepHit;
    const raw = scoredTotal > 0 ? Math.round((scoredHit / scoredTotal) * 100) : 0;
    const score = Math.max(0, Math.min(100, Number.isFinite(raw) ? raw : 0));

    const rate = (hit: number, total: number) =>
      total > 0 ? `${hit}/${total} (${Math.round((hit / total) * 100)}%)` : "—";

    finish({
      score,
      label: `적중 ${scoredHit}/${scoredTotal} (탐색 ${explore}문항 제외)`,
      detail: [
        {
          name: "레시피 수정",
          value: `${changeAt + 1}번 문항 · 14가지 중 ${flipCount}가지`,
        },
        { name: "수정 전 적중률", value: rate(preHit, preTotal) },
        { name: "수정 후 · 바뀐 조합", value: rate(reHit, reTotal) },
        { name: "수정 후 · 그대로인 조합", value: rate(keepHit, keepTotal) },
        { name: "최다 연속 적중", value: `${maxStreak}문항` },
        { name: "미응답 (3초 초과)", value: `${timeouts}문항` },
      ],
    });
  }, [finish, questions, changeAt, flipCount]);

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
    const wait = lastPick === null ? TIMEOUT_REVEAL_MS : REVEAL_MS;
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

  // 키보드: ← 파란 약 / → 빨간 약 (잡다 화면의 버튼 배치와 동일)
  useEffect(() => {
    if (phase !== "question") return;
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat) return;
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        settle("blue");
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        settle("red");
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
          `재료 카드 4장 중 일부가 앞면으로 공개됩니다. 3초 안에 어떤 약이 될지 예측하세요. 총 ${TOTAL}문항.`,
          "공개 조합은 14가지(1장 4 · 2장 6 · 3장 4). 각 조합에는 숨겨진 지배색이 있고, 결과는 지배색 80% · 반대색 20%로 나옵니다.",
          "진행 중 한 번, 예고 없이 레시피가 부분 수정됩니다 — 일부 조합의 결과색만 뒤집힙니다.",
          "한 번의 오답은 20% 노이즈일 뿐입니다. 같은 조합에서 연속으로 틀리기 시작할 때만 갈아타세요.",
          "카드 자리는 고정입니다. 재료 이름보다 ‘어느 자리가 뒷면인지’로 조합을 기억하는 게 빠릅니다.",
        ]}
        keys={[
          { key: "←", action: "파란 약" },
          { key: "→", action: "빨간 약" },
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

  const revealing = phase === "reveal";
  const predicted = lastPick !== null && lastPick === q.result;

  return (
    <div>
      <GameHUD
        left={`문항 ${index + 1}/${TOTAL}`}
        right={`${(remaining / 1000).toFixed(1)}초`}
      />
      <TimeBar remaining={remaining} total={LIMIT_MS} />

      <div className="mt-6 flex min-h-[24rem] flex-col items-center">
        <p className="mb-5 text-sm font-medium text-muted">어떤 약이 될까요?</p>

        {/* 재료 카드 4장 — 2×2 고정 배치, 조합에 포함된 카드만 앞면 */}
        <div className="grid grid-cols-2 gap-2.5 sm:gap-4">
          {INGREDIENTS.map(({ name, Icon }, i) => {
            const shown = ((q.mask >> i) & 1) === 1;
            return (
              <div
                key={name}
                role="img"
                aria-label={`${i + 1}번 자리 — ${shown ? name : "뒷면"}`}
                className={`flex h-24 w-32 items-center justify-center overflow-hidden rounded-xl border shadow-card sm:h-28 sm:w-40 ${
                  shown
                    ? "border-emerald-200 bg-emerald-50"
                    : "border-hairline bg-surface-strong"
                }`}
              >
                {shown ? (
                  <Icon className="h-16 w-16 sm:h-20 sm:w-20" />
                ) : (
                  <CardBack />
                )}
              </div>
            );
          })}
        </div>

        {/* 피드백 영역 — 높이 고정으로 레이아웃 점프 방지 */}
        <div className="mt-5 flex h-20 flex-col items-center justify-center gap-1.5">
          {revealing && (
            <>
              <p
                className={`text-sm font-semibold ${
                  lastPick === null
                    ? "text-muted"
                    : predicted
                      ? "text-success"
                      : "text-error"
                }`}
              >
                {lastPick === null
                  ? "시간 초과"
                  : predicted
                    ? "예측 성공!"
                    : "예측 실패"}
              </p>
              <p
                className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[13px] font-semibold ${
                  q.result === "red"
                    ? "bg-red-100 text-red-700"
                    : "bg-blue-100 text-blue-700"
                }`}
              >
                <span className="text-base">🧪</span>
                {q.result === "red"
                  ? "빨간 약이 제조되었습니다"
                  : "파란 약이 제조되었습니다"}
              </p>
            </>
          )}
        </div>

        {/* 선택 버튼 — 잡다와 동일하게 좌 파란약 / 우 빨간약 */}
        <div className="mt-auto flex w-full max-w-md gap-3">
          <button
            onClick={() => settle("blue")}
            disabled={phase !== "question"}
            className="flex h-14 flex-1 items-center justify-center gap-2 rounded-lg border-2 border-blue-300 bg-blue-50 text-[15px] font-semibold text-blue-700 transition-colors active:bg-blue-100 disabled:opacity-50"
          >
            파란 약 <KeyCap>←</KeyCap>
          </button>
          <button
            onClick={() => settle("red")}
            disabled={phase !== "question"}
            className="flex h-14 flex-1 items-center justify-center gap-2 rounded-lg border-2 border-red-300 bg-red-50 text-[15px] font-semibold text-red-700 transition-colors active:bg-red-100 disabled:opacity-50"
          >
            빨간 약 <KeyCap>→</KeyCap>
          </button>
        </div>
      </div>
    </div>
  );
}
