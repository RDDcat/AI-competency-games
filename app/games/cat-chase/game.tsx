"use client";

import { useEffect, useRef, useState } from "react";
import { useGameShell } from "@/components/game-shell";
import { Countdown, GameHUD, RoundIntro, TimeBar } from "@/components/game-ui";

/* ───────────────────────── 도메인 ───────────────────────── */

const GRID = 6;
const CELLS = GRID * GRID;
const TOTAL_ITEMS = 20;
const SHOW_MS = 1500; // 생쥐 노출
const HIDE_MS = 700; // "숨었습니다" 메시지
const ASK_MS = 5000; // 질문 제한시간
const GAP_MS = 450; // 다음 문항 전 간격

/**
 * 8버튼 양극 척도 → p(찾았다) 확률 환산.
 * 왼쪽(놓쳤다·매우확실)부터 오른쪽(찾았다·매우확실)까지.
 */
const P_OF_CHOICE = [0.05, 0.15, 0.3, 0.45, 0.55, 0.7, 0.85, 0.95] as const;
const CONF_LABEL = [
  "매우 확실",
  "확실",
  "조금 확실",
  "불확실",
  "불확실",
  "조금 확실",
  "확실",
  "매우 확실",
] as const;

type Item = {
  mice: number[];
  /** [빨간 칸 고양이, 파란 칸 고양이, 들러리 2마리] 의 칸 인덱스 */
  cats: [number, number, number, number];
  redOnMouse: 0 | 1;
  blueOnMouse: 0 | 1;
};

type Rec = { p: number; outcome: 0 | 1; timeout: boolean; confident: boolean };

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * 문항 생성 — 빨강·파랑 각각 독립적으로 50% 확률로 생쥐 칸 위에 배치한다.
 * 생쥐 4~7 / 비생쥐 29~32 칸이므로 어느 분기든 배치 가능한 칸이 항상 존재한다.
 */
function makeItem(): Item {
  const cells = shuffle(Array.from({ length: CELLS }, (_, i) => i));
  const mouseCount = 4 + Math.floor(Math.random() * 4); // 4~7
  const mice = cells.slice(0, mouseCount);
  const nonMice = cells.slice(mouseCount);
  const used = new Set<number>();
  const pickFrom = (pool: number[]): number => {
    const avail = pool.filter((c) => !used.has(c));
    const c = avail[Math.floor(Math.random() * avail.length)];
    used.add(c);
    return c;
  };
  const redOnMouse = Math.random() < 0.5;
  const red = pickFrom(redOnMouse ? mice : nonMice);
  const blueOnMouse = Math.random() < 0.5;
  const blue = pickFrom(blueOnMouse ? mice : nonMice);
  const all = Array.from({ length: CELLS }, (_, i) => i);
  const d1 = pickFrom(all);
  const d2 = pickFrom(all);
  return {
    mice,
    cats: [red, blue, d1, d2],
    redOnMouse: redOnMouse ? 1 : 0,
    blueOnMouse: blueOnMouse ? 1 : 0,
  };
}

function makeItems(): Item[] {
  return Array.from({ length: TOTAL_ITEMS }, makeItem);
}

/* ───────────────────────── 컴포넌트 ───────────────────────── */

type Phase = "intro" | "countdown" | "show" | "hide" | "askRed" | "askBlue" | "gap";

