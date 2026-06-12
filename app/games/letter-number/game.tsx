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
import { KeyCap } from "@/components/ui";

/* ───────────────────────── 상수·타입 ───────────────────────── */

const TOTAL = 60; // 총 문항 수
const ITEM_MS = 2500; // 문항당 응답 제한
const GAP_MS = 450; // 피드백 표시 시간
const SWITCH_P = 0.4; // 글자↔숫자 종류 전환 확률

const CONSONANTS = ["ㄱ", "ㄴ", "ㄷ", "ㄹ", "ㅁ", "ㅂ", "ㅅ", "ㅇ"] as const;
const VOWELS = ["ㅏ", "ㅑ", "ㅓ", "ㅕ", "ㅗ", "ㅛ", "ㅜ", "ㅠ"] as const;
const ODDS = ["1", "3", "5", "7", "9"] as const;
const EVENS = ["2", "4", "6", "8"] as const;

type Kind = "letter" | "number";
type Side = "L" | "R";
type Item = {
  kind: Kind;
  text: string;
  /** 정답 방향 — L(자음·홀수) / R(모음·짝수) */
  answer: Side;
  /** 직전 문항과 종류(글자/숫자)가 바뀐 전환 문항인가 */
  isSwitch: boolean;
};
type Rec = { ok: boolean; rt: number | null; isSwitch: boolean };
type Phase = "intro" | "countdown" | "item" | "gap";

function pick<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}

/** 60문항 생성 — 정답 좌우 정확히 30:30, 종류 전환 40% 확률 */
function makeItems(): Item[] {
  // 정답 방향을 정확히 절반씩 만들어 셔플 (좌우 50:50 보장)
  const sides: Side[] = [];
  for (let i = 0; i < TOTAL; i++) sides.push(i < TOTAL / 2 ? "L" : "R");
  for (let i = sides.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [sides[i], sides[j]] = [sides[j], sides[i]];
  }

  const items: Item[] = [];
  let kind: Kind = Math.random() < 0.5 ? "letter" : "number";
  for (let i = 0; i < TOTAL; i++) {
    let isSwitch = false;
    if (i > 0 && Math.random() < SWITCH_P) {
      kind = kind === "letter" ? "number" : "letter";
      isSwitch = true;
    }
    const side = sides[i];
    const text =
      kind === "letter"
        ? side === "L"
          ? pick(CONSONANTS)
          : pick(VOWELS)
        : side === "L"
          ? pick(ODDS)
          : pick(EVENS);
    items.push({ kind, text, answer: side, isSwitch });
  }
  return items;
}

/* ───────────────────────── 게임 본체 ───────────────────────── */

