"use client";

import { useEffect, useRef, useState } from "react";
import { useGameShell } from "@/components/game-shell";
import {
  Countdown,
  GameHUD,
  RoundIntro,
  formatSec,
  useCountdown,
} from "@/components/game-ui";
import { Button } from "@/components/ui";
import {
  SIZE,
  countFences,
  edgeEq,
  edgeKey,
  emptyBoard,
  generatePuzzle,
  simulate,
  type Edge,
  type Fence,
  type Puzzle,
} from "./logic";

/* ───────────────────────── 상수 ───────────────────────── */

const GAME_MS = 5 * 60 * 1000;
const STEP_MS = 150; // 칸당 이동 애니메이션
const TARGET = 6; // 성공 문제점 만점 기준
const EXTRA_PENALTY = 0.2; // 초과 울타리 1개당 효율 감점
const RETRY_PENALTY = 0.25; // 재시도 1회당 효율 감점
const SOLVED_HOLD_MS = 900;
const FAIL_HOLD_MS = 1600;

const VEHICLE_EMOJI = ["🚕", "🚙", "🚌"] as const;
const COLOR_NAME = ["노랑", "파랑", "빨강"] as const;
const COLOR_HEX = ["#f59e0b", "#3b82f6", "#ef4444"] as const;

const CELL = "h-9 w-9 sm:h-11 sm:w-11";

type Phase = "intro" | "countdown" | "edit" | "anim" | "fail" | "solved";

type AttemptSim = {
  path: { r: number; c: number }[];
  exit: Edge | null;
  ok: boolean;
};
type Attempt = {
  sims: AttemptSim[];
  success: boolean;
  /** 칸 키("r,c") → 처음 지나간 차 색·스텝 (경로 하이라이트용) */
  visit: Map<string, { color: number; step: number }>;
  maxLen: number;
};

function edgeOfGridPos(gr: number, gc: number): Edge | null {
  if (gr === 0 && gc >= 1 && gc <= SIZE) return { side: 0, idx: gc - 1 };
  if (gr === SIZE + 1 && gc >= 1 && gc <= SIZE) return { side: 2, idx: gc - 1 };
  if (gc === 0 && gr >= 1 && gr <= SIZE) return { side: 3, idx: gr - 1 };
  if (gc === SIZE + 1 && gr >= 1 && gr <= SIZE) return { side: 1, idx: gr - 1 };
  return null;
}

/* ───────────────────────── 컴포넌트 ───────────────────────── */

