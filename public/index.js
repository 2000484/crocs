"use strict";

// DOM Elements
const omniboxForm = document.getElementById("sj-omnibox");
const omniboxInput = document.getElementById("sj-omnibox-input");
const omniboxSuggestions = document.getElementById("sj-omnibox-suggestions");
const securityIcon = document.getElementById("sj-security-icon");
const backButton = document.getElementById("sj-back");
const forwardButton = document.getElementById("sj-forward");
const reloadButton = document.getElementById("sj-reload");
const homeNavButton = document.getElementById("sj-home-nav");
const bookmarkButton = document.getElementById("sj-bookmark");
const settingsButton = document.getElementById("sj-settings-btn");
const settingsModal = document.getElementById("sj-settings-modal");
const modalOverlay = document.getElementById("sj-modal-overlay");
const modalClose = document.getElementById("sj-modal-close");
const searchEngineSelect = document.getElementById("sj-search-engine-select");
const searchEngineInput = document.getElementById("sj-search-engine");
const customSearchWrap = document.getElementById("sj-custom-search-wrap");
const autoHttpsToggle = document.getElementById("sj-auto-https");
const rememberToggle = document.getElementById("sj-remember");
const swStatus = document.getElementById("sj-sw-status");
const transportStatus = document.getElementById("sj-transport-status");
const recentList = document.getElementById("sj-recent");
const cloakTitleInput = document.getElementById("sj-cloak-title");
const cloakIconInput = document.getElementById("sj-cloak-icon");
const applyCloakButton = document.getElementById("sj-apply-cloak");
const resetCloakButton = document.getElementById("sj-reset-cloak");
const favicon = document.getElementById("sj-favicon");
const homePage = document.getElementById("sj-home-page");
const tabsContainer = document.getElementById("sj-tabs");
const tabsContent = document.getElementById("sj-tabs-content");
const newTabButton = document.getElementById("sj-new-tab");
const loadingBar = document.getElementById("sj-loading-bar");
const clickLoading = document.getElementById("sj-click-loading");
const shortcutsButton = document.getElementById("sj-shortcuts-btn");
const shortcutsModal = document.getElementById("sj-shortcuts-modal");
const shortcutsOverlay = document.getElementById("sj-shortcuts-overlay");
const shortcutsClose = document.getElementById("sj-shortcuts-close");
const tabContextMenu = document.getElementById("sj-tab-context");
const startupModal = document.getElementById("sj-startup-modal");
const startupCloak = document.getElementById("sj-startup-cloak");
const startupFullscreen = document.getElementById("sj-startup-fullscreen");
const startupBoth = document.getElementById("sj-startup-both");
const startupSkip = document.getElementById("sj-startup-skip");
const bookmarkUrlInput = document.getElementById("sj-bookmark-url");
const bookmarkNameInput = document.getElementById("sj-bookmark-name");
const addBookmarkButton = document.getElementById("sj-add-bookmark");
const bookmarksList = document.getElementById("sj-bookmarks");
const bookmarksManage = document.getElementById("sj-bookmarks-manage");

// Initialize activeFrame and homeButton variables (for legacy frame handling)
let activeFrame = null;
const homeButton = homeNavButton; // Alias for backward compatibility

const quickLinks = Array.from(document.querySelectorAll("[data-quick-url]"));

const { ScramjetController } = $scramjetLoadController();

const scramjet = new ScramjetController({
	files: {
		wasm: "/scram/scramjet.wasm.wasm",
		all: "/scram/scramjet.all.js",
		sync: "/scram/scramjet.sync.js",
	},
	config: {
		// Don't use revealer to avoid blocking JavaScript execution
		// revealer: "top.location",
	},
});

scramjet.init();

const connection = new BareMux.BareMuxConnection("/baremux/worker.js");

const SEARCH_ENGINES = {
	google: "https://www.google.com/search?q=%s",
	duckduckgo: "https://duckduckgo.com/?q=%s",
	brave: "https://search.brave.com/search?q=%s",
	startpage: "https://www.startpage.com/search?q=%s",
	custom: "",
};

const STORAGE_KEYS = {
	engine: "sj-search-engine",
	customEngine: "sj-search-custom",
	autoHttps: "sj-auto-https",
	remember: "sj-remember",
	recent: "sj-recent",
	searches: "sj-searches",
	cloakTitle: "sj-cloak-title",
	cloakIcon: "sj-cloak-icon",
	bookmarks: "sj-bookmarks",
};

const defaultTitle = document.title;
const defaultFavicon = favicon?.getAttribute("href") || "";

let tabIdCounter = 0;
const tabs = new Map();
let activeTabId = null;
let isTransportReady = false;
let isSwReady = false;
let closedTabs = [];
let contextMenuTabId = null;
let draggedTab = null;

function setBadge(element, text, tone) {
	if (!element) return;
	element.textContent = text;
	element.classList.remove("good", "warn", "bad", "neutral");
	if (tone) element.classList.add(tone);
}

let currentErrorMessage = null;
let errorTimeout = null;

function clearError() {
	currentErrorMessage = null;
	if (errorTimeout) clearTimeout(errorTimeout);
}

function showError(message, details = "") {
	console.error(message, details);
	currentErrorMessage = message;
	
	// Show user-friendly error with auto-dismiss
	const errorDiv = document.createElement("div");
	errorDiv.style.cssText = `
		position: fixed;
		top: 60px;
		right: 20px;
		background: var(--danger, #f28b82);
		color: #202124;
		padding: 12px 16px;
		border-radius: 4px;
		font-size: 14px;
		z-index: 1000;
		max-width: 300px;
		box-shadow: 0 2px 8px rgba(0,0,0,0.3);
		animation: slideIn 0.3s ease-out;
	`;
	errorDiv.textContent = message;
	
	document.body.appendChild(errorDiv);
	
	if (errorTimeout) clearTimeout(errorTimeout);
	errorTimeout = setTimeout(() => {
		errorDiv.style.animation = "slideOut 0.3s ease-in";
		setTimeout(() => errorDiv.remove(), 300);
	}, 5000);
	
	// Also log detailed info if provided
	if (details) console.error("Details:", details);
}