export default function Game() {
  const { finish } = useGameShell();

  const [items] = useState<Item[]>(() => makeItems());
  const [phase, setPhase] = useState<Phase>("intro");
  const [qIndex, setQIndex] = useState(0);
  const [remaining, setRemaining] = useState(ASK_MS);

  // setPhase 와 동기화되는 즉시 반영 미러 — 타임아웃/클릭 동시 발생 시 이중 기록 방지
  const stageRef = useRef<Phase>("intro");
  const qIndexRef = useRef(0);
  qIndexRef.current = qIndex;
  const recsRef = useRef<Rec[]>([]);
  const finishedRef = useRef(false);

  const go = (p: Phase) => {
    stageRef.current = p;
    setPhase(p);
  };

  const endGame = () => {
    if (finishedRef.current) return;
    finishedRef.current = true;
    const recs = recsRef.current;
    const n = Math.max(1, recs.length);
    const brier = recs.reduce((a, r) => a + (r.p - r.outcome) ** 2, 0) / n;
    const score = Math.max(0, Math.min(100, Math.round(100 * (1 - 2 * brier))));
    const dirHits = recs.filter(
      (r) => (r.p > 0.5 && r.outcome === 1) || (r.p < 0.5 && r.outcome === 0),
    ).length;
    const conf = recs.filter((r) => r.confident);
    const confHits = conf.filter((r) => (r.p > 0.5) === (r.outcome === 1)).length;
    const timeouts = recs.filter((r) => r.timeout).length;
    finish({
      score,
      label: `방향 적중 ${dirHits}/${recs.length}`,
      detail: [
        {
          name: "정답 방향 적중률",
          value: `${dirHits}/${recs.length} (${Math.round((dirHits / n) * 100)}%)`,
        },
        {
          name: "'확실' 이상 응답의 실제 적중률",
          value:
            conf.length > 0
              ? `${confHits}/${conf.length} (${Math.round((confHits / conf.length) * 100)}%)`
              : "'확실' 이상 응답 없음",
        },
        { name: "시간 초과", value: `${timeouts}회` },
        { name: "Brier 점수 (낮을수록 정직한 확신)", value: brier.toFixed(3) },
      ],
    });
  };

  /** 응답 기록 — choice null 은 시간 초과(중립 0.5 처리) */
  const record = (choice: number | null) => {
    const st = stageRef.current;
    if (st !== "askRed" && st !== "askBlue") return;
    const item = items[qIndexRef.current];
    const outcome: 0 | 1 = st === "askRed" ? item.redOnMouse : item.blueOnMouse;
    const p = choice === null ? 0.5 : P_OF_CHOICE[choice];
    recsRef.current.push({
      p,
      outcome,
      timeout: choice === null,
      confident: choice !== null && (choice <= 1 || choice >= 6),
    });
    if (st === "askRed") {
      go("askBlue");
    } else {
      const next = qIndexRef.current + 1;
      if (next >= TOTAL_ITEMS) {
        go("gap");
        endGame();
      } else {
        setQIndex(next);
        go("gap");
      }
    }
  };
  const recordRef = useRef(record);
  recordRef.current = record;

  /* 노출/숨김/간격 타이머 */
  useEffect(() => {
    if (phase === "show") {
      const t = window.setTimeout(() => go("hide"), SHOW_MS);
      return () => window.clearTimeout(t);
    }
    if (phase === "hide") {
      const t = window.setTimeout(() => go("askRed"), HIDE_MS);
      return () => window.clearTimeout(t);
    }
    if (phase === "gap" && !finishedRef.current) {
      const t = window.setTimeout(() => go("show"), GAP_MS);
      return () => window.clearTimeout(t);
    }
  }, [phase, qIndex]);

  /* 질문 제한시간 — phase/qIndex 가 바뀔 때마다 리셋 */
  useEffect(() => {
    if (phase !== "askRed" && phase !== "askBlue") return;
    const ph = phase; // 이 인터벌이 담당하는 질문 단계
    setRemaining(ASK_MS);
    const startedAt = Date.now();
    const id = window.setInterval(() => {
      const left = ASK_MS - (Date.now() - startedAt);
      if (left <= 0) {
        window.clearInterval(id);
        setRemaining(0);
        // 마지막 순간 클릭으로 이미 다음 질문(askBlue)으로 넘어간 뒤
        // stale 인터벌이 다음 질문을 시간초과로 오기록하는 레이스 방지:
        // 이 인터벌이 만들어진 단계가 아직 진행 중일 때만 시간초과 처리.
        if (stageRef.current === ph) recordRef.current(null);
      } else {
        setRemaining(left);
      }
    }, 50);
    return () => window.clearInterval(id);
  }, [phase, qIndex]);

  /* 키보드 1~8 */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat) return;
      const st = stageRef.current;
      if (st !== "askRed" && st !== "askBlue") return;
      if (e.key >= "1" && e.key <= "8") {
        e.preventDefault();
        recordRef.current(Number(e.key) - 1);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  /* ───────── 렌더 ───────── */

  if (phase === "intro") {
    return (
      <RoundIntro
        title="고양이 술래잡기 — 순간기억 × 확신도"
        lines={[
          "6×6 격자에 생쥐 🐭 4~7마리가 1.5초만 나타났다가 숨습니다.",
          "이어서 고양이 🐱 4마리가 등장합니다 — 빨간 칸·파란 칸 위의 고양이가 질문 대상입니다.",
          "“그 칸에 생쥐가 있었을까?” 를 8단계 확신도로 답하세요. 질문당 5초, 항상 빨간 칸 먼저.",
          "채점 방식: 정답률보다 확신도의 정직함이 점수입니다. 모르면 '불확실', 확실할 때만 '확실'을 누르세요.",
          "근거 없이 '매우 확실'을 남발하면 점수가 폭락합니다. 총 20문항 × 2질문 = 40응답.",
        ]}
        keys={[
          { key: "1~4", action: "놓쳤다 (매우 확실 → 불확실)" },
          { key: "5~8", action: "찾았다 (불확실 → 매우 확실)" },
        ]}
        startLabel="시작하기"
        onStart={() => go("countdown")}
      />
    );
  }

  if (phase === "countdown") {
    return <Countdown onDone={() => go("show")} />;
  }

  const item = items[Math.min(qIndex, TOTAL_ITEMS - 1)];
  const miceSet = new Set(item.mice);
  const [redCell, blueCell, d1, d2] = item.cats;
  const catSet = new Set([redCell, blueCell, d1, d2]);
  const asking = phase === "askRed" || phase === "askBlue";
  const showMice = phase === "show";
  const showCats = asking;

  const status =
    phase === "show"
      ? "생쥐 위치를 기억하세요!"
      : phase === "hide"
        ? "생쥐들이 숨었습니다 🫥"
        : asking
          ? "고양이 4마리 등장 — 색 테두리 칸에 주목"
          : "다음 문항…";

  return (
    <div className="min-h-[24rem]">
      <GameHUD
        left={
          <span>
            문항 {Math.min(qIndex + 1, TOTAL_ITEMS)}/{TOTAL_ITEMS}
            {asking && (
              <span className="ml-2">
                · {phase === "askRed" ? "🔴 빨간 칸 질문" : "🔵 파란 칸 질문"}
              </span>
            )}
          </span>
        }
        right={asking ? `${(remaining / 1000).toFixed(1)}초` : ""}
      />

      {/* 상태 메시지 — 고정 높이로 레이아웃 점프 방지 */}
      <p className="mb-3 h-6 text-center text-[15px] font-medium text-body">{status}</p>

      {/* 6×6 격자 */}
      <div className="flex justify-center">
        <div className="grid grid-cols-6 gap-1.5 rounded-xl border border-hairline bg-canvas p-3">
          {Array.from({ length: CELLS }, (_, i) => {
            const isRed = i === redCell;
            const isBlue = i === blueCell;
            const active =
              (phase === "askRed" && isRed) || (phase === "askBlue" && isBlue);
            const border = isRed
              ? "border-2 border-red-500"
              : isBlue
                ? "border-2 border-blue-500"
                : "border border-hairline";
            return (
              <div
                key={i}
                className={`flex h-10 w-10 items-center justify-center rounded-md bg-surface-card text-xl sm:h-12 sm:w-12 ${border} ${
                  active ? (isRed ? "ring-2 ring-red-200" : "ring-2 ring-blue-200") : ""
                }`}
              >
                {showMice && miceSet.has(i) && <span>🐭</span>}
                {showCats && catSet.has(i) && <span>🐱</span>}
              </div>
            );
          })}
        </div>
      </div>

      {/* 질문 + 8버튼 척도 — 비질문 단계에서는 투명 처리로 높이 유지 */}
      <div
        className={`mx-auto mt-5 max-w-xl transition-opacity duration-150 ${
          asking ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
      >
        <TimeBar remaining={asking ? remaining : ASK_MS} total={ASK_MS} />
        <p className="mt-3 text-center text-[15px] text-body">
          {phase === "askBlue" ? (
            <>
              <span className="font-semibold text-blue-600">파란 칸</span>의 고양이는
              생쥐를 찾았을까요?
            </>
          ) : (
            <>
              <span className="font-semibold text-red-600">빨간 칸</span>의 고양이는
              생쥐를 찾았을까요?
            </>
          )}
        </p>
        <div className="mt-3 mb-1.5 flex justify-between text-[13px] font-medium">
          <span className="text-error">← 놓쳤다</span>
          <span className="text-success">찾았다 →</span>
        </div>
        <div className="grid grid-cols-4 gap-1.5 sm:grid-cols-8">
          {P_OF_CHOICE.map((_, i) => (
            <button
              key={i}
              type="button"
              onClick={() => record(i)}
              disabled={!asking}
              className="flex flex-col items-center gap-0.5 rounded-lg border border-hairline bg-canvas px-1 py-2 transition-colors hover:bg-surface-soft active:bg-surface-card"
            >
              <span className="text-[11px] tabular-nums text-muted">{i + 1}</span>
              <span
                className={`text-[12px] font-medium ${i <= 3 ? "text-error" : "text-success"}`}
              >
                {CONF_LABEL[i]}
              </span>
            </button>
          ))}
        </div>
        <p className="mt-2 text-center text-[12px] text-muted">
          5초 초과 시 '불확실' 중립으로 처리됩니다
        </p>
      </div>
    </div>
  );
}
