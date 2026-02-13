# TextSwift

Codex 기반 인페이지 즉시 번역 Chrome 확장

TextSwift는 웹 페이지에서 선택한 텍스트를 번역하는 Chrome MV3 확장 프로그램입니다.

## 주요 기능

- **인라인 선택 번역**: 텍스트 선택 시 즉시 번역 아이콘 표시 및 바로 번역
- **팝업 번역 패널**: 확장 아이콘 클릭으로 독립 번역 인터페이스 제공
- **다국어 지원**: 영어, 한국어, 일본어, 중국어, 스페인어 등
- **네이티브 메시징 보안**: API 키 없이 로컬 Codex 인증 재사용
- **모델 벤치마킹**: 응답 속도 및 성능 측정 자동화

## 마일스톤 현황

- Milestone 1: UI 전용 확장 (팝업 + 콘텐츠 위젯 + 상태 UI) 완료
- Milestone 2: 네이티브 메시징 채널 연결 완료
- Milestone 3: 실제 `codex exec` 번역 경로 활성화 (타임아웃/오류 처리 및 폴백 모델 체인 포함)

## 작동 원리

```
Chrome 확장 (Content Script)
    ↓
    | chrome.runtime.sendMessage
    ↓
Background Service Worker
    ↓
    | chrome.runtime.sendNativeMessage
    ↓
네이티브 호스트 (Node.js)
    ↓
    | child_process.spawn('codex', ['exec'])
    ↓
Codex CLI (로컬 인증)
    ↓
번역 결과 반환
```

## 지원 언어

- 영어 (English)
- 한국어 (Korean)
- 일본어 (Japanese)
- 중국어 (Chinese)
- 스페인어 (Spanish)

추가 언어는 향후 업데이트 예정입니다.

## 설치

### 사전 요구사항

- Node.js 18 이상
- npm 또는 pnpm
- Google Chrome (최신 버전)
- Codex CLI 설치 + 활성 구독

### 빌드

1. 의존성 설치:

```bash
npm install
```

2. 확장 프로그램 및 네이티브 호스트 빌드:

```bash
npm run build
```

3. 품질 검사 실행 (타입 검사 + 단위 테스트 + 스모크 테스트 + 벤치마크):

```bash
npm run checklist
```

### Chrome에 확장 로드

1. Chrome에서 `chrome://extensions` 열기
2. **개발자 모드** 활성화
3. **압축 해제된 확장 프로그램 로드** 클릭
4. `dist` 폴더 선택

새 빌드 로드 후:
- `chrome://extensions`에서 확장 카드의 **새로고침** 클릭
- 대상 탭을 새로고침하여 이전 콘텐츠 스크립트 교체

### 네이티브 호스트 설치 (Mac)

확장을 로드한 후 `chrome://extensions`에서 확장 ID를 확인하고 다음 명령 실행:

```bash
bash scripts/install-native-host.sh --extension-id <YOUR_EXTENSION_ID>
```

Chrome을 재시작하고 팝업에서 **번역** 버튼으로 테스트합니다.

## 사용법

### 인라인 번역

1. 웹 페이지에서 번역할 텍스트 선택
2. 나타나는 `TS` 아이콘 클릭
3. 인라인 패널에서 즉시 번역 결과 확인
4. **닫기** 버튼으로 패널 숨기기
5. 선택 해제 시 아이콘/패널 자동 숨김

참고: 텍스트 선택 전에는 플로팅 버튼이 표시되지 않습니다.

### 팝업 번역

1. 확장 아이콘 클릭
2. 텍스트 입력
3. 소스/타겟 언어 선택
4. **번역** 버튼 클릭
5. 결과 복사 또는 재시도 가능

## 개발

### NPM 스크립트

```bash
# 빌드
npm run build

# 타입 검사
npm run typecheck

# 단위 테스트
npm run test:unit

# 스모크 테스트 (네이티브 메시징 mock)
npm run smoke:native:mock

# 스모크 테스트 (실제 네이티브 메시징)
npm run smoke:native

# Playwright 스모크 테스트
npm run smoke:playwright

# 인라인 선택 플로우 검증
npm run smoke:inline

# 다양한 사이트 검증
npm run smoke:sites

# 전체 검사 실행
npm run checklist
```

