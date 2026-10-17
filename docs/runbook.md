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
| `SUPABASE_DB_PASSWORD` | secret | 운영 DB 비밀번호 | 운영자 Mac 키체인 `forj-supabase-db-password` |
| `SUPABASE_S3_ACCESS_KEY_ID` | secret | Storage S3 access key ID | 없음. 유실하면 대시보드에서 재발급 |
| `SUPABASE_S3_SECRET_ACCESS_KEY` | secret | Storage S3 secret access key | 없음. 유실하면 대시보드에서 재발급 |
| `VERCEL_DEPLOY_HOOK_URL` | secret | Vercel Deploy Hook URL | 없음. 유실하면 대시보드에서 재발급 |
| `BACKUP_PASSPHRASE` | secret | 백업 암호화 passphrase | 운영자 Mac 키체인 `forj-backup-passphrase` |

Supabase access token은 두지 않습니다. CI는 `postgresql://postgres.<SUPABASE_PROJECT_REF>:<SUPABASE_DB_PASSWORD>@<SUPABASE_POOLER_HOST>:5432/postgres`를 `--db-url`로 넘깁니다. 비밀번호에는 URL 인코딩이 필요한 문자가 없습니다(hex 48자).

`BACKUP_PASSPHRASE`를 잃으면 기존 백업을 복호화할 수 없습니다. 키체인 외에 비밀번호 관리자에도 사본을 둡니다.

## 여행 생성 차단 스위치

남용으로 여행이 대량으로 만들어지는 것을 발견하면, 배포 없이 여행 생성을 즉시 막을 수 있습니다([스펙 8](spec.md#8-남용-방지)). 스위치를 꺼도 이미 있는 여행의 조회와 편집은 그대로 동작합니다.

대시보드의 SQL Editor(https://supabase.com/dashboard/project/sadblxpatcspkgaznjfy/sql)에서 실행합니다.

현재 상태 확인:

```sql
select trip_creation_enabled from private.app_settings;
```

끄기:

```sql
update private.app_settings set trip_creation_enabled = false;
```

다시 켜기:

```sql
update private.app_settings set trip_creation_enabled = true;
```

- 변경은 다음 `create_trip` 호출부터 바로 적용됩니다. 꺼져 있는 동안 `create_trip`은 `TRIP_CREATION_DISABLED`로 거부하고, 첫 화면은 입력을 유지한 채 "지금은 여행을 만들 수 없습니다. 잠시 후 다시 시도해 주세요."라고 안내합니다.
- `app_settings`에는 행이 하나만 있어야 합니다. `insert`나 `delete`는 하지 말고 `update`만 씁니다.
- 최근에 만들어진 여행은 `select share_token, title, created_at from private.trips order by created_at desc limit 50;`으로 확인합니다. 남용 여행을 지우는 방법은 「운영자의 여행 삭제」 절을 따릅니다.

## 운영자의 여행 삭제

<!-- 여행 보기 이슈에서 작성: 남용 대응으로 여행을 토큰으로 찾아 삭제하는 SQL과, 열려 있던 탭에 일어나는 일 -->

## 백업 복구

<!-- daily workflow 이슈에서 작성: 백업 내려받기, 복호화, 로컬에서 검증한 뒤 운영에 복구하는 절차 -->

## scheduled workflow가 비활성화되었을 때

public repo에서 60일 동안 commit이 없으면 GitHub이 scheduled workflow를 비활성화합니다. 그러면 keepalive와 백업이 함께 멈추므로, 알림 메일을 받으면 Actions 탭에서 workflow를 다시 켭니다.
