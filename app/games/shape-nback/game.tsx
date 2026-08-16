"use client";

import { useEffect, useRef, useState } from "react";
import { useGameShell } from "@/components/game-shell";
import { Countdown, Flash, GameHUD, RoundIntro } from "@/components/game-ui";
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

/* ───────────────────────── 도형 ───────────────────────── */

/**
 * 등장 도형 3종 — 전부 같은 민트색이다.
 * 색 단서를 없애 형태로만 구분하게 하는 것이 N-back 과제의 핵심이므로
 * 이모지가 아니라 직접 그린 SVG 패스를 쓴다(기기·폰트별 모양 차이도 함께 제거).
 *  ① 별   ② 원을 좌우로 쪼갠 반원 |)(|   ③ 정사각형을 45° 돌린 마름모
 * 모두 100×100 뷰박스 기준.
 */
const SHAPES = [
  {
    name: "별",
    paths: [
      "M50,4 L61.5,34.1 L93.7,35.8 L68.6,56.1 L77,87.2 L50,69.6 L23,87.2 L31.4,56.1 L6.3,35.8 L38.5,34.1 Z",
    ],
  },
  {
    name: "반원",
    // 지름 76 짜리 원을 세로로 자른 뒤 두 조각의 평평한 면을 바깥으로 돌린 모양.
    // 두 호의 정점이 정중앙(50,50)에서 맞닿는다.
    paths: ["M12,12 A38,38 0 0,1 12,88 Z", "M88,12 A38,38 0 0,0 88,88 Z"],
  },
  {
    name: "마름모",
    paths: ["M50,6 L94,50 L50,94 L6,50 Z"],
  },
] as const;

function ShapeGlyph({ id, size }: { id: number; size: number }) {
  const shape = SHAPES[id];
  return (
    <svg
      viewBox="0 0 100 100"
      width={size}
      height={size}
      role="img"
      aria-label={shape.name}
      className="shrink-0"
    >
      {shape.paths.map((d) => (
        <path
          key={d}
          d={d}
          fill="var(--color-mint)"
          stroke="var(--color-mint-deep)"
          strokeWidth="2.5"
          strokeLinejoin="round"
        />
      ))}
    </svg>
  );
}

/* ───────────────────────── 제한시간 바 ───────────────────────── */

/**
 * 공용 TimeBar(남은 시간이 줄어드는 방식) 대신 쓰는 전용 바.
 * 이 게임은 보통 1초 안에 응답이 끝나서, 2.5초짜리 바가 줄어드는 연출로는
 * 100%→70% 정도만 변해 멈춰 있는 것처럼 보인다. 그래서 '지나간 시간'이
 * 0에서부터 차오르게 뒤집었다 — 짧은 경과 시간일수록 훨씬 또렷하게 읽힌다.
 *
 * ratio  0~1 로 정규화한 경과 시간
 * mark   응답한 시점의 위치(0~1) — 작은 삼각형으로 잠깐 찍혔다 사라진다
 * sweep  응답 직후, 바가 끝까지 밀려가는 마무리 연출(마커만 클릭 지점에 남는다)
 */
function ElapsedBar({
  ratio,
  mark,
  tone,
  sweep,
}: {
  ratio: number;
  mark: number | null;
  tone: "memo" | "answer";
  sweep: boolean;
}) {
  const clamp = (v: number) => Math.max(0, Math.min(1, v));
  const fill =
    tone === "memo" ? "bg-badge-violet" : ratio > 0.7 ? "bg-error" : "bg-ink";
  return (
    <div className="relative h-4.5">
      <div className="absolute inset-x-0 bottom-0 h-2 overflow-hidden rounded-full bg-surface-strong">
        <div
          className={`h-full rounded-full ${fill}`}
          style={{
            width: `${clamp(ratio) * 100}%`,
            // 진행 중엔 매 프레임 직접 그리므로 트랜지션이 없어야 시계와 어긋나지 않는다
            transition: sweep ? "width 240ms ease-out" : "none",
          }}
        />
      </div>
      {mark !== null && (
        <span
          className="pointer-events-none absolute bottom-2"
          style={{
            left: `${clamp(mark) * 100}%`,
            animation: "nback-mark 300ms ease-out both",
          }}
        >
          {/* 바를 내리찍는 방향의 삼각형 */}
          <svg width="13" height="8" viewBox="0 0 13 8" className="block" aria-hidden="true">
            <path d="M6.5,8 L0,0 L13,0 Z" fill="var(--color-ink)" />
          </svg>
        </span>
      )}
    </div>
  );
}

/* ───────────────────────── 상수 ───────────────────────── */

