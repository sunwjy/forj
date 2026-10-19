# forj 시각 디자인 명세

이 문서는 forj의 화면을 실제로 구현할 때 시안과 같은 느낌을 재현하기 위한 기준입니다. 방향을 정한 배경과 버린 선택지는 [ADR 0001](../adr/0001-visual-direction-ticket-timeline-peach.md)에 있습니다. 시안 원본은 `prototype/design-mockup` 브랜치의 `prototypes/design-mockup/`에서 볼 수 있습니다(`pnpm install && pnpm dev`, 기본값이 A 시안과 복숭아 테마입니다).

용어는 [GLOSSARY.md](../../GLOSSARY.md)를 따릅니다. 화면 문구에도 "여행", "일차", "일정 항목", "공유 링크"를 그대로 씁니다.

## 1. 핵심 원칙

1. **크림 배경에 복숭아색 강조색만 얹습니다.** 배경 전체를 분홍이나 복숭아로 칠하지 않습니다.
2. **강조 요소는 "연한 면과 같은 계열의 진한 글자"로 만듭니다.** 주 버튼, 선택된 일차 칩, 일차 아이콘 배경이 모두 이 방식을 따릅니다. 버튼에 흰 글자나 검은 계열 글자를 쓰지 않습니다.
3. **파스텔은 면에만 쓰고 글자에는 쓰지 않습니다.** 글자는 본문색(`--text`)이나 같은 계열의 진한 톤(`*-ink`)으로 씁니다.
4. **귀여움은 형태와 모션으로 만듭니다.** 둥근 모서리, 둥근 디스플레이 폰트, 살짝 튕기는 스프링 모션, 다정한 해요체가 귀여운 인상을 만듭니다.
5. **정보는 단정하게 둡니다.** 시각과 숫자는 Pretendard의 tabular 숫자로 쓰고, 타임라인은 왼쪽 정렬 직선으로 유지합니다. 장식은 헤더에만 넣습니다(티켓 카드는 MVP에서 제외되었습니다).

## 2. 디자인 토큰

### 2.1 라이트 모드 (기본)

```css
:root {
  /* 중립색: 크림 계열 */
  --bg: #FFF8F3;            /* 페이지 배경 */
  --surface: #FFFFFF;       /* 카드 표면 */
  --line: #EFE4DC;          /* 경계선, 비활성 칩 테두리 */
  --text: #4A3B47;          /* 본문 */
  --text-muted: #7A6873;    /* 보조 텍스트, 시각 */
  --shadow-tint: 74 59 71;  /* 그림자 RGB. 검정 대신 본문색 계열을 씁니다. */

  /* 강조색: 복숭아 */
  --primary: #FFD9CC;         /* 주 버튼 배경 */
  --on-primary: #A4482A;      /* 주 버튼 글자 */
  --primary-border: #A4482A;  /* 주 버튼 테두리 */
  --primary-ledge: #A4482A;   /* 주 버튼 아래 그림자 */
  --primary-strong: #A4482A;  /* 링크, 강조 텍스트, 포커스 링 */
  --surface-tint: #FFE4D9;    /* 보조 버튼, 연한 강조 배경 */

  /* 보조 포인트: 버터 (D-day 배지, 공유 링크 배너) */
  --accent: #FFE9A8;
  --accent-ink: #7A5C00;

  /* 일차 색: soft = 면, ink = 글자·테두리·타임라인 점 */
  --d1: #FFD9CC; --d1-ink: #A4482A;  /* 복숭아 */
  --d2: #DCD3FF; --d2-ink: #5B47B8;  /* 라일락 */
  --d3: #CDEFE3; --d3-ink: #24614F;  /* 민트 */
  --d4: #FFE9A8; --d4-ink: #7A5C00;  /* 버터 */
}
```

일차가 4개를 넘으면 `d1`부터 다시 순환합니다. 화면의 한 영역(예: 하나의 일차 탭 내용)에는 `--day-soft`와 `--day-ink`를 해당 일차 색으로 지정하고, 하위 컴포넌트는 이 두 변수만 참조합니다.

