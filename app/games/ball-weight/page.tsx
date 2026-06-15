import GameShell from "@/components/game-shell";
import Game from "./game";
import { gameMetadata } from "@/lib/games";

export const metadata = gameMetadata("ball-weight");

export default function Page() {
  return (
    <GameShell slug="ball-weight">
      <Game />
    </GameShell>
  );
}