function showSuccess(message) {
	const successDiv = document.createElement("div");
	successDiv.style.cssText = `
		position: fixed;
		top: 60px;
		right: 20px;
		background: var(--success, #81c995);
		color: #202124;
		padding: 12px 16px;
		border-radius: 4px;
		font-size: 14px;
		z-index: 1000;
		animation: slideIn 0.3s ease-out;
	`;
	successDiv.textContent = message;
	
	document.body.appendChild(successDiv);
	
	setTimeout(() => {
		successDiv.style.animation = "slideOut 0.3s ease-in";
		setTimeout(() => successDiv.remove(), 300);
	}, 3000);
}

function updateCustomSearchVisibility() {
	const isCustom = searchEngineSelect.value === "custom";
	customSearchWrap.style.display = isCustom ? "flex" : "none";
	if (!isCustom) {
		searchEngineInput.value = SEARCH_ENGINES[searchEngineSelect.value];
	}
}

function saveSettings() {
	try {
		localStorage.setItem(STORAGE_KEYS.engine, searchEngineSelect.value);
		localStorage.setItem(STORAGE_KEYS.customEngine, searchEngineInput.value);
		localStorage.setItem(
			STORAGE_KEYS.autoHttps,
			autoHttpsToggle.checked ? "true" : "false"
		);
		localStorage.setItem(
			STORAGE_KEYS.remember,
			rememberToggle.checked ? "true" : "false"
		);
		localStorage.setItem(STORAGE_KEYS.cloakTitle, cloakTitleInput.value);
		localStorage.setItem(STORAGE_KEYS.cloakIcon, cloakIconInput.value);
	} catch (err) {
		console.warn("Failed to save settings:", err);
		// Continue silently - localStorage might be full or disabled
	}
}

function loadSettings() {
	try {
		const engine = localStorage.getItem(STORAGE_KEYS.engine);
		const customEngine = localStorage.getItem(STORAGE_KEYS.customEngine);
		const autoHttps = localStorage.getItem(STORAGE_KEYS.autoHttps);
		const remember = localStorage.getItem(STORAGE_KEYS.remember);
		const cloakTitle = localStorage.getItem(STORAGE_KEYS.cloakTitle);
		const cloakIcon = localStorage.getItem(STORAGE_KEYS.cloakIcon);

		if (engine && SEARCH_ENGINES[engine]) searchEngineSelect.value = engine;
		if (customEngine) searchEngineInput.value = customEngine;
		if (autoHttps) autoHttpsToggle.checked = autoHttps === "true";
		if (remember) rememberToggle.checked = remember === "true";
		if (cloakTitle) cloakTitleInput.value = cloakTitle;
		if (cloakIcon) cloakIconInput.value = cloakIcon;

		updateCustomSearchVisibility();
		applyCloak(cloakTitleInput.value, cloakIconInput.value);
	} catch (err) {
		console.warn("Failed to load settings:", err);
		// Use defaults - silent failure for localStorage issues
	}
}

function getTemplate() {
	if (searchEngineSelect.value === "custom") {
		return searchEngineInput.value || SEARCH_ENGINES.google;
	}
	return SEARCH_ENGINES[searchEngineSelect.value] || SEARCH_ENGINES.google;
}

function applyCloak(title, icon) {
	document.title = title || defaultTitle;
	if (favicon && icon) {
		favicon.setAttribute("href", icon);
	} else if (favicon) {
		favicon.setAttribute("href", defaultFavicon);
	}
}

function resetCloak() {
	cloakTitleInput.value = "";
	cloakIconInput.value = "";
	applyCloak("", "");
	saveSettings();
}

function showStartupModal() {
	const alreadyShown = sessionStorage.getItem("sj-startup-shown") === "true";
	const isAboutBlank = location.href === "about:blank";
	const isIframe = window.self !== window.top;
	if (!startupModal || alreadyShown || isAboutBlank || isIframe) return;
	startupModal.hidden = false;
}

function hideStartupModal() {
	if (startupModal) startupModal.hidden = true;
	sessionStorage.setItem("sj-startup-shown", "true");
}

let clickLoadingTimeout = null;
function showClickLoading() {
	if (!clickLoading) return;
	clickLoading.hidden = false;
	if (clickLoadingTimeout) clearTimeout(clickLoadingTimeout);
	clickLoadingTimeout = setTimeout(() => {
		clickLoading.hidden = true;
	}, 600);
}

function requestFullscreen() {
	if (document.fullscreenElement) return Promise.resolve();
	if (document.documentElement.requestFullscreen) {
		return document.documentElement.requestFullscreen().catch(() => {});
	}
	return Promise.resolve();
}

function openAboutBlankCloak(withFullscreen = false) {
	const url = location.href;
	const win = window.open("about:blank", "_blank");
	if (!win) {
		alert("Pop-up blocked. Please allow pop-ups to use about:blank cloaking.");
		return false;
	}

	// Focus the new window so user knows it opened
	win.focus();

	win.document.open();
	win.document.write(`<!doctype html>
<html>
<head>
	<title>Schoology</title>
	<link rel="icon" href="${location.origin}/favicon.ico">
	<meta charset="utf-8" />
	<style>
		html, body { margin: 0; padding: 0; width: 100%; height: 100%; overflow: hidden; }
		iframe { border: none; width: 100%; height: 100%; }
		#fs-overlay { position: fixed; inset: 0; display: ${withFullscreen ? "flex" : "none"}; align-items: center; justify-content: center; background: rgba(0,0,0,0.6); color: #fff; font-family: Arial, sans-serif; z-index: 2; }
		#fs-overlay button { background: #8ab4f8; border: none; color: #202124; padding: 12px 20px; border-radius: 999px; font-size: 14px; cursor: pointer; }
	</style>
</head>
<body>
	<div id="fs-overlay"><button>Enter fullscreen</button></div>
	<iframe src="${url}" allow="fullscreen"></iframe>
	<script>
		const overlay = document.getElementById('fs-overlay');
		const btn = overlay.querySelector('button');
		btn.addEventListener('click', async () => {
			try {
				if (document.documentElement.requestFullscreen) {
					await document.documentElement.requestFullscreen();
				}
			} catch (e) {}
			overlay.style.display = 'none';
		});
	</script>
</body>
</html>`);
	win.document.close();
	return true;
}

