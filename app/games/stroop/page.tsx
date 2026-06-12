import GameShell from "@/components/game-shell";
import Game from "./game";
export const metadata = { title: "색-단어 일치 판단 — 역검 아케이드" };
export default function Page() {
  return (
    <GameShell slug="stroop">
      <Game />
    </GameShell>
  );
}
