# forj 운영 runbook

운영자가 따르는 절차를 모아 둔 문서입니다. 제품 동작은 [MVP 스펙](spec.md)에 있습니다. 각 절은 해당 기능을 구현하는 이슈에서 채웁니다.

## 운영 환경과 secret 위치

secret 값은 이 문서에 기록하지 않습니다. 이름과 보관 위치만 기록합니다.

### Supabase

- 프로젝트: `forj`, ref `sadblxpatcspkgaznjfy`, 리전 Seoul(`ap-northeast-2`), 무료 플랜
- 대시보드: https://supabase.com/dashboard/project/sadblxpatcspkgaznjfy
- API URL: `https://sadblxpatcspkgaznjfy.supabase.co`
- 백업 bucket: `backups`(비공개)
- Storage S3 endpoint: `https://sadblxpatcspkgaznjfy.storage.supabase.co/storage/v1/s3`, region `ap-northeast-2`

### Vercel

- 프로젝트: 팀 `sunwjy`의 `forj`, GitHub `sunwjy/forj`와 연결
- 환경 변수: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`를 Production·Preview·Development에 등록
- Deploy Hook: Settings → Git → Deploy Hooks에서 발급하며, URL은 GitHub secret에만 둡니다.

### GitHub Actions

| 이름 | 종류 | 내용 | GitHub 밖의 보관 위치 |
|---|---|---|---|
| `SUPABASE_PROJECT_REF` | variable | Supabase project ref | 이 문서 |
| `SUPABASE_POOLER_HOST` | variable | Supavisor pooler host(`aws-0-ap-northeast-2.pooler.supabase.com`) | 이 문서 |
| `SUPABASE_PUBLISHABLE_KEY` | variable | publishable key. keepalive가 `get_trip`을 부를 때 씀 | Vercel 환경 변수 `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` |
| `SUPABASE_DB_PASSWORD` | secret | 운영 DB 비밀번호 | 운영자 Mac 키체인 `forj-supabase-db-password` |
| `SUPABASE_S3_ACCESS_KEY_ID` | secret | Storage S3 access key ID | 없음. 유실하면 대시보드에서 재발급 |
| `SUPABASE_S3_SECRET_ACCESS_KEY` | secret | Storage S3 secret access key | 없음. 유실하면 대시보드에서 재발급 |
| `VERCEL_DEPLOY_HOOK_URL` | secret | Vercel Deploy Hook URL | 없음. 유실하면 대시보드에서 재발급 |
| `BACKUP_PASSPHRASE` | secret | 백업 암호화 passphrase | 운영자 Mac 키체인 `forj-backup-passphrase` |

Supabase access token은 두지 않습니다. CI는 `postgresql://postgres.<SUPABASE_PROJECT_REF>:<SUPABASE_DB_PASSWORD>@<SUPABASE_POOLER_HOST>:5432/postgres`를 `--db-url`로 넘깁니다. 비밀번호에는 URL 인코딩이 필요한 문자가 없습니다(hex 48자).

`BACKUP_PASSPHRASE`를 잃으면 기존 백업을 복호화할 수 없습니다. 키체인 외에 비밀번호 관리자에도 사본을 둡니다.

## 여행 생성 차단 스위치

<!-- 여행 만들기 이슈에서 작성: app_settings.trip_creation_enabled를 끄고 켜는 SQL -->

## 운영자의 여행 삭제

<!-- 여행 보기 이슈에서 작성: 남용 대응으로 여행을 토큰으로 찾아 삭제하는 SQL과, 열려 있던 탭에 일어나는 일 -->

## 백업 복구

`Daily` workflow(`.github/workflows/daily.yml`)가 매일 03:00 KST에 `backups` bucket의 `<YYYY-MM-DD>/` 아래에 두 파일을 올립니다. 30일보다 오래된 날짜는 지웁니다.

- `schema.sql.gpg`: `supabase db dump`. `public`과 `private`의 스키마입니다.
- `data.sql.gpg`: `supabase db dump --data-only --schema private`. 앱 데이터는 `private`에만 있으므로 `auth`·`storage`는 넣지 않습니다. 그래서 이 파일만으로 복구할 수 있습니다.

복구는 데이터만 되돌립니다. 스키마는 마이그레이션이 기준이고, `schema.sql`은 운영 스키마가 마이그레이션과 같은지 확인하는 데 씁니다. 복구하면 백업 시점 이후의 모든 변경이 사라집니다.