function getOmniboxSuggestions(query) {
	const suggestions = [];
	const normalized = query.toLowerCase().trim();
	const seen = new Set();

	if (normalized) {
		suggestions.push({
			type: "search",
			title: `Search for "${query}"`,
			value: query,
		});
		seen.add(`search:${query.toLowerCase()}`);
	}

	const recentSearches = parseSearches();
	recentSearches.forEach((item) => {
		const term = item.term;
		if (!term) return;
		if (!normalized || term.toLowerCase().includes(normalized)) {
			const key = `term:${term.toLowerCase()}`;
			if (seen.has(key)) return;
			seen.add(key);
			suggestions.push({
				type: "term",
				title: term,
				value: term,
			});
		}
	});

	const recentItems = parseRecent();
	recentItems.forEach((item) => {
		const urlText = item.url.toLowerCase();
		if (!normalized || urlText.includes(normalized)) {
			const key = `url:${item.url.toLowerCase()}`;
			if (seen.has(key)) return;
			seen.add(key);
			suggestions.push({
				type: "url",
				title: item.url,
				value: item.url,
			});
		}
	});

	quickLinks.forEach((link) => {
		const url = link.getAttribute("data-quick-url");
		const title = link.querySelector("span")?.textContent || url;
		if (!url) return;
		if (
			!normalized ||
			title.toLowerCase().includes(normalized) ||
			url.toLowerCase().includes(normalized)
		) {
			const key = `url:${url.toLowerCase()}`;
			if (seen.has(key)) return;
			seen.add(key);
			suggestions.push({
				type: "url",
				title,
				value: url,
			});
		}
	});

	return suggestions.slice(0, 8);
}

function renderOmniboxSuggestions(query) {
	if (!omniboxSuggestions) return;
	const items = getOmniboxSuggestions(query);
	if (items.length === 0) {
		omniboxSuggestions.hidden = true;
		omniboxSuggestions.innerHTML = "";
		return;
	}

	omniboxSuggestions.innerHTML = items
		.map((item) => {
			const subtitle =
				item.type === "search"
					? "Search"
					: item.type === "term"
						? "Previous search"
						: item.value;
			return `
				<button class="suggestion-item" data-type="${item.type}" data-value="${item.value}">
					<span class="suggestion-title">${item.title}</span>
					<span class="suggestion-url">${subtitle}</span>
				</button>
			`;
		})
		.join("");

	omniboxSuggestions.hidden = false;
}

function hideOmniboxSuggestions() {
	if (!omniboxSuggestions) return;
	omniboxSuggestions.hidden = true;
}

function parseRecent() {
	try {
		const raw = localStorage.getItem(STORAGE_KEYS.recent);
		return raw ? JSON.parse(raw) : [];
	} catch (err) {
		return [];
	}
}

function persistRecent(items) {
	localStorage.setItem(STORAGE_KEYS.recent, JSON.stringify(items));
}

function parseSearches() {
	try {
		const raw = localStorage.getItem(STORAGE_KEYS.searches);
		return raw ? JSON.parse(raw) : [];
	} catch (err) {
		return [];
	}
}

function persistSearches(items) {
	try {
		localStorage.setItem(STORAGE_KEYS.searches, JSON.stringify(items));
	} catch (err) {
		// Ignore localStorage errors
	}
}

function shouldStoreSearchTerm(input) {
	const trimmed = input.trim();
	if (!trimmed) return false;
	if (typeof looksLikeSchemeUrl === "function" && looksLikeSchemeUrl(trimmed)) {
		return false;
	}
	if (typeof looksLikeHostname === "function" && looksLikeHostname(trimmed)) {
		return false;
	}
	if (!trimmed.includes(" ") && trimmed.includes(".")) return false;
	return true;
}

function addSearchTerm(term) {
	const trimmed = term.trim();
	if (!trimmed) return;
	const items = parseSearches().filter((item) => item.term !== trimmed);
	items.unshift({ term: trimmed, time: Date.now() });
	persistSearches(items.slice(0, 8));
}

function removeRecent(index) {
	const items = parseRecent();
	items.splice(index, 1);
	persistRecent(items);
	renderRecent();
}

function clearAllRecent() {
	if (!confirm("Are you sure you want to delete all history? This cannot be undone.")) {
		return;
	}
	persistRecent([]);
	renderRecent();
	showSuccess("History cleared");
}

function parseBookmarks() {
	try {
		const raw = localStorage.getItem(STORAGE_KEYS.bookmarks);
		return raw ? JSON.parse(raw) : [];
	} catch (err) {
		console.warn("Failed to parse bookmarks:", err);
		return [];
	}
}

function persistBookmarks(bookmarks) {
	try {
		localStorage.setItem(STORAGE_KEYS.bookmarks, JSON.stringify(bookmarks));
	} catch (err) {
		console.warn("Failed to save bookmarks:", err);
	}
}

function addBookmark(url, name = null) {
	if (!url || !url.trim()) return false;
	
	try {
		// Validate URL format
		const urlObj = new URL(url.startsWith("http") ? url : "https://" + url);
		const validUrl = urlObj.href;
		const bookmarkName = name?.trim() || new URL(validUrl).hostname || url;
		
		const bookmarks = parseBookmarks();
		
		// Prevent duplicates
		if (bookmarks.some(b => b.url === validUrl)) {
			return false;
		}
		
		bookmarks.unshift({
			url: validUrl,
			name: bookmarkName,
			added: Date.now(),
		});
		
		persistBookmarks(bookmarks);
		renderBookmarks();
		return true;
	} catch (err) {
		console.error("Invalid bookmark URL:", err);
		return false;
	}
}

