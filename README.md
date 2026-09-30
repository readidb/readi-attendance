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

방문 예약 기능은 별도 Base `READi 방문자관리`의 기존 `방문예약`, `MASTER` 테이블을 사용합니다. 방문자명·상태 필드는 사용하지 않으며 예약 삭제·취소 기능은 포함하지 않습니다.

테이블 ID와 필드 ID는 `lib/constants.ts`에서 관리합니다. Airtable 스키마를 변경하면 해당 상수와 API 매핑을 함께 점검해야 합니다.

## 환경변수

`.env.example`을 복사해 `.env.local`을 생성합니다.

```bash
cp .env.example .env.local
```

```env
AIRTABLE_TOKEN=
AIRTABLE_BASE_ID=app4nAAb3cL0K8qmB
SESSION_SECRET=
```

- `AIRTABLE_TOKEN`: 대상 Base에 대한 읽기·레코드 쓰기 권한이 있는 Airtable PAT
- `AIRTABLE_BASE_ID`: `READi 2026근태관리` Base ID
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
