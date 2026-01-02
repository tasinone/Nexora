// Browser compatibility layer
const browserAPI = typeof browser !== 'undefined' ? browser : chrome;

// State Management
const state = {
  currentFolderId: null,
  folderHistory: [],
  settings: {
    searchEngine: 'google',
    theme: 'light',
    backgroundImage: null,
    blur: 0,
    brightness: 1.0,
    columns: 5,
    rows: 4,
    openInNewTab: false
  }
};

// Search Engine Configurations
const searchEngines = {
  google: { name: 'Google', icon: '../assets/icons/google-icon.png', url: 'https://www.google.com/search?q=' },
  duckduckgo: { name: 'DuckDuckGo', icon: '../assets/icons/ddgo-icon.png', url: 'https://duckduckgo.com/?q=' },
  startpage: { name: 'Startpage', icon: '../assets/icons/startpage-icon.png', url: 'https://www.startpage.com/search?q=' },
  ecosia: { name: 'Ecosia', icon: '../assets/icons/ecosia-icon.png', url: 'https://www.ecosia.org/search?q=' },
  qwant: { name: 'Qwant', icon: '../assets/icons/qwant-icon.png', url: 'https://www.qwant.com/?q=' },
  brave: { name: 'Brave', icon: '../assets/icons/brave-icon.png', url: 'https://search.brave.com/search?q=' },
  bing: { name: 'Bing', icon: '../assets/icons/bing-icon.png', url: 'https://www.bing.com/search?q=' },
  searx: { name: 'SearX', icon: '../assets/icons/searx-icon.png', url: 'https://searx.org/?q=' },
  yandex: { name: 'Yandex', icon: '../assets/icons/yandex-icon.png', url: 'https://yandex.com/search/?text=' }
};

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
  await loadSettings();
  initializeSettings();
  await loadBookmarks(state.currentFolderId);
  setupEventListeners();
  updateSearchBar();
  applyTheme();
  applyBackground();
  await loadNavigationState();
  await checkWelcomeModal(); // Add this
});

// Load settings from browserAPI.storage
async function loadSettings() {
  return new Promise((resolve) => {
    browserAPI.storage.local.get(['settings'], (result) => {
      if (result.settings) {
        state.settings = { ...state.settings, ...result.settings };
      }
      resolve();
    });
  });
}

// Save settings to browserAPI.storage
function saveSettings() {
  browserAPI.storage.local.set({ settings: state.settings });
}

// Load navigation state (current folder and history)
async function loadNavigationState() {
  return new Promise((resolve) => {
    browserAPI.storage.local.get(['navigationState'], (result) => {
      if (result.navigationState) {
        state.currentFolderId = result.navigationState.currentFolderId;
        state.folderHistory = result.navigationState.folderHistory || [];
      }
      resolve();
    });
  });
}

// Save navigation state
function saveNavigationState() {
  browserAPI.storage.local.set({
    navigationState: {
      currentFolderId: state.currentFolderId,
      folderHistory: state.folderHistory
    }
  });
}

// Get "Nexora" folder
async function getNexoraFolder() {
  return new Promise((resolve) => {
    browserAPI.bookmarks.search({ title: "Nexora" }, (results) => {
      // Find the actual Nexora folder (not a bookmark)
      const nexoraFolder = results.find(item => 
        item.title === "Nexora" && !item.url
      );
      resolve(nexoraFolder || null);
    });
  });
}

// Load bookmarks
async function loadBookmarks(folderId = null) {
  const container = document.getElementById('bookmarksGrid');
  container.innerHTML = '';

  let bookmarks;
  if (folderId) {
    bookmarks = await getBookmarksFromFolder(folderId);
    state.currentFolderId = folderId;
  } else {
    const nexoraFolder = await getNexoraFolder();
    if (nexoraFolder) {
      bookmarks = nexoraFolder.children || await getBookmarksFromFolder(nexoraFolder.id);
      state.currentFolderId = nexoraFolder.id;
    } else {
      bookmarks = [];
    }
  }

  renderBookmarks(bookmarks);
  updateBackButton();
  saveNavigationState();
}

// Get bookmarks from a specific folder
async function getBookmarksFromFolder(folderId) {
  return new Promise((resolve) => {
    browserAPI.bookmarks.getChildren(folderId, (children) => {
      resolve(children);
    });
  });
}

// Convert blob to base64
function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

