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

/* ───────────────────────── 도메인 ───────────────────────── */

type ColorId = "red" | "blue" | "green" | "yellow";
type Mode = "meaning" | "color";

const COLORS: readonly ColorId[] = ["red", "blue", "green", "yellow"];
const COLOR_NAME: Record<ColorId, string> = {
  red: "빨강",
  blue: "파랑",
  green: "초록",
  yellow: "노랑",
};
const COLOR_HEX: Record<ColorId, string> = {
  red: "#ef4444",
  blue: "#3b82f6",
  green: "#10b981",
  yellow: "#f59e0b",
};

const TOTAL = 60;
const QUESTION_MS = 2500;
const FLASH_MS = 300;
const SPEED_BEST_MS = 500;
const SPEED_WORST_MS = 2000;
const INTERFERENCE_RATIO = 0.7;

type Question = {
  mode: Mode;
  /** 기준 색이름 (검정 글자로 표시) */
  criterion: ColorId;
  /** 제시어의 의미 (단어) */
  word: ColorId;
  /** 제시어의 잉크색 */
  ink: ColorId;
  /** 정답: 일치(true) / 불일치(false) */
  match: boolean;
  /** 의미 ≠ 잉크색 (간섭 문항) */
  interference: boolean;
  /** 모드 전환 직후 문항 */
  isSwitch: boolean;
};

type Rec = { ok: boolean; rt: number | null; timeout: boolean; q: Question };

