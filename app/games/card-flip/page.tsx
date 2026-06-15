import GameShell from "@/components/game-shell";
import Game from "./game";
import { gameMetadata } from "@/lib/games";

export const metadata = gameMetadata("card-flip");

export default function Page() {
  return (
    <GameShell slug="card-flip">
      <Game />
    </GameShell>
  );
}
