import GameShell from "@/components/game-shell";
import Game from "./game";
import { gameMetadata } from "@/lib/games";

export const metadata = gameMetadata("cat-chase");

export default function Page() {
  return (
    <GameShell slug="cat-chase">
      <Game />
    </GameShell>
  );
}
