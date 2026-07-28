# 베베리 노래책

Google Sheets에서 관리하는 노래를 공개 조회하는 GitHub Pages용 정적
홈페이지입니다. 가수·곡명 실시간 검색과 카테고리 다중 선택 필터를
지원합니다.

## 파일 구성

```text
index.html
css/style.css
js/app.js
data/songs.json
apps-script/Code.gs
```

별도의 프레임워크, 패키지 설치 또는 빌드 과정이 필요하지 않습니다.

## 로컬 실행

브라우저의 `file://` 주소 대신 프로젝트 루트에서 정적 서버를 실행하는
것을 권장합니다.

Python이 설치된 경우:

```bash
python -m http.server 5173
```

그다음 브라우저에서 `http://localhost:5173/`을 엽니다. 홈페이지는
`data/songs.json`을 한 번 불러온 뒤 검색과 필터를 브라우저에서 처리합니다.

## 운영 데이터

방문자 홈페이지의 운영 데이터는 `data/songs.json`입니다. 파일은 다음
필드를 포함합니다.

```text
schemaVersion
generatedAt
songCount
categoryCount
songs
categories
```

`apps-script/Code.gs`는 Google Sheets 데이터를 읽는 관리·데이터 생성
측 코드로 유지합니다. 방문자의 브라우저에서는 Apps Script URL을 직접
호출하지 않습니다.

## GitHub Pages 배포

1. 이 폴더의 파일을 GitHub 저장소 기본 브랜치에 올립니다.
2. 저장소 **Settings → Pages**로 이동합니다.
3. **Build and deployment**에서 **Deploy from a branch**를 선택합니다.
4. 배포할 브랜치와 `/(root)` 폴더를 선택하고 저장합니다.
5. 표시된 GitHub Pages 주소에서 동작을 확인합니다.

CSS와 JavaScript는 `./` 상대 경로로 연결되어 있어 사용자/조직 페이지와
프로젝트 하위 경로 모두에서 별도 빌드 없이 동작합니다.

## 데이터 및 보안

- 홈페이지는 저장소의 `data/songs.json`만 읽습니다.
- Apps Script는 `doGet()`만 제공하며 시트를 수정하지 않습니다.
- 비밀번호, OAuth 토큰, 서비스 계정 키를 프런트엔드에 넣지 마세요.
- `songs.json`의 노래 순서는 생성 당시의 시트 행 순서를 유지합니다.