export default function Game() {
  const { finish } = useGameShell();

  const [phase, setPhase] = useState<Phase>("intro");
  const [puzzle, setPuzzle] = useState<Puzzle | null>(null);
  const [board, setBoard] = useState<Fence[][]>(() => emptyBoard());
  const [problemNo, setProblemNo] = useState(1);
  const [solvedCount, setSolvedCount] = useState(0);
  const [attempt, setAttempt] = useState<Attempt | null>(null);
  const [animStep, setAnimStep] = useState(0);

  const phaseRef = useRef(phase);
  phaseRef.current = phase;
  const puzzleRef = useRef(puzzle);
  puzzleRef.current = puzzle;
  const boardRef = useRef(board);
  boardRef.current = board;
  const problemNoRef = useRef(problemNo);
  problemNoRef.current = problemNo;

  const finishedRef = useRef(false);
  const retriesPuzzleRef = useRef(0);
  const statsRef = useRef({ solved: 0, extraSum: 0, effSum: 0, retriesTotal: 0 });
  const holdTimerRef = useRef<number | null>(null);

  /* ── 게임 종료 (시간 만료 시 1회) ── */
  const endGame = () => {
    if (finishedRef.current) return;
    finishedRef.current = true;
    const s = statsRef.current;
    const successPart = Math.min(s.solved / TARGET, 1) * 100;
    const effPart = (s.solved > 0 ? s.effSum / s.solved : 0) * 100;
    const score = Math.max(
      0,
      Math.min(100, Math.round(successPart * 0.7 + effPart * 0.3)),
    );
    finish({
      score,
      label: `성공 ${s.solved}문제`,
      detail: [
        { name: "성공 문제 수", value: `${s.solved}문제 (만점 기준 ${TARGET}문제)` },
        {
          name: "평균 초과 울타리",
          value: s.solved > 0 ? `${(s.extraSum / s.solved).toFixed(1)}개` : "—",
        },
        { name: "재시도 횟수", value: `${s.retriesTotal}회` },
      ],
    });
  };
  const endGameRef = useRef(endGame);
  endGameRef.current = endGame;

  /* ── 5분 전체 타이머 ── */
  const running = phase !== "intro" && phase !== "countdown";
  const remaining = useCountdown(GAME_MS, running, () => endGameRef.current());

  /* ── 새 문제 출제 ── */
  const startPuzzle = (no: number) => {
    setPuzzle(generatePuzzle());
    setBoard(emptyBoard());
    setAttempt(null);
    setAnimStep(0);
    retriesPuzzleRef.current = 0;
    setProblemNo(no);
    setPhase("edit");
  };
  const startPuzzleRef = useRef(startPuzzle);
  startPuzzleRef.current = startPuzzle;

  /* ── 칸 클릭: 없음 → '/' → '\' → 없음 ── */
  const cycleCell = (r: number, c: number) => {
    if (phaseRef.current !== "edit") return;
    setBoard((prev) => {
      const next = prev.map((row) => [...row]);
      const cur = next[r][c];
      next[r][c] = cur === null ? "/" : cur === "/" ? "\\" : null;
      return next;
    });
  };

  /* ── 출발: 전 차량 시뮬레이션 → 애니메이션 ── */
  const depart = () => {
    if (phaseRef.current !== "edit") return;
    const pz = puzzleRef.current;
    if (!pz) return;
    const sims: AttemptSim[] = pz.vehicles.map((v, i) => {
      const s = simulate(boardRef.current, v.entry);
      return {
        path: s.path,
        exit: s.exit,
        ok: s.exit !== null && edgeEq(s.exit, pz.customers[i]),
      };
    });
    const visit = new Map<string, { color: number; step: number }>();
    sims.forEach((s, i) => {
      s.path.forEach((p, st) => {
        const k = `${p.r},${p.c}`;
        if (!visit.has(k)) visit.set(k, { color: i, step: st });
      });
    });
    setAttempt({
      sims,
      success: sims.every((s) => s.ok),
      visit,
      maxLen: Math.max(...sims.map((s) => s.path.length)),
    });
    setAnimStep(0);
    setPhase("anim");
  };
  const departRef = useRef(depart);
  departRef.current = depart;

  /* ── 애니메이션 틱 ── */
  useEffect(() => {
    if (phase !== "anim" || attempt === null) return;
    const id = window.setInterval(() => setAnimStep((s) => s + 1), STEP_MS);
    return () => clearInterval(id);
  }, [phase, attempt]);

  /* ── 애니메이션 종료 판정 (정확히 1회) ── */
  useEffect(() => {
    if (phase !== "anim" || attempt === null) return;
    if (animStep !== attempt.maxLen + 2) return; // 탈출 후 ~300ms 여유
    if (finishedRef.current) return;
    if (attempt.success) {
      const pz = puzzleRef.current;
      const placed = countFences(boardRef.current);
      const extra = pz ? Math.max(0, placed - pz.answer) : 0;
      const eff = Math.max(
        0,
        1 - EXTRA_PENALTY * extra - RETRY_PENALTY * retriesPuzzleRef.current,
      );
      const s = statsRef.current;
      s.solved += 1;
      s.extraSum += extra;
      s.effSum += eff;
      setSolvedCount(s.solved);
      setPhase("solved");
      holdTimerRef.current = window.setTimeout(() => {
        holdTimerRef.current = null;
        if (finishedRef.current) return;
        startPuzzleRef.current(problemNoRef.current + 1);
      }, SOLVED_HOLD_MS);
    } else {
      statsRef.current.retriesTotal += 1;
      retriesPuzzleRef.current += 1;
      setPhase("fail");
      holdTimerRef.current = window.setTimeout(() => {
        holdTimerRef.current = null;
        if (finishedRef.current) return;
        setPhase("edit");
      }, FAIL_HOLD_MS);
    }
  }, [phase, attempt, animStep]);

  /* ── 키보드: Enter = 출발 (포커스가 버튼 위면 버튼 클릭에 양보) ── */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat) return;
      if (e.key !== "Enter") return;
      if (phaseRef.current !== "edit") return;
      if (e.target instanceof HTMLButtonElement) return;
      e.preventDefault();
      departRef.current();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  /* ── 언마운트 시 홀드 타이머 정리 ── */
  useEffect(
    () => () => {
      if (holdTimerRef.current !== null) clearTimeout(holdTimerRef.current);
    },
    [],
  );

  /* ───────────── 화면 ───────────── */

  if (phase === "intro") {
    return (
      <div className="min-h-[24rem]">
        <RoundIntro
          title="길 만들기 — 5분 연속 출제"
          lines={[
            "격자 칸을 클릭해 대각선 울타리를 설치하세요 (클릭마다 없음 → ╱ → ╲ 순환).",
            "차는 직진하다 울타리를 만나면 90°로 꺾입니다 (거울 반사).",
            "모든 차를 같은 색 손님 위치로 내보내면 성공!",
            "‘정답 울타리 수’보다 많이 설치하거나 재시도하면 효율 감점.",
            `5분 동안 연속 출제 — ${TARGET}문제 성공이면 성공점 만점.`,
          ]}
          keys={[{ key: "Enter", action: "출발" }]}
          startLabel="시작"
          onStart={() => setPhase("countdown")}
        />
      </div>
    );
  }

  if (phase === "countdown") {
    return (
      <div className="min-h-[24rem]">
        <Countdown onDone={() => startPuzzleRef.current(1)} />
      </div>
    );
  }

  if (puzzle === null) return <div className="min-h-[24rem]" />;

  const placed = countFences(board);
  const showRun = attempt !== null && phase !== "edit";
  const stepNow = phase === "anim" ? animStep : Number.MAX_SAFE_INTEGER;

  // 현재 스텝 기준 차량 위치 (격자 안 / 가장자리 도착)
  const inCell = new Map<string, number[]>();
  const arrivals = new Map<string, { color: number; ok: boolean }[]>();
  if (showRun && attempt) {
    attempt.sims.forEach((s, i) => {
      if (stepNow < s.path.length) {
        const p = s.path[stepNow];
        const k = `${p.r},${p.c}`;
        inCell.set(k, [...(inCell.get(k) ?? []), i]);
      } else if (s.exit !== null) {
        const k = edgeKey(s.exit);
        arrivals.set(k, [...(arrivals.get(k) ?? []), { color: i, ok: s.ok }]);
      } else {
        const p = s.path[s.path.length - 1];
        const k = `${p.r},${p.c}`;
        inCell.set(k, [...(inCell.get(k) ?? []), i]);
      }
    });
  }

  const entryAt = new Map<string, number>();
  const customerAt = new Map<string, number>();
  puzzle.vehicles.forEach((v, i) => entryAt.set(edgeKey(v.entry), i));
  puzzle.customers.forEach((p, i) => customerAt.set(edgeKey(p), i));

  const failColors =
    attempt !== null && !attempt.success
      ? attempt.sims.map((s, i) => (s.ok ? -1 : i)).filter((i) => i >= 0)
      : [];

  return (
    <div className="min-h-[24rem]">
      <GameHUD
        left={`문제 ${problemNo} · 성공 ${solvedCount}`}
        right={`남은 시간 ${formatSec(remaining)}`}
      />

      {/* 좌측: 정답 울타리 수 / 우측: 색 매칭 범례 */}
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-[13px] font-medium">
          <span className="rounded-full bg-surface-soft px-3 py-1 text-body">
            정답 울타리 수{" "}
            <strong className="text-ink">{puzzle.answer}개</strong>
          </span>
          <span
            className={`rounded-full px-3 py-1 ${
              placed > puzzle.answer
                ? "bg-surface-soft text-error"
                : "bg-surface-soft text-body"
            }`}
          >
            설치 {placed}개
          </span>
        </div>
        <div className="flex items-center gap-3 text-[13px] text-muted">
          {puzzle.vehicles.map((_, i) => (
            <span key={i} className="inline-flex items-center gap-1">
              {VEHICLE_EMOJI[i]}→🙋
              <span style={{ color: COLOR_HEX[i] }} className="font-semibold">
                {COLOR_NAME[i]}
              </span>
            </span>
          ))}
        </div>
      </div>

      {/* 보드: 8×8 (가장자리 마커 + 6×6 격자) */}
      <div className="mx-auto grid w-fit grid-cols-8 gap-1 rounded-xl bg-surface-card p-2 sm:p-3">
        {Array.from({ length: SIZE + 2 }).flatMap((_, gr) =>
          Array.from({ length: SIZE + 2 }).map((_, gc) => {
            const key = `${gr}-${gc}`;
            const edge = edgeOfGridPos(gr, gc);
            if (edge) {
              const k = edgeKey(edge);
              return (
                <EdgeCell
                  key={key}
                  entryColor={entryAt.get(k) ?? null}
                  customerColor={customerAt.get(k) ?? null}
                  arrivals={arrivals.get(k) ?? []}
                  dimEntry={showRun}
                />
              );
            }
            if (gr === 0 || gr === SIZE + 1 || gc === 0 || gc === SIZE + 1) {
              return <div key={key} className={CELL} />;
            }
            const r = gr - 1;
            const c = gc - 1;
            const ck = `${r},${c}`;
            const v = attempt?.visit.get(ck);
            const tint =
              showRun && v !== undefined && v.step <= stepNow
                ? `${COLOR_HEX[v.color]}30`
                : undefined;
            return (
              <BoardCell
                key={key}
                fence={board[r][c]}
                tint={tint}
                vehicles={inCell.get(ck) ?? []}
                editable={phase === "edit"}
                onClick={() => cycleCell(r, c)}
              />
            );
          }),
        )}
      </div>

      {/* 상태 메시지 — 고정 높이로 레이아웃 점프 방지 */}
      <div className="mt-3 flex h-6 items-center justify-center text-sm font-semibold">
        {phase === "solved" && (
          <span className="text-success">성공! 다음 문제가 곧 출제됩니다</span>
        )}
        {phase === "fail" && (
          <span className="text-error">
            {failColors.map((i) => COLOR_NAME[i]).join("·")} 차가 손님과
            어긋났어요 — 울타리 수정 후 다시 출발 (재시도 감점)
          </span>
        )}
        {phase === "anim" && <span className="text-muted">이동 중…</span>}
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-center gap-3">
        <Button onClick={depart} disabled={phase !== "edit"}>
          출발
        </Button>
        <Button
          variant="secondary"
          onClick={() => phase === "edit" && setBoard(emptyBoard())}
          disabled={phase !== "edit"}
        >
          모두 지우기
        </Button>
        <button
          type="button"
          onClick={() =>
            phaseRef.current === "edit" &&
            startPuzzleRef.current(problemNoRef.current + 1)
          }
          disabled={phase !== "edit"}
          className="text-[13px] font-medium text-muted transition-colors hover:text-ink disabled:opacity-50"
        >
          이 문제 건너뛰기 →
        </button>
      </div>
    </div>
  );
}

