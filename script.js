// script.js - 懒得起名小书铺交互脚本

document.addEventListener('DOMContentLoaded', async function() {
    // Supabase configuration (替换为你提供的 URL 与 anon key)
    const SUPABASE_URL = 'https://cxsomlfxlpnqnqramoyf.supabase.co';
    const SUPABASE_ANON_KEY = 'sb_publishable_iCCcnej8rT1qLIXHpsH9HA_B6LeiYFe';
    const supabaseClient = (typeof supabase !== 'undefined')
        ? supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
        : null;

    // 数据容器（将由 Supabase 填充）
    let books = [];
    let recommendations = [];
    let cart = [];
    let favorites = [];
    let history = [];
    const CART_STORAGE_PREFIX = 'bookstore_cart:';
    const FAVORITES_STORAGE_PREFIX = 'bookstore_favorites:';
    const HISTORY_STORAGE_PREFIX = 'bookstore_history:';
    const HISTORY_LIMIT = 30;

    // 从 Supabase 加载数据，如果失败则保留空数组
    async function loadDataFromSupabase() {
        if (!supabaseClient) {
            console.warn('Supabase client not found; skipping cloud load.');
            return;
        }

        try {
            const { data: booksData, error: booksError } = await supabaseClient.from('books').select('*');
            if (booksError) {
                console.error('Error loading books from Supabase:', booksError);
            } else if (booksData) {
                // 支持数据库字段为 snake_case 或 camelCase 的情况
                books = booksData.map(b => ({
                    id: b.id ?? b._id,
                    title: b.title ?? b.name ?? '',
                    author: b.author ?? b.writer ?? '',
                    category: b.category ?? b.cat ?? 'all',
                    price: parseFloat(b.price) || 0,
                    rating: parseFloat(b.rating) || 0,
                    description: b.description ?? b.desc ?? '',
                    color: b.color ?? '#dacfba'
                }));
            }

            // 不再请求 `recommendations` 表（避免 404）；推荐将根据用户行为派生
            recommendations = [];
        } catch (e) {
            console.error('Unexpected error loading from Supabase:', e);
        }
    }
    
    // DOM元素
    const booksGrid = document.querySelector('.books-grid');
    const recommendationsGrid = document.querySelector('.recommendations-grid');
    const cartItemsContainer = document.getElementById('cart-items');
    const cartCount = document.querySelector('.cart-count');
    const totalPriceElement = document.querySelector('.total-price');
    const searchInput = document.getElementById('search-input');
    const searchBtn = document.getElementById('search-btn');
    const searchBar = document.querySelector('.search-bar');
    const searchSuggestions = document.querySelector('.search-suggestions');
    const menuToggle = document.getElementById('menu-toggle');
    const navLinks = document.querySelector('.nav-links');
    const filterButtons = document.querySelectorAll('.filter-btn');
    const refreshRecommendationsBtn = document.getElementById('refresh-recommendations');
    const cartIcon = document.querySelector('.cart-icon');
    const closeCartBtn = document.getElementById('close-cart');
    const cartSidebar = document.querySelector('.cart-sidebar');
    const cartOverlay = document.getElementById('cart-overlay');
    const clearCartBtn = document.getElementById('clear-cart');
    const currentUserLabel = document.getElementById('current-user');
    const favoritesLink = document.getElementById('favorites-link');
    const historyLink = document.getElementById('history-link');
    const favoritesSidebar = document.getElementById('favorites-sidebar');
    const historySidebar = document.getElementById('history-sidebar');
    const favoritesItemsContainer = document.getElementById('favorites-items');
    const historyItemsContainer = document.getElementById('history-items');
    const closeFavoritesBtn = document.getElementById('close-favorites');
    const closeHistoryBtn = document.getElementById('close-history');
    const clearFavoritesBtn = document.getElementById('clear-favorites');
    const clearHistoryBtn = document.getElementById('clear-history');
    const bookModal = document.getElementById('book-modal');
    const bookModalBody = document.getElementById('book-modal-body');
    const bookModalClose = document.getElementById('book-modal-close');
    
    // 当前过滤器和购物车状态
    let currentFilter = 'all';
    let currentSearchQuery = '';
    let lastSearchResults = [];
    
    // 用户状态检查（兼容 sessionStorage 与 localStorage）
    function isGuestUser() {
        try {
            const userType = sessionStorage.getItem('userType');
            const u = localStorage.getItem('user');
            return userType === 'guest' || u === 'guest' || !userType;
        } catch (e) {
            return false;
        }
    }

    function getCurrentUserKey() {
        try {
            const userType = sessionStorage.getItem('userType');
            const username = sessionStorage.getItem('username');
            const displayUsername = sessionStorage.getItem('displayUsername');
            if (userType === 'registered' && (displayUsername || username)) {
                return `registered:${displayUsername || username}`;
            }
            if (userType === 'guest') return 'guest';

            const remembered = localStorage.getItem('rememberedUser');
            if (remembered) return `registered:${remembered}`;
            return null;
        } catch (e) {
            return null;
        }
    }

    function loadCartForCurrentUser() {
        const key = getCurrentUserKey();
        if (!key || key === 'guest') return [];
        try {
            const raw = localStorage.getItem(`${CART_STORAGE_PREFIX}${key}`);
            if (!raw) return [];
            const parsed = JSON.parse(raw);
            return Array.isArray(parsed) ? parsed : [];
        } catch (e) {
            return [];
        }
    }

    function saveCartForCurrentUser() {
        const key = getCurrentUserKey();
        if (!key || key === 'guest') return;
        try {
            localStorage.setItem(`${CART_STORAGE_PREFIX}${key}`, JSON.stringify(cart));
        } catch (e) {
            // ignore storage errors
        }
    }

    async function getUserId() {
        if (!supabaseClient || !supabaseClient.auth) return null;
        try {
            const { data } = await supabaseClient.auth.getUser();
            return data?.user?.id || null;
        } catch (e) {
            return null;
        }
    }

    async function loadCartFromCloud() {
        const uid = await getUserId();
        if (!uid) return [];
        const { data, error } = await supabaseClient
            .from('cart_items')
            .select('id, book_id, quantity')
            .eq('user_id', uid);
        if (error) {
            console.error('load cart cloud error', error);
            return [];
        }
        return (data || []).map(row => ({
            id: row.id,
            bookId: row.book_id,
            quantity: row.quantity
        }));
    }

    async function saveCartToCloud(currentCart) {
        const uid = await getUserId();
        if (!uid) return;
        await supabaseClient.from('cart_items').delete().eq('user_id', uid);
        if (!currentCart.length) return;
        const rows = currentCart.map(item => ({
            user_id: uid,
            book_id: item.bookId,
            quantity: item.quantity
        }));
        const { error } = await supabaseClient.from('cart_items').insert(rows);
        if (error) console.error('save cart cloud error', error);
    }

    function loadFavoritesForCurrentUser() {
        const key = getCurrentUserKey();
        if (!key || key === 'guest') return [];
        try {
            const raw = localStorage.getItem(`${FAVORITES_STORAGE_PREFIX}${key}`);
            if (!raw) return [];
            const parsed = JSON.parse(raw);
            return Array.isArray(parsed) ? parsed : [];
        } catch (e) {
            return [];
        }
    }

    function saveFavoritesForCurrentUser() {
        const key = getCurrentUserKey();
        if (!key || key === 'guest') return;
        try {
            localStorage.setItem(`${FAVORITES_STORAGE_PREFIX}${key}`, JSON.stringify(favorites));
        } catch (e) {
            // ignore storage errors
        }
    }

    async function loadFavoritesFromCloud() {
        const uid = await getUserId();
        if (!uid) return [];
        const { data, error } = await supabaseClient
            .from('favorites')
            .select('book_id')
            .eq('user_id', uid);
        if (error) {
            console.error('load favorites cloud error', error);
            return [];
        }
        return (data || []).map(r => r.book_id);
    }

    async function toggleFavoriteInCloud(bookId, shouldAdd) {
        const uid = await getUserId();
        if (!uid) return;
        if (shouldAdd) {
            const { error } = await supabaseClient
                .from('favorites')
                .insert({ user_id: uid, book_id: bookId });
            if (error) console.error('add favorite cloud error', error);
        } else {
            const { error } = await supabaseClient
                .from('favorites')
                .delete()
                .eq('user_id', uid)
                .eq('book_id', bookId);
            if (error) console.error('remove favorite cloud error', error);
        }
    }

    function loadHistoryForCurrentUser() {
        const key = getCurrentUserKey();
        if (!key || key === 'guest') return [];
        try {
            const raw = localStorage.getItem(`${HISTORY_STORAGE_PREFIX}${key}`);
            if (!raw) return [];
            const parsed = JSON.parse(raw);
            return Array.isArray(parsed) ? parsed : [];
        } catch (e) {
            return [];
        }
    }

    function saveHistoryForCurrentUser() {
        const key = getCurrentUserKey();
        if (!key || key === 'guest') return;
        try {
            localStorage.setItem(`${HISTORY_STORAGE_PREFIX}${key}`, JSON.stringify(history));
        } catch (e) {
            // ignore storage errors
        }
    }

    async function loadHistoryFromCloud() {
        const uid = await getUserId();
        if (!uid) return [];
        const { data, error } = await supabaseClient
            .from('history')
            .select('book_id, viewed_at')
            .eq('user_id', uid)
            .order('viewed_at', { ascending: false })
            .limit(HISTORY_LIMIT);
        if (error) {
            console.error('load history cloud error', error);
            return [];
        }
        return (data || []).map(r => ({ bookId: r.book_id, viewedAt: r.viewed_at }));
    }

    async function addHistoryToCloud(bookId) {
        const uid = await getUserId();
        if (!uid) return;
        const { error } = await supabaseClient
            .from('history')
            .insert({ user_id: uid, book_id: bookId });
        if (error) console.error('add history cloud error', error);
    }

    async function loadUserState() {
        const localCart = loadCartForCurrentUser();
        const localFavorites = loadFavoritesForCurrentUser();
        const localHistory = loadHistoryForCurrentUser();

        if (supabaseClient) {
            const uid = await getUserId();
            if (uid) {
                try {
                    const cloudCart = await loadCartFromCloud();
                    const cloudFavorites = await loadFavoritesFromCloud();
                    const cloudHistory = await loadHistoryFromCloud();

                    cart = (cloudCart && cloudCart.length) ? cloudCart : localCart;
                    favorites = (cloudFavorites && cloudFavorites.length) ? cloudFavorites : localFavorites;
                    history = (cloudHistory && cloudHistory.length) ? cloudHistory : localHistory;
                    return;
                } catch (e) {
                    console.error('loadUserState cloud error', e);
                }
            }
        }

        cart = localCart;
        favorites = localFavorites;
        history = localHistory;
    }

    async function persistCart() {
        saveCartForCurrentUser();
        if (supabaseClient) {
            const uid = await getUserId();
            if (uid) await saveCartToCloud(cart);
        }
    }
    
    // 初始化页面
    async function initPage() {
        await loadUserState();
        updateRecommendationsForUser();
        updateCurrentUserLabel();
        renderBooks(books, { applyFilter: true, highlightQuery: currentSearchQuery });
        renderRecommendations();
        renderCart();
        renderFavoritesPanel();
        renderHistoryPanel();
        updateCartCount();
        calculateTotal();

        // 添加事件监听器
        setupEventListeners();

        // 根据当前用户状态应用游客UI限制（确保按钮在初始渲染后展示为禁用）
        applyGuestUIRestrictions();
    }

    // 搜索相关工具函数
    function escapeHTML(str) {
        return String(str ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function normalizeText(text) {
        return String(text ?? '').toLowerCase().trim();
    }

    function tokenizeQuery(query) {
        const normalized = normalizeText(query);
        if (!normalized) return [];
        return normalized.split(/[\s,，;；/|]+/).filter(Boolean);
    }

    function escapeRegExp(str) {
        return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }

    function parseFieldedQuery(query) {
        const result = {
            title: [],
            author: [],
            category: [],
            desc: [],
            terms: []
        };

        const raw = String(query ?? '');
        const fieldPattern = /(?:^|\s)(title|书名|author|作者|category|分类|desc|简介|描述)\s*[:：]\s*(\S+)/gi;
        let cleaned = raw;
        let match;

        while ((match = fieldPattern.exec(raw)) !== null) {
            const field = match[1].toLowerCase();
            const value = match[2];
            const tokens = tokenizeQuery(value);
            if (field === 'title' || field === '书名') result.title.push(...tokens);
            else if (field === 'author' || field === '作者') result.author.push(...tokens);
            else if (field === 'category' || field === '分类') result.category.push(...tokens);
            else if (field === 'desc' || field === '简介' || field === '描述') result.desc.push(...tokens);
            cleaned = cleaned.replace(match[0], ' ');
        }

        result.terms = tokenizeQuery(cleaned);
        return result;
    }

    function getHighlightTokens(query) {
        const parsed = parseFieldedQuery(query);
        return [...parsed.terms, ...parsed.title, ...parsed.author, ...parsed.category, ...parsed.desc];
    }

    function getBookSearchText(book) {
        const categoryName = getCategoryName(book.category);
        return {
            title: normalizeText(book.title),
            author: normalizeText(book.author),
            desc: normalizeText(book.description),
            category: normalizeText(`${book.category} ${categoryName}`)
        };
    }

    function matchTokensInField(fieldText, tokens) {
        if (!tokens.length) return true;
        return tokens.every(token => fieldText.includes(token));
    }

    function scoreBookByQuery(book, query) {
        const { title, author, desc, category } = getBookSearchText(book);
        const parsed = parseFieldedQuery(query);

        if (!matchTokensInField(title, parsed.title)) return { matched: false, score: 0 };
        if (!matchTokensInField(author, parsed.author)) return { matched: false, score: 0 };
        if (!matchTokensInField(desc, parsed.desc)) return { matched: false, score: 0 };
        if (!matchTokensInField(category, parsed.category)) return { matched: false, score: 0 };

        const allTerms = parsed.terms;
        if (allTerms.length === 0 && (parsed.title.length || parsed.author.length || parsed.category.length || parsed.desc.length)) {
            return { matched: true, score: 5 };
        }

        let score = 0;
        allTerms.forEach(term => {
            if (title.includes(term)) score += 5;
            if (author.includes(term)) score += 4;
            if (desc.includes(term)) score += 2;
            if (category.includes(term)) score += 1;
        });

        const matched = score > 0;
        return { matched, score };
    }

    function highlightText(text, tokens) {
        if (!tokens.length) return text;
        const uniqueTokens = [...new Set(tokens)].filter(Boolean).sort((a, b) => b.length - a.length);
        if (uniqueTokens.length === 0) return text;
        const pattern = new RegExp(`(${uniqueTokens.map(escapeRegExp).join('|')})`, 'gi');
        return text.replace(pattern, '<mark class="search-highlight">$1</mark>');
    }

    function ensureSearchStatusElement() {
        const sectionHeader = document.querySelector('#books .section-header');
        if (!sectionHeader) return null;
        let statusEl = document.getElementById('search-status');
        if (!statusEl) {
            statusEl = document.createElement('div');
            statusEl.id = 'search-status';
            statusEl.className = 'search-status';
            sectionHeader.appendChild(statusEl);
        }
        return statusEl;
    }

    function renderSearchStatus(query, count, total) {
        const statusEl = ensureSearchStatusElement();
        if (!statusEl) return;
        if (!query) {
            statusEl.classList.remove('active');
            statusEl.textContent = '';
            return;
        }

        const safeQuery = escapeHTML(query);
        const totalText = typeof total === 'number' ? ` / ${total}` : '';
        statusEl.innerHTML = `搜索“${safeQuery}” · ${count}${totalText} 本`;
        statusEl.classList.add('active');
    }

    function updateSearchSuggestions(query) {
        if (!searchSuggestions) return;
        const normalized = normalizeText(query);
        const baseBooks = currentFilter === 'all' ? books : books.filter(b => b.category === currentFilter);

        if (!normalized) {
            searchSuggestions.innerHTML = '';
            searchSuggestions.classList.remove('active');
            return;
        }

        const suggestions = [];
        const seen = new Set();

        baseBooks.forEach(book => {
            const text = getBookSearchText(book);
            if (text.title.includes(normalized) || text.author.includes(normalized) || text.desc.includes(normalized)) {
                if (!seen.has(book.title)) {
                    suggestions.push({
                        label: book.title,
                        meta: book.author || '作者未知',
                        value: book.title
                    });
                    seen.add(book.title);
                }
            }
        });

        const authorSet = new Set();
        baseBooks.forEach(book => {
            if (!book.author) return;
            const authorText = normalizeText(book.author);
            if (authorText.includes(normalized) && !authorSet.has(book.author)) {
                suggestions.push({
                    label: `作者: ${book.author}`,
                    meta: '作者',
                    value: `author:${book.author}`
                });
                authorSet.add(book.author);
            }
        });

        const categoryMatches = ['fiction', 'nonfiction', 'academic', 'children']
            .map(cat => ({
                code: cat,
                name: getCategoryName(cat)
            }))
            .filter(cat => normalizeText(cat.name).includes(normalized) || normalizeText(cat.code).includes(normalized));

        categoryMatches.forEach(cat => {
            suggestions.push({
                label: `分类: ${cat.name}`,
                meta: '分类',
                value: `category:${cat.name}`
            });
        });

        const finalSuggestions = suggestions.slice(0, 6);

        if (finalSuggestions.length === 0) {
            searchSuggestions.innerHTML = '<div class="suggestion-empty">未找到匹配内容</div>';
            searchSuggestions.classList.add('active');
            return;
        }

        const highlightTokens = getHighlightTokens(query);
        searchSuggestions.innerHTML = finalSuggestions
            .map(item => `
                <div class="suggestion-item" data-search="${escapeHTML(item.value)}">
                    <span class="suggestion-label">${highlightText(escapeHTML(item.label), highlightTokens)}</span>
                    <span class="suggestion-meta">${escapeHTML(item.meta)}</span>
                </div>
            `)
            .join('');

        searchSuggestions.classList.add('active');

        searchSuggestions.querySelectorAll('.suggestion-item').forEach(item => {
            item.addEventListener('click', function() {
                searchInput.value = this.dataset.search || '';
                performSearch({ scroll: true });
                searchSuggestions.classList.remove('active');
            });
        });
    }
    
    // 渲染图书列表
    function renderBooks(booksToRender, options = {}) {
        const { applyFilter = true, highlightQuery = '' } = options;
        const shouldHighlight = typeof highlightQuery === 'string' && highlightQuery.trim().length > 0;
        const highlightTokens = shouldHighlight ? getHighlightTokens(highlightQuery) : [];

        booksGrid.innerHTML = '';

        const filteredBooks = (applyFilter && currentFilter !== 'all')
            ? booksToRender.filter(book => book.category === currentFilter)
            : booksToRender;
        
        if (filteredBooks.length === 0) {
            booksGrid.innerHTML = '<div class="no-results"><p>未找到相关图书</p></div>';
            return;
        }
        
        filteredBooks.forEach(book => {
            const bookCard = document.createElement('div');
            bookCard.className = 'book-card';
            bookCard.dataset.id = book.id;
            bookCard.dataset.category = book.category;
            const isFav = favorites.includes(book.id);

            const safeTitle = escapeHTML(book.title || '');
            const safeAuthor = escapeHTML(book.author || '');
            const safeDescription = escapeHTML(book.description || '');
            const imageTitle = escapeHTML((book.title || '').substring(0, 10));

            const titleText = shouldHighlight ? highlightText(safeTitle, highlightTokens) : safeTitle;
            const authorText = shouldHighlight ? highlightText(safeAuthor, highlightTokens) : safeAuthor;
            const descriptionText = shouldHighlight ? highlightText(safeDescription, highlightTokens) : safeDescription;
            
            bookCard.innerHTML = `
                <div class="book-image" style="background-color: ${book.color}">
                    <span style="color: white; font-weight: 500;">${imageTitle}...</span>
                </div>
                <div class="book-content">
                    <div class="book-category">${getCategoryName(book.category)}</div>
                    <h3 class="book-title">${titleText}</h3>
                    <p class="book-author">${authorText}</p>
                    <p class="book-description">${descriptionText}</p>
                    <div class="book-footer">
                        <div class="book-price">¥ ${book.price.toFixed(2)}</div>
                        <div class="book-rating">
                            <i class="fas fa-star"></i>
                            <span>${book.rating}</span>
                        </div>
                        <button class="favorite-btn ${isGuestUser() ? 'disabled' : ''} ${isFav ? 'active' : ''}" data-id="${book.id}" ${isGuestUser() ? 'disabled' : ''}>
                            <i class="fas fa-heart"></i>
                        </button>
                        <button class="add-to-cart ${isGuestUser() ? 'disabled' : ''}" data-id="${book.id}" ${isGuestUser() ? 'disabled' : ''}>
                            <i class="fas fa-cart-plus"></i>
                        </button>
                    </div>
                </div>
            `;
            
            booksGrid.appendChild(bookCard);
        });
        
        // 记录浏览历史（点击卡片任意非按钮区域）
        document.querySelectorAll('.book-card').forEach(card => {
            card.addEventListener('click', function(e) {
                if (e.target.closest('button')) return;
                const bookId = parseInt(this.dataset.id);
                openBookModal(bookId);
                addToHistory(bookId);
            });
        });

        // 为收藏按钮添加事件监听器
        document.querySelectorAll('.favorite-btn').forEach(btn => {
            btn.addEventListener('click', function(e) {
                e.stopPropagation();
                if (isGuestUser()) {
                    showNotification('游客无法收藏，请登录后操作', 'info');
                    return;
                }
                const bookId = parseInt(this.dataset.id);
                toggleFavorite(bookId);
            });
        });

        // 为添加到购物车按钮添加事件监听器（游客会被阻止并提示登录）
        document.querySelectorAll('.add-to-cart').forEach(btn => {
            btn.addEventListener('click', function(e) {
                if (isGuestUser()) {
                    showNotification('游客无法使用购物车，请登录后操作', 'info');
                    return;
                }
                const bookId = parseInt(this.dataset.id);
                addToCart(bookId);
            });
        });

        // 确保UI状态（disabled类/属性）与当前用户状态一致
        applyGuestUIRestrictions();
    }
    
    // 渲染推荐图书
    function renderRecommendations() {
        recommendationsGrid.innerHTML = '';
        
        recommendations.forEach(rec => {
            const book = books.find(b => b.id === rec.bookId);
            if (!book) return;
            
            const recommendationCard = document.createElement('div');
            recommendationCard.className = 'recommendation-card';
            recommendationCard.dataset.id = book.id;
            
            const isFav = favorites.includes(book.id);

            recommendationCard.innerHTML = `
                <div class="recommendation-badge">AI推荐</div>
                <p class="recommendation-reason"><i class="fas fa-lightbulb"></i> ${rec.reason}</p>
                <div class="book-category">${getCategoryName(book.category)}</div>
                <h3 class="book-title">${book.title}</h3>
                <p class="book-author">${book.author}</p>
                <p class="book-description">${book.description}</p>
                <div class="book-footer">
                    <div class="book-price">¥ ${book.price.toFixed(2)}</div>
                    <div class="book-rating">
                        <i class="fas fa-star"></i>
                        <span>${book.rating}</span>
                    </div>
                    <button class="favorite-btn ${isGuestUser() ? 'disabled' : ''} ${isFav ? 'active' : ''}" data-id="${book.id}" ${isGuestUser() ? 'disabled' : ''}>
                        <i class="fas fa-heart"></i>
                    </button>
                    <button class="add-to-cart ${isGuestUser() ? 'disabled' : ''}" data-id="${book.id}" ${isGuestUser() ? 'disabled' : ''}>
                        <i class="fas fa-cart-plus"></i>
                    </button>
                </div>
            `;
            
            recommendationsGrid.appendChild(recommendationCard);
        });
        
        // 记录浏览历史（点击推荐卡片任意非按钮区域）
        document.querySelectorAll('.recommendation-card').forEach(card => {
            card.addEventListener('click', function(e) {
                if (e.target.closest('button')) return;
                const bookId = parseInt(this.dataset.id || this.querySelector('.favorite-btn')?.dataset.id || this.querySelector('.add-to-cart')?.dataset.id, 10);
                if (!Number.isNaN(bookId)) addToHistory(bookId);
                if (!Number.isNaN(bookId)) openBookModal(bookId);
            });
        });

        // 为收藏按钮添加事件监听器
        document.querySelectorAll('.recommendation-card .favorite-btn').forEach(btn => {
            btn.addEventListener('click', function(e) {
                e.stopPropagation();
                if (isGuestUser()) {
                    showNotification('游客无法收藏，请登录后操作', 'info');
                    return;
                }
                const bookId = parseInt(this.dataset.id);
                toggleFavorite(bookId);
            });
        });

        // 为推荐区域添加到购物车按钮添加事件监听器（游客会被阻止并提示登录）
        document.querySelectorAll('.recommendation-card .add-to-cart').forEach(btn => {
            btn.addEventListener('click', function() {
                if (isGuestUser()) {
                    showNotification('游客无法使用购物车，请登录后操作', 'info');
                    return;
                }
                const bookId = parseInt(this.dataset.id);
                addToCart(bookId);
            });
        });

        // 确保UI状态（disabled类/属性）与当前用户状态一致
        applyGuestUIRestrictions();
    }

    function updateRecommendationsForUser() {
        if (!books || books.length === 0) {
            recommendations = [];
            return;
        }

        // 基于收藏/历史的类别与作者权重
        const categoryWeights = {};
        const authorWeights = {};

        favorites.forEach(bookId => {
            const b = books.find(x => x.id === bookId);
            if (!b) return;
            categoryWeights[b.category] = (categoryWeights[b.category] || 0) + 3;
            authorWeights[b.author] = (authorWeights[b.author] || 0) + 2;
        });

        history.forEach(entry => {
            const b = books.find(x => x.id === entry.bookId);
            if (!b) return;
            categoryWeights[b.category] = (categoryWeights[b.category] || 0) + 1;
            authorWeights[b.author] = (authorWeights[b.author] || 0) + 1;
        });

        const scored = books.map(b => {
            const score = (categoryWeights[b.category] || 0) + (authorWeights[b.author] || 0) + (b.rating || 0);
            return { book: b, score };
        });

        scored.sort((a, b) => b.score - a.score);
        const selected = scored.slice(0, 4).map((item, idx) => ({
            id: idx + 1,
            bookId: item.book.id,
            reason: (favorites.length || history.length) ? '基于您的收藏与浏览偏好推荐' : '基于热门与评分为您推荐'
        }));

        recommendations = selected;
    }
    
    // 渲染购物车
    function renderCart() {
        cartItemsContainer.innerHTML = '';
        
        if (cart.length === 0) {
            cartItemsContainer.innerHTML = '<div class="empty-cart"><p>购物车为空</p></div>';
            return;
        }
        
        cart.forEach(item => {
            const book = books.find(b => b.id === item.bookId);
            if (!book) return;
            
            const cartItem = document.createElement('div');
            cartItem.className = 'cart-item';
            cartItem.dataset.id = item.id;
            
            cartItem.innerHTML = `
                <div class="cart-item-image" style="background-color: ${book.color}">
                    <span style="color: white; font-size: 12px; padding: 5px;">${book.title.substring(0, 6)}...</span>
                </div>
                <div class="cart-item-details">
                    <h4 class="cart-item-title">${book.title}</h4>
                    <p class="cart-item-author">${book.author}</p>
                    <div class="cart-item-controls">
                        <div class="cart-item-quantity">
                            <button class="quantity-btn decrease-quantity" data-id="${item.id}">-</button>
                            <span class="quantity">${item.quantity}</span>
                            <button class="quantity-btn increase-quantity" data-id="${item.id}">+</button>
                        </div>
                        <div class="cart-item-price">¥ ${(book.price * item.quantity).toFixed(2)}</div>
                        <button class="remove-item" data-id="${item.id}">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </div>
            `;
            
            cartItemsContainer.appendChild(cartItem);
        });
        
        // 为购物车按钮添加事件监听器
        document.querySelectorAll('.decrease-quantity').forEach(btn => {
            btn.addEventListener('click', function() {
                const itemId = parseInt(this.dataset.id);
                updateQuantity(itemId, -1);
            });
        });
        
        document.querySelectorAll('.increase-quantity').forEach(btn => {
            btn.addEventListener('click', function() {
                const itemId = parseInt(this.dataset.id);
                updateQuantity(itemId, 1);
            });
        });
        
        document.querySelectorAll('.remove-item').forEach(btn => {
            btn.addEventListener('click', function() {
                const itemId = parseInt(this.dataset.id);
                removeFromCart(itemId);
            });
        });
    }

    function renderFavoritesPanel() {
        if (!favoritesItemsContainer) return;
        favoritesItemsContainer.innerHTML = '';

        if (favorites.length === 0) {
            favoritesItemsContainer.innerHTML = '<div class="empty-cart"><p>暂无收藏</p></div>';
            return;
        }

        favorites.forEach(bookId => {
            const book = books.find(b => b.id === bookId);
            if (!book) return;

            const item = document.createElement('div');
            item.className = 'cart-item';
            item.dataset.id = bookId;
            item.innerHTML = `
                <div class="cart-item-image" style="background-color: ${book.color}">
                    <span style="color: white; font-size: 12px; padding: 5px;">${book.title.substring(0, 6)}...</span>
                </div>
                <div class="cart-item-details">
                    <h4 class="cart-item-title">${book.title}</h4>
                    <p class="cart-item-author">${book.author}</p>
                    <div class="cart-item-controls">
                        <div class="cart-item-price">¥ ${book.price.toFixed(2)}</div>
                        <button class="remove-item" data-id="${bookId}">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </div>
            `;
            favoritesItemsContainer.appendChild(item);
        });

        favoritesItemsContainer.querySelectorAll('.remove-item').forEach(btn => {
            btn.addEventListener('click', function() {
                const bookId = parseInt(this.dataset.id);
                removeFavorite(bookId);
            });
        });
    }

    function renderHistoryPanel() {
        if (!historyItemsContainer) return;
        historyItemsContainer.innerHTML = '';

        if (history.length === 0) {
            historyItemsContainer.innerHTML = '<div class="empty-cart"><p>暂无浏览历史</p></div>';
            return;
        }

        history.forEach(entry => {
            const book = books.find(b => b.id === entry.bookId);
            if (!book) return;
            const viewedAt = new Date(entry.viewedAt || Date.now());

            const item = document.createElement('div');
            item.className = 'cart-item';
            item.dataset.id = entry.bookId;
            item.innerHTML = `
                <div class="cart-item-image" style="background-color: ${book.color}">
                    <span style="color: white; font-size: 12px; padding: 5px;">${book.title.substring(0, 6)}...</span>
                </div>
                <div class="cart-item-details">
                    <h4 class="cart-item-title">${book.title}</h4>
                    <p class="cart-item-author">${book.author}</p>
                    <div class="cart-item-controls">
                        <div class="cart-item-price" style="font-size: 12px; color: var(--text-light);">
                            ${viewedAt.toLocaleString()}
                        </div>
                        <button class="remove-item" data-id="${entry.bookId}">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </div>
            `;
            historyItemsContainer.appendChild(item);
        });

        historyItemsContainer.querySelectorAll('.remove-item').forEach(btn => {
            btn.addEventListener('click', function() {
                const bookId = parseInt(this.dataset.id);
                removeHistoryItem(bookId);
            });
        });
    }

    function toggleFavorite(bookId) {
        if (favorites.includes(bookId)) {
            favorites = favorites.filter(id => id !== bookId);
            showNotification('已取消收藏', 'info');
            toggleFavoriteInCloud(bookId, false);
        } else {
            favorites.unshift(bookId);
            showNotification('已加入收藏', 'success');
            toggleFavoriteInCloud(bookId, true);
        }

        saveFavoritesForCurrentUser();
        renderFavoritesPanel();
        updateFavoriteButtons();
    }

    function removeFavorite(bookId) {
        favorites = favorites.filter(id => id !== bookId);
        toggleFavoriteInCloud(bookId, false);
        saveFavoritesForCurrentUser();
        renderFavoritesPanel();
        updateFavoriteButtons();
    }

    function addToHistory(bookId) {
        if (isGuestUser()) return;
        history = history.filter(h => h.bookId !== bookId);
        history.unshift({ bookId, viewedAt: Date.now() });
        if (history.length > HISTORY_LIMIT) history = history.slice(0, HISTORY_LIMIT);
        saveHistoryForCurrentUser();
        addHistoryToCloud(bookId);
        renderHistoryPanel();
    }

    function removeHistoryItem(bookId) {
        history = history.filter(h => h.bookId !== bookId);
        saveHistoryForCurrentUser();
        if (supabaseClient) {
            getUserId().then(uid => {
                if (!uid) return;
                supabaseClient
                    .from('history')
                    .delete()
                    .eq('user_id', uid)
                    .eq('book_id', bookId)
                    .then(({ error }) => { if (error) console.error('remove history cloud error', error); });
            });
        }
        renderHistoryPanel();
    }

    function updateFavoriteButtons() {
        document.querySelectorAll('.favorite-btn').forEach(btn => {
            const id = parseInt(btn.dataset.id);
            if (favorites.includes(id)) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        });
    }

    function renderBookModal(book) {
        if (!bookModalBody || !book) return;

        const safeTitle = escapeHTML(book.title || '');
        const safeAuthor = escapeHTML(book.author || '');
        const safeDescription = escapeHTML(book.description || '暂无简介');
        const safeCategory = escapeHTML(getCategoryName(book.category));
        const safePrice = Number(book.price || 0).toFixed(2);
        const safeRating = Number(book.rating || 0).toFixed(1);
        const safeCoverText = escapeHTML((book.title || '').substring(0, 12));

        const isFav = favorites.includes(book.id);
        const guest = isGuestUser();

        bookModalBody.innerHTML = `
            <div class="book-modal-cover" style="background-color: ${book.color};">
                ${safeCoverText}
            </div>
            <div class="book-modal-info">
                <h3 id="book-modal-title">${safeTitle}</h3>
                <div class="book-modal-meta">
                    <span><i class="fas fa-user"></i> ${safeAuthor}</span>
                    <span><i class="fas fa-tag"></i> ${safeCategory}</span>
                    <span><i class="fas fa-star"></i> ${safeRating}</span>
                    <span><i class="fas fa-yen-sign"></i> ¥ ${safePrice}</span>
                </div>
                <p class="book-modal-desc">${safeDescription}</p>
                <div class="book-modal-actions">
                    <button class="btn btn-secondary" id="modal-favorite-btn" ${guest ? 'disabled' : ''}>
                        <i class="fas fa-heart"></i> ${isFav ? '已收藏' : '加入收藏'}
                    </button>
                    <button class="btn btn-primary" id="modal-cart-btn" ${guest ? 'disabled' : ''}>
                        <i class="fas fa-cart-plus"></i> 加入购物车
                    </button>
                </div>
            </div>
        `;

        const favBtn = document.getElementById('modal-favorite-btn');
        const cartBtn = document.getElementById('modal-cart-btn');

        if (favBtn) {
            favBtn.addEventListener('click', function() {
                if (guest) {
                    showNotification('游客无法收藏，请登录后操作', 'info');
                    return;
                }
                toggleFavorite(book.id);
                renderBookModal(book);
            });
        }

        if (cartBtn) {
            cartBtn.addEventListener('click', function() {
                if (guest) {
                    showNotification('游客无法使用购物车，请登录后操作', 'info');
                    return;
                }
                addToCart(book.id);
            });
        }
    }

    function openBookModal(bookId) {
        if (!bookModal || !bookModalBody) return;
        const book = books.find(b => b.id === bookId);
        if (!book) return;
        renderBookModal(book);
        bookModal.classList.add('active');
        bookModal.setAttribute('aria-hidden', 'false');
        document.body.style.overflow = 'hidden';
    }

    function closeBookModal() {
        if (!bookModal) return;
        bookModal.classList.remove('active');
        bookModal.setAttribute('aria-hidden', 'true');
        document.body.style.overflow = 'auto';
    }

    async function updateCurrentUserLabel() {
        if (!currentUserLabel) return;
        try {
            const userType = sessionStorage.getItem('userType');
            const username = sessionStorage.getItem('username');
            if (userType === 'guest') {
                currentUserLabel.textContent = '当前用户：游客';
                return;
            }
            if (username) {
                if (username.includes('@') && supabaseClient) {
                    const cached = sessionStorage.getItem('displayUsername');
                    if (cached) {
                        currentUserLabel.textContent = `当前用户：${cached}`;
                        return;
                    }
                    const { data, error } = await supabaseClient
                        .from('users')
                        .select('username')
                        .eq('email', username)
                        .limit(1)
                        .maybeSingle();
                    if (!error && data && data.username) {
                        sessionStorage.setItem('displayUsername', data.username);
                        currentUserLabel.textContent = `当前用户：${data.username}`;
                        return;
                    }
                }

                currentUserLabel.textContent = `当前用户：${username}`;
                return;
            }
            currentUserLabel.textContent = '';
        } catch (e) {
            currentUserLabel.textContent = '';
        }
    }

    let activePanel = null;

    function openPanel(panelName) {
        closeActivePanel();
        activePanel = panelName;
        cartOverlay.classList.add('active');
        document.body.style.overflow = 'hidden';

        if (panelName === 'cart') cartSidebar.classList.add('active');
        if (panelName === 'favorites') favoritesSidebar.classList.add('active');
        if (panelName === 'history') historySidebar.classList.add('active');
    }

    function closeActivePanel() {
        if (!activePanel) return;
        if (activePanel === 'cart') cartSidebar.classList.remove('active');
        if (activePanel === 'favorites') favoritesSidebar.classList.remove('active');
        if (activePanel === 'history') historySidebar.classList.remove('active');
        cartOverlay.classList.remove('active');
        document.body.style.overflow = 'auto';
        activePanel = null;
    }
    
    // 添加事件监听器
    function setupEventListeners() {
        if (searchBar && !searchBar.querySelector('.search-clear-btn')) {
            const clearBtn = document.createElement('button');
            clearBtn.type = 'button';
            clearBtn.className = 'search-clear-btn';
            clearBtn.setAttribute('aria-label', '清除搜索');
            clearBtn.innerHTML = '<i class="fas fa-times"></i>';
            searchBar.appendChild(clearBtn);
            clearBtn.addEventListener('click', function() {
                clearSearch({ focus: true });
            });
        }

        // 搜索功能
        searchBtn.addEventListener('click', function() {
            performSearch({ scroll: true });
        });
        searchInput.addEventListener('keydown', function(e) {
            if (e.key === 'Enter') {
                e.preventDefault();
                performSearch({ scroll: true });
            }
            if (e.key === 'Escape') {
                clearSearch({ focus: false });
                if (searchSuggestions) searchSuggestions.classList.remove('active');
            }
        });

        searchInput.addEventListener('input', function() {
            const value = searchInput.value.trim();
            if (!value) {
                clearSearch({ focus: false, silent: true });
                if (searchSuggestions) searchSuggestions.classList.remove('active');
                return;
            }
            updateSearchSuggestions(value);
        });

        document.addEventListener('click', function(e) {
            if (!searchBar || !searchSuggestions) return;
            if (!searchBar.contains(e.target)) {
                searchSuggestions.classList.remove('active');
            }
        });

        if (bookModalClose) {
            bookModalClose.addEventListener('click', closeBookModal);
        }

        if (bookModal) {
            bookModal.addEventListener('click', function(e) {
                if (e.target === bookModal) closeBookModal();
            });
        }

        document.addEventListener('keydown', function(e) {
            if (e.key === 'Escape' && bookModal && bookModal.classList.contains('active')) {
                closeBookModal();
            }
        });
        
        // 移动端菜单切换
        menuToggle.addEventListener('click', function() {
            navLinks.classList.toggle('active');
        });
        
        // 图书过滤
        filterButtons.forEach(btn => {
            btn.addEventListener('click', function() {
                filterButtons.forEach(b => b.classList.remove('active'));
                this.classList.add('active');
                currentFilter = this.dataset.filter;
                if (currentSearchQuery) {
                    performSearch({ silent: true, scroll: false });
                } else {
                    renderBooks(books, { applyFilter: true, highlightQuery: '' });
                    renderSearchStatus('', 0);
                }
            });
        });
        
        // 刷新推荐
        refreshRecommendationsBtn.addEventListener('click', function() {
            this.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 刷新中...';
            this.disabled = true;
            
            // 模拟API请求延迟
            setTimeout(() => {
                // 在实际应用中，这里会从服务器获取新的推荐
                this.innerHTML = '<i class="fas fa-sync-alt"></i> 刷新推荐';
                this.disabled = false;
                
                // 显示成功消息
                showNotification('推荐已更新', 'success');
            }, 1500);
        });
        
        // 购物车功能
        cartIcon.addEventListener('click', function() {
            if (isGuestUser()) {
                showNotification('游客无法访问购物车，请登录后使用此功能', 'info');
                return;
            }
            openCart();
        });
        closeCartBtn.addEventListener('click', closeActivePanel);
        cartOverlay.addEventListener('click', closeActivePanel);

        // 收藏/历史面板
        if (favoritesLink) {
            favoritesLink.addEventListener('click', function(e) {
                e.preventDefault();
                if (isGuestUser()) {
                    showNotification('游客无法查看收藏，请登录后使用', 'info');
                    return;
                }
                openPanel('favorites');
            });
        }
        if (historyLink) {
            historyLink.addEventListener('click', function(e) {
                e.preventDefault();
                if (isGuestUser()) {
                    showNotification('游客无法查看历史，请登录后使用', 'info');
                    return;
                }
                openPanel('history');
            });
        }
        if (closeFavoritesBtn) closeFavoritesBtn.addEventListener('click', closeActivePanel);
        if (closeHistoryBtn) closeHistoryBtn.addEventListener('click', closeActivePanel);

        if (clearFavoritesBtn) {
            clearFavoritesBtn.addEventListener('click', function() {
                if (isGuestUser()) {
                    showNotification('游客无法操作收藏，请登录后使用', 'info');
                    return;
                }
                if (favorites.length === 0) return;
                if (confirm('确定要清空收藏吗？')) {
                    favorites = [];
                    saveFavoritesForCurrentUser();
                    if (supabaseClient) {
                        getUserId().then(uid => {
                            if (!uid) return;
                            supabaseClient
                                .from('favorites')
                                .delete()
                                .eq('user_id', uid)
                                .then(({ error }) => { if (error) console.error('clear favorites cloud error', error); });
                        });
                    }
                    renderFavoritesPanel();
                    updateFavoriteButtons();
                    showNotification('收藏已清空', 'info');
                }
            });
        }
        if (clearHistoryBtn) {
            clearHistoryBtn.addEventListener('click', function() {
                if (isGuestUser()) {
                    showNotification('游客无法操作历史，请登录后使用', 'info');
                    return;
                }
                if (history.length === 0) return;
                if (confirm('确定要清空浏览历史吗？')) {
                    history = [];
                    saveHistoryForCurrentUser();
                    if (supabaseClient) {
                        getUserId().then(uid => {
                            if (!uid) return;
                            supabaseClient
                                .from('history')
                                .delete()
                                .eq('user_id', uid)
                                .then(({ error }) => { if (error) console.error('clear history cloud error', error); });
                        });
                    }
                    renderHistoryPanel();
                    showNotification('浏览历史已清空', 'info');
                }
            });
        }
        
        // 清空购物车
        clearCartBtn.addEventListener('click', function() {
            if (isGuestUser()) {
                showNotification('游客无法操作购物车，请登录后使用', 'info');
                return;
            }

            if (cart.length === 0) return;
            
            if (confirm('确定要清空购物车吗？')) {
                cart = [];
                persistCart();
                renderCart();
                updateCartCount();
                calculateTotal();
                showNotification('购物车已清空', 'info');
            }
        });
        
        // 导航链接点击
        document.querySelectorAll('.nav-link').forEach(link => {
            link.addEventListener('click', function(e) {
                if (this.getAttribute('href') === '#cart') {
                    e.preventDefault();
                    if (isGuestUser()) {
                        showNotification('游客无法访问购物车，请登录后使用此功能', 'info');
                        return;
                    }
                    openCart();
                    return;
                }
                
                // 更新活动链接
                document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
                this.classList.add('active');
                
                // 移动端关闭菜单
                if (window.innerWidth <= 768) {
                    navLinks.classList.remove('active');
                }
            });
        });

        // 退出登录：清除本地用户信息并跳转到主页
        const logoutBtn = document.getElementById('logout-btn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', function(e) {
                // allow default navigation if JS is disabled; still perform cleanup
                try { localStorage.removeItem('user'); } catch (err) { /* ignore */ }
                try { sessionStorage.removeItem('loggedIn'); sessionStorage.removeItem('username'); sessionStorage.removeItem('userType'); } catch (err) { /* ignore */ }
                // if Supabase client exists, sign out the user there as well
                (async () => {
                    try {
                        if (typeof supabase !== 'undefined' && supabase) {
                            const sup = supabase.createClient && supabase.createClient.length ? supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null;
                            if (sup && sup.auth && sup.auth.signOut) {
                                await sup.auth.signOut();
                            }
                        }
                    } catch (err) {
                        console.error('Error signing out from Supabase:', err);
                    }
                })();

                showNotification('已退出登录，正在返回首页...', 'info');
                // 强制替换到 index.html，避免 file:// 环境出现 HEAD 探测问题或历史回退
                setTimeout(() => { window.location.replace('./index.html'); }, 250);
            });
        }
    }
    
    // 搜索功能
    function performSearch(options = {}) {
        const { silent = false, scroll = false } = options;
        const rawQuery = searchInput.value.trim();
        const baseBooks = currentFilter === 'all' ? books : books.filter(book => book.category === currentFilter);

        if (searchSuggestions) searchSuggestions.classList.remove('active');

        if (!rawQuery) {
            currentSearchQuery = '';
            lastSearchResults = [];
            renderBooks(baseBooks, { applyFilter: false, highlightQuery: '' });
            renderSearchStatus('', 0);
            return;
        }

        currentSearchQuery = rawQuery;
        const scored = baseBooks
            .map(book => {
                const result = scoreBookByQuery(book, rawQuery);
                return { book, score: result.score, matched: result.matched };
            })
            .filter(item => item.matched)
            .sort((a, b) => {
                if (b.score !== a.score) return b.score - a.score;
                return (b.book.rating || 0) - (a.book.rating || 0);
            })
            .map(item => item.book);

        lastSearchResults = scored;
        renderBooks(scored, { applyFilter: false, highlightQuery: rawQuery });
        renderSearchStatus(rawQuery, scored.length, baseBooks.length);

        if (!silent) {
            showNotification(`找到 ${scored.length} 本相关图书`, scored.length ? 'info' : 'info');
        }

        if (scroll) {
            const booksSection = document.getElementById('books');
            if (booksSection) booksSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    }

    function clearSearch(options = {}) {
        const { focus = false, silent = false } = options;
        searchInput.value = '';
        currentSearchQuery = '';
        lastSearchResults = [];
        const baseBooks = currentFilter === 'all' ? books : books.filter(book => book.category === currentFilter);
        renderBooks(baseBooks, { applyFilter: false, highlightQuery: '' });
        renderSearchStatus('', 0);
        if (searchSuggestions) searchSuggestions.classList.remove('active');
        if (!silent) showNotification('已清除搜索条件', 'info');
        if (focus) searchInput.focus();
    }
    
    // 添加到购物车
    function addToCart(bookId) {
        if (isGuestUser()) {
            showNotification('游客无法使用购物车，请登录后操作', 'info');
            return;
        }
        const book = books.find(b => b.id === bookId);
        if (!book) return;
        
        // 检查是否已在购物车中
        const existingItem = cart.find(item => item.bookId === bookId);
        
        if (existingItem) {
            existingItem.quantity += 1;
        } else {
            cart.push({
                id: cart.length > 0 ? Math.max(...cart.map(item => item.id)) + 1 : 1,
                bookId,
                quantity: 1
            });
        }

        persistCart();
        
        renderCart();
        updateCartCount();
        calculateTotal();
        showNotification(`"${book.title.substring(0, 15)}..." 已添加到购物车`, 'success');
        
        // 自动打开购物车
        openCart();
    }
    
    // 更新购物车商品数量
    function updateQuantity(itemId, change) {
        if (isGuestUser()) {
            showNotification('游客无法使用购物车，请登录后操作', 'info');
            return;
        }
        const item = cart.find(i => i.id === itemId);
        if (!item) return;
        
        item.quantity += change;
        
        if (item.quantity <= 0) {
            removeFromCart(itemId);
            return;
        }
        
        renderCart();
        calculateTotal();
        updateCartCount();
        persistCart();
    }
    
    // 从购物车移除商品
    function removeFromCart(itemId) {
        if (isGuestUser()) {
            showNotification('游客无法使用购物车，请登录后操作', 'info');
            return;
        }
        const itemIndex = cart.findIndex(i => i.id === itemId);
        if (itemIndex === -1) return;
        
        const book = books.find(b => b.id === cart[itemIndex].bookId);
        cart.splice(itemIndex, 1);
        
        renderCart();
        calculateTotal();
        updateCartCount();
        persistCart();
        
        if (book) {
            showNotification(`"${book.title.substring(0, 15)}..." 已从购物车移除`, 'info');
        }
    }
    
    // 更新购物车数量显示
    function updateCartCount() {
        const totalItems = cart.reduce((total, item) => total + item.quantity, 0);
        cartCount.textContent = totalItems;
        cartCount.style.display = totalItems > 0 ? 'flex' : 'none';
    }
    
    // 计算购物车总价
    function calculateTotal() {
        const total = cart.reduce((sum, item) => {
            const book = books.find(b => b.id === item.bookId);
            return sum + (book ? book.price * item.quantity : 0);
        }, 0);
        
        totalPriceElement.textContent = `¥ ${total.toFixed(2)}`;
    }
    
    // 打开购物车
    function openCart() {
        openPanel('cart');
    }
    
    // 关闭购物车
    function closeCart() {
        closeActivePanel();
    }
    
    // 显示通知
    function showNotification(message, type) {
        // 移除现有通知
        const existingNotification = document.querySelector('.notification');
        if (existingNotification) {
            existingNotification.remove();
        }
        
        // 创建新通知
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.innerHTML = `
            <span>${message}</span>
            <button class="close-notification"><i class="fas fa-times"></i></button>
        `;
        
        document.body.appendChild(notification);
        
        // 显示通知
        setTimeout(() => {
            notification.classList.add('show');
        }, 10);
        
        // 自动隐藏通知
        setTimeout(() => {
            notification.classList.remove('show');
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.remove();
                }
            }, 300);
        }, 3000);
        
        // 关闭按钮
        notification.querySelector('.close-notification').addEventListener('click', function() {
            notification.classList.remove('show');
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.remove();
                }
            }, 300);
        });
    }
    
    // 获取分类名称
    function getCategoryName(category) {
        const names = {
            'all': '全部',
            'fiction': '小说文学',
            'nonfiction': '非虚构',
            'academic': '学术',
            'children': '儿童读物'
        };
        
        return names[category] || category;
    }
    
    // 添加通知样式
    const notificationStyle = document.createElement('style');
    notificationStyle.textContent = `
        .notification {
            position: fixed;
            top: 20px;
            right: 20px;
            background: white;
            color: var(--text-color);
            padding: 15px 20px;
            border-radius: var(--border-radius);
            box-shadow: var(--shadow-hover);
            display: flex;
            align-items: center;
            justify-content: space-between;
            z-index: 2000;
            transform: translateX(120%);
            transition: transform 0.3s ease;
            min-width: 300px;
            max-width: 400px;
        }
        
        .notification.show {
            transform: translateX(0);
        }
        
        .notification-success {
            border-left: 4px solid #28a745;
        }
        
        .notification-info {
            border-left: 4px solid #17a2b8;
        }
        
        .close-notification {
            background: none;
            border: none;
            color: var(--text-light);
            cursor: pointer;
            margin-left: 15px;
            font-size: 14px;
        }
        
        @media (max-width: 480px) {
            .notification {
                min-width: auto;
                width: calc(100% - 40px);
            }
        }
    `;
    document.head.appendChild(notificationStyle);
    
    // 先尝试从 Supabase 加载数据，再初始化页面
    await loadDataFromSupabase();
    await initPage();
});

