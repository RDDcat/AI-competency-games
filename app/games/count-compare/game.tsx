"use client";

import { useEffect, useRef, useState } from "react";
import { useGameShell } from "@/components/game-shell";
import { Countdown, GameHUD, RoundIntro, TimeBar, useCountdown } from "@/components/game-ui";
import {
  makeQuestions,
  TOTAL,
  ZONE_H,
  ZONE_W,
  type PlacedWord,
  type Question,
} from "./gen";

/* ───────────────────────── 상수·타입 ───────────────────────── */

const SHOW_MS = 1000; // 단어 노출 시간
const ANSWER_MS = 3000; // 가림 후 응답 제한
const GAP_MS = 600; // 피드백 표시 시간

type Phase = "intro" | "countdown" | "show" | "mask" | "gap";
type Verdict = "ok" | "bad" | "timeout" | null;
type Rec = { ok: boolean; rt: number | null; band: 0 | 1 | 2; timeout: boolean };
type TimerRef = { current: ReturnType<typeof setTimeout> | null };

const BAND_LABEL = ["쉬움", "중간", "어려움"] as const;

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}

/* ───────────────────────── 게임 본체 ───────────────────────── */

export default function Game() {
  const { finish } = useGameShell();
  const finishedRef = useRef(false);

  // 플레이마다 새 문항 (셸이 runId key 로 리마운트)
  const [questions] = useState<Question[]>(() => makeQuestions());

  const [phase, setPhase] = useState<Phase>("intro");
  const phaseRef = useRef<Phase>("intro");
  const go = (p: Phase) => {
    phaseRef.current = p;
    setPhase(p);
  };

  const [idx, setIdx] = useState(0);
  const idxRef = useRef(0);
  const [verdict, setVerdict] = useState<Verdict>(null);
  const [correctCount, setCorrectCount] = useState(0);

  const recsRef = useRef<Rec[]>([]);
  const maskAtRef = useRef(0);

  /* 타이머 */
  const showT = useRef<ReturnType<typeof setTimeout> | null>(null);
  const gapT = useRef<ReturnType<typeof setTimeout> | null>(null);
  const clearT = (r: TimerRef) => {
    if (r.current !== null) {
      clearTimeout(r.current);
      r.current = null;
    }
  };
  useEffect(() => {
    return () => {
      clearT(showT);
      clearT(gapT);
    };
  }, []);

  /** 현재 문항 노출 시작 → 1초 뒤 가림 */
  const startShow = () => {
    setVerdict(null);
    go("show");
    clearT(showT);
    showT.current = setTimeout(() => {
      maskAtRef.current = performance.now();
      go("mask");
    }, SHOW_MS);
  };

  const doFinish = () => {
    if (finishedRef.current) return;
    finishedRef.current = true;
    clearT(showT);
    clearT(gapT);

    const recs = recsRef.current;
    const okN = recs.filter((r) => r.ok).length;
    const acc = okN / TOTAL;
    // 속도점수: 정답 평균 응답 0.6초(만점) ~ 2.5초(0점) 선형
    const rts = recs.filter((r) => r.ok && r.rt !== null).map((r) => r.rt as number);
    const avgRt = rts.length > 0 ? rts.reduce((a, b) => a + b, 0) / rts.length : null;
    const speed01 = avgRt === null ? 0 : clamp01((2500 - avgRt) / 1900);
    const score = Math.max(0, Math.min(100, Math.round(acc * 85 + speed01 * 15)));

    const bandStat = (b: 0 | 1 | 2) => {
      const rs = recs.filter((r) => r.band === b);
      return `${rs.filter((r) => r.ok).length}/${rs.length}`;
    };
    const timeouts = recs.filter((r) => r.timeout).length;

    finish({
      score,
      label: `정답 ${okN}/${TOTAL}`,
      detail: [
        { name: "쉬움 구간 (1~15) 정답률", value: bandStat(0) },
        { name: "중간 구간 (16~32) 정답률", value: bandStat(1) },
        { name: "어려움 구간 (33~46) 정답률", value: bandStat(2) },
        {
          name: "평균 응답시간 (정답)",
          value: avgRt === null ? "—" : `${(avgRt / 1000).toFixed(2)}초`,
        },
        { name: "시간 초과", value: `${timeouts}회` },
      ],
    });
  };

  /** 좌/우 선택 (null = 시간 초과) — 가림 단계에서만 유효 */
  const answer = (side: "L" | "R" | null) => {
    if (finishedRef.current || phaseRef.current !== "mask") return;
    const q = questions[idxRef.current];
    const rt = performance.now() - maskAtRef.current;
    const ok = side !== null && side === q.more;
    recsRef.current.push({
      ok,
      rt: side === null ? null : rt,
      band: q.band,
      timeout: side === null,
    });
    if (ok) setCorrectCount((c) => c + 1);
    setVerdict(side === null ? "timeout" : ok ? "ok" : "bad");
    go("gap");
    clearT(gapT);
    gapT.current = setTimeout(() => {
      if (idxRef.current >= TOTAL - 1) {
        doFinish();
      } else {
        idxRef.current += 1;
        setIdx(idxRef.current);
        startShow();
      }
    }, GAP_MS);
  };
  const answerRef = useRef(answer);
  answerRef.current = answer;

  /** 가림 후 3초 응답 카운트다운 — 만료 시 시간 초과 처리 */
  const maskLeft = useCountdown(ANSWER_MS, phase === "mask", () =>
    answerRef.current(null),
  );

  /* 키보드: ← / → */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat) return;
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        answerRef.current("L");
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        answerRef.current("R");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  /* ───────────────────────── 렌더 ───────────────────────── */

  if (phase === "intro") {
    return (
      <RoundIntro
        title="개수 비교하기"
        lines={[
          `총 ${TOTAL}문항. 좌·우 구역에 단어들이 1초만 보였다가 가려집니다.`,
          "가려진 뒤 3초 안에 단어가 더 많았던 쪽을 고르세요.",
          "글자 크기는 함정 — 크기가 아니라 개수로 판단하세요.",
          "뒤로 갈수록 양쪽 개수 차이가 줄어 어려워집니다.",
        ]}
        keys={[
          { key: "←", action: "왼쪽이 많다" },
          { key: "→", action: "오른쪽이 많다" },
        ]}
        onStart={() => go("countdown")}
      />
    );
  }

  if (phase === "countdown") {
    return <Countdown onDone={startShow} />;
  }

  const q = questions[idx];
  const masked = phase !== "show";

  return (
    <div className="min-h-[24rem]">
      <GameHUD
        left={`문항 ${idx + 1}/${TOTAL} · ${BAND_LABEL[q.band]}`}
        right={`정답 ${correctCount}개`}
      />
      <VerdictLine v={verdict} />
      <div className="grid grid-cols-2 gap-3 sm:gap-4">
        <Zone words={q.left} text={q.leftText} masked={masked} />
        <Zone words={q.right} text={q.rightText} masked={masked} />
      </div>
      <div className="mt-3 h-1.5">
        {phase === "mask" && <TimeBar remaining={maskLeft} total={ANSWER_MS} />}
      </div>
      <div className="mt-4 grid grid-cols-2 gap-3 sm:gap-4">
        <ChoiceButton
          disabled={phase !== "mask"}
          onPick={() => answerRef.current("L")}
        >
          ← 왼쪽이 많다
        </ChoiceButton>
        <ChoiceButton
          disabled={phase !== "mask"}
          onPick={() => answerRef.current("R")}
        >
          오른쪽이 많다 →
        </ChoiceButton>
      </div>
      <p className="mt-3 text-center text-[13px] text-muted-soft">
        {phase === "show"
          ? "단어 개수를 어림하세요"
          : phase === "mask"
            ? "어느 쪽이 더 많았나요?"
            : " "}
      </p>
    </div>
  );
}

