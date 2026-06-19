# 역검 무제한 연습하기

한국 AI 역량검사(역검) 전략게임을 브라우저에서 그대로 연습할 수 있는 비공식 연습 사이트.

- **신역검(ACCA) 9종 전부**: 가위바위보 · 도형 회전하기 · 약속 정하기 · 길 만들기 · 마법약 만들기 · 숫자 누르기 · 고양이 술래잡기 · 도형 순서 기억하기 · 개수 비교하기
- **구버전(구 AI면접·구역검) 6종**: 풍선 불기(BART) · 카드 뒤집기 · 색-단어 일치(스트룹) · 글자-숫자 분류 · 공 무게 비교 · 공 옮기기(하노이)
- 게임마다 **시작 전 공략 가이드**가 먼저 나온다 (확률적 사고 기반 전략 포함)
- **DB 없음** — 기록(최고 점수·히스토리)은 `localStorage` 에만 저장
- 디자인: Cal.com 스타일 시스템 (흰 캔버스 + #111 CTA + #f5f5f5 카드 + 다크 푸터, Pretendard)

## 게임 선정 근거 (시장 점유율 기준)

한국 게임형 채용검사 시장은 마이다스인 잡다(JOBDA) AI역량검사가 사실상 독점
(1,200개+ 기업 도입, 2025). 따라서 잡다 신역검 전략게임 9종을 전부 재현하고,
일부 기업이 아직 쓸 수 있는 구역검 게임 중 룰이 확실히 확인된 6종을 추가했다.

룰 출처: 잡다 공식 유튜브 공략 시리즈("전략게임 꿀팁대방출.zip") 자막·프레임 분석
+ 응시 후기 교차 검증. 문항 수·제한시간 등 세부 수치는 실제 검사와 다를 수 있다.

제외: 감정 맞히기(얼굴 사진 자산 필요), 날씨 맞히기(마법약과 동일 룰),
입 길이·블록 방향·블록 쌓기(룰 미확인).

## 개발

```bash
npm install
npm run dev    # http://localhost:3000
npm run build
```

스택: Next.js (App Router) + TypeScript + Tailwind CSS v4. 외부 런타임 의존성 없음.

## 구조

```
lib/games.ts          # 게임 메타데이터 단일 출처 (룰·공략·난이도)
lib/storage.ts        # localStorage 기록 (yga:<slug>)
components/game-shell.tsx  # 공략 가이드 → 게임 → 결과 공통 셸
components/game-ui.tsx     # HUD·라운드 안내·타이머 등 공용 게임 UI
app/games/<slug>/     # 게임별 page.tsx + game.tsx
```

새 게임 추가: `lib/games.ts` 에 메타데이터 추가 → `app/games/<slug>/` 에
`page.tsx`(GameShell 래핑) + `game.tsx`(클라이언트 게임, `useGameShell().finish()` 호출) 작성.

## 배포 (Vercel)

```bash
npx vercel        # 프리뷰
npx vercel --prod # 프로덕션
```

별도 환경변수·DB 설정 없음. 빌드 명령 기본값(`next build`) 그대로 사용.

## 면책

본 사이트는 취업 준비생의 연습을 돕는 비공식 팬메이드 프로젝트로,
마이다스인·잡다(JOBDA)와 무관하다. 상표는 각 소유자의 자산이다.
