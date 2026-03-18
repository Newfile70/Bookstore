// script.js - 懒得起名小书铺交互脚本

document.addEventListener('DOMContentLoaded', async function() {
    let currentPage = 1;
    const pageSize = 12;
    const CHECKOUT_PAYLOAD_KEY = 'bookstore_checkout_payload_v1';
    const CART_STORAGE_PREFIX = 'bookstore_cart_v1';
    const HISTORY_STORAGE_PREFIX = 'bookstore_history_v1';
    const BOOKS_CACHE_KEY = 'bookstore_books_cache_v2';
    const ORDER_AUTO_RECEIVE_MS = 7 * 24 * 60 * 60 * 1000;
    const ORDER_STATUS_LABELS = {
        pending: '待处理',
        hold: '暂缓',
        shipped: '已发货',
        arrived: '已到货',
        received: '已收货',
        cancelled: '已取消'
    };
    // Supabase configuration (替换为你提供的 URL 与 anon key)
    const SUPABASE_URL = 'https://cxsomlfxlpnqnqramoyf.supabase.co';
    const SUPABASE_ANON_KEY = 'sb_publishable_iCCcnej8rT1qLIXHpsH9HA_B6LeiYFe';
    const supabaseClient = (typeof supabase !== 'undefined')
        ? supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
        : null;

    // 数据容器（将由 Supabase 填充）
    let books = [];
    let recommendations = [];
    let userOrders = [];
    let currentOrderFilter = 'all';
    let browsingHistory = [];
    let detailGalleryAutoplayTimer = null;
    const DETAIL_GALLERY_INTERVAL_MS = 2000;
    const favoriteBookIds = new Set();
    const cartItems = [];

    function stopDetailGalleryAutoplay() {
        if (!detailGalleryAutoplayTimer) return;
        clearInterval(detailGalleryAutoplayTimer);
        detailGalleryAutoplayTimer = null;
    }

    function normalizeOrderStatus(status) {
        const raw = String(status || '').trim().toLowerCase();
        if (!raw) return 'pending';
        if (['pending', '待处理', '待发货', 'new'].includes(raw)) return 'pending';
        if (['hold', '暂缓', 'on_hold', 'on-hold'].includes(raw)) return 'hold';
        if (['shipped', '已发货', 'completed', 'done'].includes(raw)) return 'shipped';
        if (['arrived', '已到货', 'delivered'].includes(raw)) return 'arrived';
        if (['received', '已收货', 'signed'].includes(raw)) return 'received';
        if (['cancelled', 'canceled', '已取消', 'cancel'].includes(raw)) return 'cancelled';
        return raw;
    }

    function formatOrderDate(value) {
        return value ? new Date(value).toLocaleString('zh-CN', { hour12: false }) : '-';
    }

    function safeParseJsonValue(value, fallback) {
        try {
            const parsed = JSON.parse(value);
            return parsed ?? fallback;
        } catch {
            return fallback;
        }
    }

    function toBooleanFlag(value) {
        if (typeof value === 'boolean') return value;
        const normalized = String(value ?? '').trim().toLowerCase();
        return ['true', '1', 'yes', 'y', 'on'].includes(normalized);
    }

    function normalizeStorefrontBook(raw, index = 0) {
        const photos = normalizePhotoList(raw?.photos ?? raw?.photo_urls ?? raw?.images ?? raw?.image_urls);
        return {
            photos,
            id: raw?.id ?? raw?._id ?? index + 1,
            title: raw?.title ?? raw?.name ?? '',
            author: raw?.author ?? raw?.writer ?? '',
            category: raw?.category ?? raw?.cat ?? 'all',
            price: parseFloat(raw?.price) || 0,
            rating: parseFloat(raw?.rating) || 0,
            description: raw?.description ?? raw?.desc ?? '',
            tags: normalizeTextList(raw?.tags),
            publisher: raw?.publisher ?? '',
            isbn: raw?.isbn ?? '',
            disabled: toBooleanFlag(raw?.disabled),
            color: raw?.color ?? '#b09d7b',
            coverUrl: sanitizeImageUrl(raw?.cover_url ?? raw?.coverUrl ?? photos[0] ?? ''),
            summaryHtml: raw?.summary_html ?? raw?.summaryHtml ?? ''
        };
    }

    function hasBookRating(book) {
        const rating = Number(book?.rating);
        return Number.isFinite(rating) && rating > 0;
    }

    function formatBookRating(book, fallback = '暂无评分') {
        return hasBookRating(book) ? Number(book.rating).toFixed(1) : fallback;
    }

    function loadCachedBooks() {
        const cached = safeParseJsonValue(localStorage.getItem(BOOKS_CACHE_KEY), []);
        return Array.isArray(cached) ? cached.map((book, index) => normalizeStorefrontBook(book, index)) : [];
    }

    function isBookVisible(book) {
        return Boolean(book) && !toBooleanFlag(book.disabled);
    }

    function getVisibleBooks(source = books) {
        return (Array.isArray(source) ? source : []).filter(isBookVisible);
    }

    function findBookById(bookId, options = {}) {
        const includeDisabled = Boolean(options.includeDisabled);
        const book = books.find(item => Number(item.id) === Number(bookId));
        if (!book) return null;
        if (!includeDisabled && !isBookVisible(book)) return null;
        return book;
    }

    function syncCartWithVisibleBooks() {
        const nextCart = cart.filter(item => findBookById(item.bookId));
        if (nextCart.length === cart.length) return false;
        cart = nextCart;
        persistCart();
        return true;
    }

    function syncHistoryWithVisibleBooks() {
        const nextHistory = browsingHistory.filter(item => findBookById(item.id));
        if (nextHistory.length === browsingHistory.length) return false;
        browsingHistory = nextHistory;
        persistHistory();
        return true;
    }

    function normalizeUserOrder(raw, index) {
        const items = Array.isArray(raw?.items)
            ? raw.items
            : safeParseJsonValue(raw?.items, []);
        return {
            id: raw?.id ?? `order-${index}`,
            poNumber: raw?.po_number ?? raw?.poNumber ?? `PO-${raw?.id ?? index}`,
            customerName: (raw?.customer_name ?? raw?.customerName ?? String(sessionStorage.getItem('loginUsername') || sessionStorage.getItem('username') || '').trim()) || '用户',
            purchaseDate: raw?.purchase_date ?? raw?.purchaseDate ?? raw?.created_at ?? raw?.createdAt ?? '',
            totalAmount: Number(raw?.total_amount ?? raw?.totalAmount ?? 0) || 0,
            shippingAddress: raw?.shipping_address ?? raw?.shippingAddress ?? '-',
            status: normalizeOrderStatus(raw?.status),
            items: Array.isArray(items) ? items : [],
            shipmentDate: raw?.shipment_date ?? raw?.shipmentDate ?? '',
            arrivedDate: raw?.arrived_date ?? raw?.arrivedDate ?? '',
            receivedDate: raw?.received_date ?? raw?.receivedDate ?? '',
            cancelDate: raw?.cancel_date ?? raw?.cancelDate ?? '',
            holdDate: raw?.hold_date ?? raw?.holdDate ?? '',
            userId: raw?.user_id ?? raw?.userId ?? null
        };
    }

    function getOrderRemainingText(order) {
        if (normalizeOrderStatus(order?.status) !== 'arrived' || !order?.arrivedDate) return '';
        const remaining = ORDER_AUTO_RECEIVE_MS - (Date.now() - new Date(order.arrivedDate).getTime());
        if (remaining <= 0) return '未确认收货，系统即将自动收货';
        const days = Math.ceil(remaining / (24 * 60 * 60 * 1000));
        return `未确认收货，还剩 ${days} 天自动收货`;
    }

    function shouldAutoReceiveOrder(order) {
        return normalizeOrderStatus(order?.status) === 'arrived'
            && order?.arrivedDate
            && (Date.now() - new Date(order.arrivedDate).getTime()) >= ORDER_AUTO_RECEIVE_MS;
    }

    function getActiveCartStorageKey() {
        const userType = sessionStorage.getItem('userType') || 'anon';
        const loginUsername = String(sessionStorage.getItem('loginUsername') || sessionStorage.getItem('username') || '').trim();
        const normalizedUser = loginUsername ? loginUsername.toLowerCase() : 'visitor';
        return `${CART_STORAGE_PREFIX}_${userType}_${normalizedUser}`;
    }

    function getActiveHistoryStorageKey() {
        const userType = sessionStorage.getItem('userType') || 'anon';
        const loginUsername = String(sessionStorage.getItem('loginUsername') || sessionStorage.getItem('username') || '').trim();
        const normalizedUser = loginUsername ? loginUsername.toLowerCase() : 'visitor';
        return `${HISTORY_STORAGE_PREFIX}_${userType}_${normalizedUser}`;
    }

    function loadCartFromStorage() {
        try {
            const parsed = JSON.parse(localStorage.getItem(getActiveCartStorageKey()) || 'null');
            if (!Array.isArray(parsed)) return [...cartItems];
            return parsed
                .map(item => ({
                    id: Number(item?.id),
                    bookId: Number(item?.bookId),
                    quantity: Number(item?.quantity)
                }))
                .filter(item => Number.isFinite(item.id) && Number.isFinite(item.bookId) && Number.isFinite(item.quantity) && item.quantity > 0);
        } catch (e) {
            return [...cartItems];
        }
    }

    function persistCart() {
        try {
            localStorage.setItem(getActiveCartStorageKey(), JSON.stringify(cart));
        } catch (e) {
            console.warn('Persist cart failed:', e);
        }
    }

    function loadHistoryFromStorage() {
        try {
            const parsed = JSON.parse(localStorage.getItem(getActiveHistoryStorageKey()) || '[]');
            if (!Array.isArray(parsed)) return [];
            return parsed.filter(Boolean).map(item => ({
                id: Number(item?.id),
                title: String(item?.title || '未命名图书'),
                author: String(item?.author || '未知作者'),
                viewedAt: String(item?.viewedAt || ''),
                color: String(item?.color || '#b09d7b')
            })).filter(item => Number.isFinite(item.id));
        } catch (e) {
            return [];
        }
    }

    function persistHistory() {
        try {
            localStorage.setItem(getActiveHistoryStorageKey(), JSON.stringify(browsingHistory));
        } catch (e) {
            console.warn('Persist history failed:', e);
        }
    }

    function recordBrowsingHistory(book) {
        if (!book || !Number.isFinite(Number(book.id))) return;
        const normalizedId = Number(book.id);
        browsingHistory = browsingHistory.filter(item => Number(item.id) !== normalizedId);
        browsingHistory.unshift({
            id: normalizedId,
            title: String(book.title || '未命名图书'),
            author: String(book.author || '未知作者'),
            viewedAt: new Date().toISOString(),
            color: String(book.color || '#b09d7b')
        });
        browsingHistory = browsingHistory.slice(0, 30);
        persistHistory();
        renderHistorySidebar();
    }

    async function getCurrentSupabaseUserId() {
        if (!supabaseClient || !supabaseClient.auth || !supabaseClient.auth.getUser) return null;
        try {
            const { data, error } = await supabaseClient.auth.getUser();
            if (error) {
                console.warn('Get Supabase user failed:', error);
                return null;
            }
            return data?.user?.id || null;
        } catch (e) {
            console.warn('Unexpected getUser error:', e);
            return null;
        }
    }

    async function getCurrentSupabaseUser() {
        if (!supabaseClient || !supabaseClient.auth || !supabaseClient.auth.getUser) return null;
        try {
            const { data, error } = await supabaseClient.auth.getUser();
            if (error) return null;
            return data?.user || null;
        } catch {
            return null;
        }
    }

    function toLowerTrim(value) {
        return String(value || '').trim().toLowerCase();
    }

    async function collectCurrentUserNameAliases(authUser) {
        const aliases = new Set();
        const loginUsername = String(sessionStorage.getItem('loginUsername') || '').trim();
        const sessionUsername = String(sessionStorage.getItem('username') || '').trim();

        if (loginUsername) aliases.add(toLowerTrim(loginUsername));
        if (sessionUsername) aliases.add(toLowerTrim(sessionUsername));

        if (authUser?.email) {
            const lowerEmail = toLowerTrim(authUser.email);
            aliases.add(lowerEmail);
            aliases.add(lowerEmail.split('@')[0]);
        }

        if (supabaseClient) {
            try {
                let profile = null;
                if (authUser?.id) {
                    const { data } = await supabaseClient
                        .from('users')
                        .select('username,email')
                        .eq('id', authUser.id)
                        .maybeSingle();
                    profile = data || null;
                }

                if (!profile && loginUsername) {
                    const { data } = await supabaseClient
                        .from('users')
                        .select('username,email')
                        .eq('username', loginUsername)
                        .maybeSingle();
                    profile = data || null;
                }

                if (!profile && authUser?.email) {
                    const { data } = await supabaseClient
                        .from('users')
                        .select('username,email')
                        .eq('email', authUser.email)
                        .maybeSingle();
                    profile = data || null;
                }

                if (profile?.username) {
                    const canonical = String(profile.username).trim();
                    if (canonical) {
                        aliases.add(toLowerTrim(canonical));
                        sessionStorage.setItem('loginUsername', canonical);
                        sessionStorage.setItem('username', canonical);
                    }
                }

                if (profile?.email) {
                    const lowerProfileEmail = toLowerTrim(profile.email);
                    aliases.add(lowerProfileEmail);
                    aliases.add(lowerProfileEmail.split('@')[0]);
                }
            } catch (e) {
                console.warn('Collect user aliases failed:', e);
            }
        }

        aliases.delete('');
        return aliases;
    }

    function isFavoriteBook(bookId) {
        return favoriteBookIds.has(String(bookId));
    }

    async function loadFavoritesFromSupabase() {
        favoriteBookIds.clear();
        const userId = await getCurrentSupabaseUserId();
        if (!supabaseClient || !userId) return;

        try {
            const { data, error } = await supabaseClient
                .from('favorites')
                .select('book_id')
                .eq('user_id', userId);

            if (error) {
                console.warn('Load favorites failed:', error);
                return;
            }

            (data || []).forEach(row => {
                if (row && row.book_id !== undefined && row.book_id !== null) {
                    favoriteBookIds.add(String(row.book_id));
                }
            });
        } catch (e) {
            console.warn('Unexpected load favorites error:', e);
        }
    }

    function updateFavoriteButtonVisual(button, active) {
        if (!button) return;
        button.classList.toggle('active', active);
        const icon = button.querySelector('i');
        if (icon) {
            icon.className = `${active ? 'fas' : 'far'} fa-heart`;
        }
    }

    function syncFavoriteButtonsForBook(bookId) {
        const active = isFavoriteBook(bookId);
        document.querySelectorAll(`.favorite-btn[data-id="${bookId}"]`).forEach(btn => {
            updateFavoriteButtonVisual(btn, active);
        });
    }

    async function toggleFavorite(bookId) {
        if (isGuestUser()) {
            showNotification('游客无法收藏，请登录后操作', 'info');
            return;
        }

        const userId = await getCurrentSupabaseUserId();
        if (!userId) {
            showNotification('收藏需要 Supabase 登录会话，请使用邮箱账号登录后重试', 'info');
            return;
        }

        if (!supabaseClient) {
            showNotification('收藏失败：未连接到数据库', 'info');
            return;
        }

        const key = String(bookId);
        const targetBook = books.find(b => String(b.id) === key);
        const willFavorite = !favoriteBookIds.has(key);

        try {
            if (willFavorite) {
                const { error } = await supabaseClient
                    .from('favorites')
                    .upsert([{ user_id: userId, book_id: Number(bookId) || bookId }], { onConflict: 'user_id,book_id' });
                if (error) throw error;
                favoriteBookIds.add(key);
                syncFavoriteButtonsForBook(bookId);
                renderFavoritesSidebar();
                showNotification(`已收藏《${(targetBook?.title || '该图书').substring(0, 18)}》`, 'success');
            } else {
                const { error } = await supabaseClient
                    .from('favorites')
                    .delete()
                    .eq('user_id', userId)
                    .eq('book_id', Number(bookId) || bookId);
                if (error) throw error;
                favoriteBookIds.delete(key);
                syncFavoriteButtonsForBook(bookId);
                renderFavoritesSidebar();
                showNotification(`已取消收藏《${(targetBook?.title || '该图书').substring(0, 18)}》`, 'info');
            }
        } catch (e) {
            console.error('Toggle favorite failed:', e);
            const msg = String(e?.message || '未知错误');
            if (msg.includes('row-level security') || msg.includes('permission denied')) {
                showNotification('收藏失败：数据库权限策略阻止了写入', 'info');
            } else {
                showNotification(`收藏失败：${msg}`, 'info');
            }
        }
    }

    function bindFavoriteButtons(scope) {
        if (!scope) return;
        scope.querySelectorAll('.favorite-btn').forEach(btn => {
            if (btn.dataset.favoriteBound === '1') return;
            btn.dataset.favoriteBound = '1';
            btn.addEventListener('click', function(e) {
                e.preventDefault();
                e.stopPropagation();
                toggleFavorite(this.dataset.id);
            });
        });
    }

    // 从 Supabase 加载数据，如果失败则保留空数组
    async function loadDataFromSupabase() {
        const cachedBooks = loadCachedBooks();
        const cachedBookMap = new Map(cachedBooks.map(book => [String(book.id), book]));

        if (!supabaseClient) {
            books = cachedBooks;
            recommendations = getVisibleBooks(books)
                .slice()
                .sort((a, b) => (b.rating || 0) - (a.rating || 0))
                .slice(0, 4)
                .map((b, i) => ({
                    id: i + 1,
                    bookId: b.id,
                    reason: '基于热门与评分为您推荐'
                }));
            console.warn('Supabase client not found; using local cached books.');
            return;
        }

        try {
            const { data: booksData, error: booksError } = await supabaseClient.from('books').select('*');
            if (booksError) {
                console.error('Error loading books from Supabase:', booksError);
            } else if (booksData) {
                books = booksData.map((book, index) => {
                    const normalizedBook = normalizeStorefrontBook(book, index);
                    const cachedBook = cachedBookMap.get(String(normalizedBook.id));
                    return normalizeStorefrontBook({
                        ...cachedBook,
                        ...normalizedBook,
                        disabled: typeof book?.disabled !== 'undefined' ? book.disabled : cachedBook?.disabled ?? normalizedBook.disabled,
                        tags: normalizedBook.tags?.length ? normalizedBook.tags : cachedBook?.tags,
                        publisher: normalizedBook.publisher || cachedBook?.publisher,
                        isbn: normalizedBook.isbn || cachedBook?.isbn,
                        summary_html: normalizedBook.summaryHtml || cachedBook?.summaryHtml,
                        photos: normalizedBook.photos?.length ? normalizedBook.photos : cachedBook?.photos,
                        cover_url: normalizedBook.coverUrl || cachedBook?.coverUrl
                    }, index);
                });
            }

            if (!books.length && cachedBooks.length) {
                books = cachedBooks;
            }

            // 不再请求 `recommendations` 表（避免 404）；直接根据 books 派生推荐
            recommendations = getVisibleBooks(books).slice().sort((a, b) => (b.rating || 0) - (a.rating || 0)).slice(0, 4).map((b, i) => ({
                id: i + 1,
                bookId: b.id,
                reason: '基于热门与评分为您推荐'
            }));
        } catch (e) {
            console.error('Unexpected error loading from Supabase:', e);
        }
    }
    
    // DOM元素
    const booksGrid = document.querySelector('.books-grid');
    const recommendationsGrid = document.querySelector('.recommendations-grid');
    const cartItemsContainer = document.getElementById('cart-items-container');
    const cartCount = document.querySelector('.cart-count');
    const totalPriceElement = document.querySelector('.total-price');
    const searchInput = document.getElementById('search-input');
    const searchBtn = document.getElementById('search-btn');
    const menuToggle = document.getElementById('menu-toggle');
    const navLinks = document.querySelector('.nav-links');
    const filterButtons = document.querySelectorAll('.filter-btn');
    const refreshRecommendationsBtn = document.getElementById('refresh-recommendations');
    const cartIcon = document.querySelector('.cart-icon');
    const closeCartBtn = document.getElementById('close-cart');
    const cartSidebar = document.getElementById('cart');
    const favoritesSidebar = document.getElementById('favorites-sidebar');
    const favoritesItemsContainer = document.getElementById('favorites-items');
    const closeFavoritesBtn = document.getElementById('close-favorites');
    const favoritesCountElement = document.querySelector('.favorites-count');
    const ordersSidebar = document.getElementById('orders-sidebar');
    const ordersItemsContainer = document.getElementById('orders-items');
    const closeOrdersBtn = document.getElementById('close-orders');
    const ordersCountElement = document.querySelector('.orders-count');
    const historySidebar = document.getElementById('history-sidebar');
    const historyItemsContainer = document.getElementById('history-items');
    const closeHistoryBtn = document.getElementById('close-history');
    const clearHistoryBtn = document.getElementById('clear-history');
    const historyCountElement = document.querySelector('.history-count');
    const userModeBadge = document.getElementById('user-mode-badge');
    const cartOverlay = document.getElementById('cart-overlay');
    const clearCartBtn = document.getElementById('clear-cart');
    
    // 当前过滤器和购物车状态
    let currentFilter = 'all';
    let cart = loadCartFromStorage();
    const searchFilterState = {
        lastQuery: '',
        baseResults: [],
        mode: 'category-price',
        category: 'all',
        minPrice: '',
        maxPrice: '',
        selectedTags: []
    };
    
    // 用户状态检查（若使用游客登录，请在登录流程中设置 localStorage.setItem('user', 'guest')）
    function isGuestUser() {
        return detectGuestMode();
    }

    function updateUserModeBadge() {
        if (!userModeBadge) return;
        try {
            const loggedIn = sessionStorage.getItem('loggedIn') === 'true';
            const userType = sessionStorage.getItem('userType');
            const loginUsername = String(sessionStorage.getItem('loginUsername') || '').trim();
            const username = String(sessionStorage.getItem('username') || '').trim();

            if (!loggedIn) {
                userModeBadge.textContent = '未登录';
                return;
            }

            if (userType === 'guest') {
                userModeBadge.textContent = '游客';
                return;
            }

            const preferredName = loginUsername || username;
            const displayName = preferredName.includes('@') ? preferredName.split('@')[0] : preferredName;
            userModeBadge.textContent = displayName || '用户';
        } catch (e) {
            userModeBadge.textContent = '未登录';
        }
    }
    
    // 初始化页面
    async function initPage() {
        await loadFavoritesFromSupabase();
        await loadUserOrdersFromSupabase();
        browsingHistory = loadHistoryFromStorage();
        syncCartWithVisibleBooks();
        syncHistoryWithVisibleBooks();
        renderBooks(books);
        renderRecommendations();
        renderFavoritesSidebar();
        renderOrdersSidebar();
        renderHistorySidebar();
        renderCart();
        updateCartCount();
        calculateTotal();

        // 添加事件监听器
        setupEventListeners();

        // 根据当前用户状态应用游客UI限制（确保按钮在初始渲染后展示为禁用）
        applyGuestUIRestrictions();
        updateUserModeBadge();
        await handleOrderDeepLink();
    }

    async function handleOrderDeepLink() {
        const params = new URLSearchParams(window.location.search);
        const legacyOrderPo = String(params.get('order') || '').trim();
        const currentPo = String(params.get('po') || '').trim();
        const poNumber = currentPo || legacyOrderPo;
        const shouldOpenOrders = ['1', 'true', 'yes', 'y'].includes(String(params.get('openOrders') || '').toLowerCase()) || Boolean(poNumber);
        if (!shouldOpenOrders) return;

        if (isGuestUser()) {
            showNotification('游客无法查看订单，请登录后使用', 'info');
            return;
        }

        await loadUserOrdersFromSupabase();
        renderOrdersSidebar();
        openOrders();

        if (poNumber) {
            const targetOrder = userOrders.find(order => String(order.poNumber || '').trim() === poNumber);
            if (targetOrder) {
                highlightOrder(poNumber);
                openOrderDetail(targetOrder.id);
            } else {
                showNotification('订单已创建，请在订单列表中查看最新记录', 'info');
            }
        }

        params.delete('openOrders');
        params.delete('po');
        params.delete('order');
        const query = params.toString();
        window.history.replaceState(null, '', `${window.location.pathname}${query ? `?${query}` : ''}${window.location.hash || ''}`);
    }
    
    // 渲染图书列表
    function renderBooks(booksToRender) {
        if (!booksGrid) return;
        booksGrid.innerHTML = '';

        const visibleBooks = getVisibleBooks(booksToRender);
        const filteredBooks = currentFilter === 'all'
            ? visibleBooks
            : visibleBooks.filter(book => book.category === currentFilter);

        if (filteredBooks.length === 0) {
            booksGrid.innerHTML = '<div class="no-results"><p>未找到相关图书</p></div>';
            const oldPagination = document.querySelector('.pagination');
            if (oldPagination) oldPagination.innerHTML = '';
            return;
        }

        const totalPages = Math.max(1, Math.ceil(filteredBooks.length / pageSize));
        if (currentPage > totalPages) currentPage = 1;
        const startIndex = (currentPage - 1) * pageSize;
        const pageBooks = filteredBooks.slice(startIndex, startIndex + pageSize);

        pageBooks.forEach(book => {
            const bookCard = document.createElement('div');
            bookCard.className = 'book-card';
            bookCard.dataset.id = book.id;
            bookCard.dataset.category = book.category;
            const coverUrl = getBookBrowseCoverUrl(book);

            bookCard.innerHTML = `
                <div class="book-image" style="${getBookBrowseCoverStyle(book)}">
                    ${coverUrl ? '' : `<span style="color: white; font-weight: 500;">${escapeHtml((book.title || '').substring(0, 10))}${(book.title || '').length > 10 ? '...' : ''}</span>`}
                </div>
                <div class="book-content">
                    <div class="book-category">${escapeHtml(getCategoryName(book.category))}</div>
                    <h3 class="book-title">${escapeHtml(book.title || '未命名图书')}</h3>
                    <p class="book-author">${escapeHtml(book.author || '未知作者')}</p>
                    <p class="book-description">${escapeHtml(String(book.description || '').replace(/<[^>]+>/g, '').slice(0, 80) || '暂无简介')}</p>
                    <div class="book-footer">
                        <div class="book-price">¥ ${Number(book.price || 0).toFixed(2)}</div>
                        <div class="book-rating">
                            <i class="fas fa-star"></i>
                            <span>${formatBookRating(book)}</span>
                        </div>
                        <button class="favorite-btn ${isFavoriteBook(book.id) ? 'active' : ''} ${isGuestUser() ? 'disabled' : ''}" data-id="${book.id}" ${isGuestUser() ? 'disabled' : ''}>
                            <i class="${isFavoriteBook(book.id) ? 'fas' : 'far'} fa-heart"></i>
                        </button>
                        <button class="add-to-cart ${isGuestUser() ? 'disabled' : ''}" data-id="${book.id}" ${isGuestUser() ? 'disabled' : ''}>
                            <i class="fas fa-cart-plus"></i>
                        </button>
                    </div>
                </div>
            `;

            booksGrid.appendChild(bookCard);
        });

        let pagination = document.querySelector('.pagination');
        if (!pagination) {
            pagination = document.createElement('div');
            pagination.className = 'pagination';
            booksGrid.after(pagination);
        }
        pagination.innerHTML = '';
        if (totalPages > 1) {
            for (let i = 1; i <= totalPages; i++) {
                const btn = document.createElement('button');
                btn.type = 'button';
                btn.textContent = i;
                btn.className = (i === currentPage) ? 'active' : '';
                btn.addEventListener('click', () => {
                    currentPage = i;
                    renderBooks(booksToRender);
                });
                pagination.appendChild(btn);
            }
        }

        // 为添加到购物车按钮添加事件监听器（游客会被阻止并提示登录）
        document.querySelectorAll('.add-to-cart').forEach(btn => {
            btn.addEventListener('click', function(e) {
                e.stopPropagation();
                if (isGuestUser()) {
                    showNotification('游客无法使用购物车，请登录后操作', 'info');
                    return;
                }
                const bookId = Number(this.dataset.id);
                addToCart(bookId);
            });
        });

        bindFavoriteButtons(booksGrid);

        bindBookDetailTriggers(booksGrid);

        // 确保UI状态（disabled类/属性）与当前用户状态一致
        applyGuestUIRestrictions();
    }

    // 渲染推荐图书
    function renderRecommendations() {
        recommendationsGrid.innerHTML = '';
        
        recommendations.forEach(rec => {
            const book = findBookById(rec.bookId);
            if (!book) return;
            
            const recommendationCard = document.createElement('div');
            recommendationCard.className = 'recommendation-card';
            recommendationCard.dataset.id = book.id;
            
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
                        <span>${formatBookRating(book)}</span>
                    </div>
                    <button class="favorite-btn ${isFavoriteBook(book.id) ? 'active' : ''} ${isGuestUser() ? 'disabled' : ''}" data-id="${book.id}" ${isGuestUser() ? 'disabled' : ''}>
                        <i class="${isFavoriteBook(book.id) ? 'fas' : 'far'} fa-heart"></i>
                    </button>
                    <button class="add-to-cart ${isGuestUser() ? 'disabled' : ''}" data-id="${book.id}" ${isGuestUser() ? 'disabled' : ''}>
                        <i class="fas fa-cart-plus"></i>
                    </button>
                </div>
            `;
            
            recommendationsGrid.appendChild(recommendationCard);
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

        bindFavoriteButtons(recommendationsGrid);

        bindBookDetailTriggers(recommendationsGrid);

        // 确保UI状态（disabled类/属性）与当前用户状态一致
        applyGuestUIRestrictions();
    }
    
    // 渲染购物车
    function renderCart() {
        syncCartWithVisibleBooks();
        cartItemsContainer.innerHTML = '';
        
        if (cart.length === 0) {
            cartItemsContainer.innerHTML = '<div class="empty-cart"><p>购物车为空</p></div>';
            return;
        }
        
        cart.forEach(item => {
            const book = findBookById(item.bookId);
            if (!book) return;
            const coverUrl = getBookBrowseCoverUrl(book);
            
            const cartItem = document.createElement('div');
            cartItem.className = 'cart-item';
            cartItem.dataset.id = item.id;
            
            cartItem.innerHTML = `
                <div class="cart-item-image cart-open-detail" data-book-id="${book.id}" role="button" tabindex="0" aria-label="查看《${escapeHtml(book.title || '未命名图书')}》详情" style="${getBookBrowseCoverStyle(book)}">
                    ${coverUrl ? '' : `<span style="color: white; font-size: 12px; padding: 5px;">${escapeHtml((book.title || '图书').substring(0, 6))}...</span>`}
                </div>
                <div class="cart-item-details">
                    <h4 class="cart-item-title cart-open-detail" data-book-id="${book.id}" role="button" tabindex="0">${escapeHtml(book.title || '未命名图书')}</h4>
                    <p class="cart-item-author cart-open-detail" data-book-id="${book.id}" role="button" tabindex="0">${escapeHtml(book.author || '未知作者')}</p>
                    <div class="cart-item-meta cart-open-detail" data-book-id="${book.id}" role="button" tabindex="0" style="font-size:12px;color:var(--text-light);margin-bottom:8px;">点击查看详情</div>
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

        cartItemsContainer.querySelectorAll('.cart-open-detail').forEach(node => {
            node.addEventListener('click', function() {
                const bookId = Number(this.dataset.bookId);
                if (!bookId) return;
                openBookDetail(bookId);
            });
            node.addEventListener('keydown', function(e) {
                if (e.key !== 'Enter' && e.key !== ' ') return;
                e.preventDefault();
                const bookId = Number(this.dataset.bookId);
                if (!bookId) return;
                openBookDetail(bookId);
            });
        });
    }

    function renderFavoritesSidebar() {
        if (!favoritesItemsContainer) return;

        const favoriteBooks = getVisibleBooks(books).filter(book => isFavoriteBook(book.id));
        favoritesItemsContainer.innerHTML = '';

        if (favoritesCountElement) {
            favoritesCountElement.textContent = `${favoriteBooks.length} 本`;
        }

        if (!favoriteBooks.length) {
            favoritesItemsContainer.innerHTML = '<div class="empty-cart"><p>暂无收藏图书</p></div>';
            return;
        }

        favoriteBooks.forEach(book => {
            const item = document.createElement('div');
            item.className = 'cart-item';
            item.dataset.id = book.id;
            item.innerHTML = `
                <div class="cart-item-image" style="background-color: ${sanitizeColor(book.color)}">
                    <span style="color: white; font-size: 12px; padding: 5px;">${escapeHtml((book.title || '图书').substring(0, 6))}...</span>
                </div>
                <div class="cart-item-details">
                    <h4 class="cart-item-title">${escapeHtml(book.title || '未命名图书')}</h4>
                    <p class="cart-item-author">${escapeHtml(book.author || '未知作者')}</p>
                    <div class="cart-item-controls">
                        <div class="cart-item-price">¥ ${Number(book.price || 0).toFixed(2)}</div>
                        <button class="remove-item remove-favorite" data-id="${book.id}" title="取消收藏">
                            <i class="fas fa-heart-broken"></i>
                        </button>
                    </div>
                </div>
            `;
            favoritesItemsContainer.appendChild(item);
        });

        favoritesItemsContainer.querySelectorAll('.remove-favorite').forEach(btn => {
            btn.addEventListener('click', function() {
                toggleFavorite(this.dataset.id);
            });
        });
    }

    async function fetchOrdersFromSupabase() {
        if (!supabaseClient) return [];
        const orderFields = ['purchase_date', 'purchaseDate', 'created_at', 'createdAt'];

        for (const field of orderFields) {
            try {
                const { data, error } = await supabaseClient
                    .from('orders')
                    .select('*')
                    .order(field, { ascending: false });
                if (!error && Array.isArray(data)) return data;

                const message = String(error?.message || '');
                if (!message.includes('schema cache') && !message.includes('column')) {
                    console.warn('Load orders failed:', error);
                    break;
                }
            } catch (e) {
                console.warn('Unexpected load orders error:', e);
                break;
            }
        }

        try {
            const { data, error } = await supabaseClient.from('orders').select('*');
            if (!error && Array.isArray(data)) return data;
        } catch (e) {
            console.warn('Fallback load orders failed:', e);
        }

        return [];
    }

    function buildOrderUpdatePayloadCandidates(status) {
        const now = new Date().toISOString();
        const payloads = [];
        if (status === 'received') {
            payloads.push({ status, received_date: now });
            payloads.push({ status, receivedDate: now });
        }
        payloads.push({ status });
        return payloads;
    }

    async function syncOrderStatusToCloud(orderId, status) {
        if (!supabaseClient) return { ok: false, message: '未连接到数据库' };

        for (const payload of buildOrderUpdatePayloadCandidates(status)) {
            const { error } = await supabaseClient
                .from('orders')
                .update(payload)
                .eq('id', orderId);

            if (!error) return { ok: true };

            const message = String(error?.message || error?.details || '');
            if (!message.includes('schema cache') && !message.includes('column')) {
                return { ok: false, message: message || '未知错误' };
            }
        }

        return { ok: false, message: 'orders 表缺少收货字段或更新策略未放行' };
    }

    async function autoReceiveEligibleOrders(silent = true) {
        const eligibleOrders = userOrders.filter(shouldAutoReceiveOrder);
        if (!eligibleOrders.length) return;

        for (const order of eligibleOrders) {
            const result = await syncOrderStatusToCloud(order.id, 'received');
            if (result.ok) {
                order.status = 'received';
                order.receivedDate = new Date().toISOString();
            } else if (!silent) {
                showNotification(`自动收货同步失败：${result.message}`, 'info');
            }
        }
    }

    async function loadUserOrdersFromSupabase() {
        userOrders = [];
        if (isGuestUser()) return;

        const authUser = await getCurrentSupabaseUser();
        const userId = authUser?.id || null;
        const nameAliases = await collectCurrentUserNameAliases(authUser);
        const rows = await fetchOrdersFromSupabase();

        userOrders = rows
            .filter(row => {
                const rowUserId = String(row?.user_id ?? row?.userId ?? '').trim();
                const rowCustomerName = String(row?.customer_name ?? row?.customerName ?? '').trim().toLowerCase();
                if (userId && rowUserId && rowUserId === String(userId)) return true;
                if (rowCustomerName && nameAliases.has(rowCustomerName)) return true;
                return false;
            })
            .map(normalizeUserOrder)
            .sort((a, b) => new Date(b.purchaseDate || 0) - new Date(a.purchaseDate || 0));

        await autoReceiveEligibleOrders(true);
    }

    function getFilteredUserOrders(status = currentOrderFilter) {
        const normalized = String(status || 'all').trim().toLowerCase();
        if (normalized === 'all') return [...userOrders];
        return userOrders.filter(order => normalizeOrderStatus(order.status) === normalized);
    }

    function highlightOrder(poNumber) {
        const targetPo = String(poNumber || '').trim();
        if (!targetPo) return;
        let found = false;

        ordersItemsContainer?.querySelectorAll('.cart-item').forEach(item => {
            const itemPo = String(item.dataset.po || '').trim();
            if (itemPo && itemPo === targetPo) {
                item.classList.add('order-highlight');
                item.scrollIntoView({ behavior: 'smooth', block: 'center' });
                found = true;
            } else {
                item.classList.remove('order-highlight');
            }
        });

        if (!found) {
            showNotification('未找到对应订单', 'info');
        }
    }

    function renderOrdersSidebar() {
        if (!ordersItemsContainer) return;
        ordersItemsContainer.innerHTML = '';

        const filterBar = document.createElement('div');
        filterBar.className = 'orders-filter-bar';
        filterBar.innerHTML = `
            <button type="button" class="orders-filter-btn ${currentOrderFilter === 'all' ? 'active' : ''}" data-status="all">全部</button>
            <button type="button" class="orders-filter-btn ${currentOrderFilter === 'pending' ? 'active' : ''}" data-status="pending">待处理</button>
            <button type="button" class="orders-filter-btn ${currentOrderFilter === 'hold' ? 'active' : ''}" data-status="hold">暂缓</button>
            <button type="button" class="orders-filter-btn ${currentOrderFilter === 'shipped' ? 'active' : ''}" data-status="shipped">已发货</button>
            <button type="button" class="orders-filter-btn ${currentOrderFilter === 'arrived' ? 'active' : ''}" data-status="arrived">已到货</button>
            <button type="button" class="orders-filter-btn ${currentOrderFilter === 'received' ? 'active' : ''}" data-status="received">已收货</button>
            <button type="button" class="orders-filter-btn ${currentOrderFilter === 'cancelled' ? 'active' : ''}" data-status="cancelled">已取消</button>
        `;

        if (ordersCountElement) {
            ordersCountElement.textContent = `${userOrders.length} 单`;
        }

        if (isGuestUser()) {
            ordersItemsContainer.appendChild(filterBar);
            const guestEmpty = document.createElement('div');
            guestEmpty.className = 'empty-cart';
            guestEmpty.innerHTML = '<p>游客无法查看订单，请登录后使用</p>';
            ordersItemsContainer.appendChild(guestEmpty);
            return;
        }

        ordersItemsContainer.appendChild(filterBar);

        if (!userOrders.length) {
            const empty = document.createElement('div');
            empty.className = 'empty-cart';
            empty.innerHTML = '<p>暂无订单记录</p>';
            ordersItemsContainer.appendChild(empty);
            bindOrdersFilterButtons();
            return;
        }

        const filteredOrders = getFilteredUserOrders();
        if (!filteredOrders.length) {
            const empty = document.createElement('div');
            empty.className = 'empty-cart';
            empty.innerHTML = '<p>当前状态下暂无订单</p>';
            ordersItemsContainer.appendChild(empty);
            bindOrdersFilterButtons();
            return;
        }

        filteredOrders.forEach(order => {
            const item = document.createElement('div');
            item.className = 'cart-item';
            item.dataset.id = order.id;
            item.dataset.po = String(order.poNumber || '').trim();

            const itemsHtml = (order.items || []).length
                ? `<ul style="margin:8px 0 0 18px;padding:0;">${order.items.map(product => `<li>${escapeHtml(product.title || '图书')} × ${Number(product.quantity || 0)}</li>`).join('')}</ul>`
                : '<div style="margin-top:8px;color:var(--text-light);">该订单未记录商品明细</div>';
            const canReceive = normalizeOrderStatus(order.status) === 'arrived';
            const remainingText = getOrderRemainingText(order);

            item.innerHTML = `
                <div class="cart-item-details order-open-detail" data-order-id="${order.id}" role="button" tabindex="0" style="width:100%;cursor:pointer;">
                    <h4 class="cart-item-title">订单号：${escapeHtml(order.poNumber || String(order.id))}</h4>
                    <p class="cart-item-author">状态：${escapeHtml(ORDER_STATUS_LABELS[normalizeOrderStatus(order.status)] || order.status)}</p>
                    <div style="font-size:13px;color:var(--text-light);line-height:1.8;">
                        <div>下单时间：${escapeHtml(formatOrderDate(order.purchaseDate))}</div>
                        <div>订单金额：¥ ${Number(order.totalAmount || 0).toFixed(2)}</div>
                        <div>收货地址：${escapeHtml(order.shippingAddress || '-')}</div>
                        <div>发货时间：${escapeHtml(formatOrderDate(order.shipmentDate))}</div>
                        <div>到货时间：${escapeHtml(formatOrderDate(order.arrivedDate))}</div>
                        <div>收货时间：${escapeHtml(formatOrderDate(order.receivedDate))}</div>
                        ${remainingText ? `<div style="color:#8b5e3c;">${escapeHtml(remainingText)}</div>` : ''}
                    </div>
                    <div style="margin-top:8px;font-size:12px;color:#8b5e3c;">点击查看订单详情</div>
                    ${itemsHtml}
                    ${canReceive ? `<div class="cart-item-controls" style="margin-top:10px;justify-content:flex-end;"><button class="btn btn-primary btn-confirm-received" data-id="${order.id}">已收货</button></div>` : ''}
                </div>
            `;

            ordersItemsContainer.appendChild(item);
        });

        bindOrdersFilterButtons();

        ordersItemsContainer.querySelectorAll('.btn-confirm-received').forEach(button => {
            button.addEventListener('click', async function(e) {
                e.stopPropagation();
                const orderId = this.dataset.id;
                const result = await syncOrderStatusToCloud(orderId, 'received');
                if (!result.ok) {
                    showNotification(`确认收货失败：${result.message}`, 'info');
                    return;
                }

                const order = userOrders.find(item => String(item.id) === String(orderId));
                if (order) {
                    order.status = 'received';
                    order.receivedDate = new Date().toISOString();
                }
                renderOrdersSidebar();
                showNotification('已确认收货，订单状态已同步更新', 'success');
            });
        });

        ordersItemsContainer.querySelectorAll('.order-open-detail').forEach(node => {
            node.addEventListener('click', function(e) {
                if (e.target.closest('.btn-confirm-received')) return;
                openOrderDetail(this.dataset.orderId);
            });
            node.addEventListener('keydown', function(e) {
                if (e.key !== 'Enter' && e.key !== ' ') return;
                e.preventDefault();
                openOrderDetail(this.dataset.orderId);
            });
        });
    }

    function bindOrdersFilterButtons() {
        ordersItemsContainer.querySelectorAll('.orders-filter-btn').forEach(button => {
            button.addEventListener('click', function() {
                currentOrderFilter = this.dataset.status || 'all';
                renderOrdersSidebar();
            });
        });
    }

    function ensureOrderDetailModal() {
        let modal = document.getElementById('order-detail-modal');
        if (modal) return modal;

        modal = document.createElement('div');
        modal.id = 'order-detail-modal';
        modal.className = 'order-detail-modal';
        modal.innerHTML = `
            <div class="order-detail-overlay" data-role="close-order-detail"></div>
            <div class="order-detail-panel" role="dialog" aria-modal="true" aria-labelledby="order-detail-title">
                <button type="button" class="order-detail-close" data-role="close-order-detail" aria-label="关闭订单详情">
                    <i class="fas fa-times"></i>
                </button>
                <div class="order-detail-body"></div>
            </div>
        `;

        modal.addEventListener('click', function(e) {
            if (e.target.closest('[data-role="close-order-detail"]')) {
                closeOrderDetail();
            }
        });

        document.addEventListener('keydown', function(e) {
            if (e.key === 'Escape' && modal.classList.contains('active')) {
                closeOrderDetail();
            }
        });

        document.body.appendChild(modal);
        return modal;
    }

    function closeOrderDetail() {
        const modal = document.getElementById('order-detail-modal');
        if (!modal) return;
        modal.classList.remove('active');
        document.body.classList.remove('detail-open');
    }

    function openOrderDetail(orderId) {
        const order = userOrders.find(item => String(item.id) === String(orderId));
        if (!order) {
            showNotification('未找到该订单详情', 'info');
            return;
        }

        const modal = ensureOrderDetailModal();
        const body = modal.querySelector('.order-detail-body');
        if (!body) return;

        const statusLabel = ORDER_STATUS_LABELS[normalizeOrderStatus(order.status)] || order.status;
        const remainingText = getOrderRemainingText(order);
        const items = Array.isArray(order.items) ? order.items : [];

        body.innerHTML = `
            <div class="order-detail-header">
                <span class="book-detail-category">订单详情</span>
                <h2 id="order-detail-title" class="book-detail-title">订单号：${escapeHtml(order.poNumber || String(order.id))}</h2>
                <p class="book-detail-author">收件人：${escapeHtml(order.customerName || '用户')}</p>
                <div class="book-detail-rating-row">
                    <span class="book-detail-price">¥ ${Number(order.totalAmount || 0).toFixed(2)}</span>
                    <span class="book-detail-rating"><i class="fas fa-box"></i> ${escapeHtml(statusLabel)}</span>
                </div>
                ${remainingText ? `<p class="book-detail-description" style="color:#8b5e3c;">${escapeHtml(remainingText)}</p>` : ''}
            </div>
            <div class="book-detail-section">
                <h3>订单信息</h3>
                <div class="book-detail-meta-grid">
                    <div class="book-detail-meta-item"><span class="book-detail-meta-label">下单时间</span><strong class="book-detail-meta-value">${escapeHtml(formatOrderDate(order.purchaseDate))}</strong></div>
                    <div class="book-detail-meta-item"><span class="book-detail-meta-label">支付方式</span><strong class="book-detail-meta-value">${escapeHtml(order.paymentMethod || '未记录')}</strong></div>
                    <div class="book-detail-meta-item"><span class="book-detail-meta-label">发货时间</span><strong class="book-detail-meta-value">${escapeHtml(formatOrderDate(order.shipmentDate))}</strong></div>
                    <div class="book-detail-meta-item"><span class="book-detail-meta-label">到货时间</span><strong class="book-detail-meta-value">${escapeHtml(formatOrderDate(order.arrivedDate))}</strong></div>
                    <div class="book-detail-meta-item"><span class="book-detail-meta-label">收货时间</span><strong class="book-detail-meta-value">${escapeHtml(formatOrderDate(order.receivedDate))}</strong></div>
                    <div class="book-detail-meta-item"><span class="book-detail-meta-label">收货地址</span><strong class="book-detail-meta-value">${escapeHtml(order.shippingAddress || '-')}</strong></div>
                </div>
            </div>
            <div class="book-detail-section">
                <h3>商品明细</h3>
                ${items.length ? `
                    <div class="order-detail-items">
                        ${items.map(product => `
                            <div class="order-detail-item">
                                <strong>${escapeHtml(product.title || '图书')}</strong>
                                <span>数量：${Number(product.quantity || 0)}</span>
                                <span>单价：¥ ${Number(product.price || 0).toFixed(2)}</span>
                                <span>小计：¥ ${Number(product.subtotal ?? (Number(product.price || 0) * Number(product.quantity || 0))).toFixed(2)}</span>
                            </div>
                        `).join('')}
                    </div>
                ` : '<p class="book-detail-description">该订单未记录商品明细。</p>'}
            </div>
        `;

        modal.classList.add('active');
        document.body.classList.add('detail-open');
    }

    function renderHistorySidebar() {
        if (!historyItemsContainer) return;
        syncHistoryWithVisibleBooks();
        historyItemsContainer.innerHTML = '';

        if (historyCountElement) {
            historyCountElement.textContent = `${browsingHistory.length} 条`;
        }

        if (!browsingHistory.length) {
            historyItemsContainer.innerHTML = '<div class="empty-cart"><p>暂无浏览历史</p></div>';
            return;
        }

        browsingHistory.forEach(entry => {
            const item = document.createElement('div');
            item.className = 'cart-item';
            item.dataset.id = entry.id;
            item.innerHTML = `
                <div class="cart-item-image" style="background-color: ${sanitizeColor(entry.color)}">
                    <span style="color: white; font-size: 12px; padding: 5px;">${escapeHtml((entry.title || '图书').substring(0, 6))}...</span>
                </div>
                <div class="cart-item-details">
                    <h4 class="cart-item-title">${escapeHtml(entry.title || '未命名图书')}</h4>
                    <p class="cart-item-author">${escapeHtml(entry.author || '未知作者')}</p>
                    <div style="font-size:13px;color:var(--text-light);">浏览时间：${escapeHtml(formatOrderDate(entry.viewedAt))}</div>
                    <div class="cart-item-controls">
                        <button class="btn btn-secondary history-open-btn" data-id="${entry.id}">再次查看</button>
                        <button class="remove-item remove-history" data-id="${entry.id}" title="移除记录">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </div>
            `;
            historyItemsContainer.appendChild(item);
        });

        historyItemsContainer.querySelectorAll('.history-open-btn').forEach(button => {
            button.addEventListener('click', function() {
                const bookId = Number(this.dataset.id);
                closeHistory();
                openBookDetail(bookId);
            });
        });

        historyItemsContainer.querySelectorAll('.remove-history').forEach(button => {
            button.addEventListener('click', function() {
                const bookId = Number(this.dataset.id);
                browsingHistory = browsingHistory.filter(item => Number(item.id) !== bookId);
                persistHistory();
                renderHistorySidebar();
            });
        });
    }
    
    // 添加事件监听器
    function setupEventListeners() {
        // 搜索功能
        if (searchBtn) searchBtn.addEventListener('click', performSearch);
        if (searchInput) searchInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') performSearch();
        });
        
        // 搜索建议
        document.querySelectorAll('.suggestion-item').forEach(item => {
            item.addEventListener('click', function() {
                searchInput.value = this.dataset.search;
                performSearch();
            });
        });
        
        // 移动端菜单切换
        if (menuToggle) menuToggle.addEventListener('click', function() {
            navLinks.classList.toggle('active');
        });
        
        // 图书过滤
        filterButtons.forEach(btn => {
            btn.addEventListener('click', function() {
                filterButtons.forEach(b => b.classList.remove('active'));
                this.classList.add('active');
                currentFilter = this.dataset.filter;
                renderBooks(books);
            });
        });
        
        // 刷新推荐
        if (refreshRecommendationsBtn) refreshRecommendationsBtn.addEventListener('click', function() {
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
        if (cartIcon) cartIcon.addEventListener('click', function() {
            if (isGuestUser()) {
                showNotification('游客无法访问购物车，请登录后使用此功能', 'info');
                return;
            }
            openCart();
        });
        if (closeCartBtn) closeCartBtn.addEventListener('click', closeCart);
        if (closeFavoritesBtn) closeFavoritesBtn.addEventListener('click', closeFavorites);
        if (closeOrdersBtn) closeOrdersBtn.addEventListener('click', closeOrders);
        if (closeHistoryBtn) closeHistoryBtn.addEventListener('click', closeHistory);
        if (cartOverlay) cartOverlay.addEventListener('click', function() {
            closeCart();
            closeFavorites();
            closeOrders();
            closeHistory();
        });
        
        // 清空购物车
        if (clearCartBtn) clearCartBtn.addEventListener('click', function() {
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

        const myFavoritesLink = document.getElementById('my-favorites-link');
        if (myFavoritesLink) {
            myFavoritesLink.addEventListener('click', function(e) {
                e.preventDefault();
                if (isGuestUser()) {
                    showNotification('游客无法查看收藏，请登录后使用', 'info');
                    return;
                }
                openFavorites();
            });
        }

        const myOrdersLink = document.getElementById('my-orders-link');
        if (myOrdersLink) {
            myOrdersLink.addEventListener('click', async function(e) {
                e.preventDefault();
                if (isGuestUser()) {
                    showNotification('游客无法查看订单，请登录后使用', 'info');
                    return;
                }
                await loadUserOrdersFromSupabase();
                renderOrdersSidebar();
                openOrders();
            });
        }

        const myHistoryLink = document.getElementById('my-history-link');
        if (myHistoryLink) {
            myHistoryLink.addEventListener('click', function(e) {
                e.preventDefault();
                renderHistorySidebar();
                openHistory();
            });
        }

        if (clearHistoryBtn) {
            clearHistoryBtn.addEventListener('click', function() {
                if (!browsingHistory.length) return;
                browsingHistory = [];
                persistHistory();
                renderHistorySidebar();
                showNotification('浏览历史已清空', 'info');
            });
        }

        // 退出登录：清除本地用户信息并跳转到主页
        const logoutBtn = document.getElementById('logout-btn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', function(e) {
                // allow default navigation if JS is disabled; still perform cleanup
                try { localStorage.removeItem('user'); } catch (err) { /* ignore */ }
                try { sessionStorage.removeItem('loggedIn'); sessionStorage.removeItem('username'); sessionStorage.removeItem('loginUsername'); sessionStorage.removeItem('userType'); } catch (err) { /* ignore */ }
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
		// 绑定“前往结算”按钮：获取总价并跳转到支付页面
const checkoutBtn = document.getElementById('checkout-btn');
if (checkoutBtn) {
    checkoutBtn.addEventListener('click', function(e) {
        e.preventDefault();
        if (isGuestUser()) {
            showNotification('游客无法结算，请登录后操作', 'info');
            return;
        }
        if (!cart.length) {
            showNotification('购物车为空，无法结算', 'info');
            return;
        }

        const checkoutItems = cart.map(item => {
            const book = findBookById(item.bookId);
            if (!book) return null;
            const quantity = Number(item.quantity) || 0;
            const price = Number(book.price) || 0;
            return {
                bookId: Number(book.id),
                title: book.title || '未命名图书',
                quantity,
                price,
                subtotal: Number((price * quantity).toFixed(2))
            };
        }).filter(Boolean);

        if (!checkoutItems.length) {
            showNotification('购物车商品无效，无法结算', 'info');
            return;
        }

        // 从页面上的总价元素获取金额（由 calculateTotal 实时更新）
        const totalText = document.querySelector('.total-price').textContent;
        // 提取数字（格式如 "¥ 128.00"）
        const total = parseFloat(totalText.replace(/[^0-9.-]/g, '')) || 0;

        const checkoutPayload = {
            customerName: String(sessionStorage.getItem('loginUsername') || sessionStorage.getItem('username') || '').trim() || '匿名用户',
            items: checkoutItems,
            totalAmount: Number(total.toFixed(2)),
            cartStorageKey: getActiveCartStorageKey(),
            checkoutAt: new Date().toISOString()
        };

        sessionStorage.setItem(CHECKOUT_PAYLOAD_KEY, JSON.stringify(checkoutPayload));
        window.location.href = 'payment.html?total=' + total.toFixed(2);
    });
}
    }
    
    function ensureSearchResultsSection() {
        let section = document.getElementById('search-results-section');
        if (section) return section;

        const booksSection = document.getElementById('books');
        if (!booksSection || !booksSection.parentNode) return null;

        section = document.createElement('section');
        section.id = 'search-results-section';
        section.className = 'books-section paper-section';
        section.style.display = 'none';
        section.innerHTML = `
            <div class="container">
                <div class="section-header">
                    <div>
                        <h2 class="section-title">搜索结果</h2>
                        <p class="section-subtitle" id="search-results-summary"> </p>
                    </div>
                    <button type="button" class="btn btn-outline" id="clear-search-results">清除搜索</button>
                </div>
                <div id="search-filter-panel" style="display:none;margin:0 0 24px;padding:18px;border:1px solid rgba(176,157,123,.25);border-radius:16px;background:rgba(255,248,240,.85);box-shadow:0 8px 24px rgba(0,0,0,.05);"></div>
                <div class="books-grid search-results-grid"></div>
            </div>
        `;

        booksSection.parentNode.insertBefore(section, booksSection);

        section.querySelector('#clear-search-results')?.addEventListener('click', function() {
            searchInput.value = '';
            clearSearchResults();
        });

        return section;
    }

    function getSearchResultUniqueTags(resultBooks) {
        const tagSet = new Set();
        resultBooks.forEach(book => {
            normalizeTextList(book.tags).forEach(tag => {
                const normalizedTag = String(tag || '').trim();
                if (normalizedTag) tagSet.add(normalizedTag);
            });
        });
        return Array.from(tagSet).sort((a, b) => a.localeCompare(b, 'zh-Hans-CN'));
    }

    function resetSearchFilters() {
        searchFilterState.mode = 'category-price';
        searchFilterState.category = 'all';
        searchFilterState.minPrice = '';
        searchFilterState.maxPrice = '';
        searchFilterState.selectedTags = [];
    }

    function getSearchFilteredBooks() {
        const baseResults = Array.isArray(searchFilterState.baseResults) ? searchFilterState.baseResults : [];
        if (!baseResults.length) return [];

        if (searchFilterState.mode === 'tags') {
            if (!searchFilterState.selectedTags.length) return baseResults.slice();
            return baseResults.filter(book => {
                const bookTags = normalizeTextList(book.tags).map(tag => String(tag || '').trim().toLowerCase());
                return searchFilterState.selectedTags.every(tag => bookTags.includes(String(tag).trim().toLowerCase()));
            });
        }

        const minPrice = searchFilterState.minPrice === '' ? null : Number(searchFilterState.minPrice);
        const maxPrice = searchFilterState.maxPrice === '' ? null : Number(searchFilterState.maxPrice);

        return baseResults.filter(book => {
            const bookPrice = Number(book.price || 0);
            const categoryMatched = searchFilterState.category === 'all' || book.category === searchFilterState.category;
            const minMatched = minPrice === null || (!Number.isNaN(minPrice) && bookPrice >= minPrice);
            const maxMatched = maxPrice === null || (!Number.isNaN(maxPrice) && bookPrice <= maxPrice);
            return categoryMatched && minMatched && maxMatched;
        });
    }

    function syncSearchFilterPanel(section) {
        if (!section) return;
        const panel = section.querySelector('#search-filter-panel');
        if (!panel) return;

        const baseResults = Array.isArray(searchFilterState.baseResults) ? searchFilterState.baseResults : [];
        if (!baseResults.length) {
            panel.style.display = 'none';
            panel.innerHTML = '';
            return;
        }

        const categories = Array.from(new Set(baseResults.map(book => String(book.category || 'all')).filter(Boolean)));
        const tags = getSearchResultUniqueTags(baseResults);

        panel.style.display = 'block';
        panel.innerHTML = `
            <div style="display:flex;flex-wrap:wrap;gap:12px;align-items:center;justify-content:space-between;margin-bottom:14px;">
                <div>
                    <div style="font-weight:700;color:#5c4937;margin-bottom:4px;">搜索筛选</div>
                    <div style="font-size:13px;color:#7a6857;">不改动原搜索逻辑，仅对当前搜索结果做二次筛选</div>
                </div>
                <button type="button" class="btn btn-outline" id="reset-search-filters">重置筛选</button>
            </div>
            <div style="display:flex;flex-wrap:wrap;gap:10px;margin-bottom:16px;">
                <label style="display:flex;align-items:center;gap:6px;padding:8px 12px;border:1px solid rgba(176,157,123,.35);border-radius:999px;cursor:pointer;background:${searchFilterState.mode === 'category-price' ? 'rgba(176,157,123,.15)' : 'transparent'};">
                    <input type="radio" name="search-filter-mode" value="category-price" ${searchFilterState.mode === 'category-price' ? 'checked' : ''}>
                    <span>类别 + 价格范围</span>
                </label>
                <label style="display:flex;align-items:center;gap:6px;padding:8px 12px;border:1px solid rgba(176,157,123,.35);border-radius:999px;cursor:pointer;background:${searchFilterState.mode === 'tags' ? 'rgba(176,157,123,.15)' : 'transparent'};">
                    <input type="radio" name="search-filter-mode" value="tags" ${searchFilterState.mode === 'tags' ? 'checked' : ''}>
                    <span>一个或多个标签</span>
                </label>
            </div>
            <div id="category-price-filters" style="display:${searchFilterState.mode === 'category-price' ? 'block' : 'none'};">
                <div style="display:flex;flex-wrap:wrap;gap:12px;align-items:flex-end;">
                    <label style="display:flex;flex-direction:column;gap:6px;min-width:180px;">
                        <span style="font-size:13px;color:#6b5a49;">类别</span>
                        <select id="search-filter-category" style="padding:10px 12px;border-radius:10px;border:1px solid rgba(176,157,123,.35);background:#fff;">
                            <option value="all">全部类别</option>
                            ${categories.map(category => `<option value="${escapeHtml(category)}" ${searchFilterState.category === category ? 'selected' : ''}>${escapeHtml(getCategoryName(category))}</option>`).join('')}
                        </select>
                    </label>
                    <label style="display:flex;flex-direction:column;gap:6px;min-width:140px;">
                        <span style="font-size:13px;color:#6b5a49;">最低价格</span>
                        <input id="search-filter-min-price" type="number" min="0" step="0.01" placeholder="不限" value="${escapeHtml(searchFilterState.minPrice)}" style="padding:10px 12px;border-radius:10px;border:1px solid rgba(176,157,123,.35);background:#fff;">
                    </label>
                    <label style="display:flex;flex-direction:column;gap:6px;min-width:140px;">
                        <span style="font-size:13px;color:#6b5a49;">最高价格</span>
                        <input id="search-filter-max-price" type="number" min="0" step="0.01" placeholder="不限" value="${escapeHtml(searchFilterState.maxPrice)}" style="padding:10px 12px;border-radius:10px;border:1px solid rgba(176,157,123,.35);background:#fff;">
                    </label>
                </div>
            </div>
            <div id="tag-filters" style="display:${searchFilterState.mode === 'tags' ? 'block' : 'none'};">
                <div style="font-size:13px;color:#6b5a49;margin-bottom:10px;">可多选标签（同时满足）</div>
                <div style="display:flex;flex-wrap:wrap;gap:10px;">
                    ${tags.length ? tags.map(tag => `
                        <label style="display:inline-flex;align-items:center;gap:6px;padding:8px 12px;border-radius:999px;border:1px solid rgba(176,157,123,.35);background:${searchFilterState.selectedTags.includes(tag) ? 'rgba(176,157,123,.15)' : '#fff'};cursor:pointer;">
                            <input type="checkbox" class="search-filter-tag" value="${escapeHtml(tag)}" ${searchFilterState.selectedTags.includes(tag) ? 'checked' : ''}>
                            <span>${escapeHtml(tag)}</span>
                        </label>`).join('') : '<span style="color:#7a6857;">当前结果暂无可用标签</span>'}
                </div>
            </div>
        `;

        panel.querySelectorAll('input[name="search-filter-mode"]').forEach(input => {
            input.addEventListener('change', function() {
                searchFilterState.mode = this.value;
                renderSearchResults(getSearchFilteredBooks(), searchFilterState.lastQuery);
            });
        });

        panel.querySelector('#search-filter-category')?.addEventListener('change', function() {
            searchFilterState.category = this.value;
            renderSearchResults(getSearchFilteredBooks(), searchFilterState.lastQuery);
        });

        panel.querySelector('#search-filter-min-price')?.addEventListener('input', function() {
            searchFilterState.minPrice = this.value.trim();
            renderSearchResults(getSearchFilteredBooks(), searchFilterState.lastQuery);
        });

        panel.querySelector('#search-filter-max-price')?.addEventListener('input', function() {
            searchFilterState.maxPrice = this.value.trim();
            renderSearchResults(getSearchFilteredBooks(), searchFilterState.lastQuery);
        });

        panel.querySelectorAll('.search-filter-tag').forEach(input => {
            input.addEventListener('change', function() {
                const tag = this.value;
                if (this.checked) {
                    if (!searchFilterState.selectedTags.includes(tag)) searchFilterState.selectedTags.push(tag);
                } else {
                    searchFilterState.selectedTags = searchFilterState.selectedTags.filter(item => item !== tag);
                }
                renderSearchResults(getSearchFilteredBooks(), searchFilterState.lastQuery);
            });
        });

        panel.querySelector('#reset-search-filters')?.addEventListener('click', function() {
            resetSearchFilters();
            renderSearchResults(getSearchFilteredBooks(), searchFilterState.lastQuery);
        });
    }

    function renderSearchResults(resultBooks, rawQuery) {
        const section = ensureSearchResultsSection();
        if (!section) return;

        const grid = section.querySelector('.search-results-grid');
        const summary = section.querySelector('#search-results-summary');
        if (!grid || !summary) return;

        const safeQuery = escapeHtml(rawQuery);
        const visibleResults = getVisibleBooks(resultBooks);
        const baseCount = Array.isArray(searchFilterState.baseResults) ? searchFilterState.baseResults.length : visibleResults.length;
        const filterDescription = searchFilterState.mode === 'tags'
            ? (searchFilterState.selectedTags.length ? `标签：${searchFilterState.selectedTags.join('、')}` : '标签：全部')
            : `类别：${searchFilterState.category === 'all' ? '全部' : getCategoryName(searchFilterState.category)}，价格：${searchFilterState.minPrice || '不限'} - ${searchFilterState.maxPrice || '不限'}`;

        section.style.display = 'block';
        syncSearchFilterPanel(section);
        grid.innerHTML = '';
        summary.innerHTML = `关键词“${safeQuery}”共找到 ${baseCount} 本图书；当前筛选后显示 ${visibleResults.length} 本。<br>筛选方式：${escapeHtml(filterDescription)}。热门图书区域保留在下方，搜索结果与热门展示已分开。`;

        if (!visibleResults.length) {
            grid.innerHTML = '<div class="no-results"><p>没有找到相关图书，请尝试更换关键词。</p></div>';
            section.scrollIntoView({ behavior: 'smooth', block: 'start' });
            return;
        }

        visibleResults.forEach(book => {
            const bookCard = document.createElement('div');
            bookCard.className = 'book-card';
            bookCard.dataset.id = book.id;
            bookCard.dataset.category = book.category;
            const coverUrl = getBookBrowseCoverUrl(book);

            bookCard.innerHTML = `
                <div class="book-image" style="${getBookBrowseCoverStyle(book)}">
                    ${coverUrl ? '' : `<span style="color: white; font-weight: 500;">${escapeHtml((book.title || '图书').substring(0, 10))}${(book.title || '').length > 10 ? '...' : ''}</span>`}
                </div>
                <div class="book-content">
                    <div class="book-category">${escapeHtml(getCategoryName(book.category))}</div>
                    <h3 class="book-title">${escapeHtml(book.title || '未命名图书')}</h3>
                    <p class="book-author">${escapeHtml(book.author || '未知作者')}</p>
                    <p class="book-description">${escapeHtml(String(book.description || '').replace(/<[^>]+>/g, '').slice(0, 80) || '暂无简介')}</p>
                    <div class="book-footer">
                        <div class="book-price">¥ ${Number(book.price || 0).toFixed(2)}</div>
                        <div class="book-rating">
                            <i class="fas fa-star"></i>
                            <span>${formatBookRating(book)}</span>
                        </div>
                        <button class="favorite-btn ${isFavoriteBook(book.id) ? 'active' : ''} ${isGuestUser() ? 'disabled' : ''}" data-id="${escapeHtml(book.id)}" ${isGuestUser() ? 'disabled' : ''}>
                            <i class="${isFavoriteBook(book.id) ? 'fas' : 'far'} fa-heart"></i>
                        </button>
                        <button class="add-to-cart ${isGuestUser() ? 'disabled' : ''}" data-id="${escapeHtml(book.id)}" ${isGuestUser() ? 'disabled' : ''}>
                            <i class="fas fa-cart-plus"></i>
                        </button>
                    </div>
                </div>
            `;

            grid.appendChild(bookCard);
        });

        grid.querySelectorAll('.add-to-cart').forEach(btn => {
            btn.addEventListener('click', function(e) {
                e.stopPropagation();
                if (isGuestUser()) {
                    showNotification('游客无法使用购物车，请登录后操作', 'info');
                    return;
                }
                const bookId = Number(this.dataset.id);
                addToCart(bookId);
            });
        });

        bindFavoriteButtons(grid);

        bindBookDetailTriggers(grid);
        applyGuestUIRestrictions();
        section.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    function clearSearchResults() {
        resetSearchFilters();
        searchFilterState.lastQuery = '';
        searchFilterState.baseResults = [];

        const section = document.getElementById('search-results-section');
        if (section) {
            section.style.display = 'none';
            const grid = section.querySelector('.search-results-grid');
            const summary = section.querySelector('#search-results-summary');
            const panel = section.querySelector('#search-filter-panel');
            if (grid) grid.innerHTML = '';
            if (summary) summary.textContent = '';
            if (panel) {
                panel.style.display = 'none';
                panel.innerHTML = '';
            }
        }
        currentPage = 1;
        renderBooks(books);
    }

    // 搜索功能
    function performSearch() {
        const rawQuery = searchInput.value.trim();
        const query = rawQuery.toLowerCase();

        if (query === '') {
            clearSearchResults();
            showNotification('已清除搜索结果，下面仍显示热门图书', 'info');
            return;
        }

        const keywords = query.split(/\s+/).filter(Boolean);
        const scoredBooks = getVisibleBooks(books).map(book => {
            const fields = [
                book.title,
                book.author,
                book.description,
                getCategoryName(book.category),
                ...(normalizeTextList(book.tags)),
                book.publisher,
                book.isbn
            ].map(value => String(value || '').toLowerCase());

            let score = 0;
            keywords.forEach(word => {
                fields.forEach(field => {
                    if (!field) return;
                    if (field === word) score += 8;
                    else if (field.startsWith(word)) score += 5;
                    else if (field.includes(word)) score += 3;
                });
            });

            return { book, score };
        }).filter(item => item.score > 0)
          .sort((a, b) => b.score - a.score || Number(b.book.rating || 0) - Number(a.book.rating || 0) || Number(a.book.price || 0) - Number(b.book.price || 0));

        searchFilterState.lastQuery = rawQuery;
        searchFilterState.baseResults = scoredBooks.map(item => item.book);
        resetSearchFilters();

        const filteredBooks = getSearchFilteredBooks();
        renderSearchResults(filteredBooks, rawQuery);
        showNotification(`搜索完成：找到 ${searchFilterState.baseResults.length} 本相关图书，可继续按类别价格或标签筛选`, 'info');
    }
    
    // 添加到购物车
    function addToCart(bookId) {
        if (isGuestUser()) {
            showNotification('游客无法使用购物车，请登录后操作', 'info');
            return;
        }
        const book = findBookById(bookId);
        if (!book) {
            showNotification('该图书已下架，暂时无法加入购物车', 'info');
            return;
        }
        
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

        persistCart();
        
        renderCart();
        calculateTotal();
        updateCartCount();
    }
    
    // 从购物车移除商品
    function removeFromCart(itemId) {
        if (isGuestUser()) {
            showNotification('游客无法使用购物车，请登录后操作', 'info');
            return;
        }
        const itemIndex = cart.findIndex(i => i.id === itemId);
        if (itemIndex === -1) return;
        
        const book = findBookById(cart[itemIndex].bookId, { includeDisabled: true });
        cart.splice(itemIndex, 1);
        persistCart();
        
        renderCart();
        calculateTotal();
        updateCartCount();
        
        if (book) {
            showNotification(`"${book.title.substring(0, 15)}..." 已从购物车移除`, 'info');
        }
    }
    
    // 更新购物车数量显示
    function updateCartCount() {
        syncCartWithVisibleBooks();
        const totalItems = cart.reduce((total, item) => total + item.quantity, 0);
        cartCount.textContent = totalItems;
        cartCount.style.display = totalItems > 0 ? 'flex' : 'none';
    }
    
    // 计算购物车总价
    function calculateTotal() {
        syncCartWithVisibleBooks();
        const total = cart.reduce((sum, item) => {
            const book = findBookById(item.bookId);
            return sum + (book ? book.price * item.quantity : 0);
        }, 0);
        
        totalPriceElement.textContent = `¥ ${total.toFixed(2)}`;
    }
    
    // 打开购物车
    function openCart() {
        closeFavorites();
        closeOrders();
        closeHistory();
        cartSidebar.classList.add('active');
        cartOverlay.classList.add('active');
        document.body.style.overflow = 'hidden';
    }
    
    // 关闭购物车
    function closeCart() {
        cartSidebar.classList.remove('active');
        if ((!favoritesSidebar || !favoritesSidebar.classList.contains('active')) && (!ordersSidebar || !ordersSidebar.classList.contains('active')) && (!historySidebar || !historySidebar.classList.contains('active'))) {
            cartOverlay.classList.remove('active');
            document.body.style.overflow = 'auto';
        }
    }

    function openFavorites() {
        if (isGuestUser()) {
            showNotification('游客无法查看收藏，请登录后使用', 'info');
            return;
        }
        renderFavoritesSidebar();
        closeCart();
        closeOrders();
        closeHistory();
        favoritesSidebar?.classList.add('active');
        cartOverlay.classList.add('active');
        document.body.style.overflow = 'hidden';
    }

    function closeFavorites() {
        favoritesSidebar?.classList.remove('active');
        if (!cartSidebar.classList.contains('active') && (!ordersSidebar || !ordersSidebar.classList.contains('active')) && (!historySidebar || !historySidebar.classList.contains('active'))) {
            cartOverlay.classList.remove('active');
            document.body.style.overflow = 'auto';
        }
    }

    function openOrders() {
        if (isGuestUser()) {
            showNotification('游客无法查看订单，请登录后使用', 'info');
            return;
        }
        closeCart();
        closeFavorites();
        closeHistory();
        ordersSidebar?.classList.add('active');
        cartOverlay.classList.add('active');
        document.body.style.overflow = 'hidden';
    }

    function closeOrders() {
        ordersSidebar?.classList.remove('active');
        if (!cartSidebar.classList.contains('active') && (!favoritesSidebar || !favoritesSidebar.classList.contains('active')) && (!historySidebar || !historySidebar.classList.contains('active'))) {
            cartOverlay.classList.remove('active');
            document.body.style.overflow = 'auto';
        }
    }

    function openHistory() {
        closeCart();
        closeFavorites();
        closeOrders();
        historySidebar?.classList.add('active');
        cartOverlay.classList.add('active');
        document.body.style.overflow = 'hidden';
    }

    function closeHistory() {
        historySidebar?.classList.remove('active');
        if (!cartSidebar.classList.contains('active') && (!favoritesSidebar || !favoritesSidebar.classList.contains('active')) && (!ordersSidebar || !ordersSidebar.classList.contains('active'))) {
            cartOverlay.classList.remove('active');
            document.body.style.overflow = 'auto';
        }
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
    

    function escapeHtml(value) {
        return String(value ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
    }

    function sanitizeColor(value) {
        const color = String(value || '').trim();
        if (/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(color)) return color;
        return '#b09d7b';
    }

    function createDefaultCoverImage(book) {
        const label = String(book?.title || '图书').slice(0, 12).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
        const color = sanitizeColor(book?.color);
        const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="480" height="640" viewBox="0 0 480 640"><rect width="100%" height="100%" fill="${color}"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" font-size="28" fill="white">${label}</text></svg>`;
        return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
    }

    function normalizeTextList(value) {
        if (Array.isArray(value)) return value.filter(Boolean).map(v => String(v));
        if (typeof value !== 'string') return [];
        const trimmed = value.trim();
        if (!trimmed) return [];
        try {
            const parsed = JSON.parse(trimmed);
            if (Array.isArray(parsed)) return parsed.filter(Boolean).map(v => String(v));
        } catch (e) {
            // ignore JSON parse failure and continue with split logic
        }
        return trimmed.split(/[;,，、|/]+/).map(v => v.trim()).filter(Boolean);
    }

    function normalizePhotoList(value) {
        if (Array.isArray(value)) return value.map(v => String(v || '').trim()).filter(Boolean);
        if (typeof value !== 'string') return [];
        const trimmed = value.trim();
        if (!trimmed) return [];
        try {
            const parsed = JSON.parse(trimmed);
            if (Array.isArray(parsed)) return parsed.map(v => String(v || '').trim()).filter(Boolean);
        } catch (e) {
            // ignore JSON parse failure and continue with split logic
        }
        return trimmed.split(/[\n,;，、|]+/).map(v => v.trim()).filter(Boolean);
    }

    function sanitizeImageUrl(value) {
        const raw = String(value || '').trim();
        if (!raw) return '';

            if (/^data:image\/svg\+xml/i.test(raw) || /^<svg[\s>]/i.test(raw) || /^<\?xml[\s\S]*<svg[\s>]/i.test(raw)) {
            // storefront 仅展示真实图片，忽略系统自动生成的 SVG 占位图
            return '';
        }

            if (/^javascript:/i.test(raw)) {
            return '';
        }

            if (/^https?:\/\//i.test(raw) || /^data:image\//i.test(raw) || /^blob:/i.test(raw) || raw.startsWith('/')) {
                return raw;
            }

            if (!/^[a-z][a-z0-9+.-]*:/i.test(raw)) {
                return raw;
            }

            return '';
    }

    function getBookCoverUrl(book) {
        const defaultCover = createDefaultCoverImage(book);
        const candidates = [book?.coverUrl, ...(Array.isArray(book?.photos) ? book.photos : []), defaultCover];
        for (const candidate of candidates) {
            const url = sanitizeImageUrl(candidate);
            if (url) return url;
        }
        return defaultCover;
    }

    function getBookPhotoUrls(book) {
        const seen = new Set();
        const urls = [];
        const defaultCover = createDefaultCoverImage(book);
        const candidates = [book?.coverUrl, ...(Array.isArray(book?.photos) ? book.photos : [])];
        candidates.forEach(candidate => {
            const url = sanitizeImageUrl(candidate);
            if (!url || seen.has(url)) return;
            seen.add(url);
            urls.push(url);
        });
        if (!urls.length) {
            urls.push(defaultCover);
            seen.add(defaultCover);
        }
        return urls;
    }

    function getBookBrowseCoverUrl(book) {
        return getBookCoverUrl(book);
    }

    function getBookBrowseCoverStyle(book) {
        const base = `background-color: ${sanitizeColor(book?.color)}`;
        const coverUrl = getBookBrowseCoverUrl(book);
        return `${base}; background-image: url('${coverUrl}'); background-size: cover; background-position: center;`;
    }

    function getBookCoverStyle(book) {
        const base = `background-color: ${sanitizeColor(book?.color)}`;
        const coverUrl = getBookCoverUrl(book);
        if (!coverUrl) return base;
        return `${base}; background-image: url('${coverUrl}'); background-size: cover; background-position: center;`;
    }

    function ensureBookDetailModal() {
        let modal = document.getElementById('book-detail-modal');
        if (modal) return modal;

        modal = document.createElement('div');
        modal.id = 'book-detail-modal';
        modal.className = 'book-detail-modal';
        modal.innerHTML = `
            <div class="book-detail-overlay" data-role="close-detail"></div>
            <div class="book-detail-panel" role="dialog" aria-modal="true" aria-labelledby="book-detail-title">
                <button type="button" class="book-detail-close" data-role="close-detail" aria-label="关闭详情页">
                    <i class="fas fa-times"></i>
                </button>
                <div class="book-detail-body"></div>
            </div>
        `;

        modal.addEventListener('click', function(e) {
            if (e.target.closest('[data-role="close-detail"]')) {
                closeBookDetail();
            }
        });

        document.addEventListener('keydown', function(e) {
            if (e.key === 'Escape' && modal.classList.contains('active')) {
                closeBookDetail();
            }
        });

        document.body.appendChild(modal);
        return modal;
    }

    function getBookMetaRows(book) {
        const rows = [
            { label: '图书分类', value: getCategoryName(book.category) },
            { label: '作者', value: book.author || '未知作者' },
            { label: '评分', value: hasBookRating(book) ? `${formatBookRating(book)} / 5.0` : '暂无评分' },
            { label: '价格', value: `¥ ${Number(book.price || 0).toFixed(2)}` }
        ];

        if (book.publisher) rows.push({ label: '出版社', value: book.publisher });
        if (book.isbn) rows.push({ label: 'ISBN', value: book.isbn });
        const tags = normalizeTextList(book.tags);
        if (tags.length) rows.push({ label: '标签', value: tags.join(' / ') });

        return rows;
    }

    function openBookDetail(bookId) {
        const book = findBookById(bookId);
        if (!book) {
            showNotification('未找到该图书详情', 'info');
            return;
        }

        recordBrowsingHistory(book);

        stopDetailGalleryAutoplay();

        const modal = ensureBookDetailModal();
        const body = modal.querySelector('.book-detail-body');
        if (!body) return;

        const tags = normalizeTextList(book.tags);
        const photoUrls = getBookPhotoUrls(book);
        const metaRows = getBookMetaRows(book).map(item => `
            <div class="book-detail-meta-item">
                <span class="book-detail-meta-label">${escapeHtml(item.label)}</span>
                <strong class="book-detail-meta-value">${escapeHtml(item.value)}</strong>
            </div>
        `).join('');

        const hasGallery = photoUrls.length > 0;

        body.innerHTML = `
            <div class="book-detail-hero">
                <div class="book-detail-media">
                    <div class="book-detail-cover ${hasGallery ? 'has-image' : ''}" style="${hasGallery ? '' : getBookCoverStyle(book)}">
                        ${hasGallery ? `
                            <button type="button" class="book-gallery-nav prev" aria-label="上一张图片"><i class="fas fa-chevron-left"></i></button>
                            <img class="book-detail-cover-image" src="${photoUrls[0]}" alt="${escapeHtml(book.title || '图书')} 图片 1">
                            <button type="button" class="book-gallery-nav next" aria-label="下一张图片"><i class="fas fa-chevron-right"></i></button>
                        ` : `<span>${escapeHtml(book.title || '图书')}</span>`}
                    </div>
                    ${hasGallery && photoUrls.length > 1 ? `
                        <div class="book-detail-thumbs">
                            ${photoUrls.map((url, index) => `
                                <button type="button" class="book-detail-thumb ${index === 0 ? 'active' : ''}" data-index="${index}" aria-label="查看第 ${index + 1} 张图片">
                                    <img src="${url}" alt="${escapeHtml(book.title || '图书')} 缩略图 ${index + 1}">
                                </button>
                            `).join('')}
                        </div>
                    ` : ''}
                </div>
                <div class="book-detail-summary">
                    <div class="book-detail-category">${escapeHtml(getCategoryName(book.category))}</div>
                    <h2 id="book-detail-title" class="book-detail-title">${escapeHtml(book.title || '未命名图书')}</h2>
                    <p class="book-detail-author">作者：${escapeHtml(book.author || '未知作者')}</p>
                    <div class="book-detail-rating-row">
                        <span class="book-detail-price">¥ ${Number(book.price || 0).toFixed(2)}</span>
                        <span class="book-detail-rating"><i class="fas fa-star"></i> ${formatBookRating(book)}</span>
                    </div>
                    <p class="book-detail-description">${escapeHtml(String(book.description || '暂无简介').replace(/<[^>]+>/g, ''))}</p>
                    <div class="book-detail-actions">
                        <button class="btn btn-primary detail-add-cart ${isGuestUser() ? 'disabled' : ''}" data-id="${book.id}" ${isGuestUser() ? 'disabled' : ''}>
                            <i class="fas fa-cart-plus"></i> 加入购物车
                        </button>
                        <button class="favorite-btn detail-favorite ${isFavoriteBook(book.id) ? 'active' : ''} ${isGuestUser() ? 'disabled' : ''}" data-id="${book.id}" ${isGuestUser() ? 'disabled' : ''}>
                            <i class="${isFavoriteBook(book.id) ? 'fas' : 'far'} fa-heart"></i>
                        </button>
                        <button class="btn btn-outline" type="button" data-role="close-detail">继续逛逛</button>
                    </div>
                </div>
            </div>
            <div class="book-detail-section">
                <h3>图书信息</h3>
                <div class="book-detail-meta-grid">${metaRows}</div>
            </div>
            <div class="book-detail-section">
                <h3>内容亮点</h3>
                <ul class="book-detail-highlights">
                    <li>适合喜欢「${escapeHtml(getCategoryName(book.category))}」内容的读者。</li>
                    <li>${hasBookRating(book) ? `当前读者评分为 ${formatBookRating(book)}，可作为选购参考。` : '当前暂无买家评分，欢迎首位读者完成购买后评价。'}</li>
                    <li>页面支持直接加入购物车，无需返回列表页。</li>
                </ul>
            </div>
            ${tags.length ? `
            <div class="book-detail-section">
                <h3>关键词</h3>
                <div class="book-detail-tags">${tags.map(tag => `<span class="book-detail-tag">${escapeHtml(tag)}</span>`).join('')}</div>
            </div>` : ''}
        `;

        body.querySelector('.detail-add-cart')?.addEventListener('click', function() {
            if (isGuestUser()) {
                showNotification('游客无法使用购物车，请登录后操作', 'info');
                return;
            }
            addToCart(Number(this.dataset.id));
        });

        body.querySelector('.detail-favorite')?.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            toggleFavorite(this.dataset.id);
        });

        if (hasGallery) {
            const coverImage = body.querySelector('.book-detail-cover-image');
            const prevBtn = body.querySelector('.book-gallery-nav.prev');
            const nextBtn = body.querySelector('.book-gallery-nav.next');
            const thumbButtons = Array.from(body.querySelectorAll('.book-detail-thumb'));
            let currentPhotoIndex = 0;

            const startAutoplay = () => {
                stopDetailGalleryAutoplay();
                if (photoUrls.length <= 1) return;
                detailGalleryAutoplayTimer = setInterval(() => {
                    if (!modal.classList.contains('active')) {
                        stopDetailGalleryAutoplay();
                        return;
                    }
                    updateGallery(currentPhotoIndex + 1, false);
                }, DETAIL_GALLERY_INTERVAL_MS);
            };

            const updateGallery = (nextIndex, fromUser = false) => {
                currentPhotoIndex = (nextIndex + photoUrls.length) % photoUrls.length;
                if (coverImage) {
                    coverImage.src = photoUrls[currentPhotoIndex];
                    coverImage.alt = `${book.title || '图书'} 图片 ${currentPhotoIndex + 1}`;
                }
                thumbButtons.forEach((btn, index) => {
                    btn.classList.toggle('active', index === currentPhotoIndex);
                });

                if (fromUser) {
                    startAutoplay();
                }
            };

            prevBtn?.addEventListener('click', function(e) {
                e.preventDefault();
                e.stopPropagation();
                updateGallery(currentPhotoIndex - 1, true);
            });

            nextBtn?.addEventListener('click', function(e) {
                e.preventDefault();
                e.stopPropagation();
                updateGallery(currentPhotoIndex + 1, true);
            });

            thumbButtons.forEach(btn => btn.addEventListener('click', function(e) {
                e.preventDefault();
                e.stopPropagation();
                updateGallery(Number(this.dataset.index) || 0, true);
            }));

            startAutoplay();
        }

        modal.classList.add('active');
        document.body.classList.add('detail-open');
    }

    function closeBookDetail() {
        const modal = document.getElementById('book-detail-modal');
        if (!modal) return;
        stopDetailGalleryAutoplay();
        modal.classList.remove('active');
        document.body.classList.remove('detail-open');
    }

    function bindBookDetailTriggers(scope) {
        if (!scope) return;
        scope.querySelectorAll('.book-card, .recommendation-card').forEach(card => {
            if (card.dataset.detailBound === '1') return;
            card.dataset.detailBound = '1';
            card.style.cursor = 'pointer';
            card.addEventListener('click', function(e) {
                if (e.target.closest('.add-to-cart') || e.target.closest('.favorite-btn')) return;
                const trigger = this.closest('[data-id]') || this;
                const bookId = Number(trigger.dataset.id || this.dataset.id);
                if (!bookId) return;
                openBookDetail(bookId);
            });
        });
    }

    const searchSectionStyle = document.createElement('style');
    searchSectionStyle.textContent = `
        #search-results-section .section-header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 16px;
            flex-wrap: wrap;
        }

        #search-results-section .section-subtitle {
            margin-top: 8px;
        }
    `;
    document.head.appendChild(searchSectionStyle);

    const bookDetailStyle = document.createElement('style');
    bookDetailStyle.textContent = `
        body.detail-open {
            overflow: hidden;
        }

        .book-detail-modal {
            position: fixed;
            inset: 0;
            z-index: 3000;
            display: none;
        }

        .book-detail-modal.active {
            display: block;
        }

        .book-detail-overlay {
            position: absolute;
            inset: 0;
            background: rgba(15, 23, 42, 0.45);
            backdrop-filter: blur(2px);
        }

        .book-detail-panel {
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            width: min(960px, calc(100% - 32px));
            max-height: calc(100vh - 48px);
            overflow-y: auto;
            background: #fffdf8;
            border-radius: 24px;
            box-shadow: 0 24px 80px rgba(15, 23, 42, 0.18);
            padding: 32px;
        }

        .book-detail-close {
            position: absolute;
            top: 16px;
            right: 16px;
            width: 40px;
            height: 40px;
            border: none;
            border-radius: 50%;
            background: rgba(15, 23, 42, 0.06);
            cursor: pointer;
        }

        .book-detail-hero {
            display: grid;
            grid-template-columns: 280px 1fr;
            gap: 28px;
            align-items: start;
        }

        .book-detail-media {
            display: grid;
            gap: 14px;
        }

        .book-detail-cover {
            position: relative;
            min-height: 360px;
            border-radius: 20px;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 24px;
            color: #fff;
            font-size: 28px;
            font-weight: 700;
            text-align: center;
            box-shadow: inset 0 0 0 1px rgba(255,255,255,0.15);
        }

        .book-detail-cover.has-image {
            padding: 0;
            overflow: hidden;
            background: #f3efe7;
            box-shadow: 0 10px 30px rgba(15, 23, 42, 0.12);
        }

        .book-detail-cover-image {
            width: 100%;
            height: 100%;
            min-height: 360px;
            object-fit: cover;
            display: block;
        }

        .book-gallery-nav {
            position: absolute;
            top: 50%;
            transform: translateY(-50%);
            width: 42px;
            height: 42px;
            border: none;
            border-radius: 50%;
            background: rgba(255, 255, 255, 0.88);
            color: #8c5a30;
            box-shadow: 0 8px 24px rgba(15, 23, 42, 0.16);
            cursor: pointer;
            z-index: 2;
        }

        .book-gallery-nav.prev {
            left: 12px;
        }

        .book-gallery-nav.next {
            right: 12px;
        }

        .book-detail-thumbs {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(60px, 1fr));
            gap: 10px;
        }

        .book-detail-thumb {
            padding: 0;
            border: 2px solid transparent;
            border-radius: 14px;
            overflow: hidden;
            background: #fff;
            cursor: pointer;
        }

        .book-detail-thumb.active {
            border-color: #8c5a30;
        }

        .book-detail-thumb img {
            width: 100%;
            height: 72px;
            object-fit: cover;
            display: block;
        }

        .book-detail-category {
            display: inline-flex;
            padding: 6px 12px;
            border-radius: 999px;
            background: rgba(160, 116, 74, 0.12);
            color: #8c5a30;
            font-size: 14px;
            margin-bottom: 12px;
        }

        .book-detail-title {
            margin: 0 0 12px;
            font-size: 32px;
            line-height: 1.2;
        }

        .book-detail-author,
        .book-detail-description {
            color: #4b5563;
            line-height: 1.8;
        }

        .book-detail-rating-row,
        .book-detail-actions {
            display: flex;
            flex-wrap: wrap;
            gap: 12px;
            align-items: center;
            margin: 16px 0;
        }

        .book-detail-price {
            font-size: 28px;
            font-weight: 700;
            color: #8c5a30;
        }

        .book-detail-rating {
            display: inline-flex;
            align-items: center;
            gap: 6px;
            padding: 8px 12px;
            border-radius: 999px;
            background: rgba(250, 204, 21, 0.16);
        }

        .book-detail-section {
            margin-top: 28px;
            padding-top: 24px;
            border-top: 1px solid rgba(15, 23, 42, 0.08);
        }

        .book-detail-section h3 {
            margin-bottom: 16px;
        }

        .book-detail-meta-grid {
            display: grid;
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 14px;
        }

        .book-detail-meta-item {
            padding: 16px;
            background: #fff;
            border-radius: 16px;
            border: 1px solid rgba(15, 23, 42, 0.06);
        }

        .book-detail-meta-label {
            display: block;
            color: #6b7280;
            margin-bottom: 6px;
            font-size: 14px;
        }

        .book-detail-highlights {
            margin: 0;
            padding-left: 18px;
            color: #4b5563;
            line-height: 1.8;
        }

        .book-detail-tags {
            display: flex;
            flex-wrap: wrap;
            gap: 10px;
        }

        .book-detail-tag {
            display: inline-flex;
            align-items: center;
            padding: 8px 14px;
            border-radius: 999px;
            background: rgba(140, 90, 48, 0.1);
            color: #8c5a30;
            font-size: 14px;
        }

        .orders-filter-bar {
            display: flex;
            flex-wrap: wrap;
            gap: 8px;
            margin-bottom: 14px;
        }

        .orders-filter-btn {
            border: 1px solid rgba(140, 90, 48, 0.18);
            background: #fff;
            color: #8c5a30;
            border-radius: 999px;
            padding: 6px 12px;
            cursor: pointer;
            transition: all 0.2s ease;
        }

        .orders-filter-btn.active,
        .orders-filter-btn:hover {
            background: rgba(140, 90, 48, 0.12);
            border-color: rgba(140, 90, 48, 0.38);
        }

        .order-highlight {
            border: 2px solid var(--accent-color) !important;
            background-color: rgba(196, 154, 108, 0.1) !important;
            box-shadow: 0 0 15px rgba(196, 154, 108, 0.3) !important;
            transition: all 0.3s ease;
        }

        .order-detail-modal {
            position: fixed;
            inset: 0;
            z-index: 3200;
            display: none;
        }

        .order-detail-modal.active {
            display: block;
        }

        .order-detail-overlay {
            position: absolute;
            inset: 0;
            background: rgba(15, 23, 42, 0.45);
            backdrop-filter: blur(2px);
        }

        .order-detail-panel {
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            width: min(880px, calc(100% - 32px));
            max-height: calc(100vh - 48px);
            overflow-y: auto;
            background: #fffdf8;
            border-radius: 24px;
            box-shadow: 0 24px 80px rgba(15, 23, 42, 0.18);
            padding: 32px;
        }

        .order-detail-close {
            position: absolute;
            top: 16px;
            right: 16px;
            width: 40px;
            height: 40px;
            border: none;
            border-radius: 50%;
            background: rgba(15, 23, 42, 0.06);
            cursor: pointer;
        }

        .order-detail-items {
            display: grid;
            gap: 12px;
        }

        .order-detail-item {
            display: grid;
            gap: 6px;
            padding: 16px;
            border-radius: 16px;
            background: #fff;
            border: 1px solid rgba(15, 23, 42, 0.06);
            color: #4b5563;
        }

        @media (max-width: 768px) {
            .book-detail-panel {
                width: calc(100% - 20px);
                padding: 24px 18px;
                max-height: calc(100vh - 20px);
            }

            .order-detail-panel {
                width: calc(100% - 20px);
                padding: 24px 18px;
                max-height: calc(100vh - 20px);
            }

            .book-detail-hero,
            .book-detail-meta-grid {
                grid-template-columns: 1fr;
            }

            .book-detail-cover {
                min-height: 220px;
                font-size: 24px;
            }

            .book-detail-cover-image {
                min-height: 220px;
            }

            .book-detail-title {
                font-size: 26px;
            }
        }
    `;
    document.head.appendChild(bookDetailStyle);

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
function detectGuestMode() {
    try {
        const loggedIn = sessionStorage.getItem('loggedIn') === 'true';
        const userType = sessionStorage.getItem('userType');
        if (loggedIn && userType === 'guest') return true;

        // 兼容旧逻辑（历史版本可能使用 localStorage.user）
        return localStorage.getItem('user') === 'guest';
    } catch (e) {
        return false;
    }
}

function applyGuestUIRestrictions() {
    try {
        const guest = detectGuestMode();

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

        const myOrdersLink = document.getElementById('my-orders-link');
        if (myOrdersLink) {
            if (guest) {
                myOrdersLink.classList.add('disabled');
                myOrdersLink.setAttribute('title', '游客无法查看订单');
            } else {
                myOrdersLink.classList.remove('disabled');
                myOrdersLink.removeAttribute('title');
            }
        }
    } catch (e) {
        // 忽略错误，保持页面可用
        console.error('applyGuestUIRestrictions error', e);
    }
}