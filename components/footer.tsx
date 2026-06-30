import Link from "next/link";
import { ACCA_GAMES, LEGACY_GAMES } from "@/lib/games";
import { LogoMark } from "@/components/logo";

export default function Footer() {
  return (
    <footer className="bg-surface-dark text-on-dark-soft">
      <div className="mx-auto w-full max-w-6xl px-6 py-16">
        <div className="mb-12 flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-canvas text-ink">
            <LogoMark className="h-5 w-5" />
          </span>
          <span className="text-[17px] font-semibold tracking-[-0.02em] text-on-dark">
            역검 무제한 연습하기
          </span>
        </div>

        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <h3 className="mb-4 text-sm font-semibold text-on-dark">신역검 게임</h3>
            <ul className="space-y-2.5 text-sm">
              {ACCA_GAMES.map((g) => (
                <li key={g.slug}>
                  <Link href={`/games/${g.slug}`} className="hover:text-on-dark">
                    {g.title}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h3 className="mb-4 text-sm font-semibold text-on-dark">구버전 게임</h3>
            <ul className="space-y-2.5 text-sm">
              {LEGACY_GAMES.map((g) => (
                <li key={g.slug}>
                  <Link href={`/games/${g.slug}`} className="hover:text-on-dark">
                    {g.title}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h3 className="mb-4 text-sm font-semibold text-on-dark">공략 · 자료</h3>
            <ul className="space-y-2.5 text-sm">
              <li>
                <Link
                  href="/guide"
                  data-ga="guide_click"
                  data-ga-source="footer"
                  className="hover:text-on-dark"
                >
                  게임별 공략 가이드
                </Link>
              </li>
              <li>
                <a
                  href="https://jobda.acca.ai/tutorial"
                  target="_blank"
                  rel="noopener noreferrer"
                  data-ga="cta_click"
                  data-ga-cta-type="official_tutorial"
                  data-ga-location="footer"
                  className="hover:text-on-dark"
                >
                  잡다 공식 튜토리얼
                </a>
              </li>
              <li>
                <a
                  href="https://www.youtube.com/playlist?list=PLRvhT8gNnOeoZNbmGq7GjImm7CC7e7-XU"
                  target="_blank"
                  rel="noopener noreferrer"
                  data-ga="cta_click"
                  data-ga-cta-type="official_video"
                  data-ga-location="footer"
                  className="hover:text-on-dark"
                >
                  공식 공략 영상 시리즈
                </a>
              </li>
              <li>
                <a
                  href="https://www.jobda.im/info/406"
                  target="_blank"
                  rel="noopener noreferrer"
                  data-ga="cta_click"
                  data-ga-cta-type="official_info"
                  data-ga-location="footer"
                  className="hover:text-on-dark"
                >
                  전략게임 공식 안내
                </a>
              </li>
            </ul>
          </div>
          <div>
            <h3 className="mb-4 text-sm font-semibold text-on-dark">안내</h3>
            <p className="text-sm leading-relaxed">
              본 사이트는 취업 준비생의 연습을 돕는 비공식 팬메이드 연습장입니다.
              마이다스인·잡다(JOBDA)와 무관하며, 실제 검사와 세부 수치가 다를 수
              있습니다. 모든 기록은 내 브라우저에만 저장됩니다.
            </p>
          </div>
        </div>

        <p className="mt-12 border-t border-surface-dark-elevated pt-6 text-[13px] text-muted-soft">
          © {new Date().getFullYear()} 역검 무제한 연습하기 · 비공식 연습 사이트 · 상표는 각 소유자의 자산입니다.
        </p>
      </div>
    </footer>
  );
}
