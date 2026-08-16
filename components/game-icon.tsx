import type { ComponentType, ReactNode, SVGProps } from "react";

/**
 * 신역검 9종 대표 아이콘.
 *
 * 이모지 대신 게임의 "메커니즘"을 그린 24×24 라인 아이콘 세트다.
 * 모두 currentColor 스트로크라 놓이는 자리의 글자색을 그대로 따라간다
 * (흰 카드·검은 히어로 어디에 올려도 따로 색 지정이 필요 없다).
 *
 * 구버전 6종은 아이콘이 없으므로 GameIcon 이 이모지로 폴백한다.
 */

type IconProps = SVGProps<SVGSVGElement>;

/** 공통 프레임 — 24×24, 스트로크 1.6, 라운드 캡/조인 */
function Frame({ children, ...rest }: IconProps & { children: ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      {...rest}
    >
      {children}
    </svg>
  );
}

/** 가위바위보 — 교차한 가위날과 손잡이 고리 */
function RpsIcon(p: IconProps) {
  return (
    <Frame {...p}>
      <path d="M7.3 16.6 16.5 4.8" />
      <path d="M16.7 16.6 7.5 4.8" />
      <circle cx="6.2" cy="18.6" r="2.3" />
      <circle cx="17.8" cy="18.6" r="2.3" />
    </Frame>
  );
}

/** 도형 회전하기 — 도형을 감아 도는 회전 화살표 */
function RotateIcon(p: IconProps) {
  return (
    <Frame {...p}>
      <path d="M16.36 5.77A7.6 7.6 0 1 1 7.64 5.77" />
      <path d="M6.2 8.6 7.64 5.77 4.48 6.14" />
      <path d="M12 8.8 15.2 12 12 15.2 8.8 12Z" fill="currentColor" stroke="none" />
    </Frame>
  );
}

/** 약속 정하기 — 달력에서 한 칸만 확정된 상태 */
function AppointmentIcon(p: IconProps) {
  return (
    <Frame {...p}>
      <rect x="3.5" y="5.5" width="17" height="15" rx="2.5" />
      <path d="M3.5 10.2h17" />
      <path d="M8 3.2v4" />
      <path d="M16 3.2v4" />
      <rect x="6.8" y="13.2" width="4.4" height="3.4" rx="1.1" fill="currentColor" stroke="none" />
      <rect x="13.4" y="13.2" width="4.4" height="3.4" rx="1.1" />
    </Frame>
  );
}

/** 길 만들기 — 출발점에서 목적지까지 꺾어 이은 경로 */
function PathIcon(p: IconProps) {
  return (
    <Frame {...p}>
      <path d="M5 18.8V13h6.5V6.8h5" />
      <circle cx="5" cy="18.8" r="1.9" fill="currentColor" stroke="none" />
      <circle cx="19" cy="6.8" r="2.5" />
      <circle cx="19" cy="6.8" r="1" fill="currentColor" stroke="none" />
    </Frame>
  );
}

/** 마법약 만들기 — 액체와 기포가 든 플라스크 */
function PotionIcon(p: IconProps) {
  return (
    <Frame {...p}>
      <path d="M9.5 3.2v5.6a6.5 6.5 0 1 0 5 0V3.2" />
      <path d="M8.6 3.2h6.8" />
      <path d="M5.9 16h12.2" />
      <circle cx="10.2" cy="18.4" r="1" fill="currentColor" stroke="none" />
      <circle cx="13.7" cy="19.2" r="0.7" fill="currentColor" stroke="none" />
    </Frame>
  );
}

/** 숫자 누르기 — 숫자 1이 새겨진 버튼 (1부터 차례로 누르는 게임) */
function NumberPressIcon(p: IconProps) {
  return (
    <Frame {...p}>
      <rect x="4.5" y="4.5" width="15" height="15" rx="4" />
      <path d="M10.3 9.6 12.4 8.1v7.8" />
      <path d="M10.2 15.9h4.6" />
    </Frame>
  );
}

/** 고양이 술래잡기 — 고양이 얼굴 */
function CatChaseIcon(p: IconProps) {
  return (
    <Frame {...p}>
      <circle cx="12" cy="13.7" r="6.3" />
      <path d="M7 9 5.8 4.6l4.6 2.4" />
      <path d="M17 9l1.2-4.4-4.6 2.4" />
      <circle cx="9.8" cy="13" r="0.9" fill="currentColor" stroke="none" />
      <circle cx="14.2" cy="13" r="0.9" fill="currentColor" stroke="none" />
      <path d="M3.7 15.4h2.2" />
      <path d="M18.1 15.4h2.2" />
      <path d="m10.9 16.6 1.1.9 1.1-.9" />
    </Frame>
  );
}

/** 도형 순서 기억하기 — 지금 도형에서 n칸 전 도형으로 되짚어 가는 화살표 */
function ShapeNbackIcon(p: IconProps) {
  return (
    <Frame {...p}>
      <rect x="2.9" y="12" width="6.6" height="6.6" rx="1.7" fill="currentColor" stroke="none" />
      <rect x="14.5" y="12" width="6.6" height="6.6" rx="1.7" />
      <path d="M17.8 10.8Q12 5.2 6.2 10.8" />
      <path d="M8.98 9.92 6.2 10.8 7.16 8.04" />
    </Frame>
  );
}

/** 개수 비교하기 — 좌우 무리의 개수 차이 */
function CountCompareIcon(p: IconProps) {
  return (
    <Frame {...p}>
      <path d="M12 5v14" />
      <circle cx="5.8" cy="9.6" r="1.7" fill="currentColor" stroke="none" />
      <circle cx="9.4" cy="9.6" r="1.7" fill="currentColor" stroke="none" />
      <circle cx="5.8" cy="14.6" r="1.7" fill="currentColor" stroke="none" />
      <circle cx="14.6" cy="9.6" r="1.7" fill="currentColor" stroke="none" />
      <circle cx="18.2" cy="9.6" r="1.7" fill="currentColor" stroke="none" />
      <circle cx="14.6" cy="14.6" r="1.7" fill="currentColor" stroke="none" />
      <circle cx="18.2" cy="14.6" r="1.7" fill="currentColor" stroke="none" />
    </Frame>
  );
}

const GAME_ICONS: Record<string, ComponentType<IconProps>> = {
  rps: RpsIcon,
  rotate: RotateIcon,
  appointment: AppointmentIcon,
  path: PathIcon,
  potion: PotionIcon,
  "number-press": NumberPressIcon,
  "cat-chase": CatChaseIcon,
  "shape-nback": ShapeNbackIcon,
  "count-compare": CountCompareIcon,
};

/** 아이콘을 가진 슬러그인지 — 구버전 6종은 false */
export function hasGameIcon(slug: string): boolean {
  return slug in GAME_ICONS;
}

/**
 * 게임 대표 아이콘. 신역검 9종은 SVG, 구버전 6종은 이모지로 폴백한다.
 * size 는 px — SVG 변과 이모지 글자 크기를 함께 맞춘다.
 */
export function GameIcon({
  slug,
  emoji,
  size = 24,
  className,
}: {
  slug: string;
  emoji: string;
  size?: number;
  className?: string;
}) {
  const Icon = GAME_ICONS[slug];
  if (!Icon) {
    return (
      <span
        className={className}
        style={{ fontSize: size * 0.92, lineHeight: 1 }}
        aria-hidden
      >
        {emoji}
      </span>
    );
  }
  return <Icon width={size} height={size} className={className} />;
}