평문 dump에는 모든 공유 토큰이 들어 있습니다. 저장소 밖의 작업 디렉터리에서만 다루고, 내용을 터미널에 출력하지 않으며, 끝나면 지웁니다. 필요한 도구는 `gpg`(`brew install gnupg`), Docker, Supabase CLI입니다. `psql`은 로컬 DB 컨테이너 안의 것을 씁니다.

### 1. 내려받기

```bash
umask 077
mkdir -p ~/forj-restore && cd ~/forj-restore
```

대시보드의 Storage → `backups` → 복구할 날짜 폴더에서 `schema.sql.gpg`와 `data.sql.gpg`를 내려받아 이 디렉터리에 둡니다.

### 2. 복호화

passphrase는 키체인에서 바로 gpg로 넘깁니다. 명령 인자나 shell history에 남기지 않습니다.

```bash
for f in schema data; do
  security find-generic-password -s forj-backup-passphrase -w \
    | gpg --batch --pinentry-mode loopback --passphrase-fd 0 -o "$f.sql" -d "$f.sql.gpg"
done
```

### 3. 로컬에서 검증

저장소 루트에서 실행합니다. 로컬 DB의 내용은 모두 지워집니다.

```bash
supabase start
supabase db reset   # 마이그레이션 적용. seed는 아래에서 지웁니다

# 운영 스키마가 마이그레이션과 같은지 확인합니다. 차이의 내용은 스키마뿐이므로 출력해도 됩니다.
supabase db dump --local | diff - ~/forj-restore/schema.sql && echo "schema matches"

# 데이터 복구. 한 transaction이므로 실패하면 아무것도 바뀌지 않습니다.
{ echo 'truncate private.trips, private.items, private.app_settings;'; cat ~/forj-restore/data.sql; } \
  | docker exec -i supabase_db_forj psql -U postgres -v ON_ERROR_STOP=1 --single-transaction -q

docker exec supabase_db_forj psql -U postgres -c \
  'select (select count(*) from private.trips) trips, (select count(*) from private.items) items, (select trip_creation_enabled from private.app_settings)'
```

여행 수와 일정 수가 예상과 맞는지 봅니다. 그리고 `pnpm dev`를 띄운 뒤 운영자가 링크를 알고 있는 여행 하나를 주소만 `http://localhost:3000/t/<토큰>`으로 바꿔 열어, 복구하려던 내용이 보이는지 확인합니다.

스키마에 차이가 있으면 운영에 아직 적용되지 않은 마이그레이션이 있거나 운영에서 손으로 바꾼 것이 있다는 뜻입니다. 원인을 먼저 해결하고 복구합니다.

### 4. 운영에 복구

1. 복구하는 동안 새 여행이 생기지 않도록 [여행 생성 차단 스위치](#여행-생성-차단-스위치)를 끕니다. 링크로 하는 편집은 막을 수 없으므로, 사용이 적은 시간에 합니다.
2. 로컬에서 검증한 것과 같은 명령을 운영 DB에 실행합니다. 로컬 DB 컨테이너의 `psql`로 운영에 접속하므로 `supabase start`가 떠 있어야 합니다. DB 비밀번호는 키체인에서 읽습니다.

   ```bash
   DB_URL="postgresql://postgres.sadblxpatcspkgaznjfy:$(security find-generic-password -s forj-supabase-db-password -w)@aws-0-ap-northeast-2.pooler.supabase.com:5432/postgres"
   { echo 'truncate private.trips, private.items, private.app_settings;'; cat ~/forj-restore/data.sql; } \
     | docker exec -i supabase_db_forj psql "$DB_URL" -v ON_ERROR_STOP=1 --single-transaction -q
   docker exec supabase_db_forj psql "$DB_URL" -c \
     'select (select count(*) from private.trips) trips, (select count(*) from private.items) items, (select trip_creation_enabled from private.app_settings)'
   unset DB_URL
   ```

3. 확인 쿼리가 로컬과 같은 수를 보여 주는지 봅니다. 차단 스위치는 백업 시점의 값으로 돌아가 있으므로, 원하는 상태로 다시 맞춥니다.
4. 작업 디렉터리를 지웁니다: `rm -rf ~/forj-restore`

data dump는 `session_replication_role = replica`로 트리거를 끄고 넣으므로 변경 신호가 나가지 않습니다. 열려 있던 탭은 새로고침하거나 다음 변경 신호를 받을 때까지 복구 전 화면을 보여 줍니다.

## scheduled workflow가 비활성화되었을 때

public repo에서 60일 동안 commit이 없으면 GitHub이 scheduled workflow를 비활성화합니다. 그러면 keepalive와 백업이 함께 멈추므로, 알림 메일을 받으면 Actions 탭에서 workflow를 다시 켭니다.