```css
/* 예: 1일차 영역 */
.day-1 { --day-soft: var(--d1); --day-ink: var(--d1-ink); }
```

### 2.2 대비 검증 결과

WCAG 2.x 상대휘도 공식으로 계산한 값입니다. 토큰을 바꾸면 이 표를 다시 계산해야 합니다.

| 조합 | 대비 | 기준 |
|---|---|---|
| 주 버튼 글자 `#A4482A` / `#FFD9CC` | 4.54 | AA 통과 (여유가 거의 없음) |
| 진한 복숭아 `#A4482A` / 배경 `#FFF8F3` | 5.64 | AA 통과 |
| 진한 복숭아 `#A4482A` / 표면 `#FFFFFF` | 5.93 | AA 통과 |
| 진한 복숭아 `#A4482A` / tint `#FFE4D9` | 4.90 | AA 통과 |
| 본문 `#4A3B47` / 배경 | 9.95 | AA 통과 |
| 보조 텍스트 `#7A6873` / 배경 | 4.93 | AA 통과 |
| 버터 글자 `#7A5C00` / `#FFE9A8` | 5.20 | AA 통과 |
| 라일락 `#5B47B8` / `#DCD3FF` | 4.87 | AA 통과 |
| 민트 `#24614F` / `#CDEFE3` | 5.88 | AA 통과 |

### 2.3 다크 모드 (초안, 미검증)

다크 모드의 복숭아 토큰은 시안에서 확인하지 않았습니다. 아래 값은 출발점이며, 구현 전에 화면으로 확인해야 합니다. 원칙은 라이트 모드와 같습니다: 어두운 복숭아 면에 연한 복숭아 글자를 올립니다.

```css
:root[data-theme="dark"] {
  --bg: #1F1A1E;  --surface: #2A2328;  --line: #3A3238;
  --text: #F3E9EE;  --text-muted: #B5A7AF;  --shadow-tint: 0 0 0;
  --primary: #45302B;  --on-primary: #FFC2AE;    /* 7.94:1 */
  --primary-border: #FFC2AE;  --primary-ledge: #FFC2AE;
  --primary-strong: #FFC2AE;  --surface-tint: #45302B;
  --accent: #4A4130;  --accent-ink: #FFE9A8;
  --d1: #45302B; --d1-ink: #FFC2AE;
  --d2: #36304F; --d2-ink: #CFC4FF;
  --d3: #2D4039; --d3-ink: #9ADBC5;
  --d4: #463E25; --d4-ink: #FFE29A;
}
```

### 2.4 형태, 모션, 폰트

```css
:root {
  --r-xs: 8px; --r-sm: 12px; --r-md: 18px; --r-lg: 28px; --r-full: 999px;

  --spring: cubic-bezier(.34, 1.56, .64, 1);  /* 살짝 튕기는 등장, 선택 */
  --ease-out: cubic-bezier(.05, .7, .1, 1);   /* 누름 피드백 */

  --font-body: "Pretendard Variable", Pretendard, -apple-system, system-ui, sans-serif;
  --font-display: "Jua", var(--font-body);
}
body { font-family: var(--font-body); color: var(--text); background: var(--bg); word-break: keep-all; }
.num { font-variant-numeric: tabular-nums; }
```

| 폰트 | 용도 | 라이선스 |
|---|---|---|
| Pretendard | 본문, 시각, 숫자, 버튼 라벨 | SIL OFL 1.1 |
| 배민 주아체(Jua) | 여행 제목, 일차 라벨, D-day | SIL OFL 1.1 |

주아체는 짧은 라벨에만 씁니다. 시각, 금액, 주소, 예약번호, 일정 항목의 설명은 Pretendard로 씁니다.

## 3. 여행 화면 레이아웃 (A. 티켓 타임라인)

위에서 아래로 다음 순서로 배치합니다. 좌우 여백은 20px입니다.

