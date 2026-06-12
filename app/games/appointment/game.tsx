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

/* ───────────────────────── 상수·도메인 ───────────────────────── */

const PERSONS = [
  { emoji: "🧑", name: "지훈" },
  { emoji: "👩", name: "수아" },
  { emoji: "🧔", name: "민준" },
] as const;

const DAYS = ["월", "화", "수", "목", "금", "토", "일"] as const;

/** 4×4 지도 칸에 깔리는 랜드마크 16종 — 플레이마다 배치 셔플 */
const LANDMARKS = [
  "🏥", "🏫", "🏦", "🏪", "☕", "🌳", "🎡", "🏟️",
  "⛲", "📚", "🗼", "🎬", "🛒", "🍞", "🚉", "⛪",
] as const;

const MENUS = [
  { emoji: "🍕", name: "피자" },
  { emoji: "🍣", name: "초밥" },
  { emoji: "🍜", name: "라멘" },
  { emoji: "🍔", name: "버거" },
  { emoji: "🥗", name: "샐러드" },
  { emoji: "🍱", name: "도시락" },
  { emoji: "🌮", name: "타코" },
  { emoji: "🍝", name: "파스타" },
  { emoji: "🍖", name: "바비큐" },
  { emoji: "🥘", name: "빠에야" },
  { emoji: "🍲", name: "전골" },
  { emoji: "🥪", name: "샌드위치" },
] as const;

type RoundIdx = 0 | 1 | 2 | 3;

const ROUNDS: RoundIdx[] = [0, 1, 2, 3];
const PER_ROUND = 4;
const TOTAL = 16;
const PRESENT_MS = 3000; // 사람당 카드 노출
const GAP_MS = 300; // 사람 사이 공백 (카드 소멸 체감 + 노출 타이머 리셋)
const ANSWER_MS = 8000; // 답 선택 제한
const FLASH_MS = 700;
const SPEED_BEST_MS = 1500;
const SPEED_WORST_MS = 7000;

type Question = {
  round: RoundIdx;
  /** 1~3R: 사람별 제시 개수 (3 또는 4) · 4R: 1 */
  k: number;
  /** 사람별 제시 목록 — R1 요일 idx · R2 칸 idx · R3 메뉴 idx · R4 버스 번호 */
  lists: [number[], number[], number[]];
  /** 정답 값 */
  answer: number;
  /** 보기 값 배열 — R1: 0~6, R2: 0~15, R3: 메뉴 8개, R4: 번호 4개 */
  options: number[];
};

type Rec = { round: RoundIdx; k: number; ok: boolean; rt: number | null; timeout: boolean };

/* ───────────────────────── 생성기 ───────────────────────── */

