"use client";

import { useEffect, useRef, useState } from "react";
import { useGameShell } from "@/components/game-shell";
import {
  Countdown,
  Flash,
  GameHUD,
  RoundIntro,
  formatSec,
  useCountdown,
} from "@/components/game-ui";
import { Button } from "@/components/ui";
import {
  ID,
  OPS,
  composeSeq,
  cssTransform,
  makeProblem,
  solvePath,
  stEq,
  type Cell,
  type Op,
  type Problem,
  type Shape,
  type St,
} from "./logic";

/* ───────────────────────── 상수 ───────────────────────── */

const ROUND_MS = 180_000; // 라운드당 3분
const FLASH_MS = 450;
const MAX_STEPS = 8;
const TARGET_SOLVED = 12; // 이 개수 이상 정답이면 정답 점수 만점

const OP_ICON: Record<Op, string> = {
  rotL: "↺",
  rotR: "↻",
  flipH: "⇋",
  flipV: "⇵",
};
const OP_NAME: Record<Op, string> = {
  rotL: "왼쪽 45°",
  rotR: "오른쪽 45°",
  flipH: "좌우반전",
  flipV: "상하반전",
};

const KEY_HELP = [
  { key: "← / Z", action: "왼쪽 45°" },
  { key: "→ / X", action: "오른쪽 45°" },
  { key: "C", action: "좌우반전" },
  { key: "V", action: "상하반전" },
  { key: "⌫", action: "하나 지움" },
  { key: "Enter", action: "제출" },
];

const ROUND_INTRO: Record<1 | 2, { title: string; lines: string[] }> = {
  1: {
    title: "1라운드 — 알파벳 (1~3단계 변환)",
    lines: [
      "왼쪽 ‘전’ 도형을 오른쪽 ‘후’ 모양으로 만드는 변환 순서를 입력하세요.",
      "버튼을 눌러도 변환된 모습은 절대 미리 보여주지 않습니다 — 머릿속으로만 추적!",
      "제출하면 정답·오답에 상관없이 다음 문제로 넘어갑니다 — 실수에 매달리지 말고 다음 문제를 푸세요.",
      "제한시간 3분 · 문제 수 무제한 · 입력 최대 8단계",
      "적게 입력해 맞힐수록 효율 점수가 높습니다.",
    ],
  },
  2: {
    title: "2라운드 — 타일 패턴 (2~4단계 변환)",
    lines: [
      "이번에는 타일 패턴입니다. 변환이 2~4단계로 깊어집니다.",
      "45° 홀수 회전이 섞이면 타일이 마름모로 기울어집니다 — 45°와 90°를 혼동하지 마세요.",
      "회전만으로 되는지, 반전(거울상)이 필요한지부터 판별하고 시작하세요.",
      "제한시간 3분 · 문제 수 무제한 · 입력 최대 8단계",
    ],
  },
};

type Phase = "intro" | "countdown" | "play";
type Rec = { round: 1 | 2; par: number; steps: number };
/** 자세히 보기용 — 문제별 제출 기록 (정답·오답 모두) */
type Attempt = {
  round: 1 | 2;
  shape: Shape;
  target: St;
  userSeq: Op[];
  ok: boolean;
};

/* ───────────────────────── 컴포넌트 ───────────────────────── */

