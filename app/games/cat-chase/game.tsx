"use client";

import { Fragment, useEffect, useRef, useState } from "react";
import { useGameShell } from "@/components/game-shell";
import { Countdown, GameHUD, RoundIntro, TimeBar } from "@/components/game-ui";

/* ───────────────────────── 도메인 ───────────────────────── */

const GRID = 6;
const CELLS = GRID * GRID;
const TOTAL_ITEMS = 20;
const SHOW_MS = 1500; // 1장면: 생쥐만 노출 (색 테두리 없음)
const HIDE_MS = 700; // "숨었습니다" 메시지
const CATS_MS = 2000; // 2장면: 고양이 + 빨강·파랑 테두리 노출
const ASK_MS = 5000; // 질문 제한시간 (판이 사라진 상태)
const GAP_MS = 450; // 다음 문항 전 간격

/**
 * 난이도 단계 — 실제 시험처럼 몇 문항마다 쥐·고양이 마리 수가 늘어난다.
 * 0단계에서 시작해 STAGE_SIZE 문항마다 한 칸씩, MAX_STAGE 에서 멈춘다.
 *
 * 쥐 4→16 사다리는 실제 시험을 관찰해 재구현한 사례를 따랐고,
 * 고양이 증가폭(4→10)은 출처가 없어 더 완만하게 잡았다 —
 * 고양이는 빨강·파랑 위치까지 외워야 하는 대상이라 같은 기울기면 금세 불가능해진다.
 */
const STAGE_SIZE = 3; // 3문항마다 한 단계
const MAX_STAGE = 6; // 0~6, 총 7단계
const MICE_BASE = 4;
const MICE_STEP = 2; // 4 → 16
const CATS_BASE = 4;
const CATS_STEP = 1; // 4 → 10

/** 문항 인덱스(0-base) → 난이도 단계 */
function stageOf(index: number): number {
  return Math.min(MAX_STAGE, Math.floor(index / STAGE_SIZE));
}

const miceAt = (stage: number) => MICE_BASE + MICE_STEP * stage;
const catsAt = (stage: number) => CATS_BASE + CATS_STEP * stage;

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

/**
 * 확신이 강한 양 끝일수록 큰 원 — 척도의 세기를 크기로 읽게 한다.
 * 8열이 한 줄에 들어가야 하므로 뷰포트별로 지름을 낮춘다(320px 기기까지 겹침 없음).
 */
const CIRCLE_SIZE = [
  "h-7 w-7 min-[360px]:h-8 min-[360px]:w-8 sm:h-14 sm:w-14",
  "h-6 w-6 min-[360px]:h-7 min-[360px]:w-7 sm:h-12 sm:w-12",
  "h-5 w-5 min-[360px]:h-6 min-[360px]:w-6 sm:h-10 sm:w-10",
  "h-4 w-4 min-[360px]:h-5 min-[360px]:w-5 sm:h-9 sm:w-9",
  "h-4 w-4 min-[360px]:h-5 min-[360px]:w-5 sm:h-9 sm:w-9",
  "h-5 w-5 min-[360px]:h-6 min-[360px]:w-6 sm:h-10 sm:w-10",
  "h-6 w-6 min-[360px]:h-7 min-[360px]:w-7 sm:h-12 sm:w-12",
  "h-7 w-7 min-[360px]:h-8 min-[360px]:w-8 sm:h-14 sm:w-14",
] as const;

/** 가장 큰 원과 같은 높이 — 원 행의 기준선 고정용 */
const CIRCLE_ROW_H = "h-7 min-[360px]:h-8 sm:h-14";