1. **상단 바:** 왼쪽에 뒤로가기 아이콘 버튼, 가운데에 D-day 배지, 오른쪽에 공유 아이콘 버튼을 둡니다.
2. **여행 헤더:** 여행 제목(주아체 30px)과 그 아래 보조 정보(기간, 박/일, 함께하는 사람 수, 14px 보조 텍스트)를 둡니다.
3. **일차 탭:** 가로로 스크롤되는 일차 칩 목록입니다.
4. **타임라인:** 선택한 일차의 일정 항목을 시각 순서로 보여 줍니다. 모든 일정 항목은 일반 카드로 그리고, 시각이 없는 일정 항목은 맨 아래의 "시간 미정" 묶음에 둡니다.
5. **플로팅 추가 버튼:** 오른쪽 아래(right 20px, bottom 28px)에 "＋ 일정 항목 추가" 주 버튼을 둡니다.

## 4. 컴포넌트

### 4.1 주 버튼

선택된 일차 칩과 같은 방식입니다. 화면당 하나만 둡니다.

```css
.btn {
  display: inline-flex; align-items: center; justify-content: center; gap: 6px;
  min-height: 48px; padding: 0 20px; border-radius: var(--r-md);
  font-weight: 600; font-size: 15px;
  transition: transform 130ms var(--ease-out);
}
.btn:active { transform: translateY(2px) scale(.98); }
.btn-primary {
  background: var(--primary); color: var(--on-primary);
  border: 2px solid var(--primary-border);
  box-shadow: 0 4px 0 var(--primary-ledge);   /* 흐림 없는 아래 그림자 */
}
.btn-primary:active { box-shadow: 0 2px 0 var(--primary-ledge); }
.btn-soft { background: var(--surface-tint); color: var(--primary-strong); }  /* 보조 버튼 */
.fab { height: 56px; padding: 0 22px; border-radius: var(--r-full); }        /* 플로팅 추가 버튼 */
```

### 4.2 아이콘 버튼

```css
.btn-icon {
  width: 44px; height: 44px; border-radius: var(--r-full);
  background: var(--surface); box-shadow: 0 2px 8px rgb(var(--shadow-tint) / .08);
}
```

- UI 아이콘은 `lucide-react`로 그립니다([ADR 0004](../adr/0004-ui-icons-lucide-item-icons-emoji.md)). 크기는 상단 바 20~22px, 그 밖의 버튼 18~20px이고, 선 굵기는 2.25(글자 옆의 `Plus`는 2.5)입니다. 색은 `currentColor`로 버튼의 글자색을 따릅니다.
- 일정 아이콘과 장식용 그림(🧳, 🗺️ 등)은 이모지로 둡니다.
- 아이콘만 있는 버튼에는 `aria-label`로 이름을 붙입니다. 아이콘 SVG는 `aria-hidden`입니다.

### 4.3 일차 칩

```css
.day-chip {
  flex: none; width: 64px; padding: 10px 0; border-radius: var(--r-md);
  background: var(--surface); text-align: center; border: 2px solid transparent;
  transition: transform 350ms var(--spring), background 150ms;
}
.day-chip b    { display: block; font-family: var(--font-display); font-size: 18px; font-weight: 400; }  /* "1일차" */
.day-chip span { font-size: 12px; color: var(--text-muted); }                                            /* "11.20 금" */
.day-chip[aria-selected="true"]  { background: var(--day-soft); border-color: var(--day-ink); transform: translateY(-3px); }
.day-chip[aria-selected="true"] b { color: var(--day-ink); }
```

칩 목록은 `display: flex; gap: 8px; overflow-x: auto;`로 가로 스크롤합니다. 각 칩에는 해당 일차의 `--day-soft`, `--day-ink`를 지정합니다.

### 4.4 타임라인 행

한 행은 `시각 | 레일 | 카드`의 3열 그리드입니다.