/* ───────────────────────── 셀 ───────────────────────── */

function EdgeCell({
  entryColor,
  customerColor,
  arrivals,
  dimEntry,
}: {
  entryColor: number | null;
  customerColor: number | null;
  arrivals: { color: number; ok: boolean }[];
  dimEntry: boolean;
}) {
  if (arrivals.length > 0) {
    const allOk = arrivals.every((a) => a.ok);
    return (
      <div
        className={`flex items-center justify-center rounded-lg border-2 text-base sm:text-lg ${CELL}`}
        style={{
          borderColor: allOk ? "#16a34a" : "#dc2626",
          backgroundColor: allOk ? "#16a34a1a" : "#dc26261a",
        }}
      >
        {arrivals.map((a) => (
          <span key={a.color} className="leading-none">
            {VEHICLE_EMOJI[a.color]}
          </span>
        ))}
      </div>
    );
  }
  if (customerColor !== null) {
    return (
      <div
        className={`flex items-center justify-center rounded-lg border-2 text-base sm:text-lg ${CELL}`}
        style={{
          borderColor: COLOR_HEX[customerColor],
          backgroundColor: `${COLOR_HEX[customerColor]}15`,
        }}
      >
        <span className="leading-none">🙋</span>
      </div>
    );
  }
  if (entryColor !== null) {
    return (
      <div
        className={`flex items-center justify-center rounded-lg border-2 text-base sm:text-lg ${CELL} ${
          dimEntry ? "opacity-30" : ""
        }`}
        style={{
          borderColor: COLOR_HEX[entryColor],
          backgroundColor: `${COLOR_HEX[entryColor]}15`,
        }}
      >
        <span className="leading-none">{VEHICLE_EMOJI[entryColor]}</span>
      </div>
    );
  }
  return <div className={CELL} />;
}

function BoardCell({
  fence,
  tint,
  vehicles,
  editable,
  onClick,
}: {
  fence: Fence;
  tint: string | undefined;
  vehicles: number[];
  editable: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={!editable}
      onClick={onClick}
      aria-label={
        fence === null ? "울타리 없음" : fence === "/" ? "울타리 ╱" : "울타리 ╲"
      }
      className={`relative rounded-md border border-hairline bg-canvas transition-colors enabled:hover:bg-surface-soft ${CELL}`}
      style={tint !== undefined ? { backgroundColor: tint } : undefined}
    >
      {fence !== null && (
        <svg
          viewBox="0 0 100 100"
          className="pointer-events-none absolute inset-0 h-full w-full"
        >
          <line
            x1={14}
            y1={fence === "/" ? 86 : 14}
            x2={86}
            y2={fence === "/" ? 14 : 86}
            stroke="#18181b"
            strokeWidth={9}
            strokeLinecap="round"
          />
        </svg>
      )}
      {vehicles.map((i) => (
        <span
          key={i}
          className="pointer-events-none absolute inset-0 flex items-center justify-center text-base leading-none sm:text-lg"
        >
          {VEHICLE_EMOJI[i]}
        </span>
      ))}
    </button>
  );
}
