/**
 * 브랜드 로고 마크. 게임 연습 사이트를 상징하는 '플레이' 삼각형이다.
 * stroke·fill 이 currentColor 라 부모의 text-* 색을 그대로 따르므로,
 * 밝은 배지(footer)·어두운 배지(nav) 어디에 놓아도 자동으로 대비가 맞는다.
 */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      focusable="false"
      className={className}
    >
      <path
        d="M8.5 5.5 L8.5 18.5 L19 12 Z"
        fill="currentColor"
        stroke="currentColor"
        strokeWidth={2.6}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}
