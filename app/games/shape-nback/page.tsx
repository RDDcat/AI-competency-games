import GameShell from "@/components/game-shell";
import Game from "./game";
import { gameMetadata } from "@/lib/games";

export const metadata = gameMetadata("shape-nback");

export default function Page() {
  return (
    <GameShell slug="shape-nback">
      <Game />
    </GameShell>
  );
}