function removeBookmark(url) {
	const bookmarks = parseBookmarks();
	const filtered = bookmarks.filter(b => b.url !== url);
	persistBookmarks(filtered);
	renderBookmarks();
}

function renderBookmarks() {
	const bookmarks = parseBookmarks();
	
	// Render home page bookmarks
	if (bookmarksList) {
		bookmarksList.innerHTML = "";
		if (bookmarks.length === 0) {
			const empty = document.createElement("div");
			empty.className = "bookmark-item";
			empty.innerHTML = "<span>No bookmarks yet</span>";
			bookmarksList.appendChild(empty);
		} else {
			bookmarks.slice(0, 4).forEach((bookmark) => {
				const btn = document.createElement("button");
				btn.type = "button";
				btn.className = "tile";
				btn.setAttribute("data-quick-url", bookmark.url);
				const span = document.createElement("span");
				span.textContent = bookmark.name; // Use textContent to avoid XSS
				btn.appendChild(span);
				btn.addEventListener("click", () => {
					omniboxInput.value = bookmark.url;
					omniboxForm.requestSubmit();
				});
				bookmarksList.appendChild(btn);
			});
		}
	}
	
	// Render settings bookmarks manager
	if (bookmarksManage) {
		bookmarksManage.innerHTML = "";
		if (bookmarks.length === 0) {
			const empty = document.createElement("p");
			empty.style.fontSize = "0.875rem";
			empty.style.color = "var(--text-secondary)";
			empty.textContent = "No bookmarks added yet";
			bookmarksManage.appendChild(empty);
		} else {
			const list = document.createElement("div");
			list.style.display = "flex";
			list.style.flexDirection = "column";
			list.style.gap = "8px";
			
			bookmarks.forEach((bookmark) => {
				const item = document.createElement("div");
				item.style.display = "flex";
				item.style.alignItems = "center";
				item.style.justifyContent = "space-between";
				item.style.padding = "8px";
				item.style.backgroundColor = "var(--surface-2)";
				item.style.borderRadius = "4px";
				item.style.fontSize = "0.875rem";
				
				const info = document.createElement("div");
				info.style.flex = "1";
				info.style.minWidth = "0";
				
				const nameDiv = document.createElement("div");
				nameDiv.style.fontWeight = "500";
				nameDiv.style.whiteSpace = "nowrap";
				nameDiv.style.overflow = "hidden";
				nameDiv.style.textOverflow = "ellipsis";
				nameDiv.textContent = bookmark.name;
				
				const urlDiv = document.createElement("div");
				urlDiv.style.fontSize = "0.75rem";
				urlDiv.style.color = "var(--text-secondary)";
				urlDiv.style.whiteSpace = "nowrap";
				urlDiv.style.overflow = "hidden";
				urlDiv.style.textOverflow = "ellipsis";
				urlDiv.textContent = bookmark.url;
				
				info.appendChild(nameDiv);
				info.appendChild(urlDiv);
				
				const deleteBtn = document.createElement("button");
				deleteBtn.type = "button";
				deleteBtn.className = "btn ghost";
				deleteBtn.textContent = "Remove";
				deleteBtn.style.marginLeft = "8px";
				deleteBtn.style.padding = "4px 8px";
				deleteBtn.style.fontSize = "0.75rem";
				deleteBtn.addEventListener("click", () => removeBookmark(bookmark.url));
				
				item.appendChild(info);
				item.appendChild(deleteBtn);
				list.appendChild(item);
			});
			
			bookmarksManage.appendChild(list);
		}
	}
}

function addRecent(url) {
	if (!rememberToggle.checked) return;
	const items = parseRecent().filter((item) => item.url !== url);
	items.unshift({ url, time: Date.now() });
	persistRecent(items.slice(0, 8));
	renderRecent();
}

function renderRecent() {
	const items = rememberToggle.checked ? parseRecent() : [];
	recentList.innerHTML = "";
	if (!items.length) {
		const empty = document.createElement("div");
		empty.className = "recent-item";
		empty.textContent = "No history yet";
		recentList.appendChild(empty);
		return;
	}

	items.forEach((item, index) => {
		const wrapper = document.createElement("div");
		wrapper.className = "recent-item";

		const contentDiv = document.createElement("div");
		contentDiv.className = "recent-item-content";

		const button = document.createElement("button");
		button.type = "button";
		button.className = "recent-link";
		button.textContent = item.url;
		button.addEventListener("click", () => {
			omniboxInput.value = item.url;
			omniboxForm.requestSubmit();
		});

		const meta = document.createElement("span");
		meta.className = "recent-meta";
		try {
			meta.textContent = new URL(item.url).hostname;
		} catch (err) {
			meta.textContent = "";
		}

		const deleteBtn = document.createElement("button");
		deleteBtn.type = "button";
		deleteBtn.className = "btn ghost recent-delete";
		deleteBtn.textContent = "✕";
		deleteBtn.title = "Delete this history item";
		deleteBtn.addEventListener("click", (e) => {
			e.stopPropagation();
			removeRecent(index);
		});

		contentDiv.appendChild(button);
		contentDiv.appendChild(meta);
		wrapper.appendChild(contentDiv);
		wrapper.appendChild(deleteBtn);
		recentList.appendChild(wrapper);
	});
}

