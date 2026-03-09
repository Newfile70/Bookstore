// admin-script.js - Block A/B/C enhanced admin portal

document.addEventListener('DOMContentLoaded', async () => {
    const SUPABASE_URL = 'https://cxsomlfxlpnqnqramoyf.supabase.co';
    const SUPABASE_ANON_KEY = 'sb_publishable_iCCcnej8rT1qLIXHpsH9HA_B6LeiYFe';
    const client = (typeof supabase !== 'undefined' && supabase?.createClient)
        ? supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
        : null;

    const STORAGE_KEYS = {
        books: 'bookstore_books_cache_v2',
        orders: 'bookstore_orders_v2'
    };

    const ORDER_STATUS_LABELS = {
        pending: '待处理',
        hold: '暂缓',
        shipped: '已发货',
        cancelled: '已取消'
    };

    const ORDER_STATUS_TRANSITIONS = {
        pending: ['hold', 'shipped', 'cancelled'],
        hold: ['shipped', 'cancelled'],
        shipped: [],
        cancelled: []
    };

    let books = [];
    let orders = [];
    let editingProductId = null;
    let editingPhotos = [];

    const elements = {
        addProductBtn: document.getElementById('add-product-btn'),
        searchInput: document.getElementById('admin-search-input'),
        searchBtn: document.getElementById('admin-search-btn'),
        booksGrid: document.getElementById('admin-products-grid'),
        ordersList: document.getElementById('admin-orders-list'),
        productModal: document.getElementById('product-modal'),
        productForm: document.getElementById('product-form')
    };

    function safeParse(value, fallback) {
        try { return JSON.parse(value) ?? fallback; } catch { return fallback; }
    }

    function createPlaceholderSvg(text) {
        const safe = encodeURIComponent(String(text).slice(0, 12));
        return `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="480" height="640"><rect width="100%" height="100%" fill="%236b8cbc"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" font-size="28" fill="white">${safe}</text></svg>`;
    }


    function sanitizeSummaryHtml(html) {
        const wrapper = document.createElement('div');
        wrapper.innerHTML = html || '<p>暂无简介</p>';
        wrapper.querySelectorAll('script, iframe, object, embed').forEach(node => node.remove());
        wrapper.querySelectorAll('*').forEach(node => {
            [...node.attributes].forEach(attr => {
                if (/^on/i.test(attr.name)) node.removeAttribute(attr.name);
            });
        });
        return wrapper.innerHTML;
    }

    function getAllowedTransitions(status) {
        return ORDER_STATUS_TRANSITIONS[status] || [];
    }

    function formatPhotoList(value) {
        return (Array.isArray(value) ? value : String(value || '').split(/[\n,]/))
            .map(item => String(item).trim())
            .filter(Boolean);
    }

    function normalizeBook(raw, index) {
        const photos = [raw.photos, raw.images, raw.photo_urls, raw.image_urls]
            .filter(Boolean)
            .flatMap(value => Array.isArray(value) ? value : String(value).split(/[\n,]/))
            .map(item => String(item).trim())
            .filter(Boolean);
        const tags = (Array.isArray(raw.tags) ? raw.tags : String(raw.tags || '').split(/[#,，,\s]+/))
            .map(tag => tag.trim())
            .filter(Boolean);
        return {
            id: raw.id ?? index + 1,
            title: raw.title ?? '未命名图书',
            author: raw.author ?? '未知作者',
            category: raw.category ?? 'all',
            price: Number.parseFloat(raw.price) || 0,
            rating: Number.parseFloat(raw.rating) || 4.5,
            description: raw.description ?? '暂无简介',
            summaryHtml: sanitizeSummaryHtml(raw.summary_html || raw.summaryHtml || `<p>${raw.description ?? '暂无简介'}</p>`),
            publisher: raw.publisher || '未知出版社',
            isbn: raw.isbn || `ISBN-${String(index + 100000)}`,
            tags,
            photos: photos.length ? photos : [createPlaceholderSvg(raw.title ?? '图书')],
            disabled: Boolean(raw.disabled),
            color: raw.color || '#6b8cbc'
        };
    }

    async function loadBooks() {
        let source = [];
        if (client) {
            try {
                const { data, error } = await client.from('books').select('*');
                if (!error && Array.isArray(data)) source = data;
            } catch (err) {
                console.error('load books failed', err);
            }
        }
        if (!source.length) {
            source = safeParse(localStorage.getItem(STORAGE_KEYS.books), []);
        }
        books = source.map(normalizeBook);
        localStorage.setItem(STORAGE_KEYS.books, JSON.stringify(books));
    }

    function loadOrders() {
        orders = safeParse(localStorage.getItem(STORAGE_KEYS.orders), []).sort((a, b) => new Date(b.purchaseDate) - new Date(a.purchaseDate));
    }

    function persistBooks() {
        localStorage.setItem(STORAGE_KEYS.books, JSON.stringify(books));
    }

    function persistOrders() {
        localStorage.setItem(STORAGE_KEYS.orders, JSON.stringify(orders));
    }

    function ensureUi() {
        if (!document.getElementById('admin-enhanced-style')) {
            const style = document.createElement('style');
            style.id = 'admin-enhanced-style';
            style.textContent = `
                .admin-product-card,.admin-order-card{background:#fff;border-radius:14px;padding:16px;box-shadow:0 8px 24px rgba(0,0,0,.06);display:flex;flex-direction:column;gap:10px;}
                .admin-card-actions,.admin-order-actions{display:flex;gap:10px;flex-wrap:wrap;}
                .admin-chip{display:inline-block;padding:4px 10px;border-radius:999px;background:#eef2ff;color:#4338ca;font-size:13px;}
                .modal{display:none;position:fixed;inset:0;background:rgba(0,0,0,.45);z-index:9999;align-items:center;justify-content:center;padding:20px;}
                .modal.active{display:flex;}
                .modal-content{background:#fff;border-radius:16px;width:min(900px,100%);padding:24px;max-height:90vh;overflow:auto;}
                .admin-form-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;}
                .admin-form-grid textarea,.admin-form-grid input,.admin-form-grid select{width:100%;padding:10px 12px;border:1px solid #ddd;border-radius:10px;}
                .admin-form-grid .full{grid-column:1 / -1;}
                .order-detail-panel{margin-top:14px;padding-top:14px;border-top:1px dashed #ddd;color:#4b5563;}
                .empty-state{background:#fff;border-radius:14px;padding:18px;box-shadow:0 8px 24px rgba(0,0,0,.06);}
                .photo-manager{display:grid;gap:12px;}
                .photo-input-row{display:flex;gap:10px;flex-wrap:wrap;}
                .photo-preview-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:12px;}
                .photo-preview-item{border:1px solid #e5e7eb;border-radius:12px;padding:10px;background:#fafafa;display:flex;flex-direction:column;gap:8px;}
                .photo-preview-item img{width:100%;height:120px;object-fit:cover;border-radius:8px;background:#f1f5f9;}
                .admin-toolbar{display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap;align-items:center;margin:12px 0 20px;}
                .admin-filter-bar{display:flex;gap:8px;flex-wrap:wrap;}
                @media (max-width:768px){.admin-form-grid{grid-template-columns:1fr;}}
            `;
            document.head.appendChild(style);
        }

        if (elements.productForm && !document.getElementById('product-id')) {
            elements.productForm.innerHTML = `
                <h3 id="product-form-title">新增产品</h3>
                <div class="admin-form-grid">
                    <input id="product-id" type="text" placeholder="产品ID（留空自动生成）">
                    <select id="product-category">
                        <option value="fiction">小说文学</option>
                        <option value="nonfiction">非虚构</option>
                        <option value="academic">学术</option>
                        <option value="children">儿童读物</option>
                    </select>
                    <input id="product-title" type="text" placeholder="标题">
                    <input id="product-author" type="text" placeholder="作者">
                    <input id="product-price" type="number" step="0.01" placeholder="价格">
                    <input id="product-rating" type="number" min="0" max="5" step="0.1" placeholder="评分">
                    <input id="product-publisher" type="text" placeholder="出版社">
                    <input id="product-isbn" type="text" placeholder="ISBN">
                    <input id="product-tags" class="full" type="text" placeholder="标签（逗号分隔）">
                    <textarea id="product-description" class="full" rows="3" placeholder="简短描述"></textarea>
                    <textarea id="product-summary-html" class="full" rows="4" placeholder="支持 HTML 的详情介绍"></textarea>
                    <div class="full photo-manager">
                        <label>产品图片（支持多张，符合 Block B1）</label>
                        <div class="photo-input-row">
                            <input id="product-photo-input" type="text" placeholder="输入图片 URL 后点击添加">
                            <button type="button" class="btn btn-secondary" id="add-photo-btn">添加图片</button>
                        </div>
                        <textarea id="product-photos" rows="3" placeholder="也可直接粘贴图片 URL，多张请换行或逗号分隔"></textarea>
                        <div id="photo-preview-grid" class="photo-preview-grid"></div>
                    </div>
                    <label class="full"><input id="product-disabled" type="checkbox"> 下架 / 禁用该产品</label>
                </div>
                <div class="admin-card-actions" style="margin-top:16px;">
                    <button type="submit" class="btn btn-primary">保存</button>
                    <button type="button" class="btn btn-outline" id="close-product-modal">取消</button>
                </div>
            `;
        }

        const ordersSection = document.querySelector('#orders .container');
        if (ordersSection && !document.getElementById('admin-order-filter-bar')) {
            const toolbar = document.createElement('div');
            toolbar.className = 'admin-toolbar';
            toolbar.innerHTML = `
                <div class="admin-filter-bar" id="admin-order-filter-bar">
                    <button class="btn btn-outline admin-order-filter active" type="button" data-status="all">全部订单</button>
                    <button class="btn btn-outline admin-order-filter" type="button" data-status="pending">待处理</button>
                    <button class="btn btn-outline admin-order-filter" type="button" data-status="hold">暂缓</button>
                    <button class="btn btn-outline admin-order-filter" type="button" data-status="shipped">已发货</button>
                    <button class="btn btn-outline admin-order-filter" type="button" data-status="cancelled">已取消</button>
                </div>
                <div class="admin-chip">Block B 订单处理</div>
            `;
            const ordersList = document.getElementById('admin-orders-list');
            ordersSection.insertBefore(toolbar, ordersList);
        }

        if (!document.getElementById('order-modal')) {
            const modal = document.createElement('div');
            modal.id = 'order-modal';
            modal.className = 'modal';
            modal.innerHTML = '<div class="modal-content"><div id="order-modal-body"></div></div>';
            document.body.appendChild(modal);
        }
    }

    function formatDate(value) {
        return value ? new Date(value).toLocaleString('zh-CN', { hour12: false }) : '-';
    }

    function renderBooks(filtered = books) {
        if (!elements.booksGrid) return;
        elements.booksGrid.innerHTML = '';
        if (!filtered.length) {
            elements.booksGrid.innerHTML = '<div class="empty-state">未找到产品</div>';
            return;
        }
        filtered.forEach(book => {
            const card = document.createElement('div');
            card.className = 'admin-product-card';
            card.innerHTML = `
                <div style="display:flex;justify-content:space-between;gap:12px;align-items:flex-start;">
                    <div>
                        <h3>${book.title}</h3>
                        <div>ID: ${book.id}</div>
                        <div>作者：${book.author}</div>
                        <div>分类：${book.category}</div>
                        <div>价格：¥ ${book.price.toFixed(2)}</div>
                    </div>
                    <div class="admin-chip">${book.disabled ? '已下架' : '上架中'}</div>
                </div>
                <div>${book.description}</div>
                <div>标签：${book.tags.map(tag => `#${tag}`).join(' ') || '无'}</div>
                <div>图片数：${book.photos.length}</div>
                <div class="admin-card-actions">
                    <button class="btn btn-secondary edit-btn" type="button" data-id="${book.id}">编辑</button>
                    <button class="btn btn-outline toggle-btn" type="button" data-id="${book.id}">${book.disabled ? '启用' : '禁用'}</button>
                </div>
            `;
            card.querySelector('.edit-btn')?.addEventListener('click', () => openProductModal(book.id));
            card.querySelector('.toggle-btn')?.addEventListener('click', () => toggleBookStatus(book.id));
            elements.booksGrid.appendChild(card);
        });
    }

    function getSelectedOrderStatus() {
        return document.querySelector('.admin-order-filter.active')?.dataset.status || 'all';
    }

    function renderPhotoManager() {
        const textarea = document.getElementById('product-photos');
        const grid = document.getElementById('photo-preview-grid');
        if (!textarea || !grid) return;
        editingPhotos = (Array.isArray(editingPhotos) ? editingPhotos : []).map(item => String(item).trim()).filter(Boolean);
        textarea.value = editingPhotos.join('\n');
        grid.innerHTML = editingPhotos.length
            ? editingPhotos.map((photo, index) => `
                <div class="photo-preview-item">
                    <img src="${photo}" alt="产品图片 ${index + 1}" onerror="this.src='${createPlaceholderSvg('图片失效')}'">
                    <div style="font-size:12px;word-break:break-all;">${photo}</div>
                    <button type="button" class="btn btn-outline remove-photo-btn" data-index="${index}">移除</button>
                </div>
            `).join('')
            : '<div class="empty-state">暂无图片，请至少添加一张。</div>';
        grid.querySelectorAll('.remove-photo-btn').forEach(btn => btn.addEventListener('click', () => {
            editingPhotos.splice(Number(btn.dataset.index), 1);
            renderPhotoManager();
        }));
    }

    function syncPhotosFromTextarea() {
        const rawPhotos = document.getElementById('product-photos')?.value || '';
        editingPhotos = rawPhotos.split(/[\n,]/).map(item => item.trim()).filter(Boolean);
        renderPhotoManager();
    }

    function renderOrders(status = getSelectedOrderStatus()) {
        if (!elements.ordersList) return;
        elements.ordersList.innerHTML = '';
        const filteredOrders = status === 'all' ? orders : orders.filter(order => order.status === status);
        if (!filteredOrders.length) {
            elements.ordersList.innerHTML = '<div class="empty-state">暂无订单</div>';
            return;
        }
        filteredOrders.forEach(order => {
            const card = document.createElement('div');
            card.className = 'admin-order-card';
            card.innerHTML = `
                <div style="display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap;">
                    <div>
                        <strong>订单号：${order.poNumber}</strong>
                        <div>客户：${order.customerName || '未知客户'}</div>
                        <div>下单时间：${formatDate(order.purchaseDate)}</div>
                        <div>总额：¥ ${(order.totalAmount || 0).toFixed(2)}</div>
                    </div>
                    <div class="admin-chip">${ORDER_STATUS_LABELS[order.status] || order.status}</div>
                </div>
                <div>收货地址：${order.shippingAddress || '-'}</div>
                <div class="admin-order-actions">
                    <button class="btn btn-secondary view-order-btn" type="button" data-id="${order.id}">查看详情</button>
                    <button class="btn btn-outline status-btn" type="button" data-id="${order.id}" data-status="hold">设为暂缓</button>
                    <button class="btn btn-outline status-btn" type="button" data-id="${order.id}" data-status="shipped">发货</button>
                    <button class="btn btn-outline status-btn" type="button" data-id="${order.id}" data-status="cancelled">取消</button>
                </div>
            `;
            card.querySelector('.view-order-btn')?.addEventListener('click', () => openOrderModal(order.id));
            card.querySelectorAll('.status-btn').forEach(btn => btn.addEventListener('click', () => updateOrderStatus(order.id, btn.dataset.status)));
            elements.ordersList.appendChild(card);
        });
    }


    function syncPhotoTextarea(photos) {
        const textarea = document.getElementById('product-photos');
        if (textarea) textarea.value = photos.join('\n');
    }

    function renderPhotoManager(photos) {
        const list = document.getElementById('photo-manager-list');
        if (!list) return;
        list.innerHTML = '';
        const normalized = formatPhotoList(photos);
        if (!normalized.length) {
            list.innerHTML = '<div class="status-hint">暂无图片，将自动使用占位图。</div>';
            return;
        }
        normalized.forEach((photo, index) => {
            const item = document.createElement('div');
            item.className = 'photo-item';
            item.innerHTML = `
                <img src="${photo}" alt="产品图片 ${index + 1}" onerror="this.src='${createPlaceholderSvg('图书')}'">
                <div style="word-break:break-all;font-size:12px;color:#6b7280;">${photo}</div>
                <button type="button" class="btn btn-outline remove-photo-btn" data-index="${index}">移除这张图</button>
            `;
            item.querySelector('.remove-photo-btn')?.addEventListener('click', () => {
                const next = normalized.filter((_, currentIndex) => currentIndex !== index);
                syncPhotoTextarea(next);
                renderPhotoManager(next);
            });
            list.appendChild(item);
        });
    }

    function openProductModal(bookId = null) {
        editingProductId = bookId;
        const title = document.getElementById('product-form-title');
        const modal = elements.productModal;
        if (!modal) return;
        const book = books.find(item => item.id === bookId);
        if (title) title.textContent = book ? '编辑产品' : '新增产品';
        document.getElementById('product-id').value = book?.id ?? '';
        document.getElementById('product-title').value = book?.title ?? '';
        document.getElementById('product-author').value = book?.author ?? '';
        document.getElementById('product-price').value = book?.price ?? '';
        document.getElementById('product-rating').value = book?.rating ?? '';
        document.getElementById('product-description').value = book?.description ?? '';
        document.getElementById('product-category').value = book?.category ?? 'fiction';
        document.getElementById('product-tags').value = book?.tags?.join(', ') ?? '';
        document.getElementById('product-publisher').value = book?.publisher ?? '';
        document.getElementById('product-isbn').value = book?.isbn ?? '';
        document.getElementById('product-summary-html').value = book?.summaryHtml ?? '';
        editingPhotos = book?.photos ? [...book.photos] : [];
        document.getElementById('product-photos').value = editingPhotos.join('\n');
        document.getElementById('product-disabled').checked = Boolean(book?.disabled);
        renderPhotoManager();
        modal.classList.add('active');
    }

    function closeProductModal() {
        elements.productModal?.classList.remove('active');
        editingProductId = null;
    }

    function getFormData() {
        syncPhotosFromTextarea();
        const photos = [...editingPhotos];
        return normalizeBook({
            id: document.getElementById('product-id').value.trim() || Date.now(),
            title: document.getElementById('product-title').value.trim(),
            author: document.getElementById('product-author').value.trim(),
            price: document.getElementById('product-price').value,
            rating: document.getElementById('product-rating').value,
            description: document.getElementById('product-description').value.trim(),
            category: document.getElementById('product-category').value,
            tags: document.getElementById('product-tags').value,
            publisher: document.getElementById('product-publisher').value.trim(),
            isbn: document.getElementById('product-isbn').value.trim(),
            summary_html: sanitizeSummaryHtml(document.getElementById('product-summary-html').value.trim()),
            photos,
            disabled: document.getElementById('product-disabled').checked
        }, books.length);
    }

    async function saveBook(book) {
        const index = books.findIndex(item => String(item.id) === String(editingProductId ?? book.id));
        if (index >= 0) {
            books[index] = book;
        } else {
            books.unshift(book);
        }
        persistBooks();
        if (client) {
            try {
                await client.from('books').upsert([{ 
                    id: book.id,
                    title: book.title,
                    author: book.author,
                    category: book.category,
                    price: book.price,
                    rating: book.rating,
                    description: book.description,
                    summary_html: book.summaryHtml,
                    publisher: book.publisher,
                    isbn: book.isbn,
                    tags: book.tags,
                    photos: book.photos,
                    disabled: book.disabled,
                    color: book.color
                }]);
            } catch (err) {
                console.warn('supabase upsert skipped', err);
            }
        }
        renderBooks();
        closeProductModal();
    }

    async function toggleBookStatus(bookId) {
        const target = books.find(item => String(item.id) === String(bookId));
        if (!target) return;
        target.disabled = !target.disabled;
        await saveBook(target);
    }

    function searchBooks() {
        const query = (elements.searchInput?.value || '').trim().toLowerCase();
        if (!query) {
            renderBooks();
            return;
        }
        const filtered = books.filter(book => {
            const haystack = [book.id, book.title, book.author, book.description, book.publisher, book.isbn, ...book.tags].join(' ').toLowerCase();
            return haystack.includes(query);
        });
        renderBooks(filtered);
    }

    function updateOrderStatus(orderId, status) {
        const order = orders.find(item => item.id === orderId);
        if (!order) return;
        if (!getAllowedTransitions(order.status).includes(status)) {
            alert('当前订单状态不允许执行这个操作');
            return;
        }
        order.status = status;
        if (status === 'hold') order.holdDate = new Date().toISOString();
        if (status === 'shipped') order.shipmentDate = new Date().toISOString();
        if (status === 'cancelled') order.cancelDate = new Date().toISOString();
        persistOrders();
        renderOrders();
    }

    function openOrderModal(orderId) {
        const order = orders.find(item => item.id === orderId);
        const modal = document.getElementById('order-modal');
        const body = document.getElementById('order-modal-body');
        if (!order || !modal || !body) return;
        body.innerHTML = `
            <h3>订单详情</h3>
            <div>订单号：${order.poNumber}</div>
            <div>客户：${order.customerName || '未知客户'}</div>
            <div>状态：${ORDER_STATUS_LABELS[order.status] || order.status}</div>
            <div>下单时间：${formatDate(order.purchaseDate)}</div>
            <div>发货时间：${formatDate(order.shipmentDate)}</div>
            <div>取消时间：${formatDate(order.cancelDate)}</div>
            <div>暂缓时间：${formatDate(order.holdDate)}</div>
            <div class="status-hint">订单状态流转：待处理 → 暂缓/已发货/已取消；暂缓 → 已发货/已取消</div>
            <div class="order-detail-panel">
                <strong>订单商品</strong>
                <ul>${(order.items || []).map(item => `<li>${item.title} × ${item.quantity} / 单价 ¥ ${(item.price || 0).toFixed(2)} / 小计 ¥ ${(item.subtotal || 0).toFixed(2)}</li>`).join('')}</ul>
            </div>
            <div class="admin-card-actions" style="margin-top:16px;">
                <button class="btn btn-primary" type="button" id="close-order-modal">关闭</button>
            </div>
        `;
        body.querySelector('#close-order-modal')?.addEventListener('click', () => modal.classList.remove('active'));
        modal.classList.add('active');
    }

    function bindEvents() {
        elements.addProductBtn?.addEventListener('click', () => openProductModal());
        document.getElementById('add-photo-btn')?.addEventListener('click', () => {
            const input = document.getElementById('product-photo-input');
            const value = input?.value.trim();
            if (!value) return;
            editingPhotos.push(value);
            if (input) input.value = '';
            renderPhotoManager();
        });
        document.getElementById('product-photos')?.addEventListener('change', syncPhotosFromTextarea);
        elements.searchBtn?.addEventListener('click', searchBooks);
        elements.searchInput?.addEventListener('keydown', event => { if (event.key === 'Enter') searchBooks(); });
        elements.productForm?.addEventListener('submit', async event => {
            event.preventDefault();
            const book = getFormData();
            if (!book.title || !book.author) return;
            await saveBook(book);
        });
        document.getElementById('product-photos')?.addEventListener('input', event => {
            renderPhotoManager(event.target.value);
        });
        document.addEventListener('click', event => {
            if (event.target.id === 'close-product-modal') closeProductModal();
            if (event.target === elements.productModal) closeProductModal();
            if (event.target.id === 'order-modal') document.getElementById('order-modal')?.classList.remove('active');
        });
        document.querySelectorAll('.admin-order-filter').forEach(button => button.addEventListener('click', () => {
            document.querySelectorAll('.admin-order-filter').forEach(item => item.classList.remove('active'));
            button.classList.add('active');
            renderOrders(button.dataset.status || 'all');
        }));
        document.addEventListener('keydown', event => {
            if (event.key === 'Escape') {
                closeProductModal();
                document.getElementById('order-modal')?.classList.remove('active');
            }
        });
    }

    ensureUi();
    await loadBooks();
    loadOrders();
    renderBooks();
    renderOrders();
    bindEvents();
});
