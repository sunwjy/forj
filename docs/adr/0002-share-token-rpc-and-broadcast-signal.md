# 0002. 접근 제어: 토큰 RPC와 비밀 topic Broadcast 신호

- 상태: 채택
- 날짜: 2026-10-16

## 배경

forj에는 회원가입과 로그인이 없고, **공유 링크**를 가진 사람은 누구나 그 **여행**을 보고 편집할 수 있습니다. 다른 사람의 편집은 몇 초 안에 반영되어야 합니다. Supabase에서 이를 구현하는 방법은 [조사 문서](https://github.com/sunwjy/forj/blob/research/supabase-link-access/docs/research/supabase-link-access.md)에 정리되어 있습니다. 결정 과정은 [공유 링크 기반 접근 제어 아키텍처 결정](https://github.com/sunwjy/forj/issues/3)에 기록되어 있습니다.

## 결정

1. **데이터는 토큰 RPC로만 접근합니다.** 테이블은 anon에게 모두 막아 둡니다. 브라우저는 publishable key로 `security definer` RPC만 호출하며, 모든 RPC는 공유 링크의 토큰을 인자로 받아 Postgres 안에서 검증합니다.
2. **실시간 반영은 비밀 topic Broadcast 신호로 처리합니다.** 변경이 생기면 DB 트리거가 `realtime.send`로 `trip:<token>` topic에 public Broadcast를 보냅니다. 클라이언트는 이 이벤트를 "변경이 있었다"는 신호로만 받고 여행을 다시 조회합니다. payload에는 데이터를 담지 않고, 받은 payload도 신뢰하지 않습니다.
3. **Next.js는 데이터 경로에 들어가지 않습니다.** Next.js 서버는 secret key를 보유하지 않습니다. 서버에서 실행되는 부분은 메신저 링크 미리보기를 만드는 여행 페이지의 `generateMetadata` 하나뿐이며, 이 함수도 publishable key로 RPC를 호출합니다.

## 검토했다가 버린 선택지

- **헤더 기반 RLS(`request.headers`)**: 정책 하나에서 토큰 조건을 빠뜨리면 모든 여행이 노출됩니다. 또한 `postgres_changes`와 브라우저 WebSocket에는 헤더가 전달되지 않으므로 Realtime 제한에도 쓸 수 없습니다.
- **익명 로그인과 멤버십 테이블**: 데이터와 Realtime을 같은 RLS로 묶을 수 있습니다. 하지만 "링크가 곧 권한"인 모델에서는 추가로 막아 주는 위협이 거의 없는 데 비해, 익명 사용자 누적과 정리 작업, CAPTCHA라는 운영 부담이 생깁니다.
- **서버가 서명한 여행 범위 JWT**: 위와 같은 이유에 더해, 서명 key 관리와 JWT 갱신 로직을 직접 구현해야 합니다.
- **Next.js 서버가 secret key로 대신 읽고 쓰는 방식**: RLS를 우회하므로 방어선이 앱 코드 하나로 줄어듭니다. 게다가 Realtime 구독 제한 문제는 해결하지 못합니다.
- **`postgres_changes` 구독**: JWT 신원 없이는 링크를 가진 사람으로 구독을 제한할 수 없습니다.

## 결과

- topic 이름을 아는 사람은 누구나 가짜 신호를 보낼 수 있습니다. 하지만 그 사람은 이미 토큰을 가지고 있어서 여행을 편집할 권한이 있으므로, 가짜 신호가 일으키는 피해는 불필요한 재조회 한 번뿐입니다.
- 토큰이 topic 이름으로도 쓰이므로, 링크를 재발급하면 topic도 함께 바뀝니다.
- 신호를 받을 때마다 여행 전체를 다시 조회하므로, 클라이언트 상태는 항상 서버 상태를 그대로 따릅니다. 여행 하나의 데이터가 작다는 전제가 깨지면 재조회 단위를 다시 검토해야 합니다.
- 여행 생성 RPC가 공개되어 있으므로, 남용 방지 수단은 Postgres 안에 두거나 생성 경로만 별도 서버 endpoint로 분리해야 합니다.
- 나중에 로그인이나 사용자별 권한을 추가하려면 접근 모델을 다시 설계해야 합니다.
