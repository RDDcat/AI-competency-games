import GameShell from "@/components/game-shell";
import Game from "./game";
export const metadata = { title: "카드 뒤집기 — 역검 아케이드" };
export default function Page() {
  return (
    <GameShell slug="card-flip">
      <Game />
    </GameShell>
  );
}