function createTab(url = null, isHome = true) {
	const id = ++tabIdCounter;

	const tab = {
		id,
		url,
		title: isHome ? "New Tab" : "Loading...",
		favicon:
			"https://asset-cdn.schoology.com/sites/all/themes/schoology_theme/favicon.ico",
		isHome,
		frame: null,
		element: null,
		wrapper: null,
	};

	const tabEl = document.createElement("div");
	tabEl.className = "tab";
	tabEl.dataset.tabId = id;

	const faviconEl = document.createElement("img");
	faviconEl.className = "tab-favicon";
	faviconEl.src = tab.favicon;
	faviconEl.alt = "";

	const titleEl = document.createElement("span");
	titleEl.className = "tab-title";
	titleEl.textContent = tab.title;

	const closeBtn = document.createElement("button");
	closeBtn.className = "tab-close";
	closeBtn.type = "button";
	closeBtn.innerHTML = "×";
	closeBtn.title = "Close tab";

	tabEl.appendChild(faviconEl);
	tabEl.appendChild(titleEl);
	tabEl.appendChild(closeBtn);

	tabEl.addEventListener("click", (e) => {
		if (e.target !== closeBtn) {
			switchTab(id);
		}
	});

	tabEl.addEventListener("contextmenu", (e) => {
		e.preventDefault();
		showTabContextMenu(e, id);
	});

	tabEl.addEventListener("mousedown", (e) => {
		if (e.button === 1) {
			e.preventDefault();
			closeTab(id);
		}
	});

	// Drag and drop
	tabEl.draggable = true;
	tabEl.addEventListener("dragstart", (e) => {
		draggedTab = id;
		tabEl.classList.add("dragging");
		e.dataTransfer.effectAllowed = "move";
	});

	tabEl.addEventListener("dragend", () => {
		tabEl.classList.remove("dragging");
		draggedTab = null;
	});

	tabEl.addEventListener("dragover", (e) => {
		e.preventDefault();
		if (draggedTab && draggedTab !== id) {
			const rect = tabEl.getBoundingClientRect();
			const midpoint = rect.left + rect.width / 2;
			if (e.clientX < midpoint) {
				tabEl.style.borderLeft = "2px solid var(--accent)";
			} else {
				tabEl.style.borderRight = "2px solid var(--accent)";
			}
		}
	});

	tabEl.addEventListener("dragleave", () => {
		tabEl.style.borderLeft = "";
		tabEl.style.borderRight = "";
	});

	tabEl.addEventListener("drop", (e) => {
		e.preventDefault();
		tabEl.style.borderLeft = "";
		tabEl.style.borderRight = "";

		if (draggedTab && draggedTab !== id) {
			reorderTabs(draggedTab, id);
		}
	});

	closeBtn.addEventListener("click", (e) => {
		e.stopPropagation();
		closeTab(id);
	});

	if (newTabButton && newTabButton.parentElement === tabsContainer) {
		tabsContainer.insertBefore(tabEl, newTabButton);
	} else {
		tabsContainer.appendChild(tabEl);
	}
	tab.element = tabEl;

	if (!isHome && url) {
		const wrapper = document.createElement("div");
		wrapper.className = "tab-frame-wrapper";
		wrapper.dataset.tabId = id;
		tabsContent.appendChild(wrapper);
		tab.wrapper = wrapper;
	}

	tabs.set(id, tab);
	switchTab(id);

	if (!isHome && url) {
		loadUrlInTab(id, url);
	}

	updateOmnibox();

	return id;
}

function switchTab(id) {
	if (activeTabId === id) return;

	tabs.forEach((tab) => {
		tab.element?.classList.remove("active");
		if (tab.wrapper) tab.wrapper.classList.remove("active");
	});

	const tab = tabs.get(id);
	if (!tab) return;

	activeTabId = id;
	tab.element?.classList.add("active");

	if (tab.isHome) {
		homePage.hidden = false;
		if (tab.wrapper) tab.wrapper.classList.remove("active");
		loadingBar.hidden = true;
	} else {
		homePage.hidden = true;
		if (tab.wrapper) tab.wrapper.classList.add("active");
	}

	updateOmnibox();
}

function closeTab(id) {
	const tab = tabs.get(id);
	if (!tab) return;

	// Save to closed tabs for reopening
	if (!tab.isHome && tab.url) {
		closedTabs.push({
			url: tab.url,
			title: tab.title,
		});
		if (closedTabs.length > 10) closedTabs.shift();
	}

	tab.element?.remove();
	tab.wrapper?.remove();
	tabs.delete(id);

	if (activeTabId === id) {
		const remaining = Array.from(tabs.keys());
		if (remaining.length > 0) {
			switchTab(remaining[remaining.length - 1]);
		} else {
			createTab(null, true);
		}
	}
}

function reorderTabs(draggedId, targetId) {
	const draggedTab = tabs.get(draggedId);
	const targetTab = tabs.get(targetId);

	if (!draggedTab || !targetTab) return;

	const draggedEl = draggedTab.element;
	const targetEl = targetTab.element;

	if (draggedEl && targetEl) {
		targetEl.parentNode.insertBefore(draggedEl, targetEl);
	}
}

function showTabContextMenu(event, tabId) {
	contextMenuTabId = tabId;
	tabContextMenu.hidden = false;
	tabContextMenu.style.left = event.clientX + "px";
	tabContextMenu.style.top = event.clientY + "px";

	const closeOthersBtn = tabContextMenu.querySelector(
		'[data-action="close-others"]'
	);
	const closeRightBtn = tabContextMenu.querySelector(
		'[data-action="close-right"]'
	);

	closeOthersBtn.disabled = tabs.size <= 1;

	const tabArray = Array.from(tabs.keys());
	const tabIndex = tabArray.indexOf(tabId);
	closeRightBtn.disabled = tabIndex === tabArray.length - 1;
}

function hideTabContextMenu() {
	tabContextMenu.hidden = true;
	contextMenuTabId = null;
}

