/**
 * 베베리 노래책 공개 조회 API
 *
 * 읽는 시트:
 * - 노래목록: A열 가수 / B열 곡명 / C열 카테고리
 * - 카테고리: A열 카테고리목록
 *
 * 쓰기·수정 기능은 제공하지 않습니다.
 */

const SONGBOOK_CONFIG = Object.freeze({
  SONG_SHEET_NAME: '노래목록',
  CATEGORY_SHEET_NAME: '카테고리',
  HEADER_ROW_COUNT: 1,
});

/**
 * 웹 앱 주소로 GET 요청이 들어왔을 때 실행됩니다.
 */
function doGet() {
  try {
    return createJsonResponse_(buildSongbookData_());
  } catch (error) {
    console.error(error);

    return createJsonResponse_({
      success: false,
      generatedAt: new Date().toISOString(),
      message: getErrorMessage_(error),
    });
  }
}

/**
 * 노래목록과 카테고리 데이터를 읽어 API 응답 객체를 만듭니다.
 */
function buildSongbookData_() {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();

  if (!spreadsheet) {
    throw new Error(
      '연결된 스프레드시트를 찾을 수 없습니다. Google 시트의 확장 프로그램 메뉴에서 Apps Script를 열어주세요.'
    );
  }

  const songSheet = spreadsheet.getSheetByName(
    SONGBOOK_CONFIG.SONG_SHEET_NAME
  );
  const categorySheet = spreadsheet.getSheetByName(
    SONGBOOK_CONFIG.CATEGORY_SHEET_NAME
  );

  if (!songSheet) {
    throw new Error(
      `"${SONGBOOK_CONFIG.SONG_SHEET_NAME}" 시트를 찾을 수 없습니다. 시트 이름을 확인해주세요.`
    );
  }

  if (!categorySheet) {
    throw new Error(
      `"${SONGBOOK_CONFIG.CATEGORY_SHEET_NAME}" 시트를 찾을 수 없습니다. 시트 이름을 확인해주세요.`
    );
  }

  const songs = readSongs_(songSheet);
  const categories = readCategories_(categorySheet);

  return {
    success: true,
    generatedAt: new Date().toISOString(),
    songs,
    categories,
  };
}

/**
 * 노래목록 시트를 읽습니다.
 *
 * A열: 가수
 * B열: 곡명
 * C열: 카테고리
 */
function readSongs_(sheet) {
  const lastRow = sheet.getLastRow();

  if (lastRow <= SONGBOOK_CONFIG.HEADER_ROW_COUNT) {
    return [];
  }

  const rowCount = lastRow - SONGBOOK_CONFIG.HEADER_ROW_COUNT;

  // A2:C마지막행을 한 번에 읽습니다.
  const rows = sheet
    .getRange(
      SONGBOOK_CONFIG.HEADER_ROW_COUNT + 1,
      1,
      rowCount,
      3
    )
    .getDisplayValues();

  return rows
    .map(function (row) {
      const artist = normalizeText_(row[0]);
      const title = normalizeText_(row[1]);
      const categories = splitCategories_(row[2]);

      return {
        artist,
        title,
        categories,
      };
    })
    .filter(function (song) {
      // 가수와 곡명이 모두 입력된 정상적인 노래만 반환합니다.
      return song.artist !== '' && song.title !== '';
    });
}

/**
 * 카테고리 시트 A열을 읽습니다.
 * 빈 값과 중복을 제거하고 시트 입력 순서는 유지합니다.
 */
function readCategories_(sheet) {
  const lastRow = sheet.getLastRow();

  if (lastRow <= SONGBOOK_CONFIG.HEADER_ROW_COUNT) {
    return [];
  }

  const rowCount = lastRow - SONGBOOK_CONFIG.HEADER_ROW_COUNT;

  const rows = sheet
    .getRange(
      SONGBOOK_CONFIG.HEADER_ROW_COUNT + 1,
      1,
      rowCount,
      1
    )
    .getDisplayValues();

  const categories = [];
  const seen = new Set();

  rows.forEach(function (row) {
    const category = normalizeText_(row[0]);

    if (category !== '' && !seen.has(category)) {
      seen.add(category);
      categories.push(category);
    }
  });

  return categories;
}

/**
 * "K-POP, 발라드" 같은 셀 값을 배열로 변환합니다.
 *
 * 결과:
 * ["K-POP", "발라드"]
 */
function splitCategories_(value) {
  const seen = new Set();

  return String(value || '')
    .split(',')
    .map(function (category) {
      return normalizeText_(category);
    })
    .filter(function (category) {
      if (category === '' || seen.has(category)) {
        return false;
      }

      seen.add(category);
      return true;
    });
}

/**
 * 시트 문자열의 앞뒤 공백을 제거합니다.
 */
function normalizeText_(value) {
  return String(value == null ? '' : value).trim();
}

/**
 * JSON 응답을 만듭니다.
 */
function createJsonResponse_(payload) {
  return ContentService
    .createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * 오류 객체를 안전하게 문자열로 변환합니다.
 */
function getErrorMessage_(error) {
  if (error && typeof error.message === 'string') {
    return error.message;
  }

  return String(error || '알 수 없는 오류가 발생했습니다.');
}

/**
 * Apps Script 편집기에서 데이터 읽기를 확인하기 위한 테스트 함수입니다.
 */
function testApi() {
  const result = buildSongbookData_();

  console.log(JSON.stringify(result, null, 2));
}