// 根据是否为游客设置或清除UI禁用样式/属性
function applyGuestUIRestrictions() {
    try {
        const userType = sessionStorage.getItem('userType');
        const guest = (userType === 'guest') || (localStorage.getItem('user') === 'guest') || !userType;

        document.querySelectorAll('.add-to-cart').forEach(btn => {
            if (guest) {
                btn.classList.add('disabled');
                btn.setAttribute('disabled', 'disabled');
                btn.title = '游客无法使用购物车，请登录';
            } else {
                btn.classList.remove('disabled');
                btn.removeAttribute('disabled');
                btn.removeAttribute('title');
            }
        });

        const cartIconEl = document.querySelector('.cart-icon');
        if (cartIconEl) {
            if (guest) {
                cartIconEl.classList.add('disabled');
                cartIconEl.setAttribute('title', '游客无法访问购物车');
            } else {
                cartIconEl.classList.remove('disabled');
                cartIconEl.removeAttribute('title');
            }
        }

        const favoritesLinkEl = document.getElementById('favorites-link');
        const historyLinkEl = document.getElementById('history-link');
        if (favoritesLinkEl) {
            if (guest) favoritesLinkEl.setAttribute('title', '游客无法查看收藏');
            else favoritesLinkEl.removeAttribute('title');
        }
        if (historyLinkEl) {
            if (guest) historyLinkEl.setAttribute('title', '游客无法查看历史');
            else historyLinkEl.removeAttribute('title');
        }

        // 如果页面存在收藏按钮，统一禁用
        document.querySelectorAll('.favorite-btn').forEach(fav => {
            if (guest) {
                fav.classList.add('disabled');
                fav.setAttribute('disabled', 'disabled');
                fav.title = '游客无法收藏，请登录';
            } else {
                fav.classList.remove('disabled');
                fav.removeAttribute('disabled');
                fav.removeAttribute('title');
            }
        });
    } catch (e) {
        // 忽略错误，保持页面可用
        console.error('applyGuestUIRestrictions error', e);
    }
}