function handleContextAction(action) {
	if (!contextMenuTabId) return;

	const tab = tabs.get(contextMenuTabId);
	if (!tab) return;

	switch (action) {
		case "reload":
			if (!tab.isHome && tab.frame) {
				tab.frame.frame.contentWindow?.location.reload();
			}
			break;
		case "duplicate":
			if (!tab.isHome && tab.url) {
				createTab(tab.url, false);
			}
			break;
		case "pin":
			tab.element?.classList.toggle("pinned");
			break;
		case "close":
			closeTab(contextMenuTabId);
			break;
		case "close-others":
			Array.from(tabs.keys()).forEach((id) => {
				if (id !== contextMenuTabId) closeTab(id);
			});
			break;
		case "close-right":
			const tabArray = Array.from(tabs.keys());
			const tabIndex = tabArray.indexOf(contextMenuTabId);
			tabArray.slice(tabIndex + 1).forEach((id) => closeTab(id));
			break;
	}

	hideTabContextMenu();
}

async function loadUrlInTab(id, url) {
	const tab = tabs.get(id);
	if (!tab) {
		showError("Tab not found");
		return;
	}

	if (!url || typeof url !== "string") {
		showError("Invalid URL provided");
		return;
	}

	tab.url = url;
	tab.isHome = false;

	// Show loading bar
	loadingBar.hidden = false;

	if (!tab.wrapper) {
		const wrapper = document.createElement("div");
		wrapper.className = "tab-frame-wrapper";
		wrapper.dataset.tabId = id;
		tabsContent.appendChild(wrapper);
		tab.wrapper = wrapper;
	}

	if (!tab.frame) {
		try {
			tab.frame = scramjet.createFrame();
			if (!tab.frame) {
				throw new Error("Failed to create frame");
			}
			tab.frame.frame.style.width = "100%";
			tab.frame.frame.style.height = "100%";
			tab.frame.frame.style.border = "none";
			tab.wrapper.appendChild(tab.frame.frame);

			tab.frame.frame.addEventListener("load", () => {
				loadingBar.hidden = true;
				updateTabUI(id);
				updateOmnibox();
				
				// Track URL changes within the iframe
				try {
					const contentWindow = tab.frame.frame.contentWindow;
					if (contentWindow) {
						// Listen for history changes
						contentWindow.addEventListener("popstate", () => {
							if (id === activeTabId) {
								updateOmnibox();
							}
						});
						
						// Try to get the current URL from the frame
						try {
							const currentUrl = contentWindow.location.href;
							if (currentUrl && currentUrl !== "about:blank") {
								tab.url = currentUrl;
								if (id === activeTabId) {
									updateOmnibox();
								}
							}
						} catch (e) {
							console.log("Cannot access iframe URL:", e.message);
						}
					}
				} catch (err) {
					console.log("Could not attach navigation listeners:", err.message);
				}
			});

			tab.frame.frame.addEventListener("error", (e) => {
				loadingBar.hidden = true;
				tab.title = "Error loading page";
				updateTabUI(id);
				console.error("Frame error:", e);
			});
		} catch (err) {
			loadingBar.hidden = true;
			showError("Failed to initialize frame", err?.message || String(err));
			return;
		}
	}

	// Show the wrapper immediately
	homePage.hidden = true;
	tab.wrapper.classList.add("active");

	tab.title = "Loading...";
	updateTabUI(id);

	try {
		tab.frame.go(url);
		tab.url = url; // Ensure tab URL is updated immediately
		console.log(`[Tab ${id}] Navigating to: ${url}`);

		setTimeout(() => {
			try {
				const hostname = new URL(url).hostname;
				tab.title = hostname;
				tab.favicon = `https://www.google.com/s2/favicons?domain=${hostname}&sz=32`;
				updateTabUI(id);
				
				// Try to detect if page actually loaded by checking DOM
				try {
					const contentWindow = tab.frame.frame.contentWindow;
					if (contentWindow && contentWindow.document && contentWindow.document.body) {
						const bodyHTML = contentWindow.document.body.innerHTML;
						if (!bodyHTML || bodyHTML.trim().length === 0) {
							console.warn(`[Tab ${id}] Warning: Page body is empty for ${url}`);
						}
					}
				} catch (e) {
					console.log("Could not check page content:", e.message);
				}
			} catch (err) {
				console.error("Error updating tab:", err);
				tab.title = "Untitled";
			}
			// Hide loading bar after longer timeout for complex sites like Wordle
			loadingBar.hidden = true;
		}, 2000);
	} catch (err) {
		console.error("Error loading URL:", err);
		tab.title = "Error";
		updateTabUI(id);
		loadingBar.hidden = true;
		showError("Failed to load URL", err?.message || String(err));
	}
}

function updateTabUI(id) {
	const tab = tabs.get(id);
	if (!tab || !tab.element) return;

	const titleEl = tab.element.querySelector(".tab-title");
	const faviconEl = tab.element.querySelector(".tab-favicon");

	if (titleEl) titleEl.textContent = tab.title;
	if (faviconEl) faviconEl.src = tab.favicon;
}

function closeFrame() {
	if (activeFrame?.frame?.parentElement) {
		activeFrame.frame.parentElement.removeChild(activeFrame.frame);
	}
	activeFrame = null;
	document.body.classList.remove("proxy-active");
	homeButton.hidden = true;
}

function startFrame(url) {
	if (!activeFrame) {
		activeFrame = scramjet.createFrame();
		activeFrame.frame.id = "sj-frame";
		document.body.appendChild(activeFrame.frame);
	}
	document.body.classList.add("proxy-active");
	homeButton.hidden = false;
	activeFrame.go(url);
}

async function ensureTransport() {
	if (isTransportReady) return;

	setBadge(transportStatus, "Transport: connecting", "warn");
	const wispUrl =
		(location.protocol === "https:" ? "wss" : "ws") +
		"://" +
		location.host +
		"/wisp/";

	const currentTransport = await connection.getTransport();
	
	if (currentTransport !== "/libcurl/index.mjs") {
		try {
			await connection.setTransport("/libcurl/index.mjs", [
				{ 
					websocket: wispUrl,
					sslVerifyPeer: false,
					sslVerifyHost: false,
					connectTimeout: 90,
					timeout: 180,
					httpVersion: "1.1",
					followLocation: true,
					maxRedirs: 10,
					// Add more buffer and lowspeed options
					bufferSize: 524288, // 512KB
					lowSpeedLimit: 1,  // 1 byte/s minimum
					lowSpeedTime: 30, // for 30 seconds
				},
			]);
			console.log("Transport: libcurl initialized");
		} catch (err) {
			console.error("Failed to initialize libcurl transport:", err);
			showError("Transport initialization failed", err?.message);
		}
	}

	isTransportReady = true;
	setBadge(transportStatus, "Transport: ready", "good");
}

