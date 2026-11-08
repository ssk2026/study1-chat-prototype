# Study 1 AI 대화 연구 플랫폼

ChatGPT형 연구 인터페이스에 Vercel Functions, OpenAI Responses API, Supabase 데이터 저장 구조를 결합한 프로젝트입니다.

## 과제

- **TASK 1:** 사막 생존 과제 소개 → 가상 사전조사의 10개 물품 선택 빈도 순서와 선택적 근거 초기 예측 → 결과를 모르는 AI 협력자와 10분간 대화 → 최종 1~10위 순서 제출 및 디브리핑
- **TASK 2:** 일상 갈등 초기 책임 판단 → 반대 입장 AI 토론 → 최종 판단

## 구조

```text
dist/                 참가자용 정적 UI
api/                  Vercel Functions
lib/                  OpenAI·Supabase 서버 전용 코드
supabase/migrations/  재현 가능한 데이터베이스 스키마
docs/DEPLOYMENT.md    GitHub·Supabase·Vercel 연결 절차
```

브라우저는 `/api/*`만 호출합니다. `OPENAI_API_KEY`와 Supabase secret key는 Vercel 서버 환경변수에만 저장하며 HTML에는 포함하지 않습니다.

## 로컬 UI 확인

`dist/index.html` 또는 `dist/task2.html`을 직접 열거나 정적 서버로 제공하면 자동으로 시뮬레이션 모드가 사용됩니다. 배포 환경에서는 서버 API와 데이터베이스 연결에 실패할 경우 연구 자료 누락을 막기 위해 제출을 완료하지 않습니다.

## 배포

[docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)를 따르세요. 필요한 환경변수 이름은 `.env.example`에 있습니다.

## 실제 연구 전 필수 사항

- IRB 승인 문구와 동의·철회·사후설명 화면
- 익명 참가자 ID 발급과 모집정보의 분리 보관
- 조건 무작위 배정 및 조작점검
- 정확한 OpenAI 모델 ID와 프롬프트 버전 고정
- 자료 보존기간, 삭제 절차, 관리자 접근 통제
- 모바일·중복 제출·네트워크 중단 파일럿 테스트
