import GameShell from "@/components/game-shell";
import Game from "./game";
export const metadata = { title: "글자-숫자 분류 — 역검 아케이드" };
export default function Page() {
  return (
    <GameShell slug="letter-number">
      <Game />
    </GameShell>
  );
}