async function ensureSW() {
	if (isSwReady) return;

	setBadge(swStatus, "Service worker: registering", "warn");
	await registerSW();
	isSwReady = true;
	setBadge(swStatus, "Service worker: ready", "good");
}

function updateOmnibox() {
	const tab = tabs.get(activeTabId);
	if (!tab) return;

	if (tab.isHome) {
		omniboxInput.value = "";
		omniboxInput.placeholder = "Search Google or type a URL";
		securityIcon.classList.remove("secure");
	} else {
		omniboxInput.value = tab.url || "";
		try {
			const url = new URL(tab.url);
			if (url.protocol === "https:") {
				securityIcon.classList.add("secure");
			} else {
				securityIcon.classList.remove("secure");
			}
		} catch (err) {
			securityIcon.classList.remove("secure");
		}
	}
}

omniboxForm.addEventListener("submit", async (event) => {
	event.preventDefault();
	clearError();
	showClickLoading();
	hideOmniboxSuggestions();

	const input = omniboxInput.value.trim();
	if (!input) {
		showError("Please enter a search term or URL.");
		return;
	}

	// Validate input length
	if (input.length > 2048) {
		showError("URL or search term is too long.");
		return;
	}

	saveSettings();
	if (shouldStoreSearchTerm(input)) {
		addSearchTerm(input);
	}

	let url;
	try {
		url = search(input, getTemplate(), {
			autoHttps: autoHttpsToggle.checked,
		});
	} catch (err) {
		showError("Failed to process your input.", err?.message || String(err));
		return;
	}

	if (!url) {
		showError("Unable to build a URL from that input.");
		return;
	}

	try {
		await ensureSW();
	} catch (err) {
		setBadge(swStatus, "Service worker: failed", "bad");
		showError(
			"Failed to register service worker.",
			err?.message || String(err)
		);
		return;
	}

	try {
		await ensureTransport();
	} catch (err) {
		setBadge(transportStatus, "Transport: failed", "bad");
		showError("Transport setup failed. Check your connection.", err?.message || String(err));
		return;
	}

	try {
		const currentTab = tabs.get(activeTabId);
		if (currentTab?.isHome) {
			await loadUrlInTab(activeTabId, url);
		} else {
			createTab(url, false);
		}

		addRecent(url);
		showSuccess("Page loaded");
	} catch (err) {
		showError("Failed to load page.", err?.message || String(err));
	}
});

searchEngineSelect.addEventListener("change", () => {
	updateCustomSearchVisibility();
	saveSettings();
});

searchEngineInput.addEventListener("change", saveSettings);

autoHttpsToggle.addEventListener("change", saveSettings);
rememberToggle.addEventListener("change", () => {
	saveSettings();
	renderRecent();
});

applyCloakButton.addEventListener("click", () => {
	applyCloak(cloakTitleInput.value, cloakIconInput.value);
	saveSettings();
});

resetCloakButton.addEventListener("click", resetCloak);

// Navigation controls
backButton.addEventListener("click", () => {
	showClickLoading();
	const tab = tabs.get(activeTabId);
	if (tab?.frame?.frame?.contentWindow) {
		tab.frame.frame.contentWindow.history.back();
	}
});

forwardButton.addEventListener("click", () => {
	showClickLoading();
	const tab = tabs.get(activeTabId);
	if (tab?.frame?.frame?.contentWindow) {
		tab.frame.frame.contentWindow.history.forward();
	}
});

reloadButton.addEventListener("click", () => {
	showClickLoading();
	const tab = tabs.get(activeTabId);
	if (tab?.isHome) {
		renderRecent();
	} else if (tab?.frame && tab?.url) {
		// For Scramjet frames, use the frame's go method to reload
		tab.frame.go(tab.url);
	} else if (tab?.frame) {
		// Fallback for regular frames
		tab.frame.frame.contentWindow?.location.reload();
	}
});

homeNavButton.addEventListener("click", () => {
	showClickLoading();
	if (activeTabId) {
		const tab = tabs.get(activeTabId);
		if (tab && !tab.isHome) {
			closeTab(activeTabId);
		}
		createTab(null, true);
	}
});

settingsButton.addEventListener("click", () => {
	showClickLoading();
	settingsModal.hidden = false;
});

modalClose.addEventListener("click", () => {
	settingsModal.hidden = true;
});

modalOverlay.addEventListener("click", () => {
	settingsModal.hidden = true;
});

bookmarkButton.addEventListener("click", () => {
	const tab = tabs.get(activeTabId);
	if (tab?.url) {
		const name = prompt("Bookmark name:", new URL(tab.url).hostname || tab.url);
		if (name !== null) {
			if (addBookmark(tab.url, name)) {
				showClickLoading();
				const feedback = document.createElement("div");
				feedback.textContent = "✓ Bookmark saved";
				feedback.style.cssText = "position: fixed; top: 20px; right: 20px; background: #34a853; color: white; padding: 12px 16px; border-radius: 4px; font-size: 14px; z-index: 1000;";
				document.body.appendChild(feedback);
				setTimeout(() => feedback.remove(), 2000);
			} else {
				alert("Bookmark already exists or invalid URL");
			}
		}
	} else {
		alert("No URL to bookmark. Navigate to a website first.");
	}
});

omniboxInput.addEventListener("focus", () => {
	omniboxInput.select();
});

