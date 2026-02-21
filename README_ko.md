<div align="center">

<img src="https://raw.githubusercontent.com/baekenough/textswift/main/assets/maki-promition-tile_1400x560.png" alt="TextSwift 배너" width="700">

**Codex 기반 웹페이지 즉시 번역 Chrome 확장**

[![npm version](https://img.shields.io/npm/v/@textswift/textswift)](https://www.npmjs.com/package/@textswift/textswift)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

[설치](#설치) · [사용법](#사용법) · [개발](#개발) · [문제 해결](#문제-해결)

</div>

---

## 데모

<div align="center">
<img src="https://raw.githubusercontent.com/baekenough/textswift/main/assets/capture_1280x800.png" alt="TextSwift 작동 화면" width="720">
<p><em>웹페이지에서 텍스트 선택 → 아이콘 클릭 → 즉시 번역</em></p>
</div>

---

## 주요 기능

| 기능 | 설명 |
|------|------|
| **인라인 번역** | 웹페이지에서 텍스트를 선택하고 한 번의 클릭으로 즉시 번역 |
| **팝업 패널** | Chrome 툴바에서 독립 번역 인터페이스 제공 |
| **다국어 지원** | 영어, 한국어, 일본어, 중국어, 스페인어 등 |
| **보안** | 확장에 API 키 없음; 로컬 Codex CLI 인증 재사용 |
| **글꼴 조절** | A+ / A- 버튼으로 번역 글꼴 크기 조절 |
| **모델 벤치마킹** | 최적 모델 선택을 위한 자동 성능 테스트 |

---

## 작동 원리

```
웹 페이지  →  콘텐츠 스크립트  →  백그라운드 워커  →  네이티브 호스트  →  Codex CLI
 (텍스트 선택)   (아이콘 클릭)      (요청 전송)        (codex exec)      (번역 실행)
```

Chrome의 [네이티브 메시징](https://developer.chrome.com/docs/extensions/develop/concepts/native-messaging)을 통해 로컬 Codex CLI와 안전하게 통신합니다. 확장에는 API 키가 저장되거나 전송되지 않습니다.

---

## 지원 언어

🇺🇸 영어 · 🇰🇷 한국어 · 🇯🇵 일본어 · 🇨🇳 중국어 · 🇪🇸 스페인어

> 추가 언어는 향후 업데이트 예정입니다.

---

## 설치

### 빠른 설치

```bash
npm install -g @textswift/textswift
```

자동으로 수행되는 작업:
1. Codex CLI 설치 감지
2. 네이티브 메시징 호스트 등록
3. `chrome://extensions` 자동 열기

Codex에 로그인되어 있지 않다면:

```bash
codex login
```

### Chrome 확장

**Chrome 웹 스토어** (권장):
> [TextSwift Beta](https://chromewebstore.google.com/detail/textswift-beta/bkgfdbpinhpdcclcmjhfbmccojlapalo)

**압축 해제 (개발 모드)**:
1. `chrome://extensions` 열기
2. **개발자 모드** 활성화
3. **압축 해제된 확장 프로그램 로드** → `dist/` 폴더 선택
4. 확장 ID를 복사한 후 실행:

```bash
textswift setup YOUR_EXTENSION_ID
```

### CLI 명령어

| 명령어 | 설명 |
|--------|------|
| `textswift setup [id]` | 네이티브 호스트 등록 (id = Chrome 확장 ID) |
| `textswift status` | 설치 상태 확인 |
| `textswift uninstall` | 네이티브 호스트 매니페스트 제거 |

### 사전 요구사항

- Node.js 18+ 및 npm
- Google Chrome
- [Codex CLI](https://github.com/openai/codex) 설치 및 로그인 완료
- macOS (Windows/Linux 지원 예정)

---

## 사용법

### 인라인 번역

1. 웹페이지에서 텍스트 선택
2. 선택 영역 옆에 나타나는 **TextSwift 아이콘** 클릭
3. 인라인 패널에서 즉시 번역 결과 확인
4. **A+** / **A-** 버튼으로 글꼴 크기 조절
5. **닫기**로 패널 숨기기

> 번역 중에도 아이콘이 유지됩니다 — 다시 클릭하면 패널을 다시 열 수 있습니다.

### 팝업 번역

1. Chrome 툴바에서 TextSwift 아이콘 클릭
2. 입력 필드에 텍스트 붙여넣기 또는 입력
3. 소스 및 타겟 언어 선택
4. **번역** 클릭
5. 결과 복사 또는 설정 변경 후 재시도

---

## 개발

### 스크립트 목록

| 스크립트 | 설명 |
|----------|------|
| `npm run build` | 확장 및 네이티브 호스트 빌드 |
| `npm run typecheck` | TypeScript 타입 검사 |
| `npm run test:unit` | 단위 테스트 실행 |
| `npm run smoke:native` | 실제 Codex CLI로 네이티브 메시징 테스트 |
| `npm run smoke:native:mock` | Mock 응답으로 네이티브 메시징 테스트 |
| `npm run smoke:playwright` | Playwright E2E 테스트 |
| `npm run smoke:inline` | 인라인 선택 아이콘 플로우 검증 |
| `npm run smoke:sites` | 다양한 사이트에서 확장 검증 |
| `npm run checklist` | 전체 품질 검사 |

### 품질 보증

```bash
npm run checklist
```

커밋 전에 타입 검사, 단위 테스트, 스모크 테스트, 벤치마크를 실행합니다.

---

## 모델 전략

TextSwift는 기본/폴백 모델 체인을 사용합니다:

| 역할 | 모델 | 특성 |
|------|------|------|
| 기본 | `gpt-5.3-spark` | 빠르고 비용 효율적 |
| 폴백 | `gpt-5.1-codex-mini` | 안정적인 백업 |

### 벤치마킹

```bash
# 전체 벤치마크
bash scripts/benchmark-models.sh

# 빠른 실행 (1회)
TEXTSWIFT_BENCHMARK_MODE=codex TEXTSWIFT_BENCHMARK_ITERATIONS=1 bash scripts/benchmark-models.sh

# Mock (API 호출 없음)
TEXTSWIFT_BENCHMARK_MODE=mock bash scripts/benchmark-models.sh
```

---

## 문제 해결

<details>
<summary><strong>텍스트 선택 전에 아이콘/패널이 계속 표시됨</strong></summary>

이전 빌드의 오래된 콘텐츠 스크립트가 남아있는 경우입니다. `chrome://extensions`에서 확장을 새로고침한 후 페이지를 새로고침하세요.
</details>

<details>
<summary><strong>"Cannot read properties of undefined (reading 'sendMessage')"</strong></summary>

확장 런타임 바인딩 없이 콘텐츠 스크립트가 실행되고 있습니다. 확장과 웹 페이지를 모두 새로고침하세요.
</details>

<details>
<summary><strong>Extension context invalidated</strong></summary>

콘텐츠 스크립트가 활성화된 상태에서 확장이 새로고침되었습니다. 영향을 받은 탭을 닫고 다시 여세요.
</details>

---

## 보안

- 확장에 API 키가 내장되지 않음
- Codex 인증 파일에 접근하지 않음
- 네이티브 호스트가 `codex exec`를 통해 로컬 인증 재사용
- 모든 요청은 Chrome의 보안 네이티브 메시징 채널을 통해 전달

---

## 마일스톤

- [x] UI 전용 확장 (팝업 + 콘텐츠 위젯 + 상태 UI)
- [x] 네이티브 메시징 채널 연결
- [x] 실제 `codex exec` 번역 (타임아웃/오류 처리 및 폴백 모델 체인)
- [x] Chrome 웹 스토어 출시
- [ ] Windows / Linux 지원

---

## 라이선스

MIT