export default function Game() {
  const { finish } = useGameShell();
  const finishedRef = useRef(false);

  // 플레이마다 새 문항 (셸이 runId key 로 리마운트)
  const [items] = useState<Item[]>(() => makeItems());

  const [phase, setPhase] = useState<Phase>("intro");
  const phaseRef = useRef<Phase>("intro");
  const go = (p: Phase) => {
    phaseRef.current = p;
    setPhase(p);
  };

  const [idx, setIdx] = useState(0);
  const idxRef = useRef(0);
  const [flash, setFlash] = useState<boolean | null>(null);
  const [correctCount, setCorrectCount] = useState(0);

  const recsRef = useRef<Rec[]>([]);
  const itemAtRef = useRef(0);

  /* 타이머 */
  const gapT = useRef<ReturnType<typeof setTimeout> | null>(null);
  const clearGapT = () => {
    if (gapT.current !== null) {
      clearTimeout(gapT.current);
      gapT.current = null;
    }
  };
  useEffect(() => clearGapT, []);

  /** 다음 문항 노출 시작 */
  const startItem = () => {
    setFlash(null);
    itemAtRef.current = performance.now();
    go("item");
  };

  const doFinish = () => {
    if (finishedRef.current) return;
    finishedRef.current = true;
    clearGapT();

    const recs = recsRef.current;
    const okN = recs.filter((r) => r.ok).length;
    const acc = okN / TOTAL;

    // 속도점수: 정답 평균 응답 0.5초(만점) ~ 2.0초(0점) 선형
    const rts = recs
      .filter((r) => r.ok && r.rt !== null)
      .map((r) => r.rt as number);
    const avgRt =
      rts.length > 0 ? rts.reduce((a, b) => a + b, 0) / rts.length : null;
    const speed01 = avgRt === null ? 0 : clamp01((2000 - avgRt) / 1500);
    const score = Math.max(0, Math.min(100, Math.round(acc * 80 + speed01 * 20)));

    const sw = recs.filter((r) => r.isSwitch);
    const rp = recs.filter((r) => !r.isSwitch);
    const pct = (part: Rec[]) =>
      part.length > 0
        ? Math.round((part.filter((r) => r.ok).length / part.length) * 100)
        : null;
    const swPct = pct(sw);
    const rpPct = pct(rp);
    const accStat = (part: Rec[], p: number | null) =>
      p === null ? "—" : `${p}% (${part.filter((r) => r.ok).length}/${part.length})`;
    const cost =
      swPct !== null && rpPct !== null
        ? `${swPct - rpPct >= 0 ? "+" : ""}${swPct - rpPct}%p`
        : "—";

    finish({
      score,
      label: `정답 ${okN}/${TOTAL}`,
      detail: [
        { name: "전체 정답률", value: `${Math.round(acc * 100)}% (${okN}/${TOTAL})` },
        { name: "전환 직후 정답률", value: accStat(sw, swPct) },
        { name: "반복 문항 정답률", value: accStat(rp, rpPct) },
        { name: "전환 비용 (switch cost)", value: cost },
        {
          name: "평균 응답시간 (정답)",
          value: avgRt === null ? "—" : `${(avgRt / 1000).toFixed(2)}초`,
        },
      ],
    });
  };

  /** 좌/우 응답 (null = 무응답 → 오답) — 문항 노출 중에만 유효 */
  const answer = (side: Side | null) => {
    if (finishedRef.current || phaseRef.current !== "item") return;
    const item = items[idxRef.current];
    const rt = performance.now() - itemAtRef.current;
    const ok = side !== null && side === item.answer;
    recsRef.current.push({
      ok,
      rt: side === null ? null : rt,
      isSwitch: item.isSwitch,
    });
    if (ok) setCorrectCount((c) => c + 1);
    setFlash(ok);
    go("gap");
    clearGapT();
    gapT.current = setTimeout(() => {
      if (idxRef.current >= TOTAL - 1) {
        doFinish();
      } else {
        idxRef.current += 1;
        setIdx(idxRef.current);
        startItem();
      }
    }, GAP_MS);
  };
  const answerRef = useRef(answer);
  answerRef.current = answer;

  /** 문항당 2.5초 제한 — 만료 시 무응답(오답) 처리 */
  const left = useCountdown(ITEM_MS, phase === "item", () =>
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
        title="글자-숫자 분류"
        lines={[
          `총 ${TOTAL}문항, 문항당 2.5초. 화면 중앙에 글자 1개 또는 숫자 1개가 나타납니다.`,
          "글자면 자음/모음으로, 숫자면 홀수/짝수로 분류하세요.",
          "규칙이 수시로 바뀝니다 — 지금 보이는 게 글자인지 숫자인지부터 확인하세요.",
          "시간 안에 응답하지 않으면 오답 처리됩니다.",
        ]}
        keys={[
          { key: "←", action: "자음 · 홀수" },
          { key: "→", action: "모음 · 짝수" },
        ]}
        onStart={() => go("countdown")}
      />
    );
  }

  if (phase === "countdown") {
    return <Countdown onDone={startItem} />;
  }

  const item = items[idx];
  const isLetter = item.kind === "letter";

  return (
    <div className="min-h-[24rem]">
      <GameHUD left={`문항 ${idx + 1}/${TOTAL}`} right={`정답 ${correctCount}개`} />

      {/* 규칙 안내 상시 고정 */}
      <div className="mb-4 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 rounded-lg border border-hairline bg-surface-card px-4 py-2.5 text-[13px] font-medium text-body">
        <span className="inline-flex items-center gap-1.5">
          <KeyCap>←</KeyCap> 자음 · 홀수
        </span>
        <span className="inline-flex items-center gap-1.5">
          <KeyCap>→</KeyCap> 모음 · 짝수
        </span>
      </div>

      <Flash ok={flash} />

      {/* 제시물 */}
      <div className="mt-2 flex h-48 items-center justify-center rounded-xl border border-hairline bg-canvas">
        <span className="select-none text-7xl font-semibold leading-none text-ink">
          {item.text}
        </span>
      </div>

      <div className="mt-3 h-1.5">
        {phase === "item" && <TimeBar remaining={left} total={ITEM_MS} />}
      </div>

      {/* 응답 버튼 — 현재 제시물 종류에 따라 라벨 전환 */}
      <div className="mt-4 grid grid-cols-2 gap-3 sm:gap-4">
        <ChoiceButton
          disabled={phase !== "item"}
          onPick={() => answerRef.current("L")}
        >
          ← {isLetter ? "자음" : "홀수"}
        </ChoiceButton>
        <ChoiceButton
          disabled={phase !== "item"}
          onPick={() => answerRef.current("R")}
        >
          {isLetter ? "모음" : "짝수"} →
        </ChoiceButton>
      </div>

      <p className="mt-3 text-center text-[13px] text-muted-soft">
        {isLetter ? "글자 — 자음/모음을 고르세요" : "숫자 — 홀수/짝수를 고르세요"}
      </p>
    </div>
  );
}

/* ───────────────────────── 보조 컴포넌트 ───────────────────────── */

/** 좌/우 응답 대형 버튼 (마우스·터치) */
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
