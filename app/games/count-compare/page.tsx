import GameShell from "@/components/game-shell";
import Game from "./game";
import { gameMetadata } from "@/lib/games";

export const metadata = gameMetadata("count-compare");

export default function Page() {
  return (
    <GameShell slug="count-compare">
      <Game />
    </GameShell>
  );
}
