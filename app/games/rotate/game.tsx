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
  stEq,
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
      "정답이면 다음 문제, 오답이면 같은 문제에 재도전합니다 (문제당 오답 1회 기록).",
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

  const recsRef = useRef<Rec[]>([]); // 정답 문항 기록
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
    finish({
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
    });
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
      if (ok) {
        // 정답 → 새 문제, 시퀀스 비움
        wrongFlaggedRef.current = false;
        setSeq([]);
        setProblem(makeProblem(roundRef.current));
      }
      // 오답 → 시퀀스 유지한 채 같은 문제 재도전
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

function ShapeView({ shape, st }: { shape: Shape; st: St }) {
  const transform = cssTransform(st);
  if (shape.kind === "letter") {
    return (
      <span
        className="inline-block select-none text-8xl font-semibold leading-none text-ink"
        style={{ transform }}
      >
        {shape.ch}
      </span>
    );
  }
  // 타일: 바운딩박스를 정사각 래퍼 중앙에 두고 래퍼째 변환 → 회전 중심 = 도형 중심
  const n = Math.max(shape.w, shape.h);
  const cell = n <= 4 ? 26 : 22; // 45° 회전 대각선이 카드(h-44)를 넘지 않게
  const size = n * cell;
  const ox = ((n - shape.w) / 2) * cell;
  const oy = ((n - shape.h) / 2) * cell;
  return (
    <div className="relative" style={{ width: size, height: size, transform }}>
      {shape.cells.map(([x, y]) => (
        <div
          key={`${x},${y}`}
          className="absolute rounded-[4px] bg-badge-violet"
          style={{
            left: ox + x * cell + 1,
            top: oy + y * cell + 1,
            width: cell - 2,
            height: cell - 2,
          }}
        />
      ))}
    </div>
  );
}