### 다양한 사이트 검증

`npm run smoke:sites`는 여러 페이지를 열고 검증하며 결과를 다음 위치에 저장합니다:

```
/Users/sangyi/workspace/business/textswift/output/playwright/sites
```

현재 사이트 목록:
- `https://kiro.dev`
- `https://www.kiro.dev`
- `https://example.com`
- `https://developer.mozilla.org/en-US/`
- `https://news.ycombinator.com/`
- `https://www.reddit.com/r/ClaudeAI/new/`

## 보안 제약사항

- 확장에는 API 키가 내장되거나 직접 사용되지 않습니다.
- 확장은 `auth.json`을 파싱하지 않습니다.
- 네이티브 호스트는 `codex exec`를 통해 로컬 Codex 인증을 재사용합니다 (인증 파일 파싱 없음).

## 모델 전략

### 기본/폴백 모델

- **Primary**: `gpt-5.3-codex-low`
- **Fallback**: `gpt-5.1-codex-mini`
- 팝업 UI는 프로덕션용으로 단순화되었으며, 모델 라우팅은 내부적으로 관리됩니다.

### 벤치마크

벤치마크 실행:

```bash
bash scripts/benchmark-models.sh
```

짧은 실제 벤치마크 실행:

```bash
TEXTSWIFT_BENCHMARK_MODE=codex TEXTSWIFT_BENCHMARK_ITERATIONS=1 bash scripts/benchmark-models.sh
```

Mock 벤치마크 실행:

```bash
TEXTSWIFT_BENCHMARK_MODE=mock bash scripts/benchmark-models.sh
```

스크립트는 p50/p95 값과 권장 최적 모델을 보고합니다.

## 문제 해결

### 증상: 선택 전에 아이콘/패널이 계속 표시됨

- **원인**: 이전 빌드의 오래된 콘텐츠 스크립트가 탭에 여전히 마운트됨
- **해결**:
  1. `chrome://extensions` → TextSwift → **새로고침**
  2. 대상 탭 새로고침 또는 다시 열기

### 증상: `Cannot read properties of undefined (reading 'sendMessage')`

- **원인**: 확장 런타임 바인딩 없이 콘텐츠 스크립트 실행 (오래되었거나 불일치하는 로드)
- **해결**:
  1. `chrome://extensions`에서 확장 새로고침
  2. 페이지 새로고침

### 증상: Extension context invalidated

- **원인**: 확장이 새로고침되었거나 비활성화됨
- **해결**:
  1. `chrome://extensions`에서 확장 상태 확인
  2. 필요시 확장 다시 로드
  3. 대상 페이지 새로고침

## UX 계약

### 콘텐츠 페이지 (`http://*/*`, `https://*/*`)

- 텍스트 선택 전에는 지속적인 플로팅 TS 버튼이 표시되지 않습니다.
- 인라인 `TS` 아이콘은 활성 텍스트 선택 중에만 나타납니다.
- 선택 해제 시 인라인 아이콘/패널이 즉시 숨겨집니다.
- 인라인 `TS` 클릭 시 인라인 패널이 열리고 즉시 번역이 시작됩니다.
- **닫기** 클릭 시 현재 선택에 대한 인라인 패널/아이콘이 숨겨집니다.
- 선택 변경 시 인라인 번역 UI가 다시 활성화됩니다.

### 팝업

- 팝업은 확장 툴바에서 계속 사용 가능합니다.
- 소스 텍스트 + 언어 제어 + 재시도/복사 기능은 변경되지 않습니다.

사용자 대면 상태 메시지는 프로덕션용으로 단순화되었습니다:
- 콘텐츠/팝업 성공 텍스트에 전송/모델/벤치마크 진단 정보가 표시되지 않습니다.

## 라이선스

MIT License

Copyright (c) 2026 TextSwift Contributors

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
