// script.js - 懒得起名小书铺交互脚本

document.addEventListener('DOMContentLoaded', async function() {
    let currentPage = 1;
    const pageSize = 12;
    // Supabase configuration (替换为你提供的 URL 与 anon key)
    const SUPABASE_URL = 'https://cxsomlfxlpnqnqramoyf.supabase.co';
    const SUPABASE_ANON_KEY = 'sb_publishable_iCCcnej8rT1qLIXHpsH9HA_B6LeiYFe';
    const supabaseClient = (typeof supabase !== 'undefined')
        ? supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
        : null;

    // 数据容器（将由 Supabase 填充）
    let books = [];
    let recommendations = [];
    const cartItems = [
        { id: 1, bookId: 3, quantity: 1 },
        { id: 2, bookId: 6, quantity: 2 }
    ];

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

            // 不再请求 `recommendations` 表（避免 404）；直接根据 books 派生推荐
            recommendations = books.slice().sort((a, b) => (b.rating || 0) - (a.rating || 0)).slice(0, 4).map((b, i) => ({
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
    const cartItemsContainer = document.querySelector('.cart-items');
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
    const cartSidebar = document.querySelector('.cart-sidebar');
    const cartOverlay = document.getElementById('cart-overlay');
    const clearCartBtn = document.getElementById('clear-cart');
    
    // 当前过滤器和购物车状态
    let currentFilter = 'all';
    let cart = [...cartItems];
    
    // 用户状态检查（若使用游客登录，请在登录流程中设置 localStorage.setItem('user', 'guest')）
    function isGuestUser() {
        try {
            const u = localStorage.getItem('user');
            return u === 'guest';
        } catch (e) {
            return false;
        }
    }
    
    // 初始化页面
    function initPage() {
        renderBooks(books);
        renderRecommendations();
        renderCart();
        updateCartCount();
        calculateTotal();

        // 添加事件监听器
        setupEventListeners();

        // 根据当前用户状态应用游客UI限制（确保按钮在初始渲染后展示为禁用）
        applyGuestUIRestrictions();
    }
    
    // 渲染图书列表
    function renderBooks(booksToRender) {
        if (!booksGrid) return;
        booksGrid.innerHTML = '';

        const filteredBooks = currentFilter === 'all'
            ? booksToRender
            : booksToRender.filter(book => book.category === currentFilter);

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

            bookCard.innerHTML = `
                <div class="book-image" style="background-color: ${sanitizeColor(book.color)}">
                    <span style="color: white; font-weight: 500;">${escapeHtml((book.title || '').substring(0, 10))}${(book.title || '').length > 10 ? '...' : ''}</span>
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
                            <span>${Number(book.rating || 0).toFixed(1)}</span>
                        </div>
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

        bindBookDetailTriggers(booksGrid);

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

        bindBookDetailTriggers(recommendationsGrid);

        // 确保UI状态（disabled类/属性）与当前用户状态一致
        applyGuestUIRestrictions();
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
        if (cartOverlay) cartOverlay.addEventListener('click', closeCart);
        
        // 清空购物车
        if (clearCartBtn) clearCartBtn.addEventListener('click', function() {
            if (isGuestUser()) {
                showNotification('游客无法操作购物车，请登录后使用', 'info');
                return;
            }

            if (cart.length === 0) return;
            
            if (confirm('确定要清空购物车吗？')) {
                cart = [];
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
		// 绑定“前往结算”按钮：获取总价并跳转到支付页面
const checkoutBtn = document.getElementById('checkout-btn');
if (checkoutBtn) {
    checkoutBtn.addEventListener('click', function(e) {
        e.preventDefault();  // 防止任何默认行为
        // 从页面上的总价元素获取金额（由 calculateTotal 实时更新）
        const totalText = document.querySelector('.total-price').textContent;
        // 提取数字（格式如 "¥ 128.00"）
        const total = parseFloat(totalText.replace(/[^0-9.-]/g, '')) || 0;
        // 跳转到支付页面，并附带总金额作为 URL 参数
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

    function renderSearchResults(resultBooks, rawQuery) {
        const section = ensureSearchResultsSection();
        if (!section) return;

        const grid = section.querySelector('.search-results-grid');
        const summary = section.querySelector('#search-results-summary');
        if (!grid || !summary) return;

        const safeQuery = escapeHtml(rawQuery);
        section.style.display = 'block';
        grid.innerHTML = '';
        summary.innerHTML = `关键词“${safeQuery}”共找到 ${resultBooks.length} 本图书。热门图书区域保留在下方，搜索结果与热门展示已分开。`;

        if (!resultBooks.length) {
            grid.innerHTML = '<div class="no-results"><p>没有找到相关图书，请尝试更换关键词。</p></div>';
            section.scrollIntoView({ behavior: 'smooth', block: 'start' });
            return;
        }

        resultBooks.forEach(book => {
            const bookCard = document.createElement('div');
            bookCard.className = 'book-card';
            bookCard.dataset.id = book.id;
            bookCard.dataset.category = book.category;

            bookCard.innerHTML = `
                <div class="book-image" style="background-color: ${sanitizeColor(book.color)}">
                    <span style="color: white; font-weight: 500;">${escapeHtml((book.title || '图书').substring(0, 10))}${(book.title || '').length > 10 ? '...' : ''}</span>
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
                            <span>${Number(book.rating || 0).toFixed(1)}</span>
                        </div>
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

        bindBookDetailTriggers(grid);
        applyGuestUIRestrictions();
        section.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    function clearSearchResults() {
        const section = document.getElementById('search-results-section');
        if (section) {
            section.style.display = 'none';
            const grid = section.querySelector('.search-results-grid');
            const summary = section.querySelector('#search-results-summary');
            if (grid) grid.innerHTML = '';
            if (summary) summary.textContent = '';
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
        const scoredBooks = books.map(book => {
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

        const filteredBooks = scoredBooks.map(item => item.book);
        renderSearchResults(filteredBooks, rawQuery);
        showNotification(`搜索完成：找到 ${filteredBooks.length} 本相关图书，热门图书展示保持不变`, 'info');
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
        cartSidebar.classList.add('active');
        cartOverlay.classList.add('active');
        document.body.style.overflow = 'hidden';
    }
    
    // 关闭购物车
    function closeCart() {
        cartSidebar.classList.remove('active');
        cartOverlay.classList.remove('active');
        document.body.style.overflow = 'auto';
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
        return '#dacfba';
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
            { label: '评分', value: `${Number(book.rating || 0).toFixed(1)} / 5.0` },
            { label: '价格', value: `¥ ${Number(book.price || 0).toFixed(2)}` }
        ];

        if (book.publisher) rows.push({ label: '出版社', value: book.publisher });
        if (book.isbn) rows.push({ label: 'ISBN', value: book.isbn });
        const tags = normalizeTextList(book.tags);
        if (tags.length) rows.push({ label: '标签', value: tags.join(' / ') });

        return rows;
    }

    function openBookDetail(bookId) {
        const book = books.find(b => Number(b.id) === Number(bookId));
        if (!book) {
            showNotification('未找到该图书详情', 'info');
            return;
        }

        const modal = ensureBookDetailModal();
        const body = modal.querySelector('.book-detail-body');
        if (!body) return;

        const tags = normalizeTextList(book.tags);
        const metaRows = getBookMetaRows(book).map(item => `
            <div class="book-detail-meta-item">
                <span class="book-detail-meta-label">${escapeHtml(item.label)}</span>
                <strong class="book-detail-meta-value">${escapeHtml(item.value)}</strong>
            </div>
        `).join('');

        body.innerHTML = `
            <div class="book-detail-hero">
                <div class="book-detail-cover" style="background-color: ${sanitizeColor(book.color)}">
                    <span>${escapeHtml(book.title || '图书')}</span>
                </div>
                <div class="book-detail-summary">
                    <div class="book-detail-category">${escapeHtml(getCategoryName(book.category))}</div>
                    <h2 id="book-detail-title" class="book-detail-title">${escapeHtml(book.title || '未命名图书')}</h2>
                    <p class="book-detail-author">作者：${escapeHtml(book.author || '未知作者')}</p>
                    <div class="book-detail-rating-row">
                        <span class="book-detail-price">¥ ${Number(book.price || 0).toFixed(2)}</span>
                        <span class="book-detail-rating"><i class="fas fa-star"></i> ${Number(book.rating || 0).toFixed(1)}</span>
                    </div>
                    <p class="book-detail-description">${escapeHtml(String(book.description || '暂无简介').replace(/<[^>]+>/g, ''))}</p>
                    <div class="book-detail-actions">
                        <button class="btn btn-primary detail-add-cart ${isGuestUser() ? 'disabled' : ''}" data-id="${book.id}" ${isGuestUser() ? 'disabled' : ''}>
                            <i class="fas fa-cart-plus"></i> 加入购物车
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
                    <li>当前读者评分为 ${Number(book.rating || 0).toFixed(1)}，具有较高参考价值。</li>
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

        modal.classList.add('active');
        document.body.classList.add('detail-open');
    }

    function closeBookDetail() {
        const modal = document.getElementById('book-detail-modal');
        if (!modal) return;
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
                if (e.target.closest('.add-to-cart')) return;
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

        .book-detail-cover {
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

        @media (max-width: 768px) {
            .book-detail-panel {
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
    initPage();
});

// 根据是否为游客设置或清除UI禁用样式/属性
function applyGuestUIRestrictions() {
    try {
        const guest = (localStorage.getItem('user') === 'guest');

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
    } catch (e) {
        // 忽略错误，保持页面可用
        console.error('applyGuestUIRestrictions error', e);
    }
}