/* ───────────────────────── 보조 컴포넌트 ───────────────────────── */

/** 판정 피드백 한 줄 — 높이 고정으로 레이아웃 점프 방지 */
function VerdictLine({ v }: { v: Verdict }) {
  return (
    <div className="mb-3 flex h-6 items-center justify-center text-sm font-semibold">
      {v === "ok" && <span className="text-success">정답!</span>}
      {v === "bad" && <span className="text-error">오답</span>}
      {v === "timeout" && <span className="text-error">시간 초과</span>}
    </div>
  );
}

/** 단어가 흩뿌려진 구역 — masked 면 회색 마스크로 가림 */
function Zone({
  words,
  text,
  masked,
}: {
  words: PlacedWord[];
  text: string;
  masked: boolean;
}) {
  return (
    <div className="relative h-[320px] overflow-hidden rounded-xl border border-hairline bg-canvas">
      {words.map((w, i) => (
        <span
          key={i}
          className="absolute select-none whitespace-nowrap font-semibold leading-none text-ink"
          style={{
            left: `${(w.x / ZONE_W) * 100}%`,
            top: `${(w.y / ZONE_H) * 100}%`,
            fontSize: `${w.size}px`,
          }}
        >
          {text}
        </span>
      ))}
      {masked && (
        <div className="absolute inset-0 flex items-center justify-center bg-surface-strong">
          <span className="text-2xl font-semibold text-muted">?</span>
        </div>
      )}
    </div>
  );
}

/** 좌/우 선택 대형 버튼 (마우스·터치) */
function ChoiceButton({
  disabled,
  onPick,
  children,
}: {
  disabled: boolean;
  onPick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      tabIndex={-1}
      disabled={disabled}
      onPointerDown={onPick}
      className="flex h-14 select-none items-center justify-center rounded-lg border border-hairline bg-surface-card text-base font-semibold text-ink transition-colors enabled:active:bg-surface-strong disabled:opacity-40"
    >
      {children}
    </button>
  );
}
