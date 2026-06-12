import GameShell from "@/components/game-shell";
import Game from "./game";
export const metadata = { title: "풍선 불기 — 역검 아케이드" };
export default function Page() {
  return (
    <GameShell slug="balloon">
      <Game />
    </GameShell>
  );
}