function shuffle<T>(arr: readonly T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function sample<T>(arr: readonly T[], n: number): T[] {
  return shuffle(arr).slice(0, n);
}

function range(from: number, to: number): number[] {
  const out: number[] = [];
  for (let i = from; i <= to; i++) out.push(i);
  return out;
}

/**
 * 풀 크기 poolSize 에서, 세 목록(각 k개)의 교집합이 정확히 answer 1개가 되도록 구성.
 * 1·2번 목록의 (answer 외) 공통 원소를 3번 목록 후보에서 제외하므로 교집합 1개가 보장된다.
 * 성립 조건 poolSize ≥ 2k-1 — 본 게임 최악 케이스 R1(k=4, pool=7)도 충족.
 */
function makeIntersectLists(poolSize: number, k: number): { lists: [number[], number[], number[]]; answer: number } {
  const answer = Math.floor(Math.random() * poolSize);
  const others = range(0, poolSize - 1).filter((v) => v !== answer);
  const l1 = sample(others, k - 1);
  const l2 = sample(others, k - 1);
  const common12 = l1.filter((v) => l2.includes(v));
  const l3 = sample(others.filter((v) => !common12.includes(v)), k - 1);
  return {
    lists: [shuffle([answer, ...l1]), shuffle([answer, ...l2]), shuffle([answer, ...l3])],
    answer,
  };
}

function makeQuestions(): Question[] {
  const qs: Question[] = [];
  for (const round of ROUNDS) {
    for (let i = 0; i < PER_ROUND; i++) {
      const k = i < 2 ? 3 : 4; // 라운드 전반 2문항은 3개 제시, 후반 2문항은 4개 제시
      if (round === 0) {
        const { lists, answer } = makeIntersectLists(DAYS.length, k);
        qs.push({ round, k, lists, answer, options: range(0, 6) });
      } else if (round === 1) {
        const { lists, answer } = makeIntersectLists(16, k);
        qs.push({ round, k, lists, answer, options: range(0, 15) });
      } else if (round === 2) {
        const { lists, answer } = makeIntersectLists(MENUS.length, k);
        // 보기 8개: 정답 + (세 사람이 언급한 메뉴 우선) + 나머지 풀에서 충원
        const mentioned = [...new Set(lists.flat())].filter((v) => v !== answer);
        const rest = range(0, MENUS.length - 1).filter((v) => v !== answer && !mentioned.includes(v));
        const options = shuffle([answer, ...[...shuffle(mentioned), ...shuffle(rest)].slice(0, 7)]);
        qs.push({ round, k, lists, answer, options });
      } else {
        // R4 버스: 두 자리 번호 4개 (탄 번호 3 + 안 탄 번호 1) — 정답 = 아무도 안 탄 번호
        const nums = sample(range(10, 99), 4);
        qs.push({
          round,
          k: 1,
          lists: [[nums[0]], [nums[1]], [nums[2]]],
          answer: nums[3],
          options: shuffle(nums),
        });
      }
    }
  }
  return qs;
}

/* ───────────────────────── 라운드 안내 ───────────────────────── */

const ROUND_INTROS: { title: string; lines: string[]; keys?: { key: string; action: string }[] }[] = [
  {
    title: "1라운드 — 공통 요일",
    lines: [
      "세 사람이 한 명씩 좋아하는 요일을 3초간 보여주고 사라집니다.",
      "동시에 볼 수 없으니 교집합만 들고 가세요.",
      "마지막에 셋 모두 겹치는 요일 하나를 고릅니다 (제한 8초).",
      "4문항 · 후반 2문항은 각자 4개씩 제시됩니다.",
    ],
    keys: [{ key: "1~7", action: "요일 선택" }],
  },
  {
    title: "2라운드 — 공통 위치",
    lines: [
      "4×4 지도에서 각자 만나고 싶은 곳을 하이라이트로 보여줍니다.",
      "지도 배치는 그대로 두고 칸 위치만 기억하세요.",
      "마지막에 셋 모두 겹치는 칸 하나를 클릭합니다 (제한 8초).",
      "4문항 · 후반 2문항은 각자 4곳씩 제시됩니다.",
    ],
    keys: [
      { key: "방향키", action: "칸 이동" },
      { key: "Enter", action: "선택" },
    ],
  },
  {
    title: "3라운드 — 공통 메뉴",
    lines: [
      "각자 먹고 싶은 메뉴를 차례로 보여줍니다.",
      "마지막에 보기 8개 중 셋 모두 겹치는 메뉴 하나를 고릅니다 (제한 8초).",
      "4문항 · 후반 2문항은 각자 4개씩 제시됩니다.",
    ],
    keys: [{ key: "1~8", action: "메뉴 선택" }],
  },
  {
    title: "4라운드 — 버스 번호",
    lines: [
      "⚠️ 이번 라운드만 규칙 반전!",
      "각자 '○○번 버스를 탔어요' 라고 한 명씩 알려줍니다.",
      "이번엔 공통이 아니라 '아무도 타지 않은' 번호를 고릅니다.",
      "1~3라운드 관성으로 풀면 틀립니다 — 번호 3개를 입으로 되뇌세요.",
    ],
    keys: [{ key: "1~4", action: "번호 선택" }],
  },
];

const SPEECH: Record<RoundIdx, string> = {
  0: "저는 이 요일이 좋아요!",
  1: "저는 여기서 만나고 싶어요!",
  2: "저는 이 메뉴가 좋아요!",
  3: "", // 버스는 본문에 번호 포함
};

const QUESTION_TEXT: Record<RoundIdx, string> = {
  0: "셋 모두 가능한 요일은?",
  1: "셋 모두 만나고 싶어한 곳은?",
  2: "셋 모두 먹고 싶어한 메뉴는?",
  3: "아무도 타지 않은 버스는?",
};

/* ───────────────────────── 컴포넌트 ───────────────────────── */

type Phase = "roundIntro" | "countdown" | "show" | "gap" | "answer" | "flash";

export default function Game() {
  const { finish } = useGameShell();

  const [questions] = useState<Question[]>(() => makeQuestions());
  const [mapEmojis] = useState<string[]>(() => shuffle(LANDMARKS));
  const [phase, setPhase] = useState<Phase>("roundIntro");
  const [qIndex, setQIndex] = useState(0);
  const [personIdx, setPersonIdx] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const [flashOk, setFlashOk] = useState<boolean | null>(null);
  const [correctCount, setCorrectCount] = useState(0);
  const [cursor, setCursor] = useState(5); // R2 키보드 커서 (칸 idx)

  const phaseRef = useRef<Phase>(phase);
  phaseRef.current = phase;
  const qIndexRef = useRef(qIndex);
  qIndexRef.current = qIndex;
  const personIdxRef = useRef(personIdx);
  personIdxRef.current = personIdx;
  const cursorRef = useRef(cursor);

  const recsRef = useRef<Rec[]>([]);
  const askStartRef = useRef(0);
  const finishedRef = useRef(false);
  const gapTimerRef = useRef<number | null>(null);
  const flashTimerRef = useRef<number | null>(null);

  /* 답 선택 화면이 깔린 시점 기록 (응답시간 기준점) */
  useEffect(() => {
    if (phase === "answer") askStartRef.current = Date.now();
  }, [phase, qIndex]);

  const endGame = () => {
    if (finishedRef.current) return;
    finishedRef.current = true;
    const recs = recsRef.current;
    const correct = recs.filter((r) => r.ok).length;
    const roundCorrect = ROUNDS.map((r) => recs.filter((x) => x.round === r && x.ok).length);
    const k3 = recs.filter((r) => r.round < 3 && r.k === 3 && r.ok).length;
    const k4 = recs.filter((r) => r.round < 3 && r.k === 4 && r.ok).length;
    const rts = recs.filter((r) => r.rt !== null).map((r) => r.rt as number);
    const avg = rts.length > 0 ? rts.reduce((a, b) => a + b, 0) / rts.length : null;
    const speed =
      avg === null
        ? 0
        : Math.max(0, Math.min(1, (SPEED_WORST_MS - avg) / (SPEED_WORST_MS - SPEED_BEST_MS)));
    const score = Math.max(0, Math.min(100, Math.round((correct / TOTAL) * 80 + speed * 20)));
    finish({
      score,
      label: `정답 ${correct}/${TOTAL}`,
      detail: [
        { name: "1라운드 — 공통 요일", value: `${roundCorrect[0]}/${PER_ROUND}` },
        { name: "2라운드 — 공통 위치", value: `${roundCorrect[1]}/${PER_ROUND}` },
        { name: "3라운드 — 공통 메뉴", value: `${roundCorrect[2]}/${PER_ROUND}` },
        { name: "4라운드 — 안 탄 버스 (규칙 반전)", value: `${roundCorrect[3]}/${PER_ROUND}` },
        { name: "3개 제시 문항 (1~3R)", value: `${k3}/6` },
        { name: "4개 제시 문항 (1~3R)", value: `${k4}/6` },
        { name: "평균 응답 시간 (정답 기준)", value: avg !== null ? `${(avg / 1000).toFixed(2)}초` : "—" },
      ],
    });
  };

  /** 응답 처리 — value === null 은 시간 초과 */
  const submit = (value: number | null) => {
    if (phaseRef.current !== "answer") return;
    const i = qIndexRef.current;
    const q = questions[i];
    const ok = value !== null && value === q.answer;
    recsRef.current.push({
      round: q.round,
      k: q.k,
      ok,
      rt: ok ? Date.now() - askStartRef.current : null,
      timeout: value === null,
    });
    if (ok) setCorrectCount((c) => c + 1);
    setPicked(value);
    setFlashOk(ok);
    phaseRef.current = "flash"; // 제한시간 만료 콜백 레이스 차단
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
      setPersonIdx(0);
      setQIndex(next);
      setPhase(questions[next].round !== q.round ? "roundIntro" : "show");
    }, FLASH_MS);
  };

  const submitRef = useRef(submit);
  submitRef.current = submit;

  /* 사람 카드 노출 타이머 — gap 으로 잠깐 내려가며 사람마다 리셋된다 */
  const showRemaining = useCountdown(PRESENT_MS, phase === "show", () => {
    phaseRef.current = "gap";
    setPhase("gap");
    gapTimerRef.current = window.setTimeout(() => {
      gapTimerRef.current = null;
      const p = personIdxRef.current;
      if (p < 2) {
        setPersonIdx(p + 1);
        setPhase("show");
      } else {
        if (questions[qIndexRef.current].round === 1) {
          cursorRef.current = 5;
          setCursor(5);
        }
        setPhase("answer");
      }
    }, GAP_MS);
  });

  /* 답 선택 제한시간 */
  const answerRemaining = useCountdown(ANSWER_MS, phase === "answer", () =>
    submitRef.current(null),
  );

  /* 키보드 입력 — 답 선택 단계에서만 */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat) return;
      if (phaseRef.current !== "answer") return;
      const q = questions[qIndexRef.current];
      if (q.round === 1) {
        const move: Record<string, number> = {
          ArrowLeft: -1,
          ArrowRight: 1,
          ArrowUp: -4,
          ArrowDown: 4,
        };
        if (e.key in move) {
          e.preventDefault();
          const c = cursorRef.current;
          let n = c + move[e.key];
          if (e.key === "ArrowLeft" && c % 4 === 0) n = c;
          if (e.key === "ArrowRight" && c % 4 === 3) n = c;
          if (n < 0 || n > 15) n = c;
          cursorRef.current = n;
          setCursor(n);
          return;
        }
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          submitRef.current(cursorRef.current);
        }
        return;
      }
      const n = Number(e.key);
      if (!Number.isInteger(n) || n < 1 || n > q.options.length) return;
      e.preventDefault();
      submitRef.current(q.options[n - 1]);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [questions]);

  /* 언마운트 시 타이머 정리 */
  useEffect(
    () => () => {
      if (gapTimerRef.current !== null) clearTimeout(gapTimerRef.current);
      if (flashTimerRef.current !== null) clearTimeout(flashTimerRef.current);
    },
    [],
  );

  const q = questions[qIndex];
  const round = q.round;
  const qNum = (qIndex % PER_ROUND) + 1;
  const intro = ROUND_INTROS[round];

  if (phase === "roundIntro") {
    return (
      <div className="min-h-[24rem]">
        <RoundIntro
          title={intro.title}
          lines={intro.lines}
          keys={intro.keys}
          onStart={() => setPhase("countdown")}
        />
      </div>
    );
  }

  if (phase === "countdown") {
    return (
      <div className="min-h-[24rem]">
        <Countdown
          onDone={() => {
            setPersonIdx(0);
            setPhase("show");
          }}
        />
      </div>
    );
  }

  /* show · gap · answer · flash */
  const isPresenting = phase === "show" || phase === "gap";
  const barRemaining = phase === "show" ? showRemaining : phase === "answer" ? answerRemaining : 0;
  const barTotal = isPresenting ? PRESENT_MS : ANSWER_MS;

  return (
    <div className="min-h-[24rem]">
      <GameHUD left={`${round + 1}라운드 · ${qNum}/${PER_ROUND}`} right={`정답 ${correctCount}`} />
      <TimeBar remaining={barRemaining} total={barTotal} />

      {isPresenting ? (
        <Presentation
          q={q}
          personIdx={personIdx}
          visible={phase === "show"}
          mapEmojis={mapEmojis}
        />
      ) : (
        <AnswerBoard
          q={q}
          phase={phase}
          picked={picked}
          cursor={cursor}
          mapEmojis={mapEmojis}
          flashOk={flashOk}
          onPick={submit}
        />
      )}
    </div>
  );
}

