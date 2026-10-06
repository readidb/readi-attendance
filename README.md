# READi 근태관리 시스템

READi 임직원이 개인 접속 링크로 본인의 근태 현황을 확인하고 유연근무, 잔업, 연차를 신청하는 모바일 웹앱입니다.

현재 운영 중인 `https://readi-attendance.vercel.app`과 분리된 신규 코드베이스입니다. 운영 전환 승인 전에는 기존 Production 프로젝트와 도메인을 변경하지 않습니다.

## 주요 기능

- `모바일접속키` 검증 및 재직자 접근 제한
- HttpOnly 서명 세션을 이용한 직원 식별
- 금주 잔업시간, 잔여 잔업 가능시간, 잔여 연차 표시
- 유연근무, 잔업, 연차/반차 신청
- 동일 유형의 중복 신청 및 연차 기간 중복 방지
- 주 12시간 잔업 한도 사전 검증
- 본인 신청내역만 조회 및 유형 필터
- 게시 중인 앱 공지와 첨부파일 표시
- 방문 예약 등록·조회·수정, 월간 달력·목록 보기
- 로그인 사용자 기준 담당자 자동 선택 및 당일 방문 예약 안내
- 모바일 하단 메뉴 및 제출 중 중복 클릭 방지

## 기술 구성

- Next.js 16 App Router
- React 19 / TypeScript
- Airtable REST API
- Vercel Preview Deployment

Airtable 호출은 Route Handler와 Server Component에서만 수행합니다. Airtable Token과 직원 Record ID는 브라우저로 전달하지 않습니다.

## Airtable 연결

Base: `READi 2026근태관리`

| 테이블 | 용도 |
|---|---|
| `00.Master` | 직원 인증 및 근태 요약 |
| `01.유연근무` | 유연근무 신청 |
| `02-1.잔업` | 잔업 신청 및 CAPS 검증 결과 |
| `02-2.CAPS 출퇴근기록` | 월말 CAPS 출퇴근 기록 |
| `03.연차` | 연차와 반차 신청 |
| `99.APP공지` | 앱 공지사항 |

방문 예약 기능은 별도 Base `READi 방문자관리`의 기존 `방문예약`, `MASTER` 테이블을 사용합니다. 예약 취소는 기존 취소 체크 필드로 처리하며 레코드를 삭제하지 않습니다.

Teams 공유용 페이지는 `/visitors/calendar`로 직접 접속합니다. 일반 근태 메뉴에는 노출하지 않으며 개인 `?key=`나 직원 세션이 필요하지 않습니다. `/api/visitors/calendar`는 공유 페이지 전용 API이며, 기존 `/api/visitors`의 개인 인증은 유지됩니다. 두 API는 같은 Airtable DB와 등록·조회·수정·취소 로직을 사용합니다.

방문자명은 Airtable 구조 변경 없이 기존 비고 필드의 첫 줄 `방문자명: 이름`으로 저장하며 화면에서는 방문자명과 비고를 분리합니다. 기존 일반 비고는 그대로 조회하고, 개인 화면에서 수정할 때도 방문자명을 유지합니다. 월간 캘린더에는 취소되지 않은 예약을 표시하며 취소 내역은 예약 목록에서 확인할 수 있습니다.

공유 API 검증: `node tests/visitor-calendar.cjs` (실제 Airtable 쓰기 없이 등록·수정·취소 및 인증 분리 확인).

테이블 ID와 필드 ID는 `lib/constants.ts`에서 관리합니다. Airtable 스키마를 변경하면 해당 상수와 API 매핑을 함께 점검해야 합니다.

## 환경변수

`.env.example`을 복사해 `.env.local`을 생성합니다.

```bash
cp .env.example .env.local
```

```env
AIRTABLE_TOKEN=
AIRTABLE_BASE_ID=app4nAAb3cL0K8qmB
VISITOR_AIRTABLE_TOKEN=
SESSION_SECRET=
```

- `AIRTABLE_TOKEN`: 대상 Base에 대한 읽기·레코드 쓰기 권한이 있는 Airtable PAT
- `AIRTABLE_BASE_ID`: `READi 2026근태관리` Base ID
- `VISITOR_AIRTABLE_TOKEN`: `READi 방문자관리` Base 읽기·레코드 쓰기 권한이 있는 PAT
- `SESSION_SECRET`: 32자 이상의 예측 불가능한 임의 문자열

실제 값은 GitHub에 커밋하지 않습니다. Vercel에서는 새 Preview 프로젝트의 Environment Variables에 등록합니다.

## 로컬 실행

```bash
npm install
npm run dev
```

개인 테스트 URL:

```text
http://localhost:3000/?key=개인접속키
```

## 검증 명령

```bash
npm run lint
npm run build
node --test --test-isolation=none tests/auth-session.test.mjs
```

## 배포 원칙

1. GitHub `slaml7903/readi-attendance`에만 코드를 저장합니다.
2. 별도 Vercel 프로젝트 또는 Preview 환경에만 배포합니다.
3. Preview 테스트에서는 `Preview URL/?key=개인접속키`를 사용합니다.
4. Airtable `개인접속URL` 수식은 운영 URL을 유지합니다.
5. 기존 Vercel Production과 `readi-erp`는 최종 승인 전까지 변경하지 않습니다.

## 테스트 체크리스트

- 정상 키 및 잘못된 키 접근
- 휴직·퇴사자 접근 차단
- 유연근무 신청 및 같은 날짜 중복 차단
- 잔업시간·식사 차감 계산 및 주 12시간 초과 차단
- 연차·반차 일수와 잔여연차 검증
- 본인 신청내역 및 공지 노출
- 다른 직원 데이터 미노출
- 모바일 화면과 제출 중 버튼 잠금
- Airtable 저장과 기존 CAPS 자동매칭 구조 유지


## V2 개인 링크와 내역

- 근태관리 `00.Master`의 `V2개인접속URL`은 기존 `모바일접속키`를 사용해 자동 생성됩니다.
- 형식: `https://readi-attendance-preview.vercel.app/?key=모바일접속키` (키는 URL 인코딩).
- V1 `개인접속URL`과 모바일접속키는 변경하지 않습니다. 직원별 본인 링크만 전달합니다.
- 개인 링크 인증 후 기본 URL(`/`)로 이동하며, HttpOnly 세션 쿠키는 180일간 유지됩니다. 다른 직원의 유효한 개인 링크로 접속하면 그 직원의 세션으로 전환합니다.
- 키 없이 공통 주소만 열면 현재 브라우저의 로그인 세션을 사용합니다. 미로그인 상태에서는 개인 링크 안내를 표시합니다.
- 내 신청내역의 방문예약은 현재 로그인 직원이 담당자로 지정된 예약입니다. 기존 DB에 별도 신청자 필드가 없어 예약 작성자 기준으로 추정하지 않습니다.
- 식사 라벨은 사내식사 / 외부식사입니다. 차감 계산과 DB 필드 매핑은 기존과 동일합니다.