```css
.tl-row  { display: grid; grid-template-columns: 48px 20px 1fr; gap: 0 8px; }
.tl-time { font-size: 13px; font-weight: 700; color: var(--text-muted); padding-top: 16px; text-align: right; }  /* .num 함께 사용 */
.tl-rail { position: relative; display: flex; justify-content: center; }
.tl-rail::before {  /* 점선 세로줄 */
  content: ""; position: absolute; top: 0; bottom: 0; width: 2px; opacity: .45;
  background: repeating-linear-gradient(var(--day-ink) 0 4px, transparent 4px 9px);
}
.tl-row:first-child .tl-rail::before { top: 22px; }
.tl-row:last-child  .tl-rail::before { bottom: calc(100% - 22px); }
.tl-dot {
  position: relative; margin-top: 16px; width: 14px; height: 14px; border-radius: 50%;
  background: var(--day-soft); border: 3px solid var(--day-ink);
}
```

### 4.5 일정 항목 카드

```css
.item-card {
  margin-bottom: 14px; padding: 14px 16px; border-radius: var(--r-md);
  background: var(--surface); box-shadow: 0 6px 18px rgb(var(--shadow-tint) / .07);
  animation: pop-in 450ms var(--spring) both;  /* 목록 순서대로 60ms씩 animation-delay */
}
.item-card:active { transform: scale(.98); }
.item-card h4 { font-size: 16px; font-weight: 700; display: flex; gap: 8px; align-items: center; }
.item-card p  { font-size: 13px; color: var(--text-muted); margin-top: 4px; }
.item-icon {  /* 제목 앞 이모지 아이콘 */
  width: 30px; height: 30px; border-radius: 10px; background: var(--day-soft);
  display: grid; place-items: center; font-size: 16px; flex: none;
}
@keyframes pop-in { from { opacity: 0; transform: translateY(10px) scale(.96); } }
```

### 4.6 티켓 카드 (추후 구현 후보)

> MVP에서는 쓰지 않습니다. 일정 항목에 종류를 두지 않기로 하면서 교통 일정 항목을 구분할 수 없게 되었습니다([ADR 0001](../adr/0001-visual-direction-ticket-timeline-peach.md) 결정 1의 수정 사항). 나중에 종류를 도입할 때를 위해 시안의 명세를 남겨 둡니다.

왼쪽 본문과 오른쪽 스텁(76px)으로 나누고, 경계에 반원 노치와 점선 절취선을 둡니다.

```css
.ticket {
  margin-bottom: 14px; display: grid; grid-template-columns: 1fr 76px;
  filter: drop-shadow(0 6px 14px rgb(var(--shadow-tint) / .09));
  animation: pop-in 450ms var(--spring) both;
}
.ticket .main {
  background: var(--surface); border-radius: var(--r-md) 0 0 var(--r-md); padding: 14px 16px;
  mask: radial-gradient(circle 9px at 100% 0,    transparent 98%, #000) top/100% 51% no-repeat,
        radial-gradient(circle 9px at 100% 100%, transparent 98%, #000) bottom/100% 51% no-repeat;
}
.ticket .stub {
  background: var(--day-soft); color: var(--day-ink); border-radius: 0 var(--r-md) var(--r-md) 0;
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  font-size: 11px; font-weight: 700;
  border-left: 2px dashed color-mix(in oklab, var(--day-ink) 40%, transparent);
  mask: radial-gradient(circle 9px at 0 0,    transparent 98%, #000) top/100% 51% no-repeat,
        radial-gradient(circle 9px at 0 100%, transparent 98%, #000) bottom/100% 51% no-repeat;
}
.ticket .stub b { font-family: var(--font-display); font-size: 20px; font-weight: 400; }  /* 좌석 */
.ticket .label  { font-size: 11px; font-weight: 700; color: var(--day-ink); letter-spacing: .06em; }  /* BOARDING PASS */
.ticket .route  { display: flex; align-items: center; gap: 8px; font-family: var(--font-display); font-size: 22px; margin: 2px 0; }
.ticket .route i { flex: 1; border-top: 2px dotted var(--text-muted); position: relative; }  /* 출발지와 도착지 사이 점선, 가운데에 ✈︎ */
.ticket p       { font-size: 12px; color: var(--text-muted); }  /* 항공편, 좌석 */
```