/* ───────────────────────── 노출 화면 ───────────────────────── */

function Presentation({
  q,
  personIdx,
  visible,
  mapEmojis,
}: {
  q: Question;
  personIdx: number;
  visible: boolean;
  mapEmojis: string[];
}) {
  const person = PERSONS[personIdx];
  const list = q.lists[personIdx];

  return (
    <div className="mx-auto mt-5 max-w-md">
      {/* 사람 진행 표시 */}
      <div className="mb-3 flex items-center justify-center gap-2">
        {PERSONS.map((p, i) => (
          <span
            key={p.name}
            className={`flex h-8 w-8 items-center justify-center rounded-full border text-base ${
              i === personIdx
                ? "border-ink bg-canvas"
                : i < personIdx
                  ? "border-hairline bg-surface-strong opacity-50"
                  : "border-hairline bg-surface-soft opacity-40"
            }`}
          >
            {p.emoji}
          </span>
        ))}
        <span className="ml-1 text-[13px] font-medium text-muted tabular-nums">
          {personIdx + 1}/3
        </span>
      </div>

      <div className="flex min-h-[17rem] flex-col items-center rounded-2xl border border-hairline bg-surface-card p-6">
        {visible ? (
          <>
            <div className="mb-1 flex items-center gap-2">
              <span className="text-3xl leading-none">{person.emoji}</span>
              <span className="text-base font-semibold text-ink">{person.name}</span>
            </div>
            <p className="mb-4 text-sm text-body">
              {q.round === 3 ? (
                <>
                  🚌 <strong className="text-ink">{list[0]}번</strong> 버스를 탔어요
                </>
              ) : (
                SPEECH[q.round]
              )}
            </p>

            {q.round === 0 && (
              <div className="flex flex-wrap justify-center gap-2">
                {[...list]
                  .sort((a, b) => a - b)
                  .map((d) => (
                    <span
                      key={d}
                      className="flex h-12 w-12 items-center justify-center rounded-xl border border-hairline bg-canvas text-base font-semibold text-ink"
                    >
                      {DAYS[d]}
                    </span>
                  ))}
              </div>
            )}

            {q.round === 1 && (
              <div className="grid w-full max-w-[15rem] grid-cols-4 gap-1.5">
                {mapEmojis.map((em, cell) => (
                  <span
                    key={cell}
                    className={`flex aspect-square items-center justify-center rounded-lg border text-xl ${
                      list.includes(cell)
                        ? "border-ink bg-badge-emerald/30"
                        : "border-hairline bg-canvas opacity-70"
                    }`}
                  >
                    {em}
                  </span>
                ))}
              </div>
            )}

            {q.round === 2 && (
              <div className="flex flex-wrap justify-center gap-2">
                {list.map((m) => (
                  <span
                    key={m}
                    className="flex items-center gap-1.5 rounded-xl border border-hairline bg-canvas px-3 py-2.5 text-sm font-semibold text-ink"
                  >
                    <span className="text-xl leading-none">{MENUS[m].emoji}</span>
                    {MENUS[m].name}
                  </span>
                ))}
              </div>
            )}

            {q.round === 3 && (
              <span className="flex h-20 items-center justify-center rounded-xl border border-hairline bg-canvas px-8 text-4xl font-semibold tabular-nums text-ink">
                {list[0]}
              </span>
            )}

            <p className="mt-auto pt-4 text-[12px] text-muted-soft">곧 사라집니다 — 기억하세요</p>
          </>
        ) : (
          <span className="m-auto text-sm text-muted-soft">· · ·</span>
        )}
      </div>
    </div>
  );
}

