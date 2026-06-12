"use client";

import { useEffect, useRef, useState } from "react";
import { useGameShell } from "@/components/game-shell";
import {
  Countdown,
  GameHUD,
  RoundIntro,
  TimeBar,
  useCountdown,
} from "@/components/game-ui";

/* ───────────────────────── 상수·타입 ───────────────────────── */

const R1_TRIALS = 12;
const R2_SETS = 3;
const RULE_SHOW_MS = 3000;
const PAD = [1, 2, 3, 4, 5, 6, 7, 8, 9] as const;

type Phase =
  | "r1-intro"
  | "r1-countdown"
  | "r1-wait" // 신호 대기 (불 꺼짐)
  | "r1-signal" // 불 켜짐 — 반응 측정 중
  | "r1-gap" // 시행 간 피드백
  | "r2-intro"
  | "r2-rule" // 세트 규칙 3초 표시
  | "r2-play"
  | "r2-gap"; // 세트 간 휴식

type Rule = { skips: number[]; double: number };

type FlashMsg = { text: string; tone: "ok" | "bad" } | null;

type TimerRef = { current: ReturnType<typeof setTimeout> | null };

/* ───────────────────────── 생성기 ───────────────────────── */

/** 규칙 추첨 — 2~9 에서 건너뛸 숫자 1~2개 + 두 번 누를 숫자 1개 (서로 중복 없음, 1 제외) */
function makeRule(): Rule {
  const pool = [2, 3, 4, 5, 6, 7, 8, 9];
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  const skipCount = Math.random() < 0.5 ? 1 : 2;
  return {
    skips: pool.slice(0, skipCount).sort((a, b) => a - b),
    double: pool[skipCount],
  };
}

/** 규칙을 적용한 정답 입력 시퀀스 — 항상 1로 시작하고 길이 ≥ 8 보장 */
function buildSeq(rule: Rule): number[] {
  const seq: number[] = [];
  for (let n = 1; n <= 9; n++) {
    if (rule.skips.includes(n)) continue;
    seq.push(n);
    if (n === rule.double) seq.push(n);
  }
  return seq;
}

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}

/* ───────────────────────── 게임 본체 ───────────────────────── */

