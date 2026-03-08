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
        booksGrid.innerHTML = '';
        
        const filteredBooks = currentFilter === 'all' 
            ? booksToRender 
            : booksToRender.filter(book => book.category === currentFilter);
        
        if (filteredBooks.length === 0) {
            booksGrid.innerHTML = '<div class="no-results"><p>未找到相关图书</p></div>';
            return;
        }
        
        filteredBooks.forEach(book => {
            const bookCard = document.createElement('div');
            bookCard.className = 'book-card';
            bookCard.dataset.id = book.id;
            bookCard.dataset.category = book.category;
            
            bookCard.innerHTML = `
                <div class="book-image" style="background-color: ${book.color}">
                    <span style="color: white; font-weight: 500;">${book.title.substring(0, 10)}...</span>
                </div>
                <div class="book-content">
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
                </div>
            `;
            
            booksGrid.appendChild(bookCard);
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
        searchBtn.addEventListener('click', performSearch);
        searchInput.addEventListener('keypress', function(e) {
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
        menuToggle.addEventListener('click', function() {
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
        closeCartBtn.addEventListener('click', closeCart);
        cartOverlay.addEventListener('click', closeCart);
        
        // 清空购物车
        clearCartBtn.addEventListener('click', function() {
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
    }
    
    // 搜索功能
    function performSearch() {
        const query = searchInput.value.trim().toLowerCase();
        
        if (query === '') {
            renderBooks(books);
            return;
        }
        
        const filteredBooks = books.filter(book => 
            book.title.toLowerCase().includes(query) || 
            book.author.toLowerCase().includes(query) ||
            book.description.toLowerCase().includes(query)
        );
        
        renderBooks(filteredBooks);
        showNotification(`找到 ${filteredBooks.length} 本相关图书`, 'info');
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