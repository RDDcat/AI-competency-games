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

type Hand = "scissors" | "rock" | "paper";
type Side = "me" | "opp";

const HANDS: readonly Hand[] = ["scissors", "rock", "paper"];
const EMOJI: Record<Hand, string> = { scissors: "✌️", rock: "✊", paper: "🖐" };
const HAND_NAME: Record<Hand, string> = { scissors: "가위", rock: "바위", paper: "보" };
/** h 를 이기는 패 */
const WIN_OVER: Record<Hand, Hand> = { scissors: "rock", rock: "paper", paper: "scissors" };
/** h 에게 지는 패 (= h 가 이기는 패) */
const LOSE_TO: Record<Hand, Hand> = { scissors: "paper", rock: "scissors", paper: "rock" };

const ROUND_COUNTS = [10, 10, 14] as const;
const ROUND_START = [0, 10, 20] as const;
const TOTAL = 34;
const QUESTION_MS = 3000;
const FLASH_MS = 300;
const SPEED_BEST_MS = 400;
const SPEED_WORST_MS = 2500;

type Question = { round: 0 | 1 | 2; unknown: Side; shown: Hand; answer: Hand };
type Rec = { round: number; ok: boolean; rt: number | null; timeout: boolean };

function randHand(): Hand {
  return HANDS[Math.floor(Math.random() * HANDS.length)];
}

/** 매 플레이마다 새 문항 생성 — 정답은 표(WIN_OVER/LOSE_TO)에서 유도되므로 항상 존재 */
function makeQuestions(): Question[] {
  const qs: Question[] = [];
  for (const round of [0, 1, 2] as const) {
    let prevShown: Hand | null = null;
    for (let i = 0; i < ROUND_COUNTS[round]; i++) {
      const unknown: Side =
        round === 0 ? "me" : round === 1 ? "opp" : Math.random() < 0.5 ? "me" : "opp";
      let shown = randHand();
      // 같은 패가 연속으로 나오면 단조로워서 한 칸 회전
      if (shown === prevShown) {
        shown = HANDS[(HANDS.indexOf(shown) + 1 + Math.floor(Math.random() * 2)) % 3];
      }
      prevShown = shown;
      const answer = unknown === "me" ? WIN_OVER[shown] : LOSE_TO[shown];
      qs.push({ round, unknown, shown, answer });
    }
  }
  return qs;
}

const KEY_HELP = [
  { key: "←", action: "가위" },
  { key: "↓", action: "바위" },
  { key: "→", action: "보" },
];

const ROUND_INTRO: { title: string; lines: string[] }[] = [
  {
    title: "1라운드 — 물음표는 항상 ‘나’",
    lines: [
      "왼쪽(나) 카드에 물음표, 오른쪽(상대)에 패가 보입니다.",
      "상대 패를 이기는 패를 입력하세요.",
      "멘탈모델: 물음표가 왼쪽이면 → 이기자!",
      "문항당 제한시간 3초 · 10문항",
    ],
  },
  {
    title: "2라운드 — 물음표는 항상 ‘상대’",
    lines: [
      "왼쪽(나)에 내 패가 보이고, 오른쪽(상대) 카드가 물음표입니다.",
      "‘나’가 이겨야 하므로 내 패에 지는 패를 입력해야 정답입니다.",
      "멘탈모델: 물음표가 오른쪽이면 → 지자!",
      "문항당 제한시간 3초 · 10문항",
    ],
  },
  {
    title: "3라운드 — 물음표 위치 랜덤",
    lines: [
      "문항마다 물음표가 왼쪽 또는 오른쪽에 무작위로 나타납니다.",
      "물음표가 왼쪽(나)이면 이기는 패, 오른쪽(상대)이면 지는 패!",
      "문항당 제한시간 3초 · 14문항",
    ],
  },
];

/* ───────────────────────── 컴포넌트 ───────────────────────── */

type Phase = "intro" | "countdown" | "question" | "flash";

