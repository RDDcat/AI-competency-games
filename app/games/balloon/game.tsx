"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useGameShell } from "@/components/game-shell";
import { Countdown, GameHUD, RoundIntro } from "@/components/game-ui";
import { Button } from "@/components/ui";

/* ───────────────────────── 도메인 ───────────────────────── */

const BALLOON_COUNT = 12;
/** 터짐 한계 — 1~16 펌프 균등 랜덤 (풍선마다 독립) */
const LIMIT_MAX = 16;
const POINT_PER_PUMP = 5;
/** 이론 기준 총점 (12풍선 × ≈28점) → 100점 환산 분모 */
const BASELINE_TOTAL = 336;
const POP_PAUSE_MS = 1200;
const HARVEST_PAUSE_MS = 800;

/** 매 플레이마다 새로 생성 — 풍선 i 는 (limits[i])번째 펌프에서 터진다 */
function makeLimits(): number[] {
  return Array.from(
    { length: BALLOON_COUNT },
    () => 1 + Math.floor(Math.random() * LIMIT_MAX),
  );
}

type BalloonRecord = {
  /** 이 풍선에서 누른 펌프 횟수 (터진 경우 터뜨린 그 펌프 포함) */
  presses: number;
  popped: boolean;
};

function riskLabel(avgPumps: number): string {
  if (avgPumps <= 5) return "회피적";
  if (avgPumps < 10) return "균형";
  return "공격적";
}

const clamp = (v: number, lo: number, hi: number) =>
  Math.min(hi, Math.max(lo, v));

/* ───────────────────────── 컴포넌트 ───────────────────────── */

type Phase = "intro" | "countdown" | "play" | "popped" | "harvested";

