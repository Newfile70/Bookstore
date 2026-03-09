// script.js - 懒得起名小书铺交互脚本

document.addEventListener('DOMContentLoaded', async function() {
    let currentPage = 1;
    const pageSize = 12;
    let detailModal = null;
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
                    description: b.description ?? b.desc ?? b.html_description ?? b.htmlDescription ?? '',
                    color: b.color ?? '#dacfba',
                    images: normalizeBookImages(b),
                    tags: normalizeToArray(b.tags),
                    publisher: b.publisher ?? b.press ?? '',
                    isbn: b.isbn ?? '',
                    stock: Number(b.stock ?? b.inventory ?? 0)
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


    function escapeHtml(value) {
        return String(value ?? '').replace(/[&<>"']/g, function(ch) {
            return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch];
        });
    }

    function normalizeTextList(value) {
        if (Array.isArray(value)) return value.map(v => String(v).trim()).filter(Boolean);
        if (typeof value === 'string') {
            return value.split(/[,，;；|]/).map(v => v.trim()).filter(Boolean);
        }
        return [];
    }

    function normalizeImages(value) {
        if (Array.isArray(value)) return value.map(v => String(v).trim()).filter(Boolean);
        if (typeof value === 'string') {
            const trimmed = value.trim();
            if (!trimmed) return [];
            if ((trimmed.startsWith('[') && trimmed.endsWith(']')) || (trimmed.startsWith('{') && trimmed.endsWith('}'))) {
                try {
                    const parsed = JSON.parse(trimmed);
                    return normalizeImages(parsed);
                } catch (e) {
                    // ignore JSON parse failure and fallback to split mode
                }
            }
            return trimmed.split(/[,，;；|\n\r]+/).map(v => v.trim()).filter(Boolean);
        }
        return [];
    }

    function getBookImages(book) {
        const list = [];
        if (book && book.coverImage) list.push(String(book.coverImage).trim());
        if (book && Array.isArray(book.images)) list.push(...book.images);
        return Array.from(new Set(list.filter(Boolean)));
    }

    function sanitizeHtmlDescription(value) {
        const raw = String(value ?? '').trim();
        if (!raw) return '暂无简介';
        const temp = document.createElement('div');
        temp.innerHTML = raw;
        temp.querySelectorAll('script, style, iframe, object, embed, link, meta').forEach(el => el.remove());
        temp.querySelectorAll('*').forEach(el => {
            Array.from(el.attributes).forEach(attr => {
                const name = attr.name.toLowerCase();
                const val = String(attr.value || '');
                if (name.startsWith('on')) {
                    el.removeAttribute(attr.name);
                }
                if ((name === 'href' || name === 'src') && /^\s*javascript:/i.test(val)) {
                    el.removeAttribute(attr.name);
                }
            });
        });
        const cleaned = temp.innerHTML.trim();
        return cleaned || escapeHtml(raw);
    }

    function formatBookMetaValue(label, value) {
        if (value === null || value === undefined || value === '') return '';
        return '<span><strong>' + escapeHtml(label) + '：</strong>' + escapeHtml(value) + '</span>';
    }

    function formatDateLabel(value) {
        if (!value) return '';
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) return String(value);
        return date.toLocaleDateString('zh-CN');
    }

    function sanitizeColor(value) {
        const color = String(value ?? '').trim();
        if (/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(color)) return color;
        if (/^(rgb|rgba|hsl|hsla)\([^\)]+\)$/.test(color)) return color;
        return '#dacfba';
    }

    function sameBookId(a, b) {
        return String(a ?? '') === String(b ?? '');
    }

    function findBookById(bookId) {
        return books.find(b => sameBookId(b.id, bookId));
    }

    function normalizeToArray(value) {
        if (Array.isArray(value)) return value.map(item => String(item).trim()).filter(Boolean);
        if (typeof value === 'string') {
            const trimmed = value.trim();
            if (!trimmed) return [];
            if ((trimmed.startsWith('[') && trimmed.endsWith(']')) || (trimmed.startsWith('{') && trimmed.endsWith('}'))) {
                try {
                    const parsed = JSON.parse(trimmed);
                    if (Array.isArray(parsed)) return parsed.map(item => String(item).trim()).filter(Boolean);
                } catch (e) {
                    // fallback to split mode
                }
            }
            return trimmed.split(/[,，;；|\n\r]+/).map(item => item.trim()).filter(Boolean);


        }
        return [];
    }

    function normalizeBookImages(book) {
        if (!book || typeof book !== 'object') return [];

        const candidates = [
            ...(normalizeToArray(book.images)),
            ...(normalizeToArray(book.image_urls)),
            ...(normalizeToArray(book.imageUrls)),
            ...(normalizeToArray(book.gallery)),
            ...(normalizeToArray(book.gallery_images)),
            ...(normalizeToArray(book.galleryImages)),
            ...(normalizeToArray(book.detail_images)),
            ...(normalizeToArray(book.detailImages)),
            ...(normalizeToArray(book.product_images)),
            ...(normalizeToArray(book.productImages)),
            book.image,
            book.image_url,
            book.imageUrl,
            book.cover,
            book.cover_image,
            book.coverImage,
            book.cover_url,
            book.coverUrl,
            book.thumbnail,
            book.thumbnail_url,
            book.thumbnailUrl,
            book.main_image,
            book.mainImage,
            book.banner,
            book.poster,
            book.image1,
            book.image2,
            book.image3,
            book.image4,
            book.image5
        ].filter(Boolean);

        const unique = [];
        candidates.forEach(url => {
            const value = String(url || '').trim();
            if (value && !unique.includes(value)) unique.push(value);
        });
        return unique;
    }

    function sanitizeBookDescription(value) {
        const raw = String(value ?? '').trim();
        if (!raw) return '<p>暂无简介</p>';

        const wrapper = document.createElement('div');
        wrapper.innerHTML = raw;

        wrapper.querySelectorAll('script, style, iframe, object, embed').forEach(el => el.remove());
        wrapper.querySelectorAll('*').forEach(el => {
            [...el.attributes].forEach(attr => {
                const name = attr.name.toLowerCase();
                const val = String(attr.value || '');
                if (name.startsWith('on')) {
                    el.removeAttribute(attr.name);
                    return;
                }
                if ((name === 'href' || name === 'src') && /^javascript:/i.test(val)) {
                    el.removeAttribute(attr.name);
                }
            });
        });

        const cleaned = wrapper.innerHTML.trim();
        return cleaned || `<p>${escapeHtml(raw)}</p>`;
    }

    function ensureBookDetailModal() {
        let modal = document.getElementById('book-detail-modal');
        if (modal) return modal;

        modal = document.createElement('div');
        modal.id = 'book-detail-modal';
        modal.className = 'book-detail-modal';
        modal.innerHTML = `
            <div class="book-detail-backdrop" data-close-detail="true"></div>
            <div class="book-detail-dialog" role="dialog" aria-modal="true" aria-labelledby="book-detail-title">
                <button type="button" class="book-detail-close" id="book-detail-close" aria-label="关闭详情">
                    <i class="fas fa-times"></i>
                </button>
                <div id="book-detail-body"></div>
            </div>
        `;
        document.body.appendChild(modal);

        modal.addEventListener('click', function(event) {
            if (event.target.dataset.closeDetail === 'true' || event.target.closest('#book-detail-close')) {
                closeBookDetail();
            }
        });

        document.addEventListener('keydown', function(event) {
            if (event.key === 'Escape' && modal.classList.contains('active')) {
                closeBookDetail();
            }
        });

        return modal;
    }

    function openBookDetail(bookId) {
        const book = findBookById(bookId);
        if (!book) {
            showNotification('未找到该商品详情', 'info');
            return;
        }

        const modal = ensureBookDetailModal();
        const body = modal.querySelector('#book-detail-body');
        const safeTitle = escapeHtml(book.title || '未命名图书');
        const safeAuthor = escapeHtml(book.author || '未知作者');
        const safeCategory = escapeHtml(getCategoryName(book.category));
        const safePublisher = escapeHtml(book.publisher || book.press || '暂无');
        const safeIsbn = escapeHtml(book.isbn || book.ISBN || '暂无');
        const tags = normalizeToArray(book.tags);
        const images = normalizeBookImages(book);
        const descriptionHtml = sanitizeBookDescription(book.description || book.html_description || book.htmlDescription || '');
        const displayColor = sanitizeColor(book.color);
        const relatedBooks = books
            .filter(item => !sameBookId(item.id, book.id) && (item.category === book.category || item.author === book.author))
            .slice(0, 3);

        const galleryHtml = images.length > 0
            ? `
                <div class="book-detail-gallery">
                    <div class="book-detail-main-image"><img src="${escapeHtml(images[0])}" alt="${safeTitle}" loading="lazy"></div>
                    ${images.length > 1 ? `<div class="book-detail-thumbs">${images.map((url, index) => `<button type="button" class="book-detail-thumb ${index === 0 ? 'active' : ''}" data-image="${escapeHtml(url)}"><img src="${escapeHtml(url)}" alt="${safeTitle} ${index + 1}" loading="lazy"></button>`).join('')}</div>` : ''}
                </div>
            `
            : `
                <div class="book-detail-cover" style="background-color: ${displayColor};">
                    <span>${escapeHtml((book.title || '').substring(0, 18) || '图书')}</span>
                </div>
            `;

        body.innerHTML = `
            <div class="book-detail-layout">
                ${galleryHtml}
                <div class="book-detail-content">
                    <div class="book-detail-category">${safeCategory}</div>
                    <h3 id="book-detail-title" class="book-detail-title">${safeTitle}</h3>
                    <p class="book-detail-author">作者：${safeAuthor}</p>
                    <div class="book-detail-meta">
                        <span><i class="fas fa-star"></i> ${Number(book.rating || 0).toFixed(1)}</span>
                        <span>价格：¥ ${Number(book.price || 0).toFixed(2)}</span>
                        <span>库存：${Number(book.stock || 0)}</span>
                    </div>
                    <div class="book-detail-extra">
                        <p>出版社：${safePublisher}</p>
                        <p>ISBN：${safeIsbn}</p>
                    </div>
                    ${tags.length ? `<div class="book-detail-tags">${tags.map(tag => `<span class="book-detail-tag">${escapeHtml(tag)}</span>`).join('')}</div>` : ''}
                    <div class="book-detail-description">${descriptionHtml}</div>
                    <div class="book-detail-actions">
                        <button class="btn btn-primary detail-add-to-cart ${isGuestUser() ? 'disabled' : ''}" data-id="${escapeHtml(book.id)}" ${isGuestUser() ? 'disabled' : ''}>
                            <i class="fas fa-cart-plus"></i> 加入购物车
                        </button>
                    </div>
                    ${relatedBooks.length ? `<div class="book-detail-related"><h4>相关商品</h4><div class="book-detail-related-list">${relatedBooks.map(item => `<button type="button" class="book-detail-related-item" data-related-id="${escapeHtml(item.id)}">${escapeHtml(item.title)}</button>`).join('')}</div></div>` : ''}
                </div>
            </div>
        `;

        const mainDetailImage = body.querySelector('.book-detail-main-image img');
        if (mainDetailImage) {
            mainDetailImage.addEventListener('error', function() {
                const cover = body.querySelector('.book-detail-gallery');
                if (cover) {
                    cover.outerHTML = `<div class="book-detail-cover" style="background-color: ${displayColor};"><span>${escapeHtml((book.title || '').substring(0, 18) || '图书')}</span></div>`;
                }
            }, { once: true });
        }

        body.querySelectorAll('.book-detail-thumb').forEach(btn => {
            btn.addEventListener('click', function() {
                const target = body.querySelector('.book-detail-main-image img');
                if (target && this.dataset.image) {
                    target.src = this.dataset.image;
                    target.alt = `${book.title || '图书'} 缩略图`;
                }
                body.querySelectorAll('.book-detail-thumb').forEach(node => node.classList.remove('active'));
                this.classList.add('active');
            });
        });

        body.querySelectorAll('[data-related-id]').forEach(btn => {
            btn.addEventListener('click', function() {
                openBookDetail(this.dataset.relatedId);
            });
        });

        const addBtn = body.querySelector('.detail-add-to-cart');
        if (addBtn) {
            addBtn.addEventListener('click', function() {
                if (isGuestUser()) {
                    showNotification('游客无法使用购物车，请登录后操作', 'info');
                    return;
                }
                addToCart(book.id);
            });
        }

        modal.classList.add('active');
        document.body.style.overflow = 'hidden';
    }

    function closeBookDetail() {
        const modal = document.getElementById('book-detail-modal');
        if (!modal) return;
        modal.classList.remove('active');
        if (!cartSidebar || !cartSidebar.classList.contains('active')) {
            document.body.style.overflow = 'auto';
        }
    }

    function bindBookDetailTriggers(scope) {
        if (!scope) return;
        scope.querySelectorAll('.book-card, .recommendation-card').forEach(card => {
            card.addEventListener('click', function(event) {
                if (event.target.closest('.add-to-cart')) return;
                const bookId = this.dataset.id;
                if (bookId) openBookDetail(bookId);
            });
        });

        scope.querySelectorAll('.cart-item-image, .cart-item-title').forEach(trigger => {
            trigger.addEventListener('click', function() {
                const holder = this.closest('.cart-item');
                const bookId = holder && holder.dataset.bookId;
                if (bookId) openBookDetail(bookId);
            });
        });
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

        const pagination = document.querySelector('.pagination');
        if (pagination) pagination.innerHTML = '';

        if (filteredBooks.length === 0) {
            booksGrid.innerHTML = '<div class="no-results"><p>未找到相关图书</p></div>';
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

        if (pagination && totalPages > 1) {
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

        document.querySelectorAll('.books-grid .add-to-cart').forEach(btn => {
            btn.addEventListener('click', function(e) {
                e.stopPropagation();
                if (isGuestUser()) {
                    showNotification('游客无法使用购物车，请登录后操作', 'info');
                    return;
                }
                const bookId = this.dataset.id;
                addToCart(bookId);
            });
        });

        bindBookDetailTriggers(booksGrid);
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
            btn.addEventListener('click', function(e) {
                e.stopPropagation();
                if (isGuestUser()) {
                    showNotification('游客无法使用购物车，请登录后操作', 'info');
                    return;
                }
                const bookId = this.dataset.id;
                addToCart(bookId);
            });
        });

        bindBookDetailTriggers(recommendationsGrid);
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
            const book = findBookById(item.bookId);
            if (!book) return;
            
            const cartItem = document.createElement('div');
            cartItem.className = 'cart-item';
            cartItem.dataset.id = item.id;
            cartItem.dataset.bookId = item.bookId;
            cartItem.dataset.bookId = book.id;
            
            cartItem.innerHTML = `
                <div class="cart-item-image" style="background-color: ${book.color}; cursor: pointer;">
                    <span style="color: white; font-size: 12px; padding: 5px;">${book.title.substring(0, 6)}...</span>
                </div>
                <div class="cart-item-details">
                    <h4 class="cart-item-title" style="cursor: pointer;">${book.title}</h4>
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

        bindBookDetailTriggers(cartItemsContainer);
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
        const book = findBookById(bookId);
        if (!book) return;
        
        // 检查是否已在购物车中
        const existingItem = cart.find(item => sameBookId(item.bookId, bookId));
        
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
        
        const book = findBookById(cart[itemIndex].bookId);
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
            const book = findBookById(item.bookId);
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
        
        .book-detail-modal {
            position: fixed;
            inset: 0;
            display: none;
            z-index: 2100;
        }

        .book-detail-modal.active {
            display: block;
        }

        .book-detail-backdrop {
            position: absolute;
            inset: 0;
            background: rgba(0, 0, 0, 0.55);
        }

        .book-detail-dialog {
            position: relative;
            width: min(760px, calc(100% - 32px));
            max-height: calc(100vh - 40px);
            overflow: auto;
            margin: 20px auto;
            background: #fff;
            border-radius: var(--border-radius);
            box-shadow: var(--shadow-hover);
            padding: 24px;
            z-index: 1;
        }

        .book-detail-close {
            position: absolute;
            top: 12px;
            right: 12px;
            width: 36px;
            height: 36px;
            border: none;
            border-radius: 50%;
            background: rgba(0, 0, 0, 0.06);
            cursor: pointer;
        }

        .book-detail-layout {
            display: grid;
            grid-template-columns: 220px 1fr;
            gap: 24px;
            align-items: start;
        }

        .book-detail-media {
            display: flex;
            flex-direction: column;
            gap: 12px;
        }

        .book-detail-cover {
            min-height: 300px;
            border-radius: var(--border-radius);
            display: flex;
            align-items: center;
            justify-content: center;
            text-align: center;
            padding: 20px;
            color: #fff;
            font-size: 24px;
            font-weight: 600;
            line-height: 1.5;
            overflow: hidden;
        }

        .book-detail-cover img {
            width: 100%;
            height: 100%;
            object-fit: cover;
            border-radius: inherit;
            display: block;
        }

        .book-detail-gallery {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(56px, 1fr));
            gap: 8px;
        }

        .book-detail-thumb {
            border: 1px solid rgba(0, 0, 0, 0.08);
            border-radius: 10px;
            background: #fff;
            padding: 4px;
            cursor: pointer;
        }

        .book-detail-thumb.active {
            border-color: #8f6f47;
        }

        .book-detail-thumb img {
            width: 100%;
            height: 56px;
            object-fit: cover;
            border-radius: 8px;
            display: block;
        }

        .book-detail-category {
            display: inline-block;
            padding: 4px 10px;
            border-radius: 999px;
            background: rgba(139, 111, 71, 0.12);
            color: #8f6f47;
            font-size: 13px;
            margin-bottom: 10px;
        }

        .book-detail-title {
            margin-bottom: 10px;
        }

        .book-detail-author,
        .book-detail-description {
            color: var(--text-light);
        }

        .book-detail-meta {
            display: flex;
            gap: 16px;
            flex-wrap: wrap;
            margin: 12px 0 16px;
        }

        .book-detail-extra-meta {
            display: flex;
            flex-direction: column;
            gap: 6px;
            margin-bottom: 14px;
            color: var(--text-light);
        }

        .book-detail-tags {
            display: flex;
            gap: 8px;
            flex-wrap: wrap;
            margin-bottom: 14px;
        }

        .book-detail-tag {
            padding: 4px 10px;
            border-radius: 999px;
            background: rgba(143, 111, 71, 0.1);
            color: #8f6f47;
            font-size: 12px;
        }

        .book-detail-description {
            word-break: break-word;
        }

        .book-detail-description img {
            max-width: 100%;
            height: auto;
        }

        .book-detail-actions {
            margin-top: 18px;
        }

        .book-detail-gallery {
            display: flex;
            flex-direction: column;
            gap: 12px;
        }

        .book-detail-main-image {
            background: #f8f5ef;
            border-radius: var(--border-radius);
            overflow: hidden;
            min-height: 300px;
            display: flex;
            align-items: center;
            justify-content: center;
        }

        .book-detail-main-image img {
            width: 100%;
            height: 100%;
            max-height: 360px;
            object-fit: cover;
            display: block;
        }

        .book-detail-thumbs {
            display: flex;
            gap: 8px;
            flex-wrap: wrap;
        }

        .book-detail-thumb {
            border: 1px solid rgba(0,0,0,0.12);
            background: #fff;
            border-radius: 8px;
            padding: 0;
            width: 64px;
            height: 64px;
            overflow: hidden;
            cursor: pointer;
        }

        .book-detail-thumb.active {
            border-color: #8f6f47;
        }

        .book-detail-thumb img {
            width: 100%;
            height: 100%;
            object-fit: cover;
            display: block;
        }

        .book-detail-extra p {
            margin: 6px 0;
            color: var(--text-light);
        }

        .book-detail-tags {
            display: flex;
            gap: 8px;
            flex-wrap: wrap;
            margin: 14px 0;
        }

        .book-detail-tag {
            display: inline-block;
            padding: 4px 10px;
            border-radius: 999px;
            background: rgba(139, 111, 71, 0.1);
            color: #8f6f47;
            font-size: 12px;
        }

        .book-detail-description p {
            margin: 0 0 12px;
        }

        .book-detail-related {
            margin-top: 20px;
            padding-top: 18px;
            border-top: 1px solid rgba(0,0,0,0.08);
        }

        .book-detail-related h4 {
            margin-bottom: 12px;
        }

        .book-detail-related-list {
            display: flex;
            gap: 10px;
            flex-wrap: wrap;
        }

        .book-detail-related-item {
            border: 1px solid rgba(0,0,0,0.12);
            background: #fff;
            border-radius: 999px;
            padding: 8px 12px;
            cursor: pointer;
        }

        @media (max-width: 640px) {
            .book-detail-dialog {
                padding: 18px;
            }

            .book-detail-layout {
                grid-template-columns: 1fr;
            }

            .book-detail-cover {
                min-height: 220px;
            }
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