export default function Game() {
  const { finish } = useGameShell();

  const [phase, setPhase] = useState<Phase>("intro");
  const [round, setRound] = useState<1 | 2>(1);
  const [problem, setProblem] = useState<Problem>(() => makeProblem(1));
  const [seq, setSeq] = useState<Op[]>([]);
  const [flashOk, setFlashOk] = useState<boolean | null>(null);
  const [locked, setLocked] = useState(false);
  const [correctCount, setCorrectCount] = useState(0);
  const [wrongCount, setWrongCount] = useState(0);

  /* 이벤트 핸들러에서 최신값을 읽기 위한 렌더 동기화 ref */
  const phaseRef = useRef(phase);
  phaseRef.current = phase;
  const roundRef = useRef(round);
  roundRef.current = round;
  const problemRef = useRef(problem);
  problemRef.current = problem;
  const seqRef = useRef(seq);
  seqRef.current = seq;
  const lockedRef = useRef(locked);
  lockedRef.current = locked;

  const recsRef = useRef<Rec[]>([]); // 정답 문항 기록 (점수용)
  const attemptsRef = useRef<Attempt[]>([]); // 전체 제출 기록 (자세히 보기용)
  const wrongTotalRef = useRef(0); // 오답 제출이 있었던 문제 수
  const wrongFlaggedRef = useRef(false); // 현재 문제에서 이미 오답 기록했는지
  const flashTimerRef = useRef<number | null>(null);
  const finishedRef = useRef(false);

  const endGame = () => {
    if (finishedRef.current) return;
    finishedRef.current = true;
    if (flashTimerRef.current !== null) {
      clearTimeout(flashTimerRef.current);
      flashTimerRef.current = null;
    }
    const recs = recsRef.current;
    const c1 = recs.filter((r) => r.round === 1).length;
    const c2 = recs.length - c1;
    const correct = recs.length;
    // 효율 = 정답 문항들의 (최소 스텝 ÷ 사용 스텝) 평균 — 정답이면 사용 ≥ 최소라 0~1
    const eff =
      correct > 0
        ? recs.reduce((a, r) => a + Math.min(1, r.par / r.steps), 0) / correct
        : 0;
    const score = Math.max(
      0,
      Math.min(
        100,
        Math.round(Math.min(1, correct / TARGET_SOLVED) * 70 + eff * 30),
      ),
    );
    const attempts = attemptsRef.current;
    finish(
      {
        score,
        label: `정답 ${correct}문제`,
        detail: [
          { name: "1라운드 정답 (알파벳)", value: `${c1}문제` },
          { name: "2라운드 정답 (타일)", value: `${c2}문제` },
          {
            name: "평균 스텝 효율 (최소÷사용)",
            value: correct > 0 ? `${Math.round(eff * 100)}%` : "—",
          },
          { name: "오답 제출 문제", value: `${wrongTotalRef.current}개` },
        ],
      },
      attempts.length > 0 ? <RotateReview rows={[...attempts]} /> : undefined,
    );
  };

  const addOp = (op: Op) => {
    if (phaseRef.current !== "play" || lockedRef.current) return;
    setSeq((prev) => (prev.length >= MAX_STEPS ? prev : [...prev, op]));
  };

  const undo = () => {
    if (phaseRef.current !== "play" || lockedRef.current) return;
    setSeq((prev) => prev.slice(0, -1));
  };

  const clearSeq = () => {
    if (phaseRef.current !== "play" || lockedRef.current) return;
    setSeq((prev) => (prev.length === 0 ? prev : []));
  };

  const submit = () => {
    if (phaseRef.current !== "play" || lockedRef.current) return;
    const curSeq = seqRef.current;
    if (curSeq.length === 0) return;
    const prob = problemRef.current;
    const ok = stEq(composeSeq(curSeq), prob.target); // 정수 상태 비교 — epsilon 불필요
    attemptsRef.current.push({
      round: prob.round,
      shape: prob.shape,
      target: prob.target,
      userSeq: curSeq,
      ok,
    });
    if (ok) {
      recsRef.current.push({
        round: prob.round,
        par: prob.par,
        steps: curSeq.length,
      });
      setCorrectCount((c) => c + 1);
    } else if (!wrongFlaggedRef.current) {
      wrongFlaggedRef.current = true;
      wrongTotalRef.current += 1;
      setWrongCount((w) => w + 1);
    }
    setFlashOk(ok);
    setLocked(true);
    lockedRef.current = true; // re-render 전 키 입력 즉시 차단
    flashTimerRef.current = window.setTimeout(() => {
      flashTimerRef.current = null;
      setFlashOk(null);
      setLocked(false);
      lockedRef.current = false;
      // 정답·오답 모두 제출하면 다음 문제로 (실제 검사처럼 문제당 1회 제출)
      wrongFlaggedRef.current = false;
      setSeq([]);
      setProblem(makeProblem(roundRef.current));
    }, FLASH_MS);
  };

  /* 라운드 시간 만료 */
  const handleExpire = () => {
    if (finishedRef.current) return;
    if (flashTimerRef.current !== null) {
      clearTimeout(flashTimerRef.current);
      flashTimerRef.current = null;
    }
    if (roundRef.current === 1) {
      setFlashOk(null);
      setLocked(false);
      lockedRef.current = false;
      wrongFlaggedRef.current = false;
      setRound(2);
      setProblem(makeProblem(2));
      setSeq([]);
      setPhase("intro");
    } else {
      endGame();
    }
  };

  const remaining = useCountdown(ROUND_MS, phase === "play", handleExpire);

  /* 키보드 입력 */
  const actionsRef = useRef({ addOp, undo, clearSeq, submit });
  actionsRef.current = { addOp, undo, clearSeq, submit };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat) return;
      if (phaseRef.current !== "play" || lockedRef.current) return;
      const a = actionsRef.current;
      const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
      const opMap: Partial<Record<string, Op>> = {
        ArrowLeft: "rotL",
        z: "rotL",
        ArrowRight: "rotR",
        x: "rotR",
        c: "flipH",
        v: "flipV",
      };
      const op = opMap[k];
      if (op) {
        e.preventDefault();
        a.addOp(op);
        return;
      }
      if (k === "Backspace") {
        e.preventDefault();
        a.undo();
        return;
      }
      if (k === "Delete") {
        e.preventDefault();
        a.clearSeq();
        return;
      }
      if (k === "Enter") {
        e.preventDefault();
        a.submit();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  /* 언마운트 시 플래시 타이머 정리 */
  useEffect(
    () => () => {
      if (flashTimerRef.current !== null) clearTimeout(flashTimerRef.current);
    },
    [],
  );

  if (phase === "intro") {
    const intro = ROUND_INTRO[round];
    return (
      <div className="min-h-[24rem]">
        <RoundIntro
          title={intro.title}
          lines={intro.lines}
          keys={KEY_HELP}
          onStart={() => setPhase("countdown")}
        />
      </div>
    );
  }

  if (phase === "countdown") {
    return (
      <div className="min-h-[24rem]">
        <Countdown onDone={() => setPhase("play")} />
      </div>
    );
  }

  /* play */
  const problemNo = recsRef.current.filter((r) => r.round === round).length + 1;

  return (
    <div className="min-h-[24rem]">
      <GameHUD
        left={`${round}라운드 · ${problemNo}번 문제 · 정답 ${correctCount} · 오답 ${wrongCount}`}
        right={formatSec(remaining)}
      />

      {/* 전 / 후 도형 — 후는 목표 변환이 적용된 모습 */}
      <div className="grid grid-cols-2 gap-3 sm:gap-5">
        <ShapeCard label="전 (시작)" shape={problem.shape} st={ID} />
        <ShapeCard label="후 (목표)" shape={problem.shape} st={problem.target} />
      </div>

      {/* 입력한 시퀀스 칩 — 변환된 도형 미리보기는 절대 없음 */}
      <div className="mt-4 rounded-xl bg-surface-soft px-4 py-3">
        <div className="mb-1.5 flex items-center justify-between text-[12px] font-medium text-muted">
          <span>입력한 변환 순서 (미리보기 없음)</span>
          <span className="tabular-nums">
            {seq.length}/{MAX_STEPS}
          </span>
        </div>
        <div className="flex min-h-9 flex-wrap items-center gap-1.5">
          {seq.length === 0 ? (
            <span className="text-[13px] text-muted-soft">
              변환 버튼을 눌러 순서를 입력하세요
            </span>
          ) : (
            seq.map((op, i) => (
              <span key={i} className="inline-flex items-center gap-1.5">
                {i > 0 && (
                  <span className="text-[11px] text-muted-soft">→</span>
                )}
                <span className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-hairline bg-canvas text-lg leading-none text-ink">
                  {OP_ICON[op]}
                </span>
              </span>
            ))
          )}
        </div>
      </div>

      <Flash ok={flashOk} />

      {/* 변환 버튼 4개 */}
      <div className="grid grid-cols-4 gap-2 sm:gap-3">
        {OPS.map((op) => (
          <button
            key={op}
            type="button"
            disabled={locked || seq.length >= MAX_STEPS}
            onClick={() => addOp(op)}
            className="flex flex-col items-center gap-1 rounded-xl border border-hairline bg-canvas py-3 transition-colors active:bg-surface-soft disabled:opacity-50"
          >
            <span className="text-2xl leading-none text-ink">
              {OP_ICON[op]}
            </span>
            <span className="text-[12px] font-medium text-body">
              {OP_NAME[op]}
            </span>
          </button>
        ))}
      </div>

      {/* 편집 · 제출 */}
      <div className="mt-3 flex gap-2 sm:gap-3">
        <Button
          variant="secondary"
          className="flex-1"
          disabled={locked || seq.length === 0}
          onClick={undo}
        >
          ⌫ 하나 지움
        </Button>
        <Button
          variant="secondary"
          className="flex-1"
          disabled={locked || seq.length === 0}
          onClick={clearSeq}
        >
          전체 초기화
        </Button>
        <Button
          className="flex-1"
          disabled={locked || seq.length === 0}
          onClick={submit}
        >
          제출
        </Button>
      </div>
    </div>
  );
}