/* ───────────────────────── 답 선택 화면 ───────────────────────── */

function AnswerBoard({
  q,
  phase,
  picked,
  cursor,
  mapEmojis,
  flashOk,
  onPick,
}: {
  q: Question;
  phase: "answer" | "flash";
  picked: number | null;
  cursor: number;
  mapEmojis: string[];
  flashOk: boolean | null;
  onPick: (v: number) => void;
}) {
  const disabled = phase !== "answer";

  /** 플래시 단계에서 정답·오답 하이라이트 */
  const feedback = (value: number): string => {
    if (phase !== "flash") return "";
    if (value === q.answer) return "border-2 border-current text-success";
    if (value === picked) return "border-2 border-current text-error";
    return "opacity-50";
  };

  return (
    <div className="mx-auto mt-5 max-w-lg">
      <div className="mb-1 flex items-center justify-center gap-2">
        {q.round === 3 && (
          <span className="rounded-full bg-badge-orange/20 px-2.5 py-0.5 text-[12px] font-semibold text-ink">
            규칙 반전
          </span>
        )}
        <p className="text-center text-base font-semibold text-ink">{QUESTION_TEXT[q.round]}</p>
      </div>
      <p className="mb-4 text-center text-[12px] text-muted-soft">
        {q.round === 1 ? "방향키로 이동 · Enter 로 선택할 수도 있어요" : "숫자 키로도 선택할 수 있어요"}
      </p>

      {q.round === 0 && (
        <div className="grid grid-cols-4 gap-2 sm:grid-cols-7">
          {q.options.map((d, i) => (
            <button
              key={d}
              type="button"
              disabled={disabled}
              onClick={() => onPick(d)}
              className={`flex flex-col items-center gap-1 rounded-xl border border-hairline bg-canvas py-3 transition-colors active:bg-surface-soft ${feedback(d)}`}
            >
              <span className="text-base font-semibold">{DAYS[d]}</span>
              <KeyCap>{i + 1}</KeyCap>
            </button>
          ))}
        </div>
      )}

      {q.round === 1 && (
        <div className="mx-auto grid w-full max-w-[17rem] grid-cols-4 gap-1.5">
          {q.options.map((cell) => (
            <button
              key={cell}
              type="button"
              disabled={disabled}
              onClick={() => onPick(cell)}
              className={`flex aspect-square items-center justify-center rounded-lg border border-hairline bg-canvas text-xl transition-colors active:bg-surface-soft ${
                phase === "answer" && cell === cursor ? "ring-2 ring-ink" : ""
              } ${feedback(cell)}`}
            >
              {mapEmojis[cell]}
            </button>
          ))}
        </div>
      )}

      {q.round === 2 && (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {q.options.map((m, i) => (
            <button
              key={m}
              type="button"
              disabled={disabled}
              onClick={() => onPick(m)}
              className={`flex flex-col items-center gap-1 rounded-xl border border-hairline bg-canvas py-3 transition-colors active:bg-surface-soft ${feedback(m)}`}
            >
              <span className="text-2xl leading-none">{MENUS[m].emoji}</span>
              <span className="text-[13px] font-semibold">{MENUS[m].name}</span>
              <KeyCap>{i + 1}</KeyCap>
            </button>
          ))}
        </div>
      )}

      {q.round === 3 && (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {q.options.map((n, i) => (
            <button
              key={n}
              type="button"
              disabled={disabled}
              onClick={() => onPick(n)}
              className={`flex flex-col items-center gap-1 rounded-xl border border-hairline bg-canvas py-4 transition-colors active:bg-surface-soft ${feedback(n)}`}
            >
              <span className="text-2xl font-semibold tabular-nums">{n}번</span>
              <KeyCap>{i + 1}</KeyCap>
            </button>
          ))}
        </div>
      )}

      <Flash ok={flashOk} />
    </div>
  );
}
