# 재구축 점검 — 2026-09-10

## 확인 기준
- GitHub main: c60a411a1a4d81e7a92986a7c1911f76bffd99aa (2026-09-01)
- Vercel JONGSUNG 팀: 별도 `readi-attendance-preview` 프로젝트 생성 및 GitHub 연결 완료.
- 운영 배포: dpl_BstQB8V5kPBJegJnj4oCqB7m4Ftp, READY. 운영 URL HTTP 200 확인.
- 운영 앱 공개 JavaScript와 Airtable 현재 스키마를 읽기 전용으로 비교.
- Production, readi-erp, Airtable 구조·레코드·Automation 변경 없음.

## 기존 코드
개인키 인증, 재직자 제한, 서명 세션, 홈 요약, 공지 및 첨부 링크,
유연근무·잔업·연차/반차 신청 API와 UI, 내역 필터가 구현되어 있음.
코드의 테이블 및 필드 ID가 현재 Airtable 구조와 일치함.
이 목록은 코드 구현 확인이며 실제 인증·등록 성공을 의미하지 않음.

## 이번 수정
- 사번 부분 일치 FIND를 ARRAYJOIN 결과의 정확한 일치로 변경.
- 내역 조회의 테이블별 100건 제한 제거 후 createdTime 최신순으로 전체 중 100건 표시.
- 연차 중복 점검 시 100건 이후 신청이 누락되지 않도록 조회 제한 제거.
- 05:00, 05:30, 06:00, 06:30 근무시간 및 기존 공통 계산 적용.
- 유연근무 신청 버튼 아래 07시 이전 회사 지시·증빙 안내 추가.
- 잔업 신청 날짜가 속한 월~일 기준으로 기존 신청시간을 다시 합산하여 12시간 한도 검증.
- 잔업 날짜의 최신 유연근무 신청을 자동 적용하고, 미신청일은 08:00~17:00 기본 적용.
- 잔업 `등록일시` 필드 저장 추가.
- 리프레시·공가 유형 추가. 리프레시는 평일 5일, 두 유형 모두 연차 미차감으로 처리.
- 유연근무 기본 선택을 한국시간 현재 시각과 가장 가까운 30분 단위로 변경.

## 남은 차이와 문제
- 연차/반차 기간 및 중복 검증의 실데이터 비교, 동시 제출 검증 필요.
- 공지 이미지/PDF 미리보기, 원본 로고, 모바일 디자인·사용 흐름 비교 필요.
- 안전한 테스트 데이터로 실제 쓰기 통합 테스트, 직원별 격리 테스트, 모바일 브라우저 검증 필요.

## 환경변수 및 실행
- AIRTABLE_TOKEN: 별도 Vercel 프로젝트 Production·Preview에 Secret으로 등록 완료.
- AIRTABLE_BASE_ID: app4nAAb3cL0K8qmB
- SESSION_SECRET: 32자 이상 무작위 값을 별도 Vercel 프로젝트 Production·Preview에 Secret으로 등록 완료.
- Vercel 계정의 운영 환경변수 값은 조회하거나 복사하지 않았음.
- npm ci 성공. npm run build 및 TypeScript 검사 성공.
- node tests/regression.cjs 성공: 조기근무·식사 차감·주말 제외·사번 조건·최신 100건 회귀 검증.
- `readi-attendance-preview.vercel.app` 재배포 READY, HTTP 200 및 Airtable 인증 조회 경로 정상 확인.

## 다음 순서
1. GitHub 브랜치 반영 후 자동 Preview 배포 및 사용자별 읽기 흐름 검증.
2. 운영본 UI·공지 미리보기 재현, 안전한 테스트 데이터로 사용자별 신청 검증.
3. 모바일 비교와 오류 수정. 운영 전환은 별도 승인 후 진행.

## 전환 준비 기준
기존 운영 프로젝트 및 URL을 유지한 상태에서 Preview 검증을 완료한다.
도메인 연결/기존 프로젝트 소스 연결 중 실제 가능한 방법을 Vercel 설정에서 재확인하고,
중단 가능성, 이전 배포로의 롤백, 환경변수 복사, Airtable 영향과 개인키 유지 여부를
구체화한 후 사용자 승인 전에는 어떠한 Production 변경도 하지 않는다.