/* ───────────────────────── 도형 렌더 ───────────────────────── */

function ShapeCard({
  label,
  shape,
  st,
}: {
  label: string;
  shape: Shape;
  st: St;
}) {
  return (
    <div className="rounded-2xl border border-hairline bg-canvas p-4">
      <p className="mb-1 text-center text-[13px] font-semibold text-muted">
        {label}
      </p>
      <div className="flex h-44 items-center justify-center">
        <ShapeView shape={shape} st={st} />
      </div>
    </div>
  );
}

function ShapeView({
  shape,
  st,
  compact = false,
}: {
  shape: Shape;
  st: St;
  compact?: boolean;
}) {
  const transform = cssTransform(st);
  if (shape.kind === "letter") {
    return (
      <span
        className={`inline-block select-none font-semibold leading-none text-ink ${
          compact ? "text-4xl" : "text-8xl"
        }`}
        style={{ transform }}
      >
        {shape.ch}
      </span>
    );
  }
  // 타일: 정사각 그리드(n×n) 전체를 그리고 색칠된 칸만 채운다 —
  // 실제 잡다처럼 ‘격자에 색칠된 형태’. 래퍼째 변환하므로 회전 중심 = 그리드 중심.
  const n = Math.max(shape.w, shape.h);
  const cell = compact ? (n <= 4 ? 12 : 10) : n <= 4 ? 26 : 22;
  const size = n * cell;
  const ox = Math.floor((n - shape.w) / 2);
  const oy = Math.floor((n - shape.h) / 2);
  const filled = new Set(shape.cells.map(([x, y]) => `${x + ox},${y + oy}`));
  const grid: Cell[] = [];
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) grid.push([x, y]);
  return (
    <div className="relative" style={{ width: size, height: size, transform }}>
      {grid.map(([x, y]) => {
        const on = filled.has(`${x},${y}`);
        return (
          <div
            key={`${x},${y}`}
            className={`absolute border ${
              on ? "border-ink bg-ink" : "border-hairline bg-canvas"
            }`}
            style={{ left: x * cell, top: y * cell, width: cell, height: cell }}
          />
        );
      })}
    </div>
  );
}