function pickOther(exclude: ColorId): ColorId {
  const pool = COLORS.filter((c) => c !== exclude);
  return pool[Math.floor(Math.random() * pool.length)];
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * 매 플레이마다 새 문항 생성.
 * - 일치/불일치 정확히 50:50, 간섭(의미≠잉크) 70%
 * - 모드는 3~7문항 연속 후 전환 (전환 직후 문항에 isSwitch 기록)
 * - 정답(match)이 생성 규칙에서 직접 유도되므로 항상 존재:
 *   의미 기준 → word===criterion ⇔ match, 색깔 기준 → ink===criterion ⇔ match
 */
function makeQuestions(): Question[] {
  // 1) 모드 블록 (3~7문항 run 후 전환)
  const modes: Mode[] = [];
  const switches: boolean[] = [];
  let mode: Mode = Math.random() < 0.5 ? "meaning" : "color";
  while (modes.length < TOTAL) {
    const run = 3 + Math.floor(Math.random() * 5); // 3~7
    for (let i = 0; i < run && modes.length < TOTAL; i++) {
      switches.push(i === 0 && modes.length > 0); // 맨 첫 문항은 전환 아님
      modes.push(mode);
    }
    mode = mode === "meaning" ? "color" : "meaning";
  }

  // 2) 일치 50:50 · 간섭 70% 플래그를 셔플해 배분
  const matches = shuffle(
    Array.from({ length: TOTAL }, (_, i) => i < TOTAL / 2),
  );
  const nInterf = Math.round(TOTAL * INTERFERENCE_RATIO);
  const interfs = shuffle(Array.from({ length: TOTAL }, (_, i) => i < nInterf));

  // 3) 문항 구성
  return modes.map((m, i) => {
    const match = matches[i];
    const interference = interfs[i];
    const criterion = COLORS[Math.floor(Math.random() * COLORS.length)];
    let word: ColorId;
    let ink: ColorId;
    if (m === "meaning") {
      word = match ? criterion : pickOther(criterion);
      ink = interference ? pickOther(word) : word;
    } else {
      ink = match ? criterion : pickOther(criterion);
      word = interference ? pickOther(ink) : ink;
    }
    return { mode: m, criterion, word, ink, match, interference, isSwitch: switches[i] };
  });
}

const KEY_HELP = [
  { key: "←", action: "일치" },
  { key: "→", action: "불일치" },
];

/* ───────────────────────── 컴포넌트 ───────────────────────── */

type Phase = "intro" | "countdown" | "question" | "flash";

export default function Game() {
  const { finish } = useGameShell();

  const [questions] = useState<Question[]>(() => makeQuestions());
  const [phase, setPhase] = useState<Phase>("intro");
  const [qIndex, setQIndex] = useState(0);
  const [flashOk, setFlashOk] = useState<boolean | null>(null);
  const [correctCount, setCorrectCount] = useState(0);

  const phaseRef = useRef<Phase>(phase);
  phaseRef.current = phase;
  const qIndexRef = useRef(qIndex);
  qIndexRef.current = qIndex;

  const recsRef = useRef<Rec[]>([]);
  const askStartRef = useRef(0);
  const finishedRef = useRef(false);
  const flashTimerRef = useRef<number | null>(null);

  /* 문항이 화면에 깔린 시점 기록 (반응시간 기준점) */
  useEffect(() => {
    if (phase === "question") askStartRef.current = Date.now();
  }, [phase, qIndex]);

  const endGame = () => {
    if (finishedRef.current) return;
    finishedRef.current = true;
    const recs = recsRef.current;
    const correct = recs.filter((r) => r.ok).length;
    const sw = recs.filter((r) => r.q.isSwitch);
    const swOk = sw.filter((r) => r.ok).length;
    const itf = recs.filter((r) => r.q.interference);
    const itfOk = itf.filter((r) => r.ok).length;
    const rts = recs
      .filter((r) => r.ok && r.rt !== null)
      .map((r) => r.rt as number);
    const avg = rts.length > 0 ? rts.reduce((a, b) => a + b, 0) / rts.length : null;
    const speed =
      avg === null
        ? 0
        : Math.max(
            0,
            Math.min(1, (SPEED_WORST_MS - avg) / (SPEED_WORST_MS - SPEED_BEST_MS)),
          );
    const acc = correct / TOTAL;
    const score = Math.max(0, Math.min(100, Math.round(acc * 80 + speed * 20)));
    const pct = (n: number, d: number) =>
      d > 0 ? `${n}/${d} (${Math.round((n / d) * 100)}%)` : "—";
    finish({
      score,
      label: `정답 ${correct}/${TOTAL}`,
      detail: [
        { name: "전체 정답률", value: pct(correct, TOTAL) },
        { name: "모드 전환 직후 정답률 (전환 비용)", value: pct(swOk, sw.length) },
        { name: "간섭 문항 정답률 (의미≠색)", value: pct(itfOk, itf.length) },
        {
          name: "평균 반응시간 (정답 기준)",
          value: avg !== null ? `${(avg / 1000).toFixed(2)}초` : "—",
        },
      ],
    });
  };

  /** 응답 처리 — answer === null 은 시간 초과(무응답 = 오답) */
  const submit = (answer: boolean | null) => {
    if (phaseRef.current !== "question") return;
    const i = qIndexRef.current;
    const q = questions[i];
    const ok = answer !== null && answer === q.match;
    recsRef.current.push({
      ok,
      rt: answer !== null ? Date.now() - askStartRef.current : null,
      timeout: answer === null,
      q,
    });
    if (ok) setCorrectCount((c) => c + 1);
    setFlashOk(ok);
    phaseRef.current = "flash"; // 타이머 만료 콜백 레이스 차단
    setPhase("flash");
    flashTimerRef.current = window.setTimeout(() => {
      flashTimerRef.current = null;
      const next = i + 1;
      if (next >= questions.length) {
        endGame();
        return;
      }
      setFlashOk(null);
      setQIndex(next);
      setPhase("question");
    }, FLASH_MS);
  };

  const submitRef = useRef(submit);
  submitRef.current = submit;

  /* 문항 제한시간 — 만료 시 무응답 = 오답 */
  const remaining = useCountdown(QUESTION_MS, phase === "question", () =>
    submitRef.current(null),
  );

  /* 키보드 입력: ← 일치 · → 불일치 */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat) return;
      if (phaseRef.current !== "question") return;
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        submitRef.current(true);
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        submitRef.current(false);
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
    return (
      <div className="min-h-[24rem]">
        <RoundIntro
          title="색-단어 일치 판단"
          lines={[
            "색 이름 단어가 무작위 잉크색으로 칠해져 나옵니다.",
            "상단 기준이 [의미 기준]이면 단어의 뜻이, [색깔 기준]이면 잉크색이",
            "기준 색이름과 같은지 판단하세요.",
            "기준 모드는 몇 문항마다 예고 없이 전환됩니다 — 배지를 항상 확인!",
            `총 ${TOTAL}문항 · 문항당 ${QUESTION_MS / 1000}초 · 무응답은 오답`,
          ]}
          keys={KEY_HELP}
          onStart={() => setPhase("countdown")}
        />
      </div>
    );
  }

  if (phase === "countdown") {
    return (
      <div className="min-h-[24rem]">
        <Countdown onDone={() => setPhase("question")} />
      </div>
    );
  }

  /* question · flash */
  const q = questions[qIndex];
  const isMeaning = q.mode === "meaning";

  return (
    <div className="min-h-[24rem]">
      <GameHUD left={`문항 ${qIndex + 1}/${TOTAL}`} right={`정답 ${correctCount}`} />
      <TimeBar remaining={phase === "question" ? remaining : 0} total={QUESTION_MS} />

      {/* 기준 모드 배지 + 기준 색이름 (검정 글자) */}
      <div className="mt-5 flex items-center justify-center gap-2.5">
        <span
          className={`inline-flex items-center rounded-full px-3 py-1 text-[13px] font-semibold text-ink ${
            isMeaning ? "bg-badge-violet/15" : "bg-badge-orange/20"
          }`}
        >
          {isMeaning ? "의미 기준" : "색깔 기준"}
        </span>
        <span className="text-base font-semibold text-ink">
          기준 [{COLOR_NAME[q.criterion]}]
        </span>
      </div>

      {/* 제시어 */}
      <div className="mx-auto my-5 flex h-44 max-w-lg items-center justify-center rounded-2xl border border-hairline bg-surface-card">
        <span
          className="text-6xl font-semibold leading-none sm:text-7xl"
          style={{ color: COLOR_HEX[q.ink] }}
        >
          {COLOR_NAME[q.word]}
        </span>
      </div>

      <Flash ok={flashOk} />

      <div className="mx-auto mt-4 grid max-w-lg grid-cols-2 gap-3">
        <button
          type="button"
          disabled={phase !== "question"}
          onClick={() => submit(true)}
          className="flex flex-col items-center gap-1.5 rounded-xl border border-hairline bg-canvas py-4 transition-colors active:bg-surface-soft disabled:opacity-60"
        >
          <span className="text-xl font-semibold leading-none text-success">O</span>
          <span className="inline-flex items-center gap-1.5 text-[13px] font-medium text-body">
            <KeyCap>←</KeyCap> 일치
          </span>
        </button>
        <button
          type="button"
          disabled={phase !== "question"}
          onClick={() => submit(false)}
          className="flex flex-col items-center gap-1.5 rounded-xl border border-hairline bg-canvas py-4 transition-colors active:bg-surface-soft disabled:opacity-60"
        >
          <span className="text-xl font-semibold leading-none text-error">X</span>
          <span className="inline-flex items-center gap-1.5 text-[13px] font-medium text-body">
            <KeyCap>→</KeyCap> 불일치
          </span>
        </button>
      </div>

      <p className="mt-4 text-center text-[13px] font-medium text-muted">
        의미 기준 = 단어의 뜻 · 색깔 기준 = 잉크색
      </p>
    </div>
  );
}
