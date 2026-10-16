# 인증 없는 Supabase에서 공유 링크 기반 접근 제어와 Realtime 제한

- 조사 티켓: [#2](https://github.com/sunwjy/forj/issues/2) (map: [#1](https://github.com/sunwjy/forj/issues/1))
- 조사일: 2026-10-16
- 전제: Next.js 단일 앱(Vercel), Supabase Postgres + Realtime, 회원가입/로그인 없음. **공유 링크**를 가진 사람은 누구나 해당 **여행**을 보고 편집할 수 있고, 다른 사람의 편집은 몇 초 안에 반영되어야 한다.
- 이 문서는 결정을 내리지 않는다. 선택지별 사실과 trade-off만 정리한다.

## 요약

| 방식 | 데이터 읽기/쓰기 제한 | Realtime을 링크 소유자로 제한 | 구현 복잡도 | 핵심 한계 |
|---|---|---|---|---|
| A. anon key + 헤더/RPC 토큰 + RLS | 가능 (`request.headers` 또는 RPC 인자) | **`postgres_changes`로는 불가**. Broadcast는 topic 비밀성 또는 별도 수단 필요 | 낮음~중간 | Realtime RLS 평가에 브라우저 커스텀 헤더가 전달되지 않음 |
| B. 익명 로그인 + 멤버십 테이블 + RLS | 가능 (`auth.uid()` 기준) | 가능 (`postgres_changes` RLS, private channel 모두) | 중간 | `auth.users`에 익명 사용자가 쌓임, CAPTCHA/정리 필요, 기기마다 재가입 |
| C. Next.js 서버만 호출 + service role | 가능 (서버 코드가 검증) | 서버가 대신 구독할 수 없으므로 Realtime은 별도 설계 필요 | 중간 | 모든 검증이 앱 코드 책임, RLS 방어선 없음 |
| D. 직접 서명한 JWT (토큰 → trip claim) | 가능 (`auth.jwt()` claim) | 가능 (`postgres_changes`, private channel 모두) | 중간~높음 | signing key 관리, 토큰 만료/갱신 로직 직접 구현 |

Realtime 쪽 요약:

| Realtime 방식 | 링크 소유자 제한 수단 | 비고 |
|---|---|---|
| `postgres_changes` | 구독자 JWT 기준 RLS만 사용 (헤더 불가) | 이벤트마다 구독자별 RLS 검사, 단일 스레드. `DELETE`에는 RLS 미적용 |
| Broadcast (public channel) | topic 이름 자체를 비밀로 (예: `trip:<token>`) | 아무나 그 topic에 send도 가능 → 이벤트는 "다시 불러오라는 신호"로만 취급하는 것이 안전 |
| Broadcast/Presence (private channel, Realtime Authorization) | `realtime.messages` RLS + `realtime.topic()` | join 시점에 평가 후 연결 동안 캐시. JWT 기반 신원이 있으면 깔끔함 |
| Broadcast from Database (`realtime.send`, `realtime.broadcast_changes`) | 위 두 채널 방식 중 하나와 조합 | 트리거로 DB 변경을 Broadcast로 보냄. Vercel 서버를 거치지 않음 |

## 1. 배경 사실

### 1.1 키와 Postgres role

- 레거시 `anon` / `service_role` 키는 JWT이며 legacy JWT secret으로 서명된다. 새 `sb_publishable_...` / `sb_secret_...` 키는 JWT가 아니고, API Gateway가 키를 확인한 뒤 "short-lived JWT"를 만들어 내부로 전달한다. ([JWT Signing Keys](https://supabase.com/docs/guides/auth/signing-keys))
- `anon` role은 "signed-out" 요청이며, Supabase Auth의 익명 사용자와 다르다. 익명 로그인 사용자는 `authenticated` role을 쓴다. ([RLS](https://supabase.com/docs/guides/database/postgres/row-level-security), [Anonymous Sign-Ins](https://supabase.com/docs/guides/auth/auth-anonymous))
- secret key는 RLS를 우회하며 "Never use a secret key in the browser". ([RLS](https://supabase.com/docs/guides/database/postgres/row-level-security))
- `security definer` 함수는 `search_path = ''`를 설정하고, Exposed schemas에 만들지 말 것. RLS에서 함수 호출은 `(select fn())`으로 감싸면 initPlan으로 statement당 한 번만 계산된다. ([RLS](https://supabase.com/docs/guides/database/postgres/row-level-security))

### 1.2 RLS에서 요청 헤더 읽기 (PostgREST)

PostgREST는 요청 헤더, 쿠키, JWT claim을 transaction-scoped setting으로 넣는다. 헤더 이름은 소문자로 바뀐다. ([PostgREST: Transactions](https://github.com/PostgREST/postgrest/blob/main/docs/references/transactions.rst))

```sql
select current_setting('request.headers', true)::json->>'x-trip-token';
```

supabase-js는 `createClient(url, key, { global: { headers: { 'x-trip-token': token } } })`로 모든 REST 요청에 커스텀 헤더를 붙일 수 있다.

### 1.3 Realtime이 RLS를 평가할 때 넘기는 컨텍스트 (소스 확인)

- **Realtime Authorization (private channel)**: `realtime.authorize()`가 `role`, `realtime.topic`, `request.jwt.claims`, `request.jwt.claim.sub`, `request.headers`를 `set_config`한 뒤 `realtime.messages`에 probe insert/select를 해서 권한을 판단한다. ([supabase/realtime `authorize.sql`](https://github.com/supabase/realtime/blob/main/priv/repo/tenant_schema/realtime/functions/authorize.sql))
  - 여기서 headers는 Phoenix `connect_info: [:x_headers]`, 즉 **WebSocket 업그레이드 요청의 `x-` 헤더**다. ([`endpoint.ex`](https://github.com/supabase/realtime/blob/main/lib/realtime_web/endpoint.ex), [`user_socket.ex`](https://github.com/supabase/realtime/blob/main/lib/realtime_web/channels/user_socket.ex))
  - 그런데 브라우저 표준 `WebSocket` API는 커스텀 요청 헤더를 설정할 수 없다(WHATWG WebSocket 생성자는 URL과 subprotocol만 받음). 따라서 **브라우저에서 private channel join 시 링크 토큰을 헤더로 전달하는 방법은 사실상 없다.** (추론: 소스 + 브라우저 API 제약)
- **`postgres_changes`**: `realtime.apply_rls()`는 구독자별로 `role`과 `request.jwt.claims`만 `set_config`한다. `request.headers`는 설정하지 않는다. ([`apply_rls.sql`](https://github.com/supabase/realtime/blob/main/priv/repo/tenant_schema/realtime/functions/apply_rls.sql)) → **헤더 기반 RLS 정책은 `postgres_changes`에서 동작하지 않는다.** 헤더 기반으로 막아 둔 테이블은 이벤트가 오지 않거나, 이벤트를 받게 하려고 anon에게 읽기를 열면 모든 여행이 새어 나간다.

## 2. 선택지별 분석

### A. 브라우저가 anon(publishable) key로 직접 접근 + 링크 토큰을 헤더/RPC 인자로 검증

**구현 형태**

- 여행 테이블에 추측 불가능한 `share_token`(예: 128bit 이상 랜덤)을 둔다.
- 헤더 방식: 모든 정책에서 `exists (select 1 from trips t where t.id = trip_id and t.share_token = (select current_setting('request.headers', true)::json->>'x-trip-token'))`.
- RPC 방식: 테이블은 anon에게 전부 막고, `get_trip(token)`, `update_item(token, ...)` 같은 `security definer` 함수만 노출. 함수가 토큰을 검증한다.
- 여행 생성은 `create_trip()` RPC로 하고 토큰을 반환한다.

**보안상 한계**

- 토큰이 곧 권한이다. URL이 유출되면(메신저 미리보기, 브라우저 기록, 스크린샷) 회수 수단은 토큰 교체뿐이다. 이는 모든 선택지에 공통이며 "링크 = 권한"이라는 제품 전제에서 나온다.
- publishable key는 공개 값이므로 누구나 API를 직접 호출할 수 있다. 토큰을 모르면 RLS가 막지만, 생성 RPC나 대량 요청 남용은 RLS로 막을 수 없다(남용 방지는 별도 이슈).
- 헤더 방식은 정책 실수 하나(토큰 조건 누락)가 곧 전체 노출이다. RPC 방식은 함수 수가 늘지만 노출 표면이 명시적이다.
- Supabase Data API에는 rate limit 기능이 별도로 없으며, PostgREST의 `db-pre-request` 함수 같은 수단으로 직접 구현해야 한다(추론).

**Realtime 지원**

- `postgres_changes`: 1.3절 이유로 **링크 소유자 제한 불가**.
- Private channel: 브라우저가 헤더를 못 보내므로 헤더로는 불가. 단, **topic 이름에 토큰을 넣고** (`trip:<token>`) 정책에서 `realtime.topic()`이 유효한 여행 토큰인지 확인하는 방식은 가능하다(정책 대상 role은 `anon`). 이 경우 실질적인 비밀은 topic 이름이므로 public channel + 비밀 topic과 보안 수준이 거의 같고, 정책이 "존재하는 여행인지" 정도만 추가로 확인해 준다. (추론: 공식 예시는 `authenticated` 대상이지만, 정책은 JWT의 role에 대해 평가되므로 `to anon` 정책도 같은 방식으로 적용된다.)
- Public Broadcast + 비밀 topic: topic을 아는 사람만 받는다. 다만 public channel이므로 topic을 아는 누구나 **send도 가능**하다. 이벤트 payload를 신뢰하지 말고 "변경이 있었으니 다시 조회"하는 신호로만 쓰면 위조 위험이 줄어든다.
- DB 트리거에서 `realtime.send(payload, event, 'trip:'||share_token, false)`로 public broadcast를 보낼 수 있다. "A public broadcast only reaches public channels and a private broadcast only reaches private channels." ([Broadcast](https://supabase.com/docs/guides/realtime/broadcast))

**구현 복잡도**: 낮음~중간. 로그인 흐름이 전혀 없고, 모든 것이 SQL(정책/RPC/트리거)과 클라이언트 코드에 있다.

### B. Supabase 익명 로그인 + 멤버십 테이블 + RLS

**구현 형태**

- 첫 방문 시 `supabase.auth.signInAnonymously()`로 익명 사용자 생성 (`authenticated` role, JWT에 `is_anonymous` claim). ([Anonymous Sign-Ins](https://supabase.com/docs/guides/auth/auth-anonymous))
- `join_trip(token)` `security definer` RPC가 토큰을 검증하고 `trip_members(trip_id, user_id)`에 `auth.uid()`를 추가한다.
- 모든 테이블 정책은 `exists (select 1 from trip_members m where m.trip_id = ... and m.user_id = (select auth.uid()))`.

**보안상 한계**

- 링크 토큰은 join 시점에만 쓰이고, 이후는 JWT 신원으로 판단한다. 토큰을 교체해도 이미 join한 사용자는 남는다(멤버십 삭제로 회수 가능, 장점이기도 함).
- 익명 사용자는 `auth.users`에 저장된다. 문서는 "strongly recommended to enable invisible CAPTCHA or Cloudflare Turnstile"이라 하고, 기본 IP 기반 rate limit은 시간당 30회다. 자동 정리는 없으며 오래된 익명 사용자를 지우는 SQL을 직접 돌려야 한다. ([Anonymous Sign-Ins](https://supabase.com/docs/guides/auth/auth-anonymous))
- 브라우저 데이터를 지우거나 다른 기기를 쓰면 새 익명 사용자가 된다. 링크로 다시 join하면 되므로 이 제품에서는 큰 문제는 아니지만 멤버십 행이 늘어난다.
- 문서 caveat: Next.js 정적 렌더링에서 익명 사용자 metadata가 캐시되어 섞인 사례가 보고되어 dynamic rendering을 권장한다.
- 나중에 로그인 기능을 붙이면 익명 사용자를 영구 계정으로 링크할 수 있다(`updateUser`, `linkIdentity`). MVP 범위 밖이지만 확장 경로가 있다.

**Realtime 지원**: 가장 자연스럽다.

- `postgres_changes`: 구독자 JWT로 RLS를 검사하므로 멤버만 해당 여행 행 변경을 받는다. 단 `DELETE` 이벤트에는 RLS가 적용되지 않는다("RLS policies are not applied to `DELETE` statements"). 삭제 이벤트는 primary key 정도만 노출되도록 설계해야 한다. ([Postgres Changes](https://supabase.com/docs/guides/realtime/postgres-changes))
- Private channel: `realtime.messages`에 `topic = 'trip:'||trip_id`이고 해당 `auth.uid()`가 멤버인 경우만 `select`/`insert` 허용. "Allow public access"를 꺼야 강제된다. ([Realtime Authorization](https://supabase.com/docs/guides/realtime/authorization))

**구현 복잡도**: 중간. Auth 세션 관리(`@supabase/ssr`), CAPTCHA, 익명 사용자 정리 작업이 추가된다.

### C. 브라우저는 Next.js 서버만 호출, 서버가 service role(secret key)로 접근

**구현 형태**

- Server Actions / Route Handlers가 URL의 토큰을 받아 여행을 조회하고 검증한 뒤 secret key 클라이언트로 읽기/쓰기.
- DB는 anon에 대해 전부 닫아 둔다(RLS enabled, 정책 없음).

**보안상 한계**

- secret key는 RLS를 우회하므로 **검증 누락 = 전체 노출**이다. 방어선이 앱 코드 하나뿐이다.
- 대신 rate limit, 입력 검증, 로깅 등 남용 방지를 서버에서 자유롭게 넣을 수 있다.
- Server Actions는 공개 HTTP endpoint이므로 각 action 안에서 토큰을 매번 검증해야 한다(Next.js 일반 원칙).

**Realtime 지원**

- 서버가 대신 구독해서 브라우저로 중계하려면 장기 연결이 필요하다. Vercel Functions는 Fluid Compute 기반 WebSocket을 public beta로 지원하지만, 연결은 함수 최대 실행 시간에 끊기고 인스턴스 간 상태 공유가 안 되어 재연결 로직과 외부 pub/sub이 필요하다. ([Vercel KB: WebSocket](https://vercel.com/kb/guide/do-vercel-serverless-functions-support-websocket-connections)) Supabase Realtime을 쓰는 의미가 사라진다.
- 현실적인 조합은 **"쓰기는 서버, 알림은 브라우저가 Supabase Realtime 직접 구독"**이다. 그러면 Realtime 제한 문제는 A 또는 B, D의 방식으로 다시 풀어야 한다.
  - 서버는 쓰기 후 Broadcast REST API(`POST /realtime/v1/api/broadcast/...`, private이면 `?private=true`)로 WebSocket 없이 알림을 보낼 수 있어 서버리스와 잘 맞는다. 또는 DB 트리거(`realtime.send`)에 맡긴다. ([Broadcast](https://supabase.com/docs/guides/realtime/broadcast))
  - 브라우저 구독은 public channel + 비밀 topic(A와 동일한 한계), 또는 private channel + 서버가 발급한 JWT(D)를 쓴다.

**구현 복잡도**: 중간. 데이터 접근 계층을 직접 만들어야 하고, Realtime은 여전히 별도 설계가 필요하다.

### D. 서버가 링크 토큰을 검증하고 "여행 범위" JWT를 직접 서명해 발급

이슈 목록에 없던 추가 선택지.

**구현 형태**

- Supabase에 자체 private key를 import(`supabase gen signing-key --algorithm ES256` → standby key로 추가 → rotate)하거나 legacy JWT secret을 사용한다. Supabase가 관리하는 key의 private key는 추출할 수 없다. ([JWT Signing Keys](https://supabase.com/docs/guides/auth/signing-keys))
- Next.js Route Handler가 링크 토큰을 검증하고 `{ role: 'anon' 또는 'authenticated', trip_id: ..., exp: 짧게 }` JWT를 서명해 브라우저에 준다. JWT 헤더의 `kid`/`alg`는 import한 key와 맞아야 하고, `role`과 `exp`는 필수다.
- 브라우저는 그 JWT를 `Authorization: Bearer`로 쓰고(`apikey`에는 publishable key), Realtime에는 `supabase.realtime.setAuth(jwt)`.
- 정책: `trip_id = (select auth.jwt()->>'trip_id')::uuid`.

**보안상 한계**

- 서명 key 유출 시 모든 여행이 노출된다. key는 서버 환경 변수로만 관리.
- 만료 전 회수가 어렵다. Realtime은 권한을 연결 동안 캐시하므로 "JWT가 만료되거나 새 JWT가 올 때까지" 계속 받는다. ([Realtime Authorization](https://supabase.com/docs/guides/realtime/authorization))
- 공식 문서는 직접 서명한 JWT를 Data API에 쓰는 방법을 설명하며, Realtime 수용 여부는 명시하지 않는다. 다만 Postgres Changes 문서가 "sign your own JWT to add claims"와 `setAuth` 사용을 안내한다. ([Postgres Changes](https://supabase.com/docs/guides/realtime/postgres-changes))
- 한 번에 여러 여행을 열면 여행별 JWT/클라이언트가 필요하거나, claim에 여러 trip_id를 담아야 한다.

**Realtime 지원**: `postgres_changes`와 private channel 모두 claim 기반 RLS로 제한 가능.

**구현 복잡도**: 중간~높음. JWT 발급 endpoint, 만료 전 갱신, key rotation 운영이 필요하다. Auth 사용자 테이블은 늘지 않는다.

## 3. Realtime 방식 상세

### 3.1 `postgres_changes`

- "authorizes every event against each subscriber". 구독자 100명이면 이벤트당 RLS 검사 100번. 변경은 순서 보장을 위해 단일 스레드로 처리되며, compute를 키워도 처리량이 크게 늘지 않는다. 같은 변경을 3,000명 이상이 구독할 것으로 예상되면 Broadcast를 권장. ([Postgres Changes](https://supabase.com/docs/guides/realtime/postgres-changes))
- 필터는 서버에서 평가되며 `eq`, `in`(최대 100개) 등을 지원, `OR` 미지원. `trip_id=eq.<id>` 필터는 트래픽 절감용이지 보안 수단이 아니다(필터는 클라이언트가 고르므로 RLS가 보안을 담당해야 함).
- `DELETE`에는 RLS 미적용. replica identity `full`이어야 delete 필터 가능.
- 이 MVP 규모(여행당 동시 편집자 소수)에서는 성능 한계는 문제되지 않을 가능성이 크다.

### 3.2 Broadcast

- 클라이언트 간 직접 전송, REST API로 서버에서 전송(WebSocket 불필요), DB에서 `realtime.send` / `realtime.broadcast_changes` 트리거로 전송 가능.
- DB broadcast는 기본 private이고, public/private 플래그가 채널과 일치해야 전달된다.
- DB broadcast 주의: 그날 첫 DB broadcast 전에 WebSocket 연결이 한 번도 없으면 일별 파티션이 없어 insert가 실패하고 `WarnSendingBroadcastMessage` 경고가 난다. ([Broadcast](https://supabase.com/docs/guides/realtime/broadcast))

### 3.3 Realtime Authorization (private channel)

- 클라이언트 `channel('trip:...', { config: { private: true } })` + 대시보드에서 "Allow public access" 끄기.
- `realtime.messages`에 RLS: `select` = 받기, `insert` = 보내기, `extension in ('broadcast','presence')`로 구분, `realtime.topic()`으로 topic 매칭.
- 권한은 채널 join 시 계산되어 **연결 동안 캐시**된다. 회수는 JWT 만료나 새 JWT 전송 시점에 반영된다.
- `realtime` schema에 테이블/함수를 만들 수 없고, 마이그레이션에 `ALTER TABLE realtime.messages ENABLE ROW LEVEL SECURITY`를 넣으면 실패한다(이미 enabled). ([Realtime Authorization](https://supabase.com/docs/guides/realtime/authorization))
- 추후 presence(커서/접속자 표시) 후보 기능도 같은 정책으로 보호할 수 있다.

### 3.4 Vercel 서버리스와의 궁합

- 브라우저가 Supabase Realtime에 직접 WebSocket 연결하는 구조라면 Vercel 쪽 제약은 없다.
- 서버 측에서 알림을 보낼 때는 Broadcast REST API나 DB 트리거가 서버리스에 맞다. 서버리스 함수에서 WebSocket 구독을 유지하는 방식은 맞지 않는다.

### 3.5 관련 한도 (2026-10 기준 문서)

| | Free | Pro |
|---|---|---|
| 동시 연결 | 200 | 500 (spend cap 해제 시 10,000) |
| 초당 메시지 | 100 | 500 (spend cap 해제 시 2,500) |
| 초당 채널 join | 100 | 500 |
| Broadcast payload | 256 KB | 3,000 KB |
| Postgres changes payload | 1,024 KB | 1,024 KB |

출처: [Realtime Limits](https://supabase.com/docs/guides/realtime/limits). 동시 연결 수는 "여행 페이지를 열어 둔 브라우저 탭 수"에 해당하므로 Free 플랜에서는 200 탭이 상한이다.

## 4. 결정에 주는 의미

- **헤더/RPC 토큰(A)은 데이터 접근에는 가장 단순하지만, Realtime과 맞물리지 않는다.** `postgres_changes`는 헤더를 보지 못하고, 브라우저는 WebSocket에 헤더를 못 붙인다. A를 고르면 Realtime은 "비밀 topic의 Broadcast를 변경 신호로 받고 다시 조회"하는 구조가 사실상 강제된다. 이 구조는 단순하고 이 제품의 위협 모델(링크 = 권한)과 크게 어긋나지 않지만, topic을 아는 누구나 가짜 신호를 보낼 수 있다는 점을 받아들여야 한다.
- **JWT 신원이 생기면(B 또는 D) 데이터와 Realtime을 같은 RLS 모델로 묶을 수 있다.** B는 Supabase가 공식 지원하는 경로라 구현 재료가 많지만 익명 사용자 누적, CAPTCHA, 정리 작업이 따라온다. D는 Auth 사용자를 만들지 않지만 key와 JWT 수명 관리를 직접 해야 한다.
- **service role 서버 경유(C)는 Realtime 문제를 해결하지 못한다.** 쓰기 경로와 남용 방지를 서버에 모으는 장점은 있으나, 구독 제한은 결국 A/B/D 중 하나를 다시 골라야 한다. C는 다른 방식과 "쓰기만 서버로" 조합하는 형태로 고려할 수 있다.
- 어떤 방식이든 링크 토큰은 추측 불가능해야 하고, 여행 ID(내부 키)와 분리해 두면 나중에 토큰 교체나 보기 전용 링크(별도 토큰) 추가가 쉬워진다.
- 남용 방지 이슈와 연결: B는 Supabase Auth의 CAPTCHA/rate limit을 쓸 수 있고, C는 서버 rate limit을 쓸 수 있다. A와 D는 생성 endpoint의 남용 방지를 별도로 설계해야 한다(D는 JWT 발급 endpoint가 Next.js에 있으므로 거기서 제한 가능).