export default function Game() {
  const { finish } = useGameShell();

  const [limits] = useState<number[]>(() => makeLimits());
  const [phase, setPhase] = useState<Phase>("intro");
  const [index, setIndex] = useState(0); // 현재 풍선 (0-based)
  const [pumps, setPumps] = useState(0); // 현재 풍선의 성공한 펌프 수
  const [bank, setBank] = useState(0);

  const phaseRef = useRef<Phase>(phase);
  phaseRef.current = phase;
  const indexRef = useRef(index);
  indexRef.current = index;
  const pumpsRef = useRef(pumps);
  pumpsRef.current = pumps;
  const bankRef = useRef(bank);
  bankRef.current = bank;

  const recordsRef = useRef<BalloonRecord[]>([]);
  const finishedRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 언마운트 시 전환 타이머 정리
  useEffect(() => {
    return () => {
      if (timerRef.current !== null) clearTimeout(timerRef.current);
    };
  }, []);

  const doFinish = useCallback(() => {
    if (finishedRef.current) return;
    finishedRef.current = true;

    const recs = recordsRef.current;
    const totalBank = bankRef.current;
    const totalPresses = recs.reduce((s, r) => s + r.presses, 0);
    const avg = recs.length > 0 ? totalPresses / recs.length : 0;
    const poppedCount = recs.filter((r) => r.popped).length;
    const harvestedCount = recs.length - poppedCount;
    const score = clamp(Math.round((totalBank / BASELINE_TOTAL) * 100), 0, 100);

    finish({
      score,
      label: `은행 ${totalBank}점`,
      detail: [
        { name: "평균 펌프 수", value: `${avg.toFixed(1)}회` },
        { name: "터진 풍선", value: `${poppedCount}/${BALLOON_COUNT}개` },
        { name: "수확 성공", value: `${harvestedCount}/${BALLOON_COUNT}개` },
        { name: "위험 성향", value: riskLabel(avg) },
      ],
    });
  }, [finish]);

  /** 현재 풍선을 정산하고 다음 풍선(또는 종료)으로 전환 */
  const scheduleNext = useCallback(
    (pauseMs: number) => {
      if (timerRef.current !== null) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        timerRef.current = null;
        if (indexRef.current >= BALLOON_COUNT - 1) {
          doFinish();
        } else {
          setIndex((i) => i + 1);
          setPumps(0);
          setPhase("play");
        }
      }, pauseMs);
    },
    [doFinish],
  );

  const pump = useCallback(() => {
    if (phaseRef.current !== "play") return;
    const next = pumpsRef.current + 1;
    if (next >= limits[indexRef.current]) {
      // 터짐 — 이번 풍선 점수 소멸 (터뜨린 펌프도 의사결정 횟수로 기록)
      recordsRef.current.push({ presses: next, popped: true });
      setPhase("popped");
      scheduleNext(POP_PAUSE_MS);
    } else {
      setPumps(next);
    }
  }, [limits, scheduleNext]);

  const harvest = useCallback(() => {
    if (phaseRef.current !== "play" || pumpsRef.current === 0) return;
    const gained = pumpsRef.current * POINT_PER_PUMP;
    const newBank = bankRef.current + gained;
    bankRef.current = newBank;
    setBank(newBank);
    recordsRef.current.push({ presses: pumpsRef.current, popped: false });
    setPhase("harvested");
    scheduleNext(HARVEST_PAUSE_MS);
  }, [scheduleNext]);

  // 키보드: Space=펌프, Enter=수확
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat) return;
      if (phaseRef.current !== "play") return;
      if (e.code === "Space" || e.key === " ") {
        e.preventDefault();
        pump();
      } else if (e.key === "Enter") {
        e.preventDefault();
        harvest();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [pump, harvest]);

  /* ───────── 화면 ───────── */

  if (phase === "intro") {
    return (
      <RoundIntro
        title="풍선 불기"
        lines={[
          `풍선 ${BALLOON_COUNT}개가 차례로 주어집니다.`,
          `펌프 1회마다 이번 풍선 점수 +${POINT_PER_PUMP}점 — 터지면 전부 소멸합니다.`,
          "수확하면 이번 풍선 점수가 은행에 확정됩니다.",
          "측정되는 건 점수가 아니라 패턴 — 일관된 정지 규칙이 합리적입니다. 풍선끼리는 독립입니다.",
        ]}
        keys={[
          { key: "Space", action: "펌프" },
          { key: "Enter", action: "수확" },
        ]}
        startLabel="시작"
        onStart={() => setPhase("countdown")}
      />
    );
  }

  if (phase === "countdown") {
    return <Countdown onDone={() => setPhase("play")} />;
  }

  const currentScore = pumps * POINT_PER_PUMP;
  const scale = 1 + pumps * 0.09;
  const playing = phase === "play";

  return (
    <div>
      <GameHUD
        left={`풍선 ${index + 1}/${BALLOON_COUNT} · 남은 풍선 ${BALLOON_COUNT - index - 1}개`}
        right={`은행 ${bank}점`}
      />

      <div className="flex min-h-[24rem] flex-col items-center justify-between rounded-xl border border-hairline bg-canvas p-6">
        {/* 점수판 */}
        <div className="flex w-full max-w-sm items-center justify-center gap-3">
          <div className="flex-1 rounded-xl bg-surface-card px-4 py-3 text-center">
            <p className="text-[12px] font-medium text-muted">이번 풍선</p>
            <p className="text-xl font-semibold tabular-nums text-ink">
              {currentScore}점
            </p>
          </div>
          <div className="flex-1 rounded-xl bg-surface-card px-4 py-3 text-center">
            <p className="text-[12px] font-medium text-muted">펌프</p>
            <p className="text-xl font-semibold tabular-nums text-ink">
              {pumps}회
            </p>
          </div>
        </div>

        {/* 풍선 영역 */}
        <div className="flex h-52 items-center justify-center">
          {phase === "popped" ? (
            <div className="text-center">
              <style>{`@keyframes yga-balloon-pop{0%{transform:scale(.4);opacity:.3}60%{transform:scale(1.25)}100%{transform:scale(1);opacity:1}}`}</style>
              <div
                className="text-7xl"
                style={{ animation: "yga-balloon-pop 0.35s ease-out" }}
              >
                💥
              </div>
              <p className="mt-3 text-sm font-semibold text-error">
                터졌습니다! 이번 풍선 {currentScore}점 소멸
              </p>
            </div>
          ) : phase === "harvested" ? (
            <div className="text-center">
              <div className="text-6xl">🎉</div>
              <p className="mt-3 text-sm font-semibold text-success">
                +{currentScore}점 은행 확정
              </p>
            </div>
          ) : (
            <span
              className="select-none text-6xl transition-transform duration-150 ease-out"
              style={{
                transform: `scale(${scale})`,
                filter: `hue-rotate(${(index * 137) % 360}deg)`,
              }}
              aria-label={`풍선 — 펌프 ${pumps}회`}
            >
              🎈
            </span>
          )}
        </div>

        {/* 조작 버튼 */}
        <div className="flex w-full max-w-sm gap-3">
          <Button
            className="flex-1"
            disabled={!playing}
            onClick={(e) => {
              e.currentTarget.blur();
              pump();
            }}
          >
            펌프 +{POINT_PER_PUMP}점
          </Button>
          <Button
            variant="secondary"
            className="flex-1"
            disabled={!playing || pumps === 0}
            onClick={(e) => {
              e.currentTarget.blur();
              harvest();
            }}
          >
            수확
          </Button>
        </div>
      </div>

      <p className="mt-3 text-center text-[13px] text-muted">
        Space 펌프 · Enter 수확 — 언제 터질지는 풍선마다 다릅니다
      </p>
    </div>
  );
}