Safari를 지원하려면 `mask`와 함께 `-webkit-mask`도 지정합니다.

### 4.7 D-day 배지와 공유 링크 배너

```css
.dday {
  font-family: var(--font-display); font-size: 15px; padding: 4px 12px; border-radius: var(--r-full);
  background: var(--accent); color: var(--accent-ink);
}
.share-banner {
  display: flex; align-items: center; gap: 10px; padding: 12px 14px; border-radius: var(--r-md);
  background: var(--accent); color: var(--accent-ink); font-size: 13px; font-weight: 600;
}
.share-banner .link { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.share-banner button { background: var(--surface); color: var(--text); padding: 6px 12px; border-radius: var(--r-full); font-size: 12px; font-weight: 700; }
```

### 4.8 토스트

공유 링크를 복사했을 때처럼 가벼운 확인에 씁니다. 아래에서 스프링으로 올라오고 1.8초 뒤 사라집니다.

```css
.toast {
  position: absolute; left: 50%; bottom: 28px; transform: translate(-50%, 220%); opacity: 0;
  background: var(--text); color: var(--bg); padding: 12px 18px; border-radius: var(--r-full);
  font-size: 14px; font-weight: 600;
  transition: transform 450ms var(--spring), opacity 200ms;
}
.toast.show { transform: translate(-50%, 0); opacity: 1; }
```

## 5. 모션

| 상황 | 값 |
|---|---|
| 누름 피드백 | `translateY(2px) scale(.98)`, 130ms, `--ease-out` |
| 일차 칩 선택 | `translateY(-3px)`, 350ms, `--spring` |
| 카드 등장 | `pop-in` 450ms, `--spring`, 항목마다 60ms 지연 |
| 토스트 | 450ms, `--spring` |
| 바텀 시트 등장·복귀 | 380ms, `--ease-out` (하단에 붙어 있으므로 오버슈트하면 아래에 빈 공간이 드러남) |

그림자는 애니메이션하지 않고 `transform`과 `opacity`만 움직입니다. `prefers-reduced-motion: reduce`에서는 애니메이션과 전환을 모두 끕니다.

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after { animation: none !important; transition-duration: 1ms !important; }
}
```

## 6. 접근성 규칙

- 글자 대비는 4.5:1 이상, 아이콘과 의미 있는 테두리는 3:1 이상을 유지합니다. 토큰을 바꾸면 2.2의 표를 다시 계산합니다.
- 터치 영역은 44×44px 이상으로 합니다.
- 포커스 링은 그림자와 분리해 `outline: 3px solid var(--primary-strong); outline-offset: 2px;`로 그립니다.
- 일차는 색만으로 구분하지 않습니다. 칩과 헤더에 항상 "N일차" 라벨을 함께 표시합니다.
- 일차 칩 목록은 탭 패턴(Base UI Tabs)으로 만들고, 선택 상태를 `aria-selected`로 노출합니다.

## 7. 말투

- 다정한 해요체를 씁니다. 예: "공유 링크를 복사했어요".
- 반말, 애교체("~해쪄"), 과도한 이모지는 쓰지 않습니다.
- 오류나 데이터 손실과 관련된 안내는 장식 없이 담백하게 씁니다.

## 8. 하지 않을 것

- 배경, 경계선, 그림자에 분홍이나 복숭아 색조를 넣지 않습니다.
- 주 버튼에 흰 글자나 검은 계열 글자를 쓰지 않습니다.
- 파스텔 색을 글자색으로 쓰지 않습니다.
- 그림자에 순수한 검정을 쓰지 않습니다.
- 지도 화면은 필요해질 때까지 만들지 않습니다(ADR 0001).
