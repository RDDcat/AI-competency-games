import GameShell from "@/components/game-shell";
import Game from "./game";
export const metadata = { title: "개수 비교하기 — 역검 아케이드" };
export default function Page() {
  return (
    <GameShell slug="count-compare">
      <Game />
    </GameShell>
  );
}