const QUESTION_MS = 2500;
const MEMORIZE_MS = 1500;
const FLASH_MS = 300;

type Phase = "intro" | "countdown" | "show" | "flash";
type RoundData = { seq: number[]; memo: number; answers: Action[] };
/** ms 는 카드 등장 → 응답까지의 반응속도. 무응답이면 null. */
type Rec = { round: 0 | 1; ok: boolean; noAnswer: boolean; ms: number | null };

const ROUND_INTRO = [
  {
    title: "1라운드 — 2-back",
    lines: [
      "도형이 카드 더미 위에 한 장씩 갱신됩니다. 등장 도형은 3종뿐!",
      "세 도형 모두 같은 색입니다 — 색이 아니라 형태로 구분하세요.",
      "처음 2장은 응답 없이 기억만 하세요.",
      "3번째부터: 지금 도형이 2번째 전과 같으면 ←, 다르면 Space.",
      "문항당 제한시간 2.5초 · 응답 20회 · 무응답은 오답입니다.",
      "팁: 도형에 이름을 붙여 “별-반-마름…” 소리내며 리듬을 타세요.",
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
  /** 직전에 실제로 눌린 응답 — 해당 버튼 위에 체크표시를 잠깐 띄운다 */
  const [pressed, setPressed] = useState<Action | null>(null);
  /** 응답한 시점의 바 위치(0~1) — 삼각형 마커 자리 */
  const [mark, setMark] = useState<number | null>(null);
  const [correct, setCorrect] = useState(0);
  const [remaining, setRemaining] = useState(QUESTION_MS);

  const cur = rounds[round];
  const isMemorize = seqIndex < cur.memo;
  const responding = phase === "show" && !isMemorize;
  const windowMs = isMemorize ? MEMORIZE_MS : QUESTION_MS;

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
  /** 현재 카드가 화면에 뜬 시각 — 남은 시간 계산과 반응속도 측정의 기준점 */
  const startedAtRef = useRef(0);

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
    // 반응속도는 실제로 키를 누른 문항만 — 무응답(2.5초 만료)을 섞으면 평균이 왜곡된다.
    const timed = recs.filter((r): r is Rec & { ms: number } => r.ms !== null);
    const avgMs =
      timed.length > 0
        ? Math.round(timed.reduce((s, r) => s + r.ms, 0) / timed.length)
        : null;
    const score = Math.max(0, Math.min(100, Math.round((total / TOTAL_RESP) * 100)));
    finish({
      score,
      label: `정답 ${total}/${TOTAL_RESP}`,
      detail: [
        { name: "1라운드 (2-back)", value: `${r1}/${R1_RESP}` },
        { name: "2라운드 (2&3-back)", value: `${r2}/${R2_RESP}` },
        {
          name: "평균 반응속도 (응답한 문항)",
          value:
            avgMs !== null ? `${(avgMs / 1000).toFixed(2)}초 (${timed.length}회)` : "—",
        },
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
    const elapsed = Math.max(0, performance.now() - startedAtRef.current);
    recsRef.current.push({
      round: r,
      ok,
      noAnswer: a === null,
      ms: a === null ? null : Math.round(elapsed),
    });
    if (ok) setCorrect((c) => c + 1);
    setFlashOk(ok);
    setPressed(a);
    // 무응답(시간 초과)은 바가 이미 끝까지 간 상태 — 찍을 '클릭 시점'이 없다
    setMark(a === null ? null : Math.min(1, elapsed / QUESTION_MS));
    phaseRef.current = "flash"; // 제한시간 만료 콜백 레이스 차단
    setPhase("flash");
    flashTimerRef.current = window.setTimeout(() => {
      flashTimerRef.current = null;
      setFlashOk(null);
      setPressed(null);
      setMark(null);
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

  /** 카드 제한시간 만료 — 기억 카드는 자동으로 다음 장, 응답 카드는 무응답 처리 */
  const expire = () => {
    if (seqIndexRef.current < rounds[roundRef.current].memo) {
      setSeqIndex((s) => s + 1); // 기억 카드는 라운드 마지막이 아니므로 단순 +1
    } else {
      submitRef.current(null);
    }
  };
  const expireRef = useRef(expire);
  expireRef.current = expire;

  /*
   * 카드 한 장의 제한시간 — 기억 카드(1.5초)와 응답 카드(2.5초)를 한 루프가 함께 돌린다.
   * 매 프레임 실제 경과 시각으로 남은 시간을 다시 계산하므로 상단 바가 항상 시계와 일치하고,
   * 카드가 뜬 시각(startedAtRef)은 그대로 반응속도 측정의 기준점이 된다.
   */
  useEffect(() => {
    if (phase !== "show") return;
    const total = seqIndex < rounds[round].memo ? MEMORIZE_MS : QUESTION_MS;
    const startedAt = performance.now();
    startedAtRef.current = startedAt;
    setRemaining(total);
    let raf = requestAnimationFrame(function tick() {
      const left = total - (performance.now() - startedAt);
      if (left > 0) {
        setRemaining(left);
        raf = requestAnimationFrame(tick);
        return;
      }
      setRemaining(0);
      expireRef.current();
    });
    return () => cancelAnimationFrame(raf);
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
          <div className="flex items-start gap-7">
            {SHAPES.map((s, i) => (
              <div key={s.name} className="flex flex-col items-center gap-1.5">
                <ShapeGlyph id={i} size={44} />
                <span className="text-[12px] font-medium text-muted">{s.name}</span>
              </div>
            ))}
          </div>
          <p className="text-[13px] text-muted">
            이번 판 등장 도형 3종 — 색이 같으니 형태와 이름으로 기억하세요
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
  // 응답 직후(flash)에는 바를 끝까지 밀어 마무리하고, 클릭 지점은 마커로 남긴다
  const barRatio = phase === "flash" ? 1 : 1 - remaining / windowMs;

  return (
    <div className="min-h-[24rem]">
      <style>{`@keyframes nback-flash{0%{box-shadow:0 0 0 6px rgba(17,17,17,.35);transform:scale(.96)}100%{box-shadow:0 0 0 0 rgba(17,17,17,0);transform:scale(1)}}@keyframes nback-check{0%{opacity:0;transform:scale(.6)}35%{opacity:1;transform:scale(1.08)}70%{opacity:1;transform:scale(1)}100%{opacity:0;transform:scale(1)}}@keyframes nback-mark{0%{opacity:0;transform:translate(-50%,-6px)}30%{opacity:1;transform:translate(-50%,0)}70%{opacity:1;transform:translate(-50%,0)}100%{opacity:0;transform:translate(-50%,0)}}`}</style>
      <GameHUD
        left={hudLeft}
        right={
          <span className="flex items-center gap-3">
            <span>정답 {correct}</span>
            <span
              className={`inline-block w-20 text-right ${
                responding && remaining <= 800 ? "text-error" : "text-muted"
              }`}
            >
              남은 {(remaining / 1000).toFixed(1)}초
            </span>
          </span>
        }
      />
      <ElapsedBar
        ratio={barRatio}
        mark={mark}
        tone={isMemorize ? "memo" : "answer"}
        sweep={phase === "flash"}
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
              <ShapeGlyph id={cur.seq[seqIndex]} size={112} />
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

      {/* 터치/마우스 응답 버튼 — 키보드로 눌러도 해당 칸에 체크표시가 잠깐 뜬다 */}
      <div
        className={`mx-auto mt-6 grid max-w-lg gap-3 ${
          round === 1 ? "grid-cols-3" : "grid-cols-2"
        }`}
      >
        <AnswerButton
          keyLabel="←"
          label="2번째 전과 같음"
          disabled={!responding}
          checked={pressed === "left"}
          onClick={() => submit("left")}
        />
        <AnswerButton
          keyLabel="Space"
          label={round === 0 ? "다름" : "둘 다 다름"}
          disabled={!responding}
          checked={pressed === "space"}
          onClick={() => submit("space")}
        />
        {round === 1 && (
          <AnswerButton
            keyLabel="→"
            label="3번째 전과 같음"
            disabled={!responding}
            checked={pressed === "right"}
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
  checked,
  onClick,
}: {
  keyLabel: string;
  label: string;
  disabled: boolean;
  checked: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      // 응답 직후엔 버튼이 disabled 로 바뀌지만, 체크표시가 흐려지면 안 되므로 그때만 dim 을 뺀다
      className={`relative flex flex-col items-center gap-1.5 rounded-xl border border-hairline bg-canvas py-3.5 transition-colors active:bg-surface-soft ${
        checked ? "border-ink" : "disabled:opacity-60"
      }`}
    >
      <KeyCap>{keyLabel}</KeyCap>
      <span className="text-[13px] font-medium text-body">{label}</span>
      {checked && (
        <span className="pointer-events-none absolute inset-0 flex items-center justify-center rounded-xl bg-canvas/92">
          <svg
            viewBox="0 0 24 24"
            width="40"
            height="40"
            fill="none"
            stroke="currentColor"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="text-ink"
            style={{ animation: "nback-check 300ms ease-out both" }}
            aria-hidden="true"
          >
            <path d="M4 12.5 L9.5 18 L20 6.5" />
          </svg>
        </span>
      )}
    </button>
  );
}