// Get from storage
async function getFromStorage(key) {
  return new Promise((resolve) => {
    browserAPI.storage.local.get([key], (result) => {
      resolve(result[key] || null);
    });
  });
}

// Save to storage
async function saveToStorage(key, data) {
  return new Promise((resolve) => {
    browserAPI.storage.local.set({ [key]: data }, () => {
      resolve();
    });
  });
}

// Fetch link icon from HTML
async function fetchLinkIcon(domain) {
  try {
    const response = await fetch(domain);
    if (!response.ok) return null;
    
    const html = await response.text();
    const match = html.match(/<link[^>]+rel=["'](?:icon|shortcut icon|apple-touch-icon)["'][^>]*>/i);
    
    if (match) {
      const hrefMatch = match[0].match(/href=["']([^"']+)["']/i);
      if (hrefMatch) {
        const href = hrefMatch[1];
        return new URL(href, domain).href;
      }
    }
  } catch (error) {
    console.error('Error fetching link icon:', error);
  }
  return null;
}

// Get favicon with multiple fallback methods
async function getFavicon(url) {
  try {
    // Validate URL first
    if (!url || url.trim() === '') {
      return getDefaultFaviconSvg();
    }

    const urlObj = new URL(url);
    const domain = urlObj.origin;
    const hostname = urlObj.hostname;
    
    // Check cache first
    const cached = await getFromStorage(`favicon_${domain}`);
    if (cached) return cached;

    // Try multiple methods in order
    const methods = [
      `${domain}/favicon.ico`,
      async () => await fetchLinkIcon(domain),
      `https://icons.duckduckgo.com/ip3/${hostname}.ico`,
      `https://www.google.com/s2/favicons?domain=${hostname}&sz=64`
    ];

    for (const method of methods) {
      let iconUrl = typeof method === 'function' ? await method() : method;
      
      if (!iconUrl) continue;

      try {
        const response = await fetch(iconUrl);
        if (response.ok) {
          const blob = await response.blob();
          
          // Verify it's actually an image
          if (blob.type.startsWith('image/')) {
            const base64 = await blobToBase64(blob);
            await saveToStorage(`favicon_${domain}`, base64);
            return base64;
          }
        }
      } catch (error) {
        console.error(`Failed to fetch from ${iconUrl}:`, error);
        continue;
      }
    }

    // Return default if all methods fail
    return getDefaultFaviconSvg();
  } catch (error) {
    console.error('Error in getFavicon:', error);
    return getDefaultFaviconSvg();
  }
}

// Default favicon SVG
function getDefaultFaviconSvg() {
  return 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAIAAAACACAMAAAD04JH5AAAACXBIWXMAAAsTAAALEwEAmpwYAAAAIGNIUk0AAHolAACAgwAA+f8AAIDpAAB1MAAA6mAAADqYAAAXb5JfxUYAAAMAUExURf///3Wo1kyQyvL3+5rA4TiExNDi8TKBwvr8/kCJxujx+Gag0sHZ7d3q9VmYzbPQ6abH5YKx2o643RMTExQUFBUVFRYWFhcXFxgYGBkZGRoaGhsbGxwcHB0dHR4eHh8fHyAgICEhISIiIiMjIyQkJCUlJSYmJicnJygoKCkpKSoqKisrKywsLC0tLS4uLi8vLzAwMDExMTIyMjMzMzQ0NDU1NTY2Njc3Nzg4ODk5OTo6Ojs7Ozw8PD09PT4+Pj8/P0BAQEFBQUJCQkNDQ0REREVFRUZGRkdHR0hISElJSUpKSktLS0xMTE1NTU5OTk9PT1BQUFFRUVJSUlNTU1RUVFVVVVZWVldXV1hYWFlZWVpaWltbW1xcXF1dXV5eXl9fX2BgYGFhYWJiYmNjY2RkZGVlZWZmZmdnZ2hoaGlpaWpqamtra2xsbG1tbW5ubm9vb3BwcHFxcXJycnNzc3R0dHV1dXZ2dnd3d3h4eHl5eXp6ent7e3x8fH19fX5+fn9/f4CAgIGBgYKCgoODg4SEhIWFhYaGhoeHh4iIiImJiYqKiouLi4yMjI2NjY6Ojo+Pj5CQkJGRkZKSkpOTk5SUlJWVlZaWlpeXl5iYmJmZmZqampubm5ycnJ2dnZ6enp+fn6CgoKGhoaKioqOjo6SkpKWlpaampqenp6ioqKmpqaqqqqurq6ysrK2tra6urq+vr7CwsLGxsbKysrOzs7S0tLW1tba2tre3t7i4uLm5ubq6uru7u7y8vL29vb6+vr+/v8DAwMHBwcLCwsPDw8TExMXFxcbGxsfHx8jIyMnJycrKysvLy8zMzM3Nzc7Ozs/Pz9DQ0NHR0dLS0tPT09TU1NXV1dbW1tfX19jY2NnZ2dra2tvb29zc3N3d3d7e3t/f3+Dg4OHh4eLi4uPj4+Tk5OXl5ebm5ufn5+jo6Onp6erq6uvr6+zs7O3t7e7u7u/v7/Dw8PHx8fLy8vPz8/T09PX19fb29vf39/j4+Pn5+fr6+vv7+/z8/P39/f7+/v///wvEBiwAAAQlSURBVHja7FrJEqQgDI0iCigu/P/HzqHVZglKEKdrasilS2zJI2QjAaBSpUqVKlWqVOlfJqb1smgtfsB6aQeP2umvMe/5ECGp3+euotw/xNmr7M2QQOtr7Jshkcwr7NeBQOU1UiBcGHx+QSEvC/MfQw4bAJy8Iu+LkTVvv/9qsAHA5L0uKgRLwgJO8bsA4OAMzN6jwranAOS+UPABwPJ5GAH0+cFSdPs3gGN5DYQAYP4+jQUVoXV21Ntd7GlwjGYsxb8FS9UAByDOjQIAXgbBIcvOZmgiAI5/fx62Em6xs20uFADgz8r59xOvqDxzciwAA7A6A/q03Yf+5+DPAv9yM6AfeiTfmnkg0WB+Y2nsdwf54+hrcHbXI9vDFMGNf63YN3i8BiB3NWHycWyMRHq4BiBSPkvLe/MAxHDrTAGs0IeBXsUA6AZh3OSJwPqsx9Pf0Sz7m341I4+vO08PHRci5JBBUjjujMb/Y0LyXiVS0tKc3CAE3WXzPyyDwl/7AjiXwW8FPznO0PqW5WpAIJN+RHVCNjoiPUV2yDH7Hu//dzjD+//dHoKcOM78SByfeA0HDfo1SQALugYUgEBcX6hT9wA4khsmAQAncc7ZA4ZkUgMVgET2gJaJ3gqFBIuUn0YnaNMA8OQFpKsA2Mn5HYCoBAcKgA4Z69MAIHaIgrrOxdjtWBSARkY1AQBm8gz/HgfAkNOAIORFGzJrTwGAiosQkmdk1oUCALDVEk7rfHiN5l8DaH8NQP73ANK2QP5aCV80w7RwaN5zRGnVmuk9V6wIwUghrBKDUZ8uwotwvKVIEAfQIaMzGQBP0SEcwFwkIXmQkkW/T83Lm+QVJI8KUo1AIDkZGUCbnZHh885UANuTwyHy9ykdAEPMmBAJvtzWcFumFACIJ20IbujyeH4EE722Xszk7arj5xJyiYSHju9oEd60TxuFcOuJO4AWtuSDwJtRJgtrNA0NQHe9nMQayeDKkEjaXQ2xWGs3X6KL37clmsNteKOHKII55NspbHOVCfVkxBo9FBGM/upHcVOu9y+XmDazXq/Llusz2sjcF2YSALbXqeecA8FFy0SfytSm9IyU1TbM75utvvyITSurkd9nATg2YXWdYXcFYHQrus1AdsLYJkxRfjcD3eOrFF7nMmi++PM3Tj5rnl/l0K5nV2nNa+FGj0cXORb3WOtHOg+AtJ/lMwUMOjW2CAQOwHlb7EpTh7TgLq9wSLCdQIFrLJPjzVy7cgDw7xPPb5jG06OPLjbIlQ5H51a7bV7qbp/djXNEawE4bW594z6ZFWONfaXgy+ewucbNBYqRxiteJwAkKVJQllrs6uQOwOSWo0gkKAkpvEIqlf17F1tZQhGTv3zPeUs/kLxG5qfcd41cvDOAXH5xwxxACPEbxpUqVapUqVKlSuXozwC33nS4h10c4wAAAABJRU5ErkJggg==';
}

// Render bookmarks in grid (REPLACE the entire renderBookmarks function)
function renderBookmarks(bookmarks) {
  const container = document.getElementById('bookmarksGrid');
  container.innerHTML = '';
  
  // Update grid columns AND rows based on settings
  container.style.setProperty('--grid-columns', state.settings.columns);
  container.style.setProperty('--grid-rows', state.settings.rows);
  
  const scrollArea = document.querySelector('.bookmarks-scrollable-area');
  scrollArea.style.setProperty('--grid-rows', state.settings.rows);
  
  if (bookmarks.length === 0) {
    container.innerHTML = '<div class="col-span-full text-center text-base-content/50 py-8">No bookmarks found</div>';
    return;
  }

  bookmarks.forEach(bookmark => {
    const item = createBookmarkItem(bookmark);
    container.appendChild(item);
  });
}

// Create bookmark item element
function createBookmarkItem(bookmark) {
  const item = document.createElement('div');
  item.className = 'bookmark-item bg-base-300 rounded-box';
  item.dataset.bookmarkId = bookmark.id;
  
  // Determine if it's a folder by checking if url property is missing or if children property exists
  const isFolder = !bookmark.url || bookmark.children;
  item.dataset.isFolder = isFolder ? 'true' : 'false';

  const iconContainer = document.createElement('div');
  iconContainer.className = 'bookmark-icon-container';

  if (isFolder) {
    // It's a folder - always show folder icon
    iconContainer.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" class="folder-icon">
        <path fill="none" stroke="currentColor" stroke-linejoin="round" stroke-width="1.5" d="M2.75 8.623v7.379a4 4 0 0 0 4 4h10.5a4 4 0 0 0 4-4v-5.69a4 4 0 0 0-4-4H12M2.75 8.624V6.998a3 3 0 0 1 3-3h2.9a2.5 2.5 0 0 1 1.768.732L12 6.313m-9.25 2.31h5.904a2.5 2.5 0 0 0 1.768-.732L12 6.313"/>
      </svg>
    `;
  } else if (bookmark.url && bookmark.url.trim() !== '') {
    // It's a bookmark with a valid URL - fetch and display favicon
    const img = document.createElement('img');
    img.className = 'bookmark-icon';
    img.src = getDefaultFaviconSvg(); // Set default initially
    
    // Fetch the actual favicon asynchronously
    getFavicon(bookmark.url).then(faviconUrl => {
      img.src = faviconUrl;
    }).catch(error => {
      console.error('Error loading favicon for', bookmark.url, ':', error);
      img.src = getDefaultFaviconSvg();
    });
    
    img.onerror = () => {
      img.src = getDefaultFaviconSvg();
    };
    
    iconContainer.appendChild(img);
  } else {
    // Bookmark without URL - show default icon
    const img = document.createElement('img');
    img.className = 'bookmark-icon';
    img.src = getDefaultFaviconSvg();
    iconContainer.appendChild(img);
  }

  const title = document.createElement('div');
  title.className = 'bookmark-title';
  
  // Truncate title if too long
  const maxLength = 15;
  const displayTitle = bookmark.title && bookmark.title.length > maxLength 
    ? bookmark.title.substring(0, maxLength) + '...' 
    : (bookmark.title || 'Untitled');
  
  title.textContent = displayTitle;
  title.title = bookmark.title; // Full title on hover

  item.appendChild(iconContainer);
  item.appendChild(title);

  // Click handler with animation
  item.addEventListener('click', (e) => {
    e.stopPropagation();
    item.classList.add('bookmark-item-clicked');
    setTimeout(() => {
      handleBookmarkClick(bookmark);
    }, 150);
  });

  // Context menu
  item.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    showContextMenu(e, bookmark);
  });

  return item;
}

// Handle bookmark click
function handleBookmarkClick(bookmark) {
  const isFolder = !bookmark.url || bookmark.children;
  
  if (isFolder) {
    // Open folder with animation
    state.folderHistory.push(state.currentFolderId);
    state.currentFolderId = bookmark.id;
    
    const container = document.getElementById('bookmarksGrid');
    container.style.opacity = '0';
    container.style.transform = 'scale(0.95)';
    
    setTimeout(() => {
      loadBookmarks(bookmark.id);
      container.style.opacity = '1';
      container.style.transform = 'scale(1)';
    }, 200);
  } else {
    // Validate URL before opening
    if (bookmark.url && bookmark.url.trim() !== '') {
      if (state.settings.openInNewTab) {
        browserAPI.tabs.create({ url: bookmark.url });
      } else {
        window.location.href = bookmark.url;
      }
    } else {
      console.error('Invalid bookmark URL:', bookmark.url);
    }
  }
}

// Update back button visibility
function updateBackButton() {
  const backButton = document.getElementById('backButton');
  if (state.folderHistory.length > 0) {
    backButton.classList.remove('hidden');
    backButton.onclick = () => {
      const previousFolder = state.folderHistory.pop();
      state.currentFolderId = previousFolder;
      
      const container = document.getElementById('bookmarksGrid');
      container.style.opacity = '0';
      container.style.transform = 'scale(0.95)';
      
      setTimeout(() => {
        if (state.folderHistory.length === 0) {
          loadBookmarks();
        } else {
          loadBookmarks(previousFolder);
        }
        container.style.opacity = '1';
        container.style.transform = 'scale(1)';
      }, 200);
    };
  } else {
    backButton.classList.add('hidden');
  }
}

// Context Menu
function showContextMenu(e, bookmark) {
  const menu = document.getElementById('contextMenu');
  menu.innerHTML = '';
  menu.classList.remove('hidden');
  menu.style.opacity = '0';
  menu.style.transform = 'scale(0.95)';

  if (bookmark) {
    if (bookmark.children) {
      // Folder context menu
      addContextMenuItem(menu, 'Open All Bookmarks', () => openAllBookmarks(bookmark.id));
      addContextMenuDivider(menu);
      addContextMenuItem(menu, 'Edit', () => editBookmark(bookmark));
      addContextMenuItem(menu, 'Delete', () => deleteBookmark(bookmark));
    } else {
      // Bookmark context menu
      addContextMenuItem(menu, 'Open in New Tab', () => browserAPI.tabs.create({ url: bookmark.url }));
      addContextMenuItem(menu, 'Open in New Window', () => browserAPI.windows.create({ url: bookmark.url }));
      addContextMenuItem(menu, 'Open in Private Window', () => browserAPI.windows.create({ url: bookmark.url, incognito: true }));
      addContextMenuDivider(menu);
      addContextMenuItem(menu, 'Edit', () => editBookmark(bookmark));
      addContextMenuItem(menu, 'Delete', () => deleteBookmark(bookmark));
    }
  } else {
    // General context menu
    addContextMenuItem(menu, 'Add New', () => openAddModal());
    addContextMenuItem(menu, 'Settings', () => openSettings());
  }

  // Position menu
  menu.style.left = `${e.pageX}px`;
  menu.style.top = `${e.pageY}px`;
  
  // Animate in
  setTimeout(() => {
    menu.style.opacity = '1';
    menu.style.transform = 'scale(1)';
  }, 10);
}

function addContextMenuItem(menu, text, onClick) {
  const item = document.createElement('div');
  item.className = 'context-menu-item';
  item.textContent = text;
  item.onclick = () => {
    onClick();
    hideContextMenu();
  };
  menu.appendChild(item);
}

function addContextMenuDivider(menu) {
  const divider = document.createElement('div');
  divider.className = 'divider my-1';
  menu.appendChild(divider);
}

function hideContextMenu() {
  const menu = document.getElementById('contextMenu');
  menu.style.opacity = '0';
  menu.style.transform = 'scale(0.95)';
  setTimeout(() => {
    menu.classList.add('hidden');
  }, 200);
}

// Open all bookmarks in folder
async function openAllBookmarks(folderId) {
  const bookmarks = await getBookmarksFromFolder(folderId);
  bookmarks.forEach(bookmark => {
    if (!bookmark.children) {
      browserAPI.tabs.create({ url: bookmark.url, active: false });
    }
  });
}

// Edit bookmark
function editBookmark(bookmark) {
  const newTitle = prompt('Enter new title:', bookmark.title);
  if (newTitle !== null && newTitle.trim() !== '') {
    browserAPI.bookmarks.update(bookmark.id, { title: newTitle }, () => {
      loadBookmarks(state.currentFolderId);
    });
  }
}

// Delete bookmark
function deleteBookmark(bookmark) {
  if (confirm(`Are you sure you want to delete "${bookmark.title}"?`)) {
    if (bookmark.children) {
      browserAPI.bookmarks.removeTree(bookmark.id, () => {
        loadBookmarks(state.currentFolderId);
      });
    } else {
      browserAPI.bookmarks.remove(bookmark.id, () => {
        loadBookmarks(state.currentFolderId);
      });
    }
  }
}

// Add Modal
function openAddModal() {
  document.getElementById('addModal').showModal();
}

// Settings Drawer
function openSettings() {
  document.getElementById('settingsDrawer').checked = true;
}

// Setup event listeners
function setupEventListeners() {
  // Search input
  const searchInput = document.getElementById('searchInput');
  searchInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      const query = searchInput.value.trim();
      if (query) {
        const engine = searchEngines[state.settings.searchEngine];
        window.location.href = engine.url + encodeURIComponent(query);
      }
    }
  });

  // Hide context menu on click
  document.addEventListener('click', hideContextMenu);
  
  // Right-click on page - Show general context menu
  document.addEventListener('contextmenu', (e) => {
    // Check if the right-click is on a bookmark item
    const bookmarkItem = e.target.closest('.bookmark-item');
    if (bookmarkItem) {
      // Bookmark context menu is handled by the bookmark item itself
      return;
    }
    
    // Otherwise show general context menu
    e.preventDefault();
    showContextMenu(e, null);
  });

  // Add Modal tabs
  const bookmarkTab = document.getElementById('bookmarkTab');
  const folderTab = document.getElementById('folderTab');
  const bookmarkForm = document.getElementById('bookmarkForm');
  const folderForm = document.getElementById('folderForm');

  bookmarkTab.addEventListener('click', () => {
    bookmarkTab.classList.add('btn-active');
    folderTab.classList.remove('btn-active');
    bookmarkForm.classList.remove('hidden');
    folderForm.classList.add('hidden');
  });

  folderTab.addEventListener('click', () => {
    folderTab.classList.add('btn-active');
    bookmarkTab.classList.remove('btn-active');
    folderForm.classList.remove('hidden');
    bookmarkForm.classList.add('hidden');
  });

  // Add button
  document.getElementById('addButton').addEventListener('click', async (e) => {
    e.preventDefault();
    const isBookmark = !folderForm.classList.contains('hidden') ? false : true;

    if (isBookmark) {
      const title = document.getElementById('bookmarkTitle').value.trim();
      const url = document.getElementById('bookmarkUrl').value.trim();
      
      if (title && url) {
        browserAPI.bookmarks.create({
          parentId: state.currentFolderId,
          title: title,
          url: url
        }, () => {
          document.getElementById('bookmarkTitle').value = '';
          document.getElementById('bookmarkUrl').value = '';
          document.getElementById('addModal').close();
          loadBookmarks(state.currentFolderId);
        });
      }
    } else {
      const name = document.getElementById('folderName').value.trim();
      
      if (name) {
        browserAPI.bookmarks.create({
          parentId: state.currentFolderId,
          title: name
        }, () => {
          document.getElementById('folderName').value = '';
          document.getElementById('addModal').close();
          loadBookmarks(state.currentFolderId);
        });
      }
    }
  });
}

// Update search bar with selected engine
function updateSearchBar() {
  const engine = searchEngines[state.settings.searchEngine];
  document.getElementById('searchIcon').src = engine.icon;
  document.getElementById('searchInput').placeholder = `Search on ${engine.name}...`;
}

// Apply theme
function applyTheme() {
  const html = document.documentElement;
  html.setAttribute('data-theme', state.settings.theme);
  
  // Add transition class for smooth theme change
  html.style.transition = 'background-color 0.3s ease, color 0.3s ease';
}

// Apply background
function applyBackground() {
  const bgContainer = document.getElementById('bgContainer');
  const body = document.body;
  
  if (state.settings.backgroundImage) {
    bgContainer.style.backgroundImage = `url(${state.settings.backgroundImage})`;
    bgContainer.style.filter = `blur(${state.settings.blur}px) brightness(${state.settings.brightness})`;
    body.classList.add('has-background');
  } else {
    bgContainer.style.backgroundImage = 'none';
    bgContainer.style.filter = 'none';
    body.classList.remove('has-background');
  }
}

// Check and show welcome modal for first-time users
async function checkWelcomeModal() {
  return new Promise((resolve) => {
    browserAPI.storage.local.get(['hasSeenWelcome'], (result) => {
      if (!result.hasSeenWelcome) {
        const welcomeModal = document.getElementById('welcomeModal');
        welcomeModal.showModal();
        
        document.getElementById('welcomeUnderstandBtn').addEventListener('click', () => {
          browserAPI.storage.local.set({ hasSeenWelcome: true });
          welcomeModal.close();
        });
      }
      resolve();
    });
  });
}