export default function Game() {
  const { finish } = useGameShell();

  const [questions] = useState<Question[]>(() => makeQuestions());
  const [phase, setPhase] = useState<Phase>("intro");
  const [qIndex, setQIndex] = useState(0);
  const [flashOk, setFlashOk] = useState<boolean | null>(null);
  const [picked, setPicked] = useState<Hand | null>(null);
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
    const roundCorrect = [0, 1, 2].map(
      (r) => recs.filter((x) => x.round === r && x.ok).length,
    );
    const timeouts = recs.filter((r) => r.timeout).length;
    const rts = recs.filter((r) => r.rt !== null).map((r) => r.rt as number);
    const avg = rts.length > 0 ? rts.reduce((a, b) => a + b, 0) / rts.length : null;
    const speed =
      avg === null
        ? 0
        : Math.max(0, Math.min(1, (SPEED_WORST_MS - avg) / (SPEED_WORST_MS - SPEED_BEST_MS)));
    const score = Math.max(
      0,
      Math.min(100, Math.round((correct / TOTAL) * 70 + speed * 30)),
    );
    finish({
      score,
      label: `정답 ${correct}/${TOTAL}`,
      detail: [
        { name: "1라운드 (물음표 = 나)", value: `${roundCorrect[0]}/${ROUND_COUNTS[0]}` },
        { name: "2라운드 (물음표 = 상대)", value: `${roundCorrect[1]}/${ROUND_COUNTS[1]}` },
        { name: "3라운드 (위치 랜덤)", value: `${roundCorrect[2]}/${ROUND_COUNTS[2]}` },
        {
          name: "평균 반응시간 (정답 기준)",
          value: avg !== null ? `${(avg / 1000).toFixed(2)}초` : "—",
        },
        { name: "시간 초과", value: `${timeouts}회` },
      ],
    });
  };

  /** 응답 처리 — h === null 은 시간 초과 */
  const submit = (h: Hand | null) => {
    if (phaseRef.current !== "question") return;
    const i = qIndexRef.current;
    const q = questions[i];
    const ok = h !== null && h === q.answer;
    recsRef.current.push({
      round: q.round,
      ok,
      rt: ok ? Date.now() - askStartRef.current : null,
      timeout: h === null,
    });
    if (ok) setCorrectCount((c) => c + 1);
    setPicked(h);
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
      setPicked(null);
      setQIndex(next);
      setPhase(questions[next].round !== q.round ? "intro" : "question");
    }, FLASH_MS);
  };

  const submitRef = useRef(submit);
  submitRef.current = submit;

  /* 문항 제한시간 */
  const remaining = useCountdown(QUESTION_MS, phase === "question", () =>
    submitRef.current(null),
  );

  /* 키보드 입력 */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat) return;
      const map: Partial<Record<string, Hand>> = {
        ArrowLeft: "scissors",
        ArrowDown: "rock",
        ArrowRight: "paper",
      };
      const h = map[e.key];
      if (!h || phaseRef.current !== "question") return;
      e.preventDefault();
      submitRef.current(h);
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

  const q = questions[qIndex];
  const round = q.round;
  const intro = ROUND_INTRO[round];

  if (phase === "intro") {
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
        <Countdown onDone={() => setPhase("question")} />
      </div>
    );
  }

  /* question · flash */
  const qNum = qIndex - ROUND_START[round] + 1;
  const myHand: Hand | null = q.unknown === "me" ? picked : q.shown;
  const oppHand: Hand | null = q.unknown === "opp" ? picked : q.shown;

  return (
    <div className="min-h-[24rem]">
      <GameHUD
        left={`${round + 1}라운드 · ${qNum}/${ROUND_COUNTS[round]}`}
        right={`정답 ${correctCount}`}
      />
      <TimeBar remaining={phase === "question" ? remaining : 0} total={QUESTION_MS} />

      <p className="mt-4 text-center text-[13px] font-medium text-muted">
        물음표가 왼쪽이면 이기자 · 오른쪽이면 지자
      </p>

      <div className="mx-auto my-5 grid max-w-lg grid-cols-2 gap-4 sm:gap-6">
        <HandCard label="나" unknown={q.unknown === "me"} hand={myHand} />
        <HandCard label="상대" unknown={q.unknown === "opp"} hand={oppHand} />
      </div>

      <Flash ok={flashOk} />

      <div className="mx-auto mt-4 grid max-w-lg grid-cols-3 gap-3">
        {HANDS.map((h, i) => (
          <button
            key={h}
            type="button"
            disabled={phase !== "question"}
            onClick={() => submit(h)}
            className="flex flex-col items-center gap-1.5 rounded-xl border border-hairline bg-canvas py-4 transition-colors active:bg-surface-soft disabled:opacity-60"
          >
            <span className="text-3xl leading-none">{EMOJI[h]}</span>
            <span className="inline-flex items-center gap-1.5 text-[13px] font-medium text-body">
              <KeyCap>{KEY_HELP[i].key}</KeyCap> {HAND_NAME[h]}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

function HandCard({
  label,
  unknown,
  hand,
}: {
  label: string;
  unknown: boolean;
  hand: Hand | null;
}) {
  return (
    <div
      className={`flex flex-col items-center rounded-2xl border p-6 sm:p-8 ${
        unknown ? "border-ink bg-canvas" : "border-hairline bg-surface-card"
      }`}
    >
      <span className="mb-3 text-[13px] font-semibold text-muted">{label}</span>
      <span className="flex h-24 items-center justify-center">
        {hand !== null ? (
          <span className="text-7xl leading-none">{EMOJI[hand]}</span>
        ) : (
          <span className="text-6xl font-semibold leading-none text-ink">?</span>
        )}
      </span>
    </div>
  );
}
