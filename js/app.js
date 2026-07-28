(function () {
  'use strict';

  var FAVORITES_STORAGE_KEY = 'beberry-songbook-favorites-v1';
  var SONG_DATA_URL = './data/songs.json';
  var searchInput = document.querySelector('#song-search');
  var categoryButtons = document.querySelector('#category-buttons');
  var allCategoriesButton = document.querySelector('[data-all-categories]');
  var favoriteFilterButton = document.querySelector('[data-favorites-only]');
  var resultCount = document.querySelector('#result-count');
  var activeFilterSummary = document.querySelector('#active-filter-summary');
  var resetButton = document.querySelector('#reset-button');
  var statusPanel = document.querySelector('#status-panel');
  var songResults = document.querySelector('#song-results');

  var songs = [];
  var songsByIdKey = new Map();
  var categories = [];
  var categoryCounts = new Map();
  var selectedCategories = new Set();
  var favoriteSongIds = new Map();
  var favoritesNeedCleanup = false;
  var favoritesOnlyMode = false;
  var isReady = false;

  function normalizeSearchText(value) {
    return String(value == null ? '' : value)
      .normalize('NFKC')
      .trim()
      .toLocaleLowerCase();
  }

  function normalizeCategoryList(value) {
    var values = Array.isArray(value) ? value : String(value || '').split(',');
    var seen = new Set();

    return values
      .map(function (category) {
        return String(category == null ? '' : category).trim();
      })
      .filter(function (category) {
        if (category === '' || seen.has(category)) {
          return false;
        }

        seen.add(category);
        return true;
      });
  }

  function normalizeSongId(value) {
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value;
    }

    if (typeof value === 'string' && value.trim() !== '') {
      return value.trim();
    }

    return null;
  }

  function getSongIdKey(songId) {
    return typeof songId + ':' + String(songId);
  }

  function normalizePayload(payload) {
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
      throw new Error('노래 데이터가 올바른 JSON 객체가 아닙니다.');
    }

    if (payload.schemaVersion !== 1) {
      throw new Error('지원하지 않는 노래 데이터 스키마입니다.');
    }

    if (!Array.isArray(payload.songs) || !Array.isArray(payload.categories)) {
      throw new Error('노래 데이터에 songs 또는 categories 배열이 없습니다.');
    }

    if (
      payload.categories.some(function (category) {
        return (
          typeof category !== 'string' ||
          category.trim() === '' ||
          category !== category.trim()
        );
      })
    ) {
      throw new Error('카테고리 데이터의 문자열 형식이 올바르지 않습니다.');
    }

    if (
      payload.songCount !== payload.songs.length ||
      payload.categoryCount !== payload.categories.length
    ) {
      throw new Error('노래 데이터의 개수 정보가 실제 배열과 일치하지 않습니다.');
    }

    if (
      typeof payload.generatedAt !== 'string' ||
      Number.isNaN(Date.parse(payload.generatedAt))
    ) {
      throw new Error('노래 데이터의 생성 시각이 올바르지 않습니다.');
    }

    var normalizedCategories = normalizeCategoryList(payload.categories);

    if (normalizedCategories.length !== payload.categories.length) {
      throw new Error('카테고리 데이터에 빈 값 또는 중복 값이 있습니다.');
    }

    var validCategories = new Set(normalizedCategories);
    var usedIdKeys = new Set();
    var normalizedSongs = payload.songs.map(function (song, index) {
      if (!song || typeof song !== 'object' || Array.isArray(song)) {
        throw new Error((index + 1) + '번째 노래 데이터가 올바르지 않습니다.');
      }

      if (
        typeof song.id !== 'string' ||
        song.id.trim() === '' ||
        song.id !== song.id.trim()
      ) {
        throw new Error((index + 1) + '번째 노래의 id가 올바르지 않습니다.');
      }

      var songIdKey = getSongIdKey(song.id);

      if (usedIdKeys.has(songIdKey)) {
        throw new Error('중복된 노래 id가 있습니다: ' + song.id);
      }

      usedIdKeys.add(songIdKey);

      if (
        typeof song.artist !== 'string' ||
        song.artist.trim() === '' ||
        typeof song.title !== 'string' ||
        song.title.trim() === ''
      ) {
        throw new Error(
          (index + 1) + '번째 노래의 가수 또는 곡명이 올바르지 않습니다.'
        );
      }

      if (!Array.isArray(song.categories)) {
        throw new Error(
          (index + 1) + '번째 노래의 categories가 배열이 아닙니다.'
        );
      }

      if (
        song.categories.some(function (category) {
          return (
            typeof category !== 'string' ||
            category.trim() === '' ||
            category !== category.trim()
          );
        })
      ) {
        throw new Error(
          (index + 1) + '번째 노래의 카테고리 문자열이 올바르지 않습니다.'
        );
      }

      var songCategories = normalizeCategoryList(song.categories);

      if (songCategories.length !== song.categories.length) {
        throw new Error(
          (index + 1) + '번째 노래의 카테고리에 빈 값 또는 중복이 있습니다.'
        );
      }

      songCategories.forEach(function (category) {
        if (!validCategories.has(category)) {
          throw new Error('목록에 없는 카테고리가 있습니다: ' + category);
        }
      });

      return {
        id: song.id,
        artist: song.artist.trim(),
        title: song.title.trim(),
        categories: songCategories
      };
    });

    return {
      songs: normalizedSongs,
      categories: normalizedCategories
    };
  }

  function fetchSongbookData() {
    return fetch(SONG_DATA_URL, {
      cache: 'no-store'
    }).then(function (response) {
      if (!response.ok) {
        throw new Error(
          '노래 데이터 요청에 실패했습니다. (' + response.status + ')'
        );
      }

      return response.json();
    });
  }

  function clearElement(element) {
    while (element.firstChild) {
      element.removeChild(element.firstChild);
    }
  }

  function loadFavorites() {
    favoriteSongIds = new Map();
    favoritesNeedCleanup = false;

    try {
      var storedValue = window.localStorage.getItem(FAVORITES_STORAGE_KEY);

      if (storedValue === null) {
        return;
      }

      var storedIds = JSON.parse(storedValue);

      if (!Array.isArray(storedIds)) {
        favoritesNeedCleanup = true;
        return;
      }

      storedIds.forEach(function (storedId) {
        var songId = normalizeSongId(storedId);

        if (songId === null) {
          favoritesNeedCleanup = true;
          return;
        }

        var songIdKey = getSongIdKey(songId);

        if (favoriteSongIds.has(songIdKey)) {
          favoritesNeedCleanup = true;
          return;
        }

        favoriteSongIds.set(songIdKey, songId);
      });
    } catch (error) {
      favoritesNeedCleanup = true;
      favoriteSongIds = new Map();
    }
  }

  function saveFavorites() {
    try {
      window.localStorage.setItem(
        FAVORITES_STORAGE_KEY,
        JSON.stringify(Array.from(favoriteSongIds.values()))
      );
      favoritesNeedCleanup = false;
      return true;
    } catch (error) {
      return false;
    }
  }

  function isFavorite(songId) {
    return favoriteSongIds.has(getSongIdKey(songId));
  }

  function cleanupFavorites(validSongIds) {
    var validIdKeys = new Set(
      validSongIds.map(function (songId) {
        return getSongIdKey(songId);
      })
    );
    var changed = favoritesNeedCleanup;

    favoriteSongIds.forEach(function (songId, songIdKey) {
      if (!validIdKeys.has(songIdKey)) {
        favoriteSongIds.delete(songIdKey);
        changed = true;
      }
    });

    if (changed) {
      saveFavorites();
    }
  }

  function toggleFavorite(songId) {
    var songIdKey = getSongIdKey(songId);

    if (!songsByIdKey.has(songIdKey)) {
      return;
    }

    if (favoriteSongIds.has(songIdKey)) {
      favoriteSongIds.delete(songIdKey);
    } else {
      favoriteSongIds.set(songIdKey, songId);
    }

    saveFavorites();
    renderFavoriteCount();

    if (favoritesOnlyMode) {
      renderResults();
    } else {
      updateFavoriteButtons(songId);
    }
  }

  function showLoading() {
    isReady = false;
    searchInput.disabled = true;
    resetButton.disabled = true;
    allCategoriesButton.disabled = true;

    if (favoriteFilterButton) {
      favoriteFilterButton.disabled = true;
    }

    songResults.hidden = true;
    statusPanel.hidden = false;
    resultCount.textContent = '노래 목록 준비 중';
    clearElement(statusPanel);

    var spinner = document.createElement('div');
    spinner.className = 'loading-spinner';
    spinner.setAttribute('aria-hidden', 'true');

    var title = document.createElement('p');
    title.className = 'status-panel__title';
    title.textContent = '노래 목록을 불러오는 중이에요…';

    statusPanel.append(spinner, title);
  }

  function showError() {
    isReady = false;
    searchInput.disabled = true;
    resetButton.disabled = true;
    allCategoriesButton.disabled = true;

    if (favoriteFilterButton) {
      favoriteFilterButton.disabled = true;
    }

    songResults.hidden = true;
    statusPanel.hidden = false;
    resultCount.textContent = '불러오기 오류';
    clearElement(statusPanel);

    var icon = document.createElement('span');
    icon.className = 'status-panel__icon';
    icon.setAttribute('aria-hidden', 'true');
    icon.textContent = '!';

    var title = document.createElement('p');
    title.className = 'status-panel__title';
    title.textContent = '노래 목록을 불러오지 못했습니다.';

    var description = document.createElement('p');
    description.className = 'status-panel__description';
    description.textContent = '잠시 후 다시 시도해주세요.';

    var retryButton = document.createElement('button');
    retryButton.className = 'retry-button';
    retryButton.type = 'button';
    retryButton.textContent = '다시 불러오기';
    retryButton.addEventListener('click', loadData);

    statusPanel.append(icon, title, description, retryButton);
  }

  function showEmptyState() {
    songResults.hidden = true;
    statusPanel.hidden = false;
    clearElement(statusPanel);

    var icon = document.createElement('span');
    icon.className = 'status-panel__icon';
    icon.setAttribute('aria-hidden', 'true');
    icon.textContent = '⌕';

    var title = document.createElement('p');
    title.className = 'status-panel__title';
    title.textContent = '검색 결과가 없습니다.';

    var description = document.createElement('p');
    description.className = 'status-panel__description';
    description.textContent =
      '가수, 곡명 또는 선택한 카테고리를 다시 확인해주세요.';

    statusPanel.append(icon, title, description);
  }

  function showFavoritesEmptyState() {
    songResults.hidden = true;
    statusPanel.hidden = false;
    clearElement(statusPanel);

    var icon = document.createElement('span');
    icon.className = 'status-panel__icon status-panel__icon--heart';
    icon.setAttribute('aria-hidden', 'true');
    icon.textContent = '♡';

    var title = document.createElement('p');
    title.className = 'status-panel__title';
    title.textContent = '아직 즐겨찾기한 노래가 없습니다.';

    var description = document.createElement('p');
    description.className = 'status-panel__description';
    description.textContent =
      '노래 옆의 하트를 눌러 자주 찾는 곡을 저장해보세요.';

    statusPanel.append(icon, title, description);
  }

  function appendCategoryButtonContent(button, label, count, iconText) {
    var check = document.createElement('span');
    check.className = 'filter-chip__check';
    check.setAttribute('aria-hidden', 'true');
    check.textContent = iconText || '✓';

    var labelText = document.createElement('span');
    labelText.className = 'filter-chip__label';
    labelText.textContent = label;

    var countText = document.createElement('span');
    countText.className = 'filter-chip__count';
    countText.textContent = String(count);

    button.dataset.songCount = String(count);
    button.setAttribute('aria-label', label + ', ' + count + '곡');
    button.append(check, labelText, countText);
  }

  function createCategoryButton(category) {
    var button = document.createElement('button');
    button.className = 'filter-chip';
    button.type = 'button';
    button.dataset.category = category;
    button.setAttribute('aria-pressed', 'false');
    appendCategoryButtonContent(
      button,
      category,
      categoryCounts.get(category) || 0
    );

    return button;
  }

  function calculateCategoryCounts() {
    categoryCounts = new Map();

    categories.forEach(function (category) {
      categoryCounts.set(category, 0);
    });

    songs.forEach(function (song) {
      song.categories.forEach(function (category) {
        if (categoryCounts.has(category)) {
          categoryCounts.set(category, categoryCounts.get(category) + 1);
        }
      });
    });
  }

  function renderCategoryButtons() {
    clearElement(categoryButtons);

    favoriteFilterButton = document.createElement('button');
    favoriteFilterButton.className = 'filter-chip filter-chip--favorite';
    favoriteFilterButton.type = 'button';
    favoriteFilterButton.dataset.favoritesOnly = '';
    favoriteFilterButton.setAttribute('aria-pressed', 'false');
    appendCategoryButtonContent(
      favoriteFilterButton,
      '즐겨찾기',
      favoriteSongIds.size,
      '♥'
    );
    categoryButtons.appendChild(favoriteFilterButton);

    allCategoriesButton = document.createElement('button');
    allCategoriesButton.className = 'filter-chip is-selected';
    allCategoriesButton.type = 'button';
    allCategoriesButton.dataset.allCategories = '';
    allCategoriesButton.setAttribute('aria-pressed', 'true');
    appendCategoryButtonContent(allCategoriesButton, '전체', songs.length);
    categoryButtons.appendChild(allCategoriesButton);

    categories.forEach(function (category) {
      categoryButtons.appendChild(createCategoryButton(category));
    });
  }

  function renderFavoriteCount() {
    if (!favoriteFilterButton) {
      return;
    }

    var count = favoriteFilterButton.querySelector('.filter-chip__count');

    if (count) {
      count.textContent = String(favoriteSongIds.size);
    }

    favoriteFilterButton.dataset.songCount = String(favoriteSongIds.size);
    favoriteFilterButton.setAttribute(
      'aria-label',
      '즐겨찾기, ' + favoriteSongIds.size + '곡'
    );
  }

  function updateActiveFilterSummary() {
    if (favoritesOnlyMode) {
      activeFilterSummary.textContent = '선택된 필터: 즐겨찾기';
      return;
    }

    if (selectedCategories.size === 0) {
      activeFilterSummary.textContent = '선택된 카테고리: 전체';
      return;
    }

    var selectedInDisplayOrder = categories.filter(function (category) {
      return selectedCategories.has(category);
    });

    activeFilterSummary.textContent =
      '선택된 카테고리: ' + selectedInDisplayOrder.join(', ');
  }

  function updateCategoryButtonStates() {
    var categoryFilterButtons =
      categoryButtons.querySelectorAll('[data-category]');
    var isAllSelected =
      !favoritesOnlyMode && selectedCategories.size === 0;

    allCategoriesButton.classList.toggle('is-selected', isAllSelected);
    allCategoriesButton.setAttribute('aria-pressed', String(isAllSelected));
    favoriteFilterButton.classList.toggle('is-selected', favoritesOnlyMode);
    favoriteFilterButton.setAttribute(
      'aria-pressed',
      String(favoritesOnlyMode)
    );

    categoryFilterButtons.forEach(function (button) {
      var isSelected =
        !favoritesOnlyMode && selectedCategories.has(button.dataset.category);
      button.classList.toggle('is-selected', isSelected);
      button.setAttribute('aria-pressed', String(isSelected));
    });

    updateActiveFilterSummary();
  }

  function updateFavoriteButton(button, song) {
    var favorite = isFavorite(song.id);
    var heart = button.querySelector('.favorite-button__heart');

    button.classList.toggle('is-favorite', favorite);
    button.setAttribute('aria-pressed', String(favorite));
    button.setAttribute(
      'aria-label',
      song.title +
        (favorite ? ' 즐겨찾기에서 제거' : ' 즐겨찾기에 추가')
    );

    if (heart) {
      heart.textContent = favorite ? '♥' : '♡';
    }
  }

  function updateFavoriteButtons(songId) {
    var songIdKey = getSongIdKey(songId);
    var song = songsByIdKey.get(songIdKey);

    if (!song) {
      return;
    }

    songResults
      .querySelectorAll('[data-favorite-song]')
      .forEach(function (button) {
        if (button.dataset.favoriteSong === songIdKey) {
          updateFavoriteButton(button, song);
        }
      });
  }

  function createSongCard(song) {
    var article = document.createElement('article');
    article.className = 'song-card';

    var content = document.createElement('div');
    content.className = 'song-card__content';

    var artist = document.createElement('p');
    artist.className = 'song-card__artist';
    artist.textContent = song.artist;

    var title = document.createElement('h3');
    title.className = 'song-card__title';
    title.textContent = song.title;

    content.append(artist, title);

    if (song.categories.length > 0) {
      var categoryList = document.createElement('ul');
      categoryList.className = 'song-card__categories';
      categoryList.setAttribute('aria-label', '카테고리');

      song.categories.forEach(function (category) {
        var item = document.createElement('li');
        item.className = 'song-card__category';
        item.textContent = category;
        categoryList.appendChild(item);
      });

      content.appendChild(categoryList);
    }

    var favoriteButton = document.createElement('button');
    favoriteButton.className = 'favorite-button';
    favoriteButton.type = 'button';
    favoriteButton.dataset.favoriteSong = getSongIdKey(song.id);

    var heart = document.createElement('span');
    heart.className = 'favorite-button__heart';
    heart.setAttribute('aria-hidden', 'true');
    favoriteButton.appendChild(heart);
    updateFavoriteButton(favoriteButton, song);

    article.append(content, favoriteButton);
    return article;
  }

  function getFilteredSongs() {
    var query = normalizeSearchText(searchInput.value);

    return songs.filter(function (song) {
      var matchesText =
        query === '' ||
        normalizeSearchText(song.artist).includes(query) ||
        normalizeSearchText(song.title).includes(query);

      var matchesSelectedFilter = favoritesOnlyMode
        ? isFavorite(song.id)
        : selectedCategories.size === 0 ||
          song.categories.some(function (category) {
            return selectedCategories.has(category);
          });

      return matchesText && matchesSelectedFilter;
    });
  }

  function hasActiveFilters() {
    return (
      searchInput.value.trim() !== '' ||
      selectedCategories.size > 0 ||
      favoritesOnlyMode
    );
  }

  function renderResults() {
    var filteredSongs = getFilteredSongs();
    var hasFilters = hasActiveFilters();

    resultCount.textContent =
      (hasFilters ? '검색 결과 ' : '전체 ') + filteredSongs.length + '곡';
    resetButton.disabled = !isReady || !hasFilters;

    if (filteredSongs.length === 0) {
      songResults.replaceChildren();

      if (favoritesOnlyMode && favoriteSongIds.size === 0) {
        showFavoritesEmptyState();
      } else {
        showEmptyState();
      }

      return;
    }

    var songCards = document.createDocumentFragment();

    filteredSongs.forEach(function (song) {
      songCards.appendChild(createSongCard(song));
    });

    songResults.replaceChildren(songCards);
    statusPanel.hidden = true;
    songResults.hidden = false;
  }

  function setFavoritesOnlyMode(enabled) {
    favoritesOnlyMode = enabled;

    if (enabled) {
      selectedCategories.clear();
    }

    updateCategoryButtonStates();
    renderResults();
  }

  function resetFilters() {
    searchInput.value = '';
    favoritesOnlyMode = false;
    selectedCategories.clear();
    updateCategoryButtonStates();
    renderResults();
    searchInput.focus();
  }

  function handleCategoryClick(event) {
    var button = event.target.closest('button');

    if (!button || !categoryButtons.contains(button)) {
      return;
    }

    if (button.hasAttribute('data-favorites-only')) {
      setFavoritesOnlyMode(true);
      return;
    }

    favoritesOnlyMode = false;

    if (button.hasAttribute('data-all-categories')) {
      selectedCategories.clear();
    } else if (button.dataset.category) {
      if (selectedCategories.has(button.dataset.category)) {
        selectedCategories.delete(button.dataset.category);
      } else {
        selectedCategories.add(button.dataset.category);
      }
    }

    updateCategoryButtonStates();
    renderResults();
  }

  function handleSongResultsClick(event) {
    var button = event.target.closest('[data-favorite-song]');

    if (!button || !songResults.contains(button)) {
      return;
    }

    var song = songsByIdKey.get(button.dataset.favoriteSong);

    if (song) {
      toggleFavorite(song.id);
    }
  }

  function loadData() {
    showLoading();

    fetchSongbookData()
      .then(normalizePayload)
      .then(function (data) {
        songs = data.songs;
        songsByIdKey = new Map();
        songs.forEach(function (song) {
          songsByIdKey.set(getSongIdKey(song.id), song);
        });
        categories = data.categories;
        loadFavorites();
        cleanupFavorites(
          songs.map(function (song) {
            return song.id;
          })
        );
        calculateCategoryCounts();
        favoritesOnlyMode = false;
        selectedCategories.clear();
        searchInput.value = '';
        renderCategoryButtons();
        updateCategoryButtonStates();
        renderFavoriteCount();
        isReady = true;
        searchInput.disabled = false;
        allCategoriesButton.disabled = false;
        favoriteFilterButton.disabled = false;
        renderResults();
      })
      .catch(function (error) {
        console.error('노래 목록 로딩 실패:', error);
        showError();
      });
  }

  searchInput.addEventListener('input', renderResults);
  categoryButtons.addEventListener('click', handleCategoryClick);
  songResults.addEventListener('click', handleSongResultsClick);
  resetButton.addEventListener('click', resetFilters);

  loadData();
})();
