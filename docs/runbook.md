# forj 운영 runbook

운영자가 따르는 절차를 모아 둔 문서입니다. 제품 동작은 [MVP 스펙](spec.md)에 있습니다. 각 절은 해당 기능을 구현하는 이슈에서 채웁니다.

## 운영 환경과 secret 위치

<!-- 운영 환경 준비 이슈에서 작성: Supabase·Vercel 프로젝트, Deploy Hook, GitHub secret 이름, GitHub 밖에 보관한 백업 passphrase의 위치 -->

## 여행 생성 차단 스위치

<!-- 여행 만들기 이슈에서 작성: app_settings.trip_creation_enabled를 끄고 켜는 SQL -->

## 운영자의 여행 삭제

<!-- 여행 보기 이슈에서 작성: 남용 대응으로 여행을 토큰으로 찾아 삭제하는 SQL과, 열려 있던 탭에 일어나는 일 -->

## 백업 복구

<!-- daily workflow 이슈에서 작성: 백업 내려받기, 복호화, 로컬에서 검증한 뒤 운영에 복구하는 절차 -->

## scheduled workflow가 비활성화되었을 때

public repo에서 60일 동안 commit이 없으면 GitHub이 scheduled workflow를 비활성화합니다. 그러면 keepalive와 백업이 함께 멈추므로, 알림 메일을 받으면 Actions 탭에서 workflow를 다시 켭니다.
