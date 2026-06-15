import GameShell from "@/components/game-shell";
import Game from "./game";
import { gameMetadata } from "@/lib/games";

export const metadata = gameMetadata("appointment");

export default function Page() {
  return (
    <GameShell slug="appointment">
      <Game />
    </GameShell>
  );
}
