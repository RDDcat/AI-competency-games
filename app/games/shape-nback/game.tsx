"use client";

import { useEffect, useRef, useState } from "react";
import { useGameShell } from "@/components/game-shell";
import {
  Countdown,
  Flash,
  GameHUD,
  RoundIntro,
  TimeBar,
  useCountdown,
} from "@/components/game-ui";
import { Badge, KeyCap } from "@/components/ui";
import {
  answersFor,
  makeRound1Seq,
  makeRound2Seq,
  R1_MEMO,
  R1_RESP,
  R2_MEMO,
  R2_RESP,
  TOTAL_RESP,
  type Action,
} from "./sequence";

/* ───────────────────────── 상수 ───────────────────────── */

/** 도형 풀 5묶음 — 매 플레이 1묶음만 등장 */
const POOLS: readonly (readonly [string, string, string])[] = [
  ["🔺", "🔵", "🟨"],
  ["⭐", "🔶", "🟢"],
  ["💜", "🔷", "🟠"],
  ["♠️", "♥️", "♣️"],
  ["🌙", "☀️", "⚡"],
];

const QUESTION_MS = 2500;
const MEMORIZE_MS = 1500;
const FLASH_MS = 300;

type Phase = "intro" | "countdown" | "show" | "flash";
type RoundData = { seq: number[]; memo: number; answers: Action[] };
type Rec = { round: 0 | 1; ok: boolean; noAnswer: boolean };

const ROUND_INTRO = [
  {
    title: "1라운드 — 2-back",
    lines: [
      "도형이 카드 더미 위에 한 장씩 갱신됩니다. 등장 도형은 3종뿐!",
      "처음 2장은 응답 없이 기억만 하세요.",
      "3번째부터: 지금 도형이 2번째 전과 같으면 ←, 다르면 Space.",
      "문항당 제한시간 2.5초 · 응답 20회 · 무응답은 오답입니다.",
      "팁: 도형에 한 글자 이름을 붙여 “네-별-달…” 소리내며 리듬을 타세요.",
      "팁: 흐름을 놓치면 미련 없이 그 자리부터 다시 시작!",
    ],
    keys: [
      { key: "←", action: "2번째 전과 같음" },
      { key: "Space", action: "다름" },
    ],
  },
  {
    title: "2라운드 — 2&3-back",
    lines: [
      "이번엔 처음 3장을 응답 없이 기억만 하세요.",
      "4번째부터: 2번째 전과 같으면 ←, 3번째 전과 같으면 →, 둘 다 아니면 Space.",
      "문항당 제한시간 2.5초 · 응답 24회 · 무응답은 오답입니다.",
      "팁: 머릿속 길이 3짜리 큐를 소리내며 밀기 — 판단과 큐 갱신을 한 동작처럼.",
      "팁: 놓치면 그 자리부터 새로 기억을 쌓으세요. 2~3문항 버리는 게 전부 무너지는 것보다 낫습니다.",
    ],
    keys: [
      { key: "←", action: "2번째 전과 같음" },
      { key: "→", action: "3번째 전과 같음" },
      { key: "Space", action: "둘 다 다름" },
    ],
  },
] as const;

/* ───────────────────────── 컴포넌트 ───────────────────────── */