export default function Game() {
  const { finish } = useGameShell();
  const finishedRef = useRef(false);

  const [phase, setPhase] = useState<Phase>("r1-intro");
  const phaseRef = useRef<Phase>("r1-intro");
  const go = (p: Phase) => {
    phaseRef.current = p;
    setPhase(p);
  };

  /* 표시용 상태 */
  const [trial, setTrial] = useState(1);
  const [lit, setLit] = useState<number | null>(null);
  const [pressed, setPressed] = useState<number | null>(null);
  const [flash, setFlash] = useState<FlashMsg>(null);
  const [tooFast, setTooFast] = useState(0);
  const [setIdx, setSetIdx] = useState(0);
  const [rule, setRule] = useState<Rule | null>(null);
  const [seqPos, setSeqPos] = useState(0);
  const [seqLen, setSeqLen] = useState(0);
  const [errTotal, setErrTotal] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [lastSetSec, setLastSetSec] = useState(0);

  /* 판정용 ref (stale closure 방지) */
  const trialRef = useRef(1);
  const litRef = useRef<number | null>(null);
  const lastLitRef = useRef(0);
  const signalAtRef = useRef(0);
  const rtsRef = useRef<number[]>([]);
  const tooFastRef = useRef(0);
  const setIdxRef = useRef(0);
  const seqRef = useRef<number[]>([]);
  const seqPosRef = useRef(0);
  const errorsRef = useRef<number[]>([0, 0, 0]);
  const setTimesRef = useRef<number[]>([]);
  const setStartAtRef = useRef(0);

  /* 타이머 */
  const signalT = useRef<ReturnType<typeof setTimeout> | null>(null);
  const gapT = useRef<ReturnType<typeof setTimeout> | null>(null);
  const flashT = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pressT = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearT = (r: TimerRef) => {
    if (r.current !== null) {
      clearTimeout(r.current);
      r.current = null;
    }
  };
  const clearAll = () => {
    clearT(signalT);
    clearT(gapT);
    clearT(flashT);
    clearT(pressT);
  };
  // 언마운트 시 모든 타이머 정리
  useEffect(() => {
    return () => {
      clearT(signalT);
      clearT(gapT);
      clearT(flashT);
      clearT(pressT);
    };
  }, []);

  const showFlash = (text: string, tone: "ok" | "bad", ms = 700) => {
    setFlash({ text, tone });
    clearT(flashT);
    flashT.current = setTimeout(() => setFlash(null), ms);
  };

  /* ── 1라운드: 단순 반응 ── */

  /** 무작위 0.6~2.0초 대기 후 무작위 숫자에 불 켜기 (같은 시행에서 재무장 가능) */
  const armSignal = () => {
    litRef.current = null;
    setLit(null);
    go("r1-wait");
    clearT(signalT);
    const delay = 600 + Math.random() * 1400;
    signalT.current = setTimeout(() => {
      let n = 1 + Math.floor(Math.random() * 9);
      if (n === lastLitRef.current) n = (n % 9) + 1; // 직전과 같은 숫자 회피
      lastLitRef.current = n;
      litRef.current = n;
      setLit(n);
      signalAtRef.current = performance.now();
      go("r1-signal");
    }, delay);
  };

  const startR1 = () => {
    trialRef.current = 1;
    setTrial(1);
    armSignal();
  };

  /* ── 2라운드: 규칙 시퀀스 ── */

  const startSet = () => {
    const r = makeRule();
    const seq = buildSeq(r);
    setRule(r);
    seqRef.current = seq;
    seqPosRef.current = 0;
    setSeqPos(0);
    setSeqLen(seq.length);
    go("r2-rule");
  };

  /** 규칙 3초 표시 종료 → 플레이 시작 (시간 측정 개시) */
  const ruleLeft = useCountdown(RULE_SHOW_MS, phase === "r2-rule", () => {
    setStartAtRef.current = performance.now();
    setElapsed(0);
    go("r2-play");
  });

  // 플레이 중 경과 시간 표시 틱
  useEffect(() => {
    if (phase !== "r2-play") return;
    const id = setInterval(() => {
      setElapsed(performance.now() - setStartAtRef.current);
    }, 100);
    return () => clearInterval(id);
  }, [phase]);

  const doFinish = () => {
    if (finishedRef.current) return;
    finishedRef.current = true;
    clearAll();

    const rts = rtsRef.current;
    const avgRt =
      rts.length > 0 ? rts.reduce((a, b) => a + b, 0) / rts.length : null;
    // R1 속도점수: 평균 RT 250ms(만점) ~ 800ms(0점) 선형
    const r1Speed = avgRt === null ? 0 : clamp01((800 - avgRt) / 550);

    // R2 정확도: 세트당 오답 0=만점, 3개 이상=0점 선형 → 세트 평균
    const errs = errorsRef.current;
    const acc =
      errs.reduce((sum, e) => sum + clamp01(1 - e / 3), 0) / R2_SETS;
    // R2 완주 속도: 세트 평균 9초(만점) ~ 20초(0점) 선형
    const times = setTimesRef.current;
    const avgSec =
      times.length > 0 ? times.reduce((a, b) => a + b, 0) / times.length : 0;
    const spd = times.length > 0 ? clamp01((20 - avgSec) / 11) : 0;
    const r2 = acc * 0.7 + spd * 0.3;

    const score = Math.max(
      0,
      Math.min(100, Math.round(r1Speed * 40 + r2 * 60)),
    );
    const totalErr = errs.reduce((a, b) => a + b, 0);

    finish({
      score,
      label: `반응 ${avgRt === null ? "측정 없음" : `${Math.round(avgRt)}ms`} · 오답 ${totalErr}개`,
      detail: [
        {
          name: "R1 평균 반응시간",
          value: avgRt === null ? "측정 없음" : `${Math.round(avgRt)}ms`,
        },
        { name: "너무 빨랐던 횟수", value: `${tooFastRef.current}회` },
        { name: "R2 오답 수", value: `${totalErr}개` },
        {
          name: "세트 평균 시간",
          value: times.length > 0 ? `${avgSec.toFixed(1)}초` : "—",
        },
      ],
    });
  };

  /* ── 입력 처리 (클릭·키보드 공용) ── */

  const press = (n: number) => {
    if (finishedRef.current) return;
    const ph = phaseRef.current;
    if (ph !== "r1-wait" && ph !== "r1-signal" && ph !== "r2-play") return;

    // 눌림 하이라이트
    setPressed(n);
    clearT(pressT);
    pressT.current = setTimeout(() => setPressed(null), 130);

    if (ph === "r1-wait") {
      // 신호 전 입력 = 오답 기록 + 같은 시행 재대기
      tooFastRef.current += 1;
      setTooFast(tooFastRef.current);
      showFlash("너무 빨라요!", "bad");
      armSignal();
      return;
    }

    if (ph === "r1-signal") {
      if (n === litRef.current) {
        const rt = performance.now() - signalAtRef.current;
        rtsRef.current.push(rt);
        showFlash(`${Math.round(rt)}ms`, "ok");
      } else {
        showFlash("오답", "bad");
      }
      litRef.current = null;
      setLit(null);
      go("r1-gap");
      clearT(gapT);
      gapT.current = setTimeout(() => {
        if (trialRef.current >= R1_TRIALS) {
          go("r2-intro");
        } else {
          trialRef.current += 1;
          setTrial(trialRef.current);
          armSignal();
        }
      }, 550);
      return;
    }

    // ph === "r2-play"
    const seq = seqRef.current;
    const pos = seqPosRef.current;
    if (n === seq[pos]) {
      const next = pos + 1;
      seqPosRef.current = next;
      setSeqPos(next);
      if (next >= seq.length) {
        const sec = (performance.now() - setStartAtRef.current) / 1000;
        setTimesRef.current.push(sec);
        if (setIdxRef.current >= R2_SETS - 1) {
          doFinish();
        } else {
          setLastSetSec(sec);
          go("r2-gap");
          clearT(gapT);
          gapT.current = setTimeout(() => {
            setIdxRef.current += 1;
            setSetIdx(setIdxRef.current);
            startSet();
          }, 1300);
        }
      }
    } else {
      // 잘못 누름 — 오답 +1, 진행은 그대로 (되돌릴 수 없음)
      errorsRef.current[setIdxRef.current] += 1;
      setErrTotal(errorsRef.current.reduce((a, b) => a + b, 0));
      showFlash("오답", "bad", 500);
    }
  };

  const pressRef = useRef(press);
  pressRef.current = press;

  // 숫자키 1~9 (상단·넘패드 공통)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat) return;
      if (e.key >= "1" && e.key <= "9") pressRef.current(Number(e.key));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  /* ───────────────────────── 렌더 ───────────────────────── */

  if (phase === "r1-intro") {
    return (
      <RoundIntro
        title="1라운드 · 단순 반응"
        lines={[
          `총 ${R1_TRIALS}번, 키패드의 무작위 숫자 하나에 불이 들어옵니다.`,
          "불이 들어온 숫자를 최대한 빠르게 누르세요 — 반응시간이 기록됩니다.",
          "불이 들어오기 전에 누르면 오답입니다. 신호를 기다리세요.",
        ]}
        keys={[{ key: "1~9", action: "숫자 입력 (클릭도 가능)" }]}
        onStart={() => go("r1-countdown")}
      />
    );
  }

  if (phase === "r1-countdown") {
    return <Countdown onDone={startR1} />;
  }

  if (phase === "r1-wait" || phase === "r1-signal" || phase === "r1-gap") {
    return (
      <div>
        <GameHUD
          left={`1라운드 · ${trial}/${R1_TRIALS}`}
          right={`너무 빠름 ${tooFast}회`}
        />
        <div className="flex min-h-[24rem] flex-col items-center justify-center gap-6">
          <FlashLine flash={flash} />
          <Keypad lit={lit} pressed={pressed} onPress={(n) => pressRef.current(n)} />
          <p className="text-[13px] text-muted-soft">
            불이 들어온 숫자를 최대한 빠르게 누르세요
          </p>
        </div>
      </div>
    );
  }

  if (phase === "r2-intro") {
    return (
      <RoundIntro
        title="2라운드 · 규칙 시퀀스"
        lines={[
          `총 ${R2_SETS}세트. 세트마다 새 규칙이 3초간 표시된 뒤 사라집니다.`,
          "1부터 9까지 오름차순으로 누르되, 규칙의 숫자는 건너뛰거나 두 번 누릅니다.",
          "잘못 누르면 오답 +1 — 되돌릴 수 없고 진행은 그대로입니다.",
          "세트 완주 시간이 기록됩니다. 정확하게, 그리고 빠르게.",
        ]}
        keys={[{ key: "1~9", action: "숫자 입력 (클릭도 가능)" }]}
        startLabel="세트 1 시작"
        onStart={() => {
          setIdxRef.current = 0;
          setSetIdx(0);
          startSet();
        }}
      />
    );
  }

  if (phase === "r2-rule" && rule) {
    return (
      <div>
        <GameHUD
          left={`2라운드 · 세트 ${setIdx + 1}/${R2_SETS}`}
          right="규칙 암기"
        />
        <div className="flex min-h-[24rem] flex-col items-center justify-center gap-6">
          <p className="text-sm font-medium text-muted">
            1부터 9까지 오름차순, 단 —
          </p>
          <div className="space-y-4 text-center">
            <p className="text-2xl font-semibold text-ink sm:text-3xl">
              <span className="text-error">{rule.skips.join(", ")}</span> 은
              건너뛰기
            </p>
            <p className="text-2xl font-semibold text-ink sm:text-3xl">
              <span className="text-success">{rule.double}</span> 은 두 번
              누르기
            </p>
          </div>
          <div className="w-56">
            <TimeBar remaining={ruleLeft} total={RULE_SHOW_MS} />
          </div>
          <p className="text-[13px] text-muted-soft">
            규칙은 시작하면 사라집니다 — 입으로 되뇌세요
          </p>
        </div>
      </div>
    );
  }

  if (phase === "r2-play") {
    return (
      <div>
        <GameHUD
          left={`2라운드 · 세트 ${setIdx + 1}/${R2_SETS}`}
          right={`${(elapsed / 1000).toFixed(1)}초 · 오답 ${errTotal}개`}
        />
        <div className="flex min-h-[24rem] flex-col items-center justify-center gap-6">
          <FlashLine flash={flash} />
          <Keypad
            lit={null}
            pressed={pressed}
            onPress={(n) => pressRef.current(n)}
          />
          <div className="flex w-56 flex-col items-center gap-2">
            <p className="text-sm font-medium tabular-nums text-body">
              진행 {seqPos}/{seqLen}
            </p>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-strong">
              <div
                className="h-full rounded-full bg-ink transition-[width] duration-150"
                style={{
                  width: `${seqLen > 0 ? (seqPos / seqLen) * 100 : 0}%`,
                }}
              />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (phase === "r2-gap") {
    return (
      <div>
        <GameHUD
          left={`2라운드 · 세트 ${setIdx + 1}/${R2_SETS}`}
          right={`오답 ${errTotal}개`}
        />
        <div className="flex min-h-[24rem] flex-col items-center justify-center gap-3">
          <p className="display-sm">세트 {setIdx + 1} 완료</p>
          <p className="text-base text-body tabular-nums">
            {lastSetSec.toFixed(1)}초
          </p>
          <p className="mt-2 text-[13px] text-muted-soft">
            잠시 후 다음 세트 규칙이 표시됩니다
          </p>
        </div>
      </div>
    );
  }

  // 전환 직전 프레임 등 — 빈 보드 유지
  return <div className="min-h-[24rem]" />;
}

/* ───────────────────────── 보조 컴포넌트 ───────────────────────── */

/** 키패드 위 피드백 한 줄 (높이 고정 → 레이아웃 점프 방지) */
function FlashLine({ flash }: { flash: FlashMsg }) {
  return (
    <div className="flex h-8 items-center justify-center">
      {flash && (
        <span
          className={`text-lg font-semibold ${
            flash.tone === "ok" ? "text-success" : "text-error"
          }`}
        >
          {flash.text}
        </span>
      )}
    </div>
  );
}

/** 전화기 배열 3×3 고정 키패드 — 1 2 3 / 4 5 6 / 7 8 9 */
function Keypad({
  lit,
  pressed,
  onPress,
}: {
  lit: number | null;
  pressed: number | null;
  onPress: (n: number) => void;
}) {
  return (
    <div className="grid grid-cols-3 gap-3">
      {PAD.map((n) => {
        const isLit = lit === n;
        const isPressed = pressed === n;
        return (
          <button
            key={n}
            type="button"
            tabIndex={-1}
            onPointerDown={() => onPress(n)}
            className={`flex h-16 w-16 select-none items-center justify-center rounded-xl border text-2xl font-semibold transition-transform duration-75 sm:h-20 sm:w-20 ${
              isLit
                ? "scale-110 border-primary bg-primary text-on-dark shadow-[0_4px_12px_rgba(0,0,0,0.25)]"
                : isPressed
                  ? "scale-95 border-hairline bg-surface-strong text-ink"
                  : "border-hairline bg-surface-card text-ink"
            }`}
          >
            {n}
          </button>
        );
      })}
    </div>
  );
}