type Item = {
  mice: number[];
  /** [빨간 테두리, 파란 테두리, 들러리…] 의 칸 인덱스 — 길이는 난이도에 따라 늘어난다 */
  cats: number[];
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
 * 이 50% 는 난이도와 무관하게 고정이다: 정답의 사전확률이 흔들리면
 * Brier 채점(캘리브레이션)이 왜곡되기 때문이다.
 *
 * 최고 단계에서도 쥐 16 / 비쥐 20 / 고양이 10 이라 어느 분기든 남는 칸이 있다.
 */
function makeItem(stage: number): Item {
  const cells = shuffle(Array.from({ length: CELLS }, (_, i) => i));
  const mice = cells.slice(0, miceAt(stage));
  const nonMice = cells.slice(miceAt(stage));
  const used = new Set<number>();
  const all = Array.from({ length: CELLS }, (_, i) => i);
  const pickFrom = (pool: number[]): number => {
    const avail = pool.filter((c) => !used.has(c));
    // 상수를 더 키워도 undefined 칸이 나오지 않도록 — 현재 값에서는 닿지 않는 분기
    const from = avail.length > 0 ? avail : all.filter((c) => !used.has(c));
    const c = from[Math.floor(Math.random() * from.length)];
    used.add(c);
    return c;
  };
  const redOnMouse = Math.random() < 0.5;
  const red = pickFrom(redOnMouse ? mice : nonMice);
  const blueOnMouse = Math.random() < 0.5;
  const blue = pickFrom(blueOnMouse ? mice : nonMice);
  const decoys = Array.from({ length: catsAt(stage) - 2 }, () => pickFrom(all));
  return {
    mice,
    cats: [red, blue, ...decoys],
    redOnMouse: redOnMouse ? 1 : 0,
    blueOnMouse: blueOnMouse ? 1 : 0,
  };
}

function makeItems(): Item[] {
  return Array.from({ length: TOTAL_ITEMS }, (_, i) => makeItem(stageOf(i)));
}

/* ───────────────────────── 컴포넌트 ───────────────────────── */

/**
 * 문항 진행 3장면:
 *  show  → 생쥐만 보인다 (고양이·색 테두리 없음 — 위치 암기 구간)
 *  cats  → 생쥐는 숨고 고양이 4마리 등장, 그중 둘에 빨강·파랑 테두리
 *  ask*  → 판이 통째로 사라지고 질문 대상 고양이 한 마리만 중앙에 뜬다
 */
type Phase =
  | "intro"
  | "countdown"
  | "show"
  | "hide"
  | "cats"
  | "askRed"
  | "askBlue"
  | "gap";

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
      const t = window.setTimeout(() => go("cats"), HIDE_MS);
      return () => window.clearTimeout(t);
    }
    if (phase === "cats") {
      const t = window.setTimeout(() => go("askRed"), CATS_MS);
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
          "① 6×6 격자에 생쥐 🐭 들이 1.5초만 나타났다가 숨습니다.",
          "② 이어서 고양이 🐱 들이 등장합니다 — 빨간 테두리·파란 테두리 고양이의 위치까지 함께 기억하세요.",
          "③ 판이 사라지고 질문 대상 고양이만 중앙에 뜹니다. “이 고양이가 생쥐를 찾았을까?” 를 8단계 확신도로 답하세요. 질문당 5초, 항상 빨강 먼저.",
          "채점 방식: 정답률보다 확신도의 정직함이 점수입니다. 모르면 '불확실', 확실할 때만 '확실'을 누르세요.",
          "3문항마다 난이도가 오릅니다 — 생쥐 4마리로 시작해 16마리까지, 고양이도 함께 늘어납니다.",
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
  const [redCell, blueCell] = item.cats;
  const catSet = new Set(item.cats);
  const asking = phase === "askRed" || phase === "askBlue";
  const showMice = phase === "show";
  const showCats = phase === "cats";

  const status =
    phase === "show"
      ? "생쥐 위치를 기억하세요!"
      : phase === "hide"
        ? "생쥐들이 숨었습니다 🫥"
        : phase === "cats"
          ? "고양이 4마리 등장 — 🔴 빨강 · 🔵 파랑 위치를 기억하세요"
          : asking
            ? "판이 사라졌습니다 — 기억으로 답하세요"
            : "다음 문항…";

  return (
    <div className="min-h-[24rem]">
      <GameHUD
        left={
          <span>
            문항 {Math.min(qIndex + 1, TOTAL_ITEMS)}/{TOTAL_ITEMS}
            {asking && (
              <span className="ml-2">
                · {phase === "askRed" ? "🔴 빨간 고양이 질문" : "🔵 파란 고양이 질문"}
              </span>
            )}
          </span>
        }
        right={asking ? `${(remaining / 1000).toFixed(1)}초` : ""}
      />

      {/* 상태 메시지 — 고정 높이로 레이아웃 점프 방지 */}
      <p className="mb-3 h-6 text-center text-[15px] font-medium text-body">{status}</p>

      {/*
        판 영역 — 높이를 고정해 격자 ↔ 중앙 고양이 전환 시 레이아웃 점프를 막는다.
        색 테두리는 'cats' 장면부터만 존재한다: 생쥐 노출 중에 보이면 어느 칸을 물을지
        미리 알게 되어 기억 과제가 무너진다.
      */}
      <div className="flex min-h-74 items-center justify-center sm:min-h-86">
        {asking ? (
          <div className="flex flex-col items-center gap-3">
            <div
              className={`cat-float flex h-24 w-24 items-center justify-center rounded-2xl bg-surface-card text-5xl shadow-elevated sm:h-28 sm:w-28 sm:text-6xl ${
                phase === "askRed"
                  ? "border-4 border-red-500 ring-4 ring-red-100"
                  : "border-4 border-blue-500 ring-4 ring-blue-100"
              }`}
            >
              🐱
            </div>
            <span
              className={`text-[13px] font-semibold ${
                phase === "askRed" ? "text-red-600" : "text-blue-600"
              }`}
            >
              {phase === "askRed" ? "빨간 테두리 고양이" : "파란 테두리 고양이"}
            </span>
          </div>
        ) : (
          <div className="grid grid-cols-6 gap-1.5 rounded-xl border border-hairline bg-canvas p-3">
            {Array.from({ length: CELLS }, (_, i) => {
              const border =
                showCats && i === redCell
                  ? "border-2 border-red-500"
                  : showCats && i === blueCell
                    ? "border-2 border-blue-500"
                    : "border border-hairline";
              return (
                <div
                  key={i}
                  className={`flex h-10 w-10 items-center justify-center rounded-md bg-surface-card text-xl sm:h-12 sm:w-12 ${border}`}
                >
                  {showMice && miceSet.has(i) && <span>🐭</span>}
                  {showCats && catSet.has(i) && <span>🐱</span>}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 질문 + 8단계 원형 척도 — 비질문 단계에서는 투명 처리로 높이 유지 */}
      <div
        className={`mx-auto mt-5 max-w-xl transition-opacity duration-150 ${
          asking ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
      >
        <TimeBar remaining={asking ? remaining : ASK_MS} total={ASK_MS} />
        <p className="mt-3 text-center text-[15px] text-body">
          {phase === "askBlue" ? (
            <>
              <span className="font-semibold text-blue-600">파란 테두리</span> 고양이가
              서 있던 칸에 생쥐가 있었을까요?
            </>
          ) : (
            <>
              <span className="font-semibold text-red-600">빨간 테두리</span> 고양이가 서
              있던 칸에 생쥐가 있었을까요?
            </>
          )}
        </p>
        <div className="mt-3 mb-1.5 flex justify-between text-[13px] font-medium">
          <span className="text-error">← 놓쳤다</span>
          <span className="text-brand-deep">찾았다 →</span>
        </div>
        {/* 양극 척도 — 원형 선택지, 확신이 강한 양 끝일수록 원이 커진다 */}
        <div className="mt-4 flex items-start justify-center gap-0.5 sm:gap-2">
          {P_OF_CHOICE.map((_, i) => {
            const negative = i <= 3;
            return (
              <Fragment key={i}>
                {i === 4 && (
                  <span
                    aria-hidden
                    className={`w-px flex-none self-start bg-hairline ${CIRCLE_ROW_H}`}
                  />
                )}
                <button
                  type="button"
                  onClick={() => record(i)}
                  disabled={!asking}
                  aria-label={`${negative ? "놓쳤다" : "찾았다"} · ${CONF_LABEL[i]}`}
                  className="group flex max-w-16 min-w-0 flex-1 basis-0 flex-col items-center gap-1.5"
                >
                  {/* 크기가 달라도 라벨 기준선이 흔들리지 않도록 원은 고정 높이 안에서 중앙 정렬 */}
                  <span className={`flex items-center ${CIRCLE_ROW_H}`}>
                    <span
                      className={`flex flex-none items-center justify-center rounded-full bg-surface-strong transition-colors ${CIRCLE_SIZE[i]} ${
                        negative
                          ? "group-hover:bg-error group-active:bg-error"
                          : "group-hover:bg-brand group-active:bg-brand"
                      }`}
                    >
                      <span className="h-3/5 w-3/5 rounded-full bg-canvas" />
                    </span>
                  </span>
                  <span
                    className={`text-center text-[10px] leading-tight font-medium break-keep sm:text-[11px] ${
                      negative ? "text-error" : "text-brand-deep"
                    }`}
                  >
                    {CONF_LABEL[i]}
                  </span>
                  <span className="hidden text-[10px] tabular-nums text-muted-soft sm:block">
                    {i + 1}
                  </span>
                </button>
              </Fragment>
            );
          })}
        </div>
        <p className="mt-2 text-center text-[12px] text-muted">
          5초 초과 시 '불확실' 중립으로 처리됩니다
        </p>
      </div>
    </div>
  );
}
