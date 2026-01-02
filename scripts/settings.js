// Settings Management

// Initialize settings event listeners
function initializeSettings() {
  // Settings - Search Engine
  const searchEngineSelect = document.getElementById('searchEngineSelect');
  searchEngineSelect.value = state.settings.searchEngine;
  searchEngineSelect.addEventListener('change', (e) => {
    state.settings.searchEngine = e.target.value;
    saveSettings();
    updateSearchBar();
  });

  // Settings - Theme
  const themeToggle = document.getElementById('themeToggle');
  themeToggle.checked = state.settings.theme === 'dark';
  themeToggle.addEventListener('change', (e) => {
    state.settings.theme = e.target.checked ? 'dark' : 'light';
    saveSettings();
    applyTheme();
  });

  // Settings - Background Image
  const bgImageInput = document.getElementById('bgImageInput');
  const removeBgBtn = document.getElementById('removeBgBtn');
  
  bgImageInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        state.settings.backgroundImage = event.target.result;
        saveSettings();
        applyBackground();
        removeBgBtn.classList.remove('hidden');
      };
      reader.readAsDataURL(file);
    }
  });

  removeBgBtn.addEventListener('click', () => {
    state.settings.backgroundImage = null;
    bgImageInput.value = '';
    saveSettings();
    applyBackground();
    removeBgBtn.classList.add('hidden');
  });

  if (state.settings.backgroundImage) {
    removeBgBtn.classList.remove('hidden');
  }

  // Settings - Blur
  const blurRange = document.getElementById('blurRange');
  const blurValue = document.getElementById('blurValue');
  blurRange.value = state.settings.blur;
  blurValue.textContent = state.settings.blur;
  
  blurRange.addEventListener('input', (e) => {
    state.settings.blur = parseInt(e.target.value);
    blurValue.textContent = state.settings.blur;
    saveSettings();
    applyBackground();
  });

  // Settings - Brightness
  const brightnessRange = document.getElementById('brightnessRange');
  const brightnessValue = document.getElementById('brightnessValue');
  brightnessRange.value = state.settings.brightness * 10;
  brightnessValue.textContent = state.settings.brightness.toFixed(1);
  
  brightnessRange.addEventListener('input', (e) => {
    state.settings.brightness = parseInt(e.target.value) / 10;
    brightnessValue.textContent = state.settings.brightness.toFixed(1);
    saveSettings();
    applyBackground();
  });

  // Settings - Columns
  const columnRange = document.getElementById('columnRange');
  const columnValue = document.getElementById('columnValue');
  columnRange.value = state.settings.columns;
  columnValue.textContent = state.settings.columns;
  
  columnRange.addEventListener('input', (e) => {
    state.settings.columns = parseInt(e.target.value);
    columnValue.textContent = state.settings.columns;
    saveSettings();
    loadBookmarks(state.currentFolderId);
  });

  // Settings - Rows
  const rowRange = document.getElementById('rowRange');
  const rowValue = document.getElementById('rowValue');
  rowRange.value = state.settings.rows;
  rowValue.textContent = state.settings.rows;
  
  rowRange.addEventListener('input', (e) => {
    state.settings.rows = parseInt(e.target.value);
    rowValue.textContent = state.settings.rows;
    saveSettings();
    applyRowSettings();
  });

  // Settings - Open in New Tab
  const newTabCheck = document.getElementById('newTabCheck');
  newTabCheck.checked = state.settings.openInNewTab;
  newTabCheck.addEventListener('change', (e) => {
    state.settings.openInNewTab = e.target.checked;
    saveSettings();
  });
}

// Apply row settings to the grid
function applyRowSettings() {
  const container = document.getElementById('bookmarksGrid');
  if (container) {
    container.style.setProperty('--grid-rows', state.settings.rows);
  }
  
  const scrollArea = document.querySelector('.bookmarks-scrollable-area');
  if (scrollArea) {
    scrollArea.style.setProperty('--grid-rows', state.settings.rows);
  }
}

// Call this function when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  initializeSettings();
});