newTabButton.addEventListener("click", () => {
	showClickLoading();
	createTab(null, true);
});

window.addEventListener("keydown", (event) => {
	if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "t") {
		event.preventDefault();
		createTab(null, true);
	}
	if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "w") {
		if (activeTabId && tabs.size > 1) {
			event.preventDefault();
			closeTab(activeTabId);
		}
	}
	if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "l") {
		event.preventDefault();
		omniboxInput.focus();
		omniboxInput.select();
	}
	if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "r") {
		event.preventDefault();
		reloadButton.click();
	}
	// Show shortcuts with Ctrl+/
	if (event.ctrlKey && event.key === "/") {
		event.preventDefault();
		shortcutsModal.hidden = false;
	}
	// Reopen closed tab with Ctrl+Shift+T
	if (event.ctrlKey && event.shiftKey && event.key === "T") {
		event.preventDefault();
		const lastClosed = closedTabs.pop();
		if (lastClosed) {
			createTab(lastClosed.url, false);
		}
	}
	// Cycle tabs with Ctrl+Tab and Ctrl+Shift+Tab
	if (event.ctrlKey && event.key === "Tab") {
		event.preventDefault();
		const tabArray = Array.from(tabs.keys());
		const currentIndex = tabArray.indexOf(activeTabId);

		if (event.shiftKey) {
			const prevIndex =
				currentIndex > 0 ? currentIndex - 1 : tabArray.length - 1;
			switchTab(tabArray[prevIndex]);
		} else {
			const nextIndex =
				currentIndex < tabArray.length - 1 ? currentIndex + 1 : 0;
			switchTab(tabArray[nextIndex]);
		}
	}
	// Jump to specific tab with Ctrl+1-9
	if (event.ctrlKey && event.key >= "1" && event.key <= "9") {
		event.preventDefault();
		const index = parseInt(event.key) - 1;
		const tabArray = Array.from(tabs.keys());
		if (index < tabArray.length) {
			switchTab(tabArray[index]);
		}
	}
	// Fullscreen with F11
	if (event.key === "F11") {
		event.preventDefault();
		requestFullscreen();
	}
});

quickLinks.forEach((link) => {
	link.addEventListener("click", () => {
		const url = link.getAttribute("data-quick-url");
		if (!url) return;
		omniboxInput.value = url;
		omniboxForm.requestSubmit();
	});
});

// Context menu handlers
tabContextMenu.querySelectorAll("[data-action]").forEach((btn) => {
	btn.addEventListener("click", (e) => {
		const action = e.target.getAttribute("data-action");
		handleContextAction(action);
	});
});

document.addEventListener("click", () => {
	hideTabContextMenu();
});

document.addEventListener("click", (e) => {
	const clickable = e.target.closest(
		"button, a, .tab, .tile, .context-item, .suggestion-item, .recent-item button"
	);
	if (clickable) showClickLoading();
});

// Shortcuts modal handlers
shortcutsButton.addEventListener("click", () => {
	showClickLoading();
	shortcutsModal.hidden = false;
});

shortcutsClose.addEventListener("click", () => {
	shortcutsModal.hidden = true;
});

shortcutsOverlay.addEventListener("click", () => {
	shortcutsModal.hidden = true;
});

startupSkip.addEventListener("click", () => {
	hideStartupModal();
});

startupFullscreen.addEventListener("click", async () => {
	startupFullscreen.classList.add("loading");
	await requestFullscreen();
	hideStartupModal();
	startupFullscreen.classList.remove("loading");
});

startupCloak.addEventListener("click", () => {
	startupCloak.classList.add("loading");
	hideStartupModal();
	openAboutBlankCloak(false);
	startupCloak.classList.remove("loading");
});

startupBoth.addEventListener("click", () => {
	startupBoth.classList.add("loading");
	hideStartupModal();
	openAboutBlankCloak(true);
	startupBoth.classList.remove("loading");
});

// Omnibox suggestions
omniboxInput.addEventListener("input", () => {
	renderOmniboxSuggestions(omniboxInput.value);
});

omniboxInput.addEventListener("focus", () => {
	renderOmniboxSuggestions(omniboxInput.value);
});

omniboxInput.addEventListener("blur", () => {
	setTimeout(() => {
		hideOmniboxSuggestions();
	}, 120);
});

document.addEventListener("click", (e) => {
	if (!omniboxSuggestions.contains(e.target) && e.target !== omniboxInput) {
		hideOmniboxSuggestions();
	}
});

omniboxSuggestions.addEventListener("click", (e) => {
	const target = e.target.closest(".suggestion-item");
	if (!target) return;
	const value = target.getAttribute("data-value");
	const type = target.getAttribute("data-type");
	if (!value) return;

	if (type === "search") {
		omniboxInput.value = value;
	} else {
		omniboxInput.value = value;
	}
	omniboxForm.requestSubmit();
	hideOmniboxSuggestions();
});

loadSettings();
renderRecent();
renderBookmarks();
createTab(null, true);

// Add bookmark button handler
addBookmarkButton.addEventListener("click", () => {
	const url = bookmarkUrlInput.value.trim();
	const name = bookmarkNameInput.value.trim();
	
	if (!url) {
		alert("Please enter a URL");
		return;
	}
	
	if (addBookmark(url, name)) {
		bookmarkUrlInput.value = "";
		bookmarkNameInput.value = "";
		renderBookmarks();
	} else {
		alert("Failed to add bookmark. It may already exist.");
	}
});

// Allow Enter key in bookmark inputs
bookmarkUrlInput?.addEventListener("keypress", (e) => {
	if (e.key === "Enter") addBookmarkButton.click();
});

bookmarkNameInput?.addEventListener("keypress", (e) => {
	if (e.key === "Enter") addBookmarkButton.click();
});

// Clear history button
const clearHistoryButton = document.getElementById("sj-clear-history");
if (clearHistoryButton) {
	clearHistoryButton.addEventListener("click", clearAllRecent);
}

showStartupModal();
