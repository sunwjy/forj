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

<!-- 여행 만들기 이슈에서 작성: app_settings.trip_creation_enabled를 끄고 켜는 SQL -->

## 운영자의 여행 삭제

<!-- 여행 보기 이슈에서 작성: 남용 대응으로 여행을 토큰으로 찾아 삭제하는 SQL과, 열려 있던 탭에 일어나는 일 -->

## 백업 복구

<!-- daily workflow 이슈에서 작성: 백업 내려받기, 복호화, 로컬에서 검증한 뒤 운영에 복구하는 절차 -->

## scheduled workflow가 비활성화되었을 때

public repo에서 60일 동안 commit이 없으면 GitHub이 scheduled workflow를 비활성화합니다. 그러면 keepalive와 백업이 함께 멈추므로, 알림 메일을 받으면 Actions 탭에서 workflow를 다시 켭니다.
