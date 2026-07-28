# AGENTS.md

## Project

베베리 노래책 공개 조회 사이트다.

관리자는 Google Sheets에서 노래를 관리하고,
방문자는 GitHub Pages에서 노래를 검색하고 카테고리로 필터링한다.

## Stack

- HTML
- CSS
- Vanilla JavaScript
- Google Apps Script
- GitHub Pages
- 프레임워크 및 빌드 도구 사용 금지
- 외부 UI 라이브러리 사용 금지

## Files

- `index.html`
- `css/style.css`
- `js/app.js`
- `data/songs.json`
- `apps-script/Code.gs`
- `README.md`

## Spreadsheet

### 노래목록

- A열: 가수
- B열: 곡명
- C열: 카테고리
- 1행: 헤더
- 카테고리는 쉼표로 구분된 다중 값

### 카테고리

- A1: 헤더
- A2 이하: 카테고리 목록

`검색` 탭은 홈페이지 API에서 읽지 않는다.

## Homepage data

- 방문자 홈페이지는 `./data/songs.json`만 요청한다.
- Apps Script `/exec` 주소를 방문자 브라우저에서 직접 호출하지 않는다.
- 검색과 필터는 최초 로드한 데이터를 브라우저 메모리에서 처리한다.

## Core behavior

- 가수와 곡명을 부분 검색한다.
- 검색은 대소문자를 구분하지 않는다.
- 카테고리는 여러 개 선택할 수 있다.
- 선택한 카테고리 사이는 OR 조건이다.
- 검색어와 카테고리 조건 사이는 AND 조건이다.
- 카테고리는 정확히 일치시킨다.
- `POP`을 선택했을 때 `K-POP`, `J-POP`이 포함되면 안 된다.
- 카테고리를 선택하지 않으면 전체를 표시한다.
- 시트 행 순서를 유지한다.

## Security

- 공개 읽기 전용이다.
- `doGet()`만 사용한다.
- `doPost()`와 시트 수정 기능을 만들지 않는다.
- 비밀번호, OAuth 토큰, 서비스 계정 키를 프런트엔드에 넣지 않는다.
- 사용자 입력을 `innerHTML`로 삽입하지 않는다.
- 가능한 경우 `textContent`를 사용한다.

## UI

- 모바일 우선
- 모바일 1열, PC 2열
- 카드 표시 순서: 가수, 곡명, 카테고리
- 검색창, 카테고리 칩, 결과 개수, 초기화 버튼을 제공한다.
- 로딩, 오류, 결과 없음 상태를 제공한다.
- 참고 이미지를 홈페이지에 직접 삽입하지 않는다.
- 캐릭터와 SOOP 플레이어 UI를 복제하지 않는다.

## Design tokens

- 배경: `#FFF4F5`
- 카드: `#FFFFFF`
- 보조 배경: `#FFE6EA`
- 메인 핑크: `#F28D9B`
- 강조 코랄: `#F45C63`
- 본문: `#35282C`
- 보조 글자: `#7D696E`
- 테두리: `#EBC8CE`

귀엽고 포근하게 구성하되 장식보다 검색 가독성을 우선한다.

## Validation

구현 후 다음을 확인한다.

- 샘플 데이터 표시
- 가수·곡명 검색
- 카테고리 1개 및 여러 개 선택
- 다중 카테고리 OR 조건
- 검색어와 카테고리 AND 조건
- POP 정확 일치
- 모바일·PC 반응형
- 로딩·오류·결과 없음
- GitHub Pages 경로 호환
