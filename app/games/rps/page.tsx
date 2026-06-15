import GameShell from "@/components/game-shell";
import Game from "./game";
import { gameMetadata } from "@/lib/games";

export const metadata = gameMetadata("rps");

export default function Page() {
  return (
    <GameShell slug="rps">
      <Game />
    </GameShell>
  );
}