export default function Game() {
  const { finish } = useGameShell();

  const [pool] = useState(() => POOLS[Math.floor(Math.random() * POOLS.length)]);
  const [rounds] = useState<RoundData[]>(() => {
    const s1 = makeRound1Seq();
    const s2 = makeRound2Seq();
    return [
      { seq: s1, memo: R1_MEMO, answers: answersFor(s1, R1_MEMO, false) },
      { seq: s2, memo: R2_MEMO, answers: answersFor(s2, R2_MEMO, true) },
    ];
  });

  const [phase, setPhase] = useState<Phase>("intro");
  const [round, setRound] = useState<0 | 1>(0);
  const [seqIndex, setSeqIndex] = useState(0);
  const [flashOk, setFlashOk] = useState<boolean | null>(null);
  const [correct, setCorrect] = useState(0);

  const cur = rounds[round];
  const isMemorize = seqIndex < cur.memo;
  const responding = phase === "show" && !isMemorize;

  /* 이벤트 핸들러·타이머 콜백용 최신값 ref */
  const phaseRef = useRef<Phase>(phase);
  phaseRef.current = phase;
  const roundRef = useRef<0 | 1>(round);
  roundRef.current = round;
  const seqIndexRef = useRef(seqIndex);
  seqIndexRef.current = seqIndex;

  const recsRef = useRef<Rec[]>([]);
  const finishedRef = useRef(false);
  const flashTimerRef = useRef<number | null>(null);

  const endGame = () => {
    if (finishedRef.current) return;
    finishedRef.current = true;
    const recs = recsRef.current;
    const total = recs.filter((r) => r.ok).length;
    const r1 = recs.filter((r) => r.round === 0 && r.ok).length;
    const r2 = recs.filter((r) => r.round === 1 && r.ok).length;
    const noAns = recs.filter((r) => r.noAnswer).length;
    let streak = 0;
    let bestStreak = 0;
    for (const r of recs) {
      if (r.ok) {
        streak++;
        if (streak > bestStreak) bestStreak = streak;
      } else {
        streak = 0;
      }
    }
    const score = Math.max(0, Math.min(100, Math.round((total / TOTAL_RESP) * 100)));
    finish({
      score,
      label: `정답 ${total}/${TOTAL_RESP}`,
      detail: [
        { name: "1라운드 (2-back)", value: `${r1}/${R1_RESP}` },
        { name: "2라운드 (2&3-back)", value: `${r2}/${R2_RESP}` },
        { name: "무응답 (시간 초과)", value: `${noAns}회` },
        { name: "최장 연속 정답", value: `${bestStreak}문항` },
      ],
    });
  };

  /** 응답 처리 — a === null 은 시간 초과(무응답 = 오답) */
  const submit = (a: Action | null) => {
    if (phaseRef.current !== "show") return;
    const r = roundRef.current;
    const i = seqIndexRef.current;
    const data = rounds[r];
    if (i < data.memo) return; // 기억 단계에는 응답 없음
    const ok = a !== null && a === data.answers[i - data.memo];
    recsRef.current.push({ round: r, ok, noAnswer: a === null });
    if (ok) setCorrect((c) => c + 1);
    setFlashOk(ok);
    phaseRef.current = "flash"; // 제한시간 만료 콜백 레이스 차단
    setPhase("flash");
    flashTimerRef.current = window.setTimeout(() => {
      flashTimerRef.current = null;
      setFlashOk(null);
      const next = i + 1;
      if (next < data.seq.length) {
        setSeqIndex(next);
        setPhase("show");
      } else if (r === 0) {
        setRound(1);
        setSeqIndex(0);
        setPhase("intro");
      } else {
        endGame();
      }
    }, FLASH_MS);
  };

  const submitRef = useRef(submit);
  submitRef.current = submit;

  /* 문항 제한시간 — 응답 구간에만 가동, 만료 시 무응답 처리 */
  const remaining = useCountdown(QUESTION_MS, responding, () =>
    submitRef.current(null),
  );

  /* 기억 단계 자동 진행 (기억 카드는 라운드 마지막이 아니므로 단순 +1) */
  useEffect(() => {
    if (phase !== "show") return;
    if (seqIndex >= rounds[round].memo) return;
    const t = window.setTimeout(() => setSeqIndex((s) => s + 1), MEMORIZE_MS);
    return () => clearTimeout(t);
  }, [phase, seqIndex, round, rounds]);

  /* 키보드 입력 */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat) return;
      if (phaseRef.current !== "show") return;
      if (seqIndexRef.current < rounds[roundRef.current].memo) return;
      let a: Action | null = null;
      if (e.key === " " || e.code === "Space") a = "space";
      else if (e.key === "ArrowLeft") a = "left";
      else if (e.key === "ArrowRight" && roundRef.current === 1) a = "right";
      if (a === null) return;
      e.preventDefault();
      submitRef.current(a);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [rounds]);

  /* 언마운트 시 플래시 타이머 정리 */
  useEffect(
    () => () => {
      if (flashTimerRef.current !== null) clearTimeout(flashTimerRef.current);
    },
    [],
  );

  /* ── 라운드 안내 ── */
  if (phase === "intro") {
    const intro = ROUND_INTRO[round];
    return (
      <div className="min-h-[24rem]">
        <div className="mx-auto mt-2 flex max-w-md flex-col items-center gap-2 rounded-xl bg-surface-card px-6 py-4">
          <div className="flex items-center gap-5">
            {pool.map((e) => (
              <span key={e} className="text-4xl leading-none">
                {e}
              </span>
            ))}
          </div>
          <p className="text-[13px] text-muted">
            이번 판 등장 도형 3종 — 시작 전에 한 글자 이름을 붙여두세요
          </p>
        </div>
        <RoundIntro
          title={intro.title}
          lines={[...intro.lines]}
          keys={[...intro.keys]}
          onStart={() => setPhase("countdown")}
        />
      </div>
    );
  }

  /* ── 카운트다운 ── */
  if (phase === "countdown") {
    return (
      <div className="min-h-[24rem]">
        <Countdown onDone={() => setPhase("show")} />
      </div>
    );
  }

  /* ── show · flash ── */
  const respTotal = round === 0 ? R1_RESP : R2_RESP;
  const respNum = Math.min(Math.max(seqIndex - cur.memo + 1, 1), respTotal);
  const hudLeft = isMemorize
    ? `${round + 1}라운드 · 기억 ${seqIndex + 1}/${cur.memo}`
    : `${round + 1}라운드 · ${respNum}/${respTotal}`;

  return (
    <div className="min-h-[24rem]">
      <style>{`@keyframes nback-flash{0%{box-shadow:0 0 0 6px rgba(17,17,17,.35);transform:scale(.96)}100%{box-shadow:0 0 0 0 rgba(17,17,17,0);transform:scale(1)}}`}</style>
      <GameHUD left={hudLeft} right={`정답 ${correct}`} />
      <TimeBar
        remaining={responding ? remaining : phase === "flash" ? 0 : QUESTION_MS}
        total={QUESTION_MS}
      />

      <div className="mt-6 flex items-start justify-center gap-6">
        {/* 카드 더미 */}
        <div className="flex flex-col items-center">
          <div className="mb-4 flex h-7 items-center">
            {isMemorize ? (
              <Badge tone="bg-badge-violet/15 text-ink">
                기억하세요 — 아직 응답하지 않습니다
              </Badge>
            ) : (
              <p className="text-[13px] font-medium text-muted">
                {round === 0
                  ? "2번째 전과 같은가?"
                  : "2번째 전? 3번째 전? 둘 다 아님?"}
              </p>
            )}
          </div>

          <div className="relative h-56 w-48">
            <div className="absolute inset-0 translate-x-2 translate-y-2 rotate-2 rounded-2xl border border-hairline bg-surface-card" />
            <div className="absolute inset-0 -translate-x-1.5 translate-y-1 -rotate-1 rounded-2xl border border-hairline bg-surface-soft" />
            {/* key 교체로 갱신마다 테두리 번쩍 애니메이션 재트리거 */}
            <div
              key={`${round}-${seqIndex}`}
              className="absolute inset-0 flex items-center justify-center rounded-2xl border-2 border-ink bg-canvas"
              style={{ animation: "nback-flash 380ms ease-out" }}
            >
              <span className="text-[6rem] leading-none">
                {pool[cur.seq[seqIndex]]}
              </span>
            </div>
          </div>

          <div className="mt-4">
            <Flash ok={flashOk} />
          </div>
        </div>

        {/* 우측 키 안내 (상시) */}
        <aside className="hidden w-44 shrink-0 flex-col gap-3 self-center rounded-xl border border-hairline bg-surface-card p-4 sm:flex">
          <p className="text-[12px] font-semibold text-muted">키 안내</p>
          <span className="inline-flex items-center gap-2 text-[13px] text-body">
            <KeyCap>Space</KeyCap> 다름
          </span>
          <span className="inline-flex items-center gap-2 text-[13px] text-body">
            <KeyCap>←</KeyCap> 2번째 전
          </span>
          {round === 1 && (
            <span className="inline-flex items-center gap-2 text-[13px] text-body">
              <KeyCap>→</KeyCap> 3번째 전
            </span>
          )}
        </aside>
      </div>

      {/* 터치/마우스 응답 버튼 */}
      <div
        className={`mx-auto mt-6 grid max-w-lg gap-3 ${
          round === 1 ? "grid-cols-3" : "grid-cols-2"
        }`}
      >
        <AnswerButton
          keyLabel="←"
          label="2번째 전과 같음"
          disabled={!responding}
          onClick={() => submit("left")}
        />
        <AnswerButton
          keyLabel="Space"
          label={round === 0 ? "다름" : "둘 다 다름"}
          disabled={!responding}
          onClick={() => submit("space")}
        />
        {round === 1 && (
          <AnswerButton
            keyLabel="→"
            label="3번째 전과 같음"
            disabled={!responding}
            onClick={() => submit("right")}
          />
        )}
      </div>
    </div>
  );
}

function AnswerButton({
  keyLabel,
  label,
  disabled,
  onClick,
}: {
  keyLabel: string;
  label: string;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="flex flex-col items-center gap-1.5 rounded-xl border border-hairline bg-canvas py-3.5 transition-colors active:bg-surface-soft disabled:opacity-60"
    >
      <KeyCap>{keyLabel}</KeyCap>
      <span className="text-[13px] font-medium text-body">{label}</span>
    </button>
  );
}