/* ───────────────────────── 자세히 보기 (문제별 정답) ───────────────────────── */

function RotateReview({ rows }: { rows: Attempt[] }) {
  const correct = rows.filter((r) => r.ok).length;
  return (
    <div className="rounded-2xl border border-hairline bg-canvas p-5 text-left">
      <h3 className="text-base font-semibold text-ink">문제별 결과</h3>
      <p className="mb-4 mt-1 text-[13px] text-muted">
        맞은 문제 {correct} · 틀린 문제 {rows.length - correct} · 틀린 문제는
        정답 예시를 함께 표시합니다.
      </p>
      <ol className="max-h-112 space-y-3 overflow-y-auto pr-1">
        {rows.map((a, i) => (
          <li
            key={i}
            className="rounded-xl border border-hairline-soft p-3"
          >
            <div className="mb-2.5 flex items-center justify-between">
              <span className="text-[13px] font-semibold text-ink">
                {i + 1}번 · {a.round}라운드
              </span>
              <span
                className={`rounded-full px-2 py-0.5 text-[12px] font-medium ${
                  a.ok ? "bg-badge-emerald/20 text-ink" : "bg-error/15 text-error"
                }`}
              >
                {a.ok ? "정답" : "오답"}
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <MiniShape shape={a.shape} st={ID} label="전" />
              <span className="text-muted-soft">→</span>
              <MiniShape shape={a.shape} st={a.target} label="후" />
              <div className="min-w-32 flex-1 space-y-1.5">
                <SeqRow label="내 입력" seq={a.userSeq} dim={!a.ok} />
                {!a.ok && (
                  <SeqRow label="정답 예시" seq={solvePath(a.target)} answer />
                )}
              </div>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}

function MiniShape({
  shape,
  st,
  label,
}: {
  shape: Shape;
  st: St;
  label: string;
}) {
  return (
    <div className="flex flex-col items-center gap-1">
      <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-lg border border-hairline bg-surface-soft">
        <ShapeView shape={shape} st={st} compact />
      </div>
      <span className="text-[11px] text-muted-soft">{label}</span>
    </div>
  );
}

function SeqRow({
  label,
  seq,
  dim = false,
  answer = false,
}: {
  label: string;
  seq: Op[];
  dim?: boolean;
  answer?: boolean;
}) {
  return (
    <div className="flex items-center gap-1.5">
      <span
        className={`w-16 shrink-0 text-[12px] ${
          answer ? "font-semibold text-ink" : "text-muted"
        }`}
      >
        {label}
      </span>
      <div className="flex flex-wrap items-center gap-1">
        {seq.length === 0 ? (
          <span className="text-[12px] text-muted-soft">미입력</span>
        ) : (
          seq.map((op, i) => (
            <span
              key={i}
              className={`inline-flex h-6 w-6 items-center justify-center rounded border text-sm leading-none ${
                answer
                  ? "border-badge-emerald bg-badge-emerald/10 text-ink"
                  : dim
                    ? "border-hairline bg-surface-soft text-muted"
                    : "border-hairline bg-canvas text-ink"
              }`}
            >
              {OP_ICON[op]}
            </span>
          ))
        )}
      </div>
    </div>
  );
}
