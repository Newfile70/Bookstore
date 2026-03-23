// admin-script.js - Block A/B/C enhanced admin portal

document.addEventListener('DOMContentLoaded', async () => {
	// 产品分页
let productsPageSize = 12;
let productsCurrentPage = 1;
let productsFilteredBooks = [];   // 存储当前产品列表（全量或搜索结果）

// 订单分页
let ordersPageSize = 10;
let ordersCurrentPage = 1;
let ordersFilteredOrders = [];    // 存储当前订单列表（全量或状态筛选）
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
        arrived: '已到货',
        received: '已收货',
        cancelled: '已取消'
    };

    const ORDER_STATUS_TRANSITIONS = {
        pending: ['hold', 'shipped', 'cancelled'],
        hold: ['shipped', 'cancelled'],
        shipped: ['arrived'],
        arrived: ['received'],
        received: [],
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
        productForm: document.getElementById('product-form'),
        logoutBtn: document.getElementById('logout-btn')
    };

    function hasMerchantAccess() {
        const loggedIn = sessionStorage.getItem('loggedIn') === 'true';
        const userType = sessionStorage.getItem('userType');
        const merchantAuthenticated = sessionStorage.getItem('merchantAuthenticated') === 'true';
        return loggedIn && userType === 'merchant' && merchantAuthenticated;
    }

    function redirectToLogin() {
        alert('请先通过商家登录后再访问管理后台');
        window.location.replace('index.html');
    }

    if (!hasMerchantAccess()) {
        redirectToLogin();
        return;
    }

    function safeParse(value, fallback) {
        try { return JSON.parse(value) ?? fallback; } catch { return fallback; }
    }

    function createPlaceholderSvg(text) {
        const safeText = String(text).slice(0, 12).replace(/[&<>"']/g, char => ({
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#39;'
        }[char]));
        const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="480" height="640" viewBox="0 0 480 640"><rect width="100%" height="100%" fill="#b09d7b"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" font-size="28" fill="white">${safeText}</text></svg>`;
        return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
    }

    function isGeneratedPlaceholderPhoto(value) {
        const text = String(value || '').trim();
            return /^data:image\/svg\+xml/i.test(text)
                || /^<svg[\s>]/i.test(text)
                || /^<\?xml[\s\S]*<svg[\s>]/i.test(text);
    }

    function isMalformedPhotoEntry(value) {
        const text = String(value || '').trim();
        if (!text) return true;
        if (/^data:image\//i.test(text) && !text.includes(',')) return true;
        if (/^[A-Za-z0-9+/=]{20,}$/.test(text)) return true;
        return false;
    }

    function normalizeEditablePhotos(value) {
        return splitPhotoInput(value)
            .map(item => String(item).trim())
            .filter(Boolean)
            .filter(item => !isMalformedPhotoEntry(item))
            .filter(item => !isGeneratedPlaceholderPhoto(item));
    }

    function splitPhotoInput(value) {
        if (Array.isArray(value)) {
            return value.flatMap(item => splitPhotoInput(item));
        }

        const text = String(value || '').trim();
        if (!text) return [];

        const lines = text.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
        const chunks = lines.length > 1 ? lines : [text];

        return chunks.flatMap(chunk => {
            const item = String(chunk || '').trim();
            if (!item) return [];

            if (/^data:image\//i.test(item) || /^blob:/i.test(item)) {
                return [item];
            }

            return item.split(',').map(part => part.trim()).filter(Boolean);
        });
    }

    function sanitizePhotoUrl(value) {
        const text = String(value || '').trim();
        if (!text) return '';
        if (isGeneratedPlaceholderPhoto(text)) return '';
        if (/^javascript:/i.test(text)) return '';
        if (/^https?:\/\//i.test(text) || /^data:image\//i.test(text) || /^blob:/i.test(text) || text.startsWith('/')) {
            return text;
        }
        if (!/^[a-z][a-z0-9+.-]*:/i.test(text)) {
            return text;
        }
        return '';
    }

    function readFileAsDataUrl(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(String(reader.result || ''));
            reader.onerror = () => reject(new Error(`读取文件失败: ${file?.name || 'unknown'}`));
            reader.readAsDataURL(file);
        });
    }

    async function addLocalPhotoFiles(fileList) {
        const files = Array.from(fileList || []);
        if (!files.length) return;

        const imageFiles = files.filter(file => String(file?.type || '').startsWith('image/'));
        const skipped = files.length - imageFiles.length;
        if (!imageFiles.length) {
            alert('请选择图片文件（jpg/png/webp/gif 等）');
            return;
        }

        const nextPhotos = [];
        for (const file of imageFiles) {
            try {
                const dataUrl = await readFileAsDataUrl(file);
                if (dataUrl) nextPhotos.push(dataUrl);
            } catch (error) {
                console.error(error);
            }
        }

        if (nextPhotos.length) {
            editingPhotos.push(...nextPhotos);
            renderPhotoManager();
        }

        if (skipped > 0) {
            alert(`已跳过 ${skipped} 个非图片文件`);
        }
    }

    function getDefaultCoverLabel() {
        const title = document.getElementById('product-title')?.value?.trim();
        return title || '默认封面';
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
        const normalized = normalizeOrderStatus(status);
        return ORDER_STATUS_TRANSITIONS[normalized] || [];
    }

    function normalizeOrderStatus(status) {
        const raw = String(status || '').trim().toLowerCase();
        if (!raw) return 'pending';

        if (['pending', '待处理', '待发货', 'new'].includes(raw)) return 'pending';
        if (['hold', '暂缓', 'on_hold', 'on-hold'].includes(raw)) return 'hold';
        if (['shipped', '已发货', 'completed', 'done'].includes(raw)) return 'shipped';
        if (['arrived', '已到货', 'delivered'].includes(raw)) return 'arrived';
        if (['received_done', 'received', '已收货', 'signed'].includes(raw)) return 'received';
        if (['cancelled', 'canceled', '已取消', 'cancel'].includes(raw)) return 'cancelled';

        return raw;
    }

    function formatPhotoList(value) {
        return splitPhotoInput(value)
            .map(item => String(item).trim())
            .filter(Boolean);
    }

    function normalizeOrder(raw, index) {
        const items = Array.isArray(raw?.items)
            ? raw.items
            : safeParse(raw?.items, []);
        const userId = raw?.user_id ?? raw?.userId;
        const fallbackCustomer = userId ? `用户 ${String(userId).slice(0, 8)}` : '未知客户';

        return {
            id: raw?.id ?? `local-${index}`,
            poNumber: raw?.po_number ?? raw?.poNumber ?? `PO-${Date.now()}-${index}`,
            customerName: raw?.customer_name ?? raw?.customerName ?? fallbackCustomer,
            purchaseDate: raw?.purchase_date ?? raw?.purchaseDate ?? raw?.created_at ?? raw?.createdAt ?? new Date().toISOString(),
            totalAmount: Number(raw?.total_amount ?? raw?.totalAmount ?? 0) || 0,
            shippingAddress: raw?.shipping_address ?? raw?.shippingAddress ?? '-',
            status: normalizeOrderStatus(raw?.status),
            items: Array.isArray(items) ? items : [],
            holdDate: raw?.hold_date ?? raw?.holdDate,
            shipmentDate: raw?.shipment_date ?? raw?.shipmentDate,
            arrivedDate: raw?.arrived_date ?? raw?.arrivedDate,
            receivedDate: raw?.received_date ?? raw?.receivedDate,
            cancelDate: raw?.cancel_date ?? raw?.cancelDate,
            paymentMethod: raw?.payment_method ?? raw?.paymentMethod ?? ''
        };
    }

    function toOrderUpdatePayload(status) {
        const now = new Date().toISOString();
        const payload = { status };
        if (status === 'hold') payload.hold_date = now;
        if (status === 'shipped') payload.shipment_date = now;
        if (status === 'arrived') payload.arrived_date = now;
        if (status === 'received') payload.received_date = now;
        if (status === 'cancelled') payload.cancel_date = now;
        return payload;
    }

    function toOrderUpdatePayloadCamel(status) {
        const now = new Date().toISOString();
        const payload = { status };
        if (status === 'hold') payload.holdDate = now;
        if (status === 'shipped') payload.shipmentDate = now;
        if (status === 'arrived') payload.arrivedDate = now;
        if (status === 'received') payload.receivedDate = now;
        if (status === 'cancelled') payload.cancelDate = now;
        return payload;
    }

    function shouldAutoReceiveOrder(order) {
        return normalizeOrderStatus(order?.status) === 'arrived'
            && order?.arrivedDate
            && (Date.now() - new Date(order.arrivedDate).getTime()) >= 7 * 24 * 60 * 60 * 1000;
    }

    function normalizeBook(raw, index) {
        const photos = normalizeEditablePhotos([raw.photos, raw.images, raw.photo_urls, raw.image_urls]
            .filter(Boolean)
            .flatMap(value => splitPhotoInput(value))
            .map(item => String(item).trim())
            .filter(Boolean));
        const tags = (Array.isArray(raw.tags) ? raw.tags : String(raw.tags || '').split(/[#,，,\s]+/))
            .map(tag => tag.trim())
            .filter(Boolean);
        return {
            id: raw.id ?? index + 1,
            title: raw.title ?? '未命名图书',
            author: raw.author ?? '未知作者',
            category: raw.category ?? 'all',
            price: Number.parseFloat(raw.price) || 0,
            rating: Number.parseFloat(raw.rating) || 0,
            description: raw.description ?? '暂无简介',
            summaryHtml: sanitizeSummaryHtml(raw.summary_html || raw.summaryHtml || `<p>${raw.description ?? '暂无简介'}</p>`),
            publisher: raw.publisher || '未知出版社',
            isbn: raw.isbn || `ISBN-${String(index + 100000)}`,
            tags,
            photos,
            disabled: Boolean(raw.disabled),
            color: raw.color || '#b09d7b'
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
		    productsFilteredBooks = books;
    productsCurrentPage = 1;
    renderProductsWithPagination();
    persistBooks();
       
    }
// 渲染当前页产品
function renderProductsWithPagination() {
    const start = (productsCurrentPage - 1) * productsPageSize;
    const pageBooks = productsFilteredBooks.slice(start, start + productsPageSize);
    renderBooks(pageBooks);          // 复用已有的 renderBooks 函数
    renderProductsPagination();
}

// 渲染产品分页控件
function renderProductsPagination() {
    const totalPages = Math.ceil(productsFilteredBooks.length / productsPageSize);
    const paginationDiv = document.getElementById('products-pagination');
    if (!paginationDiv) return;

    if (totalPages <= 1) {
        paginationDiv.innerHTML = '';
        return;
    }

    paginationDiv.innerHTML = '';

    // 上一页按钮
    const prevBtn = document.createElement('button');
    prevBtn.textContent = '上一页';
    prevBtn.className = 'pagination-btn';
    prevBtn.disabled = productsCurrentPage === 1;
    prevBtn.addEventListener('click', () => {
        if (productsCurrentPage > 1) {
            productsCurrentPage--;
            renderProductsWithPagination();
        }
    });
    paginationDiv.appendChild(prevBtn);

    // 页码按钮（最多显示7个）
    const maxVisible = 5;
    let startPage = Math.max(1, productsCurrentPage - Math.floor(maxVisible / 2));
    let endPage = Math.min(totalPages, startPage + maxVisible - 1);
    if (endPage - startPage < maxVisible - 1) startPage = Math.max(1, endPage - maxVisible + 1);

    for (let i = startPage; i <= endPage; i++) {
        const pageBtn = document.createElement('button');
        pageBtn.textContent = i;
        pageBtn.className = 'pagination-btn' + (i === productsCurrentPage ? ' active' : '');
        pageBtn.addEventListener('click', () => {
            productsCurrentPage = i;
            renderProductsWithPagination();
        });
        paginationDiv.appendChild(pageBtn);
    }

    // 下一页按钮
    const nextBtn = document.createElement('button');
    nextBtn.textContent = '下一页';
    nextBtn.className = 'pagination-btn';
    nextBtn.disabled = productsCurrentPage === totalPages;
    nextBtn.addEventListener('click', () => {
        if (productsCurrentPage < totalPages) {
            productsCurrentPage++;
            renderProductsWithPagination();
        }
    });
    paginationDiv.appendChild(nextBtn);
}
    async function loadOrders() {
        let source = [];

        if (client) {
            try {
                const orderFields = ['purchase_date', 'purchaseDate', 'created_at', 'createdAt'];
                for (const field of orderFields) {
                    const { data, error } = await client
                        .from('orders')
                        .select('*')
                        .order(field, { ascending: false });
                    if (!error && Array.isArray(data)) {
                        source = data;
                        break;
                    }

                    if (error) {
                        const msg = String(error.message || '');
                        const missingColumn = getMissingColumnName(error);
                        if (missingColumn || msg.includes('schema cache')) {
                            continue;
                        }
                        console.error('load orders from Supabase failed', error);
                        break;
                    }
                }

                if (!source.length) {
                    const { data, error } = await client.from('orders').select('*');
                    if (!error && Array.isArray(data)) {
                        source = data;
                    } else if (error) {
                        console.error('load orders from Supabase fallback failed', error);
                    }
                }
            } catch (err) {
                console.error('load orders failed', err);
            }
        }

        if (!source.length) {
            source = safeParse(localStorage.getItem(STORAGE_KEYS.orders), []);
        }

        orders = source
            .map(normalizeOrder)
            .sort((a, b) => new Date(b.purchaseDate) - new Date(a.purchaseDate));
    ordersFilteredOrders = orders;
    ordersCurrentPage = 1;
    renderOrdersWithPagination();
    persistOrders();
        const autoReceiveTargets = orders.filter(shouldAutoReceiveOrder);
        for (const order of autoReceiveTargets) {
            order.status = 'received';
            order.receivedDate = new Date().toISOString();
            if (client) {
                for (const payload of [toOrderUpdatePayload('received'), toOrderUpdatePayloadCamel('received'), { status: 'received' }]) {
                    const { error } = await client.from('orders').update(payload).eq('id', order.id);
                    if (!error) break;
                    const msg = String(error?.message || '');
                    if (!msg.includes('schema cache') && !msg.includes('column')) break;
                }
            }
        }

        persistOrders();
    }
// 渲染当前页订单
function renderOrdersWithPagination() {
	    if (!elements.ordersList) return;
    elements.ordersList.innerHTML = '';
    const start = (ordersCurrentPage - 1) * ordersPageSize;
    const pageOrders = ordersFilteredOrders.slice(start, start + ordersPageSize);
    renderOrders(pageOrders);          // 复用已有的 renderOrders 函数（需要修改，见下文）
    renderOrdersPagination();
}

// 渲染订单分页控件
function renderOrdersPagination() {
    const totalPages = Math.ceil(ordersFilteredOrders.length / ordersPageSize);
    const paginationDiv = document.getElementById('orders-pagination');
    if (!paginationDiv) return;

    if (totalPages <= 1) {
        paginationDiv.innerHTML = '';
        return;
    }

    paginationDiv.innerHTML = '';

    // 上一页按钮
    const prevBtn = document.createElement('button');
    prevBtn.textContent = '上一页';
    prevBtn.className = 'pagination-btn';
    prevBtn.disabled = ordersCurrentPage === 1;
    prevBtn.addEventListener('click', () => {
        if (ordersCurrentPage > 1) {
            ordersCurrentPage--;
            renderOrdersWithPagination();
        }
    });
    paginationDiv.appendChild(prevBtn);

    // 页码按钮（最多显示5个）
    const maxVisible = 5;
    let startPage = Math.max(1, ordersCurrentPage - Math.floor(maxVisible / 2));
    let endPage = Math.min(totalPages, startPage + maxVisible - 1);
    if (endPage - startPage < maxVisible - 1) startPage = Math.max(1, endPage - maxVisible + 1);

    for (let i = startPage; i <= endPage; i++) {
        const pageBtn = document.createElement('button');
        pageBtn.textContent = i;
        pageBtn.className = 'pagination-btn' + (i === ordersCurrentPage ? ' active' : '');
        pageBtn.addEventListener('click', () => {
            ordersCurrentPage = i;
            renderOrdersWithPagination();
        });
        paginationDiv.appendChild(pageBtn);
    }

    // 下一页按钮
    const nextBtn = document.createElement('button');
    nextBtn.textContent = '下一页';
    nextBtn.className = 'pagination-btn';
    nextBtn.disabled = ordersCurrentPage === totalPages;
    nextBtn.addEventListener('click', () => {
        if (ordersCurrentPage < totalPages) {
            ordersCurrentPage++;
            renderOrdersWithPagination();
        }
    });
    paginationDiv.appendChild(nextBtn);
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
			    if (!document.getElementById('products-pagination')) {
        const productsGrid = document.getElementById('admin-products-grid');
        if (productsGrid) {
            const paginationDiv = document.createElement('div');
            paginationDiv.id = 'products-pagination';
            paginationDiv.className = 'pagination';
            productsGrid.after(paginationDiv);
        }
    }
    if (!document.getElementById('orders-pagination')) {
        const ordersList = document.getElementById('admin-orders-list');
        if (ordersList) {
            const paginationDiv = document.createElement('div');
            paginationDiv.id = 'orders-pagination';
            paginationDiv.className = 'pagination';
            ordersList.after(paginationDiv);
        }
    }
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
                    <input id="product-publisher" type="text" placeholder="出版社">
                    <input id="product-isbn" type="text" placeholder="ISBN">
                    <div class="full empty-state" style="padding:12px 14px;box-shadow:none;">评分由买家评价后自动生成，新上架商品默认显示“暂无评分”。</div>
                    <input id="product-tags" class="full" type="text" placeholder="标签（逗号分隔）">
                    <textarea id="product-description" class="full" rows="3" placeholder="简短描述"></textarea>
                    <textarea id="product-summary-html" class="full" rows="4" placeholder="支持 HTML 的详情介绍"></textarea>
                    <div class="full photo-manager">
                        <label>产品图片（支持多张，符合 Block B1）</label>
                        <div class="photo-input-row">
                            <input id="product-photo-input" type="text" placeholder="输入图片 URL 后点击添加">
                            <button type="button" class="btn btn-secondary" id="add-photo-btn">添加图片</button>
                        </div>
                        <input id="product-photo-file" type="file" accept="image/*" multiple>
                        <div style="font-size:12px;color:#6b7280;">可直接选择本地图片，无需先复制到项目目录；也支持继续粘贴图片 URL。</div>
                        <textarea id="product-photos" rows="3" placeholder="也可直接粘贴图片 URL，多张请优先换行分隔"></textarea>
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
                    <button class="btn btn-outline admin-order-filter" type="button" data-status="arrived">已到货</button>
                    <button class="btn btn-outline admin-order-filter" type="button" data-status="received">已收货</button>
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

    function activateAdminSection(sectionId) {
        const targetId = sectionId === 'orders' ? 'orders' : 'products';
        document.body.classList.add('admin-tabbed');

        document.querySelectorAll('.admin-section').forEach(section => {
            section.classList.toggle('active', section.id === targetId);
        });

        document.querySelectorAll('.nav-links .nav-link[href^="#"]').forEach(link => {
            const href = String(link.getAttribute('href') || '');
            link.classList.toggle('active', href === `#${targetId}`);
        });
    }

    function initAdminSectionTabs() {
        const sectionLinks = Array.from(document.querySelectorAll('.nav-links .nav-link[href^="#"]'));
        if (!sectionLinks.length) return;

        if (!document.getElementById('admin-tabbed-style')) {
            const style = document.createElement('style');
            style.id = 'admin-tabbed-style';
            style.textContent = `
                body.admin-tabbed .admin-section{display:none;}
                body.admin-tabbed .admin-section.active{display:block;}
            `;
            document.head.appendChild(style);
        }

        sectionLinks.forEach(link => {
            link.addEventListener('click', event => {
                event.preventDefault();
                const targetId = String(link.getAttribute('href') || '').replace('#', '');
                activateAdminSection(targetId || 'products');
                history.replaceState(null, '', `#${targetId || 'products'}`);
            });
        });

        const initialHash = window.location.hash.replace('#', '');
        activateAdminSection(initialHash || 'products');
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
        editingPhotos = normalizeEditablePhotos(editingPhotos);
        textarea.value = editingPhotos.join('\n');
        grid.innerHTML = '';

        if (!editingPhotos.length) {
            const defaultItem = document.createElement('div');
            defaultItem.className = 'photo-preview-item';

            const defaultImg = document.createElement('img');
            defaultImg.alt = '系统默认封面';
            defaultImg.src = createPlaceholderSvg(getDefaultCoverLabel());

            const defaultText = document.createElement('div');
            defaultText.style.fontSize = '12px';
            defaultText.style.wordBreak = 'break-all';
            defaultText.textContent = '当前未添加自定义封面，系统默认封面将用于展示。';

            const defaultBadge = document.createElement('button');
            defaultBadge.type = 'button';
            defaultBadge.className = 'btn btn-outline remove-photo-btn';
            defaultBadge.disabled = true;
            defaultBadge.textContent = '默认封面';

            defaultItem.appendChild(defaultImg);
            defaultItem.appendChild(defaultText);
            defaultItem.appendChild(defaultBadge);
            grid.appendChild(defaultItem);

            const empty = document.createElement('div');
            empty.className = 'empty-state';
            empty.textContent = '暂无自定义图片，当前将保留系统默认封面。';
            grid.appendChild(empty);
            return;
        }

        const hint = document.createElement('div');
        hint.className = 'empty-state';
        hint.textContent = '已添加自定义封面，前台将不再显示系统默认封面。';
        grid.appendChild(hint);

        editingPhotos.forEach((photo, index) => {
            const item = document.createElement('div');
            item.className = 'photo-preview-item';

            const img = document.createElement('img');
            img.alt = `产品图片 ${index + 1}`;
            img.src = sanitizePhotoUrl(photo) || createPlaceholderSvg('图片失效');
            img.addEventListener('error', () => {
                img.src = createPlaceholderSvg('图片失效');
            });

            const text = document.createElement('div');
            text.style.fontSize = '12px';
            text.style.wordBreak = 'break-all';
            text.textContent = photo;

            const button = document.createElement('button');
            button.type = 'button';
            button.className = 'btn btn-outline remove-photo-btn';
            button.dataset.index = String(index);
            button.textContent = '移除';
            button.addEventListener('click', () => {
                editingPhotos.splice(index, 1);
                renderPhotoManager();
            });

            item.appendChild(img);
            item.appendChild(text);
            item.appendChild(button);
            grid.appendChild(item);
        });
    }

    function syncPhotosFromTextarea() {
        const rawPhotos = document.getElementById('product-photos')?.value || '';
        editingPhotos = normalizeEditablePhotos(rawPhotos);
        renderPhotoManager();
    }

function renderOrders(ordersToRender = null) {
    if (!elements.ordersList) return;
    elements.ordersList.innerHTML = '';
    // 如果传入了 ordersToRender，直接使用；否则根据当前筛选状态从全局 orders 获取
    const filteredOrders = ordersToRender ?? (getSelectedOrderStatus() === 'all' ? orders : orders.filter(order => order.status === getSelectedOrderStatus()));
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
                <button class="btn btn-outline status-btn" type="button" data-id="${order.id}" data-status="arrived">已到货</button>
                <button class="btn btn-outline status-btn" type="button" data-id="${order.id}" data-status="cancelled">取消</button>
            </div>
        `;
        card.querySelector('.view-order-btn')?.addEventListener('click', () => openOrderModal(order.id));
        card.querySelectorAll('.status-btn').forEach(btn => btn.addEventListener('click', () => updateOrderStatus(order.id, btn.dataset.status)));
        elements.ordersList.appendChild(card);
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
        const existingBook = books.find(item => String(item.id) === String(editingProductId));
        const rawId = document.getElementById('product-id').value.trim();
        const idValue = rawId ? Number(rawId) : null;
        if (rawId && (!Number.isFinite(idValue) || idValue <= 0)) {
            alert('产品ID 必须是正整数，或留空自动生成');
            return null;
        }

        return {
            id: idValue,
            title: document.getElementById('product-title').value.trim() || '未命名图书',
            author: document.getElementById('product-author').value.trim() || '未知作者',
            category: document.getElementById('product-category').value || 'all',
            price: Number.parseFloat(document.getElementById('product-price').value) || 0,
            rating: Number.isFinite(Number(existingBook?.rating)) ? Number(existingBook.rating) : 0,
            description: document.getElementById('product-description').value.trim() || '暂无简介',
            summaryHtml: sanitizeSummaryHtml(document.getElementById('product-summary-html').value.trim() || '<p>暂无简介</p>'),
            publisher: document.getElementById('product-publisher').value.trim() || '未知出版社',
            isbn: document.getElementById('product-isbn').value.trim() || '',
            tags: String(document.getElementById('product-tags').value || '').split(/[#,，,\s]+/).map(tag => tag.trim()).filter(Boolean),
            photos,
            disabled: document.getElementById('product-disabled').checked,
            color: '#b09d7b'
        };
    }

    function toBookPayload(book) {
        const payload = {
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
        };
        if (book.id !== null && book.id !== undefined && String(book.id).trim() !== '') {
            payload.id = book.id;
        }
        return payload;
    }

    function toBookPayloadBasic(book) {
        const payload = {
            title: book.title,
            author: book.author,
            category: book.category,
            price: book.price,
            rating: book.rating,
            description: book.description
        };
        if (book.id !== null && book.id !== undefined && String(book.id).trim() !== '') {
            payload.id = book.id;
        }
        return payload;
    }

    function getMissingColumnName(error) {
        const message = String(error?.message || '');
        const postgrestMatch = message.match(/Could not find the '([^']+)' column/i);
        if (postgrestMatch && postgrestMatch[1]) return postgrestMatch[1];

        const pgMatch = message.match(/column\s+"?([a-zA-Z0-9_]+)"?\s+does not exist/i);
        if (pgMatch && pgMatch[1]) return pgMatch[1];

        return null;
    }

    function upsertBookLocally(book, referenceId = editingProductId ?? book?.id) {
        const normalized = normalizeBook(book, books.length);
        const index = books.findIndex(item => String(item.id) === String(referenceId ?? normalized.id));
        if (index >= 0) books[index] = normalized;
        else books.unshift(normalized);

        persistBooks();
        renderBooks();
        closeProductModal();
        return normalized;
    }

    async function saveBook(book) {
        if (!client) {
            upsertBookLocally(book);
            alert('当前未连接到 Supabase，已先保存到本地缓存。');
            return true;
        }

        const payload = toBookPayload(book);
        const safePayload = { ...payload };

        let data = null;
        let error = null;

        for (let attempt = 0; attempt < 8; attempt += 1) {
            const result = await client
                .from('books')
                .upsert([safePayload])
                .select('*')
                .maybeSingle();

            data = result.data;
            error = result.error;
            if (!error) break;

            const missingColumn = getMissingColumnName(error);
            if (!missingColumn) break;
            if (missingColumn === 'id') break;
            if (!(missingColumn in safePayload)) break;

            delete safePayload[missingColumn];
        }

        if (error) {
            console.error('保存到 Supabase 失败:', error);
            const msg = String(error.message || error.details || error.hint || error.code || '未知错误');
            if (msg.includes('row-level security') || msg.includes('permission denied')) {
                alert('保存失败：数据库 RLS/权限策略阻止了写入，请在 Supabase 为 books 表配置 INSERT/UPDATE 策略。');
            } else {
                alert(`保存失败：${msg}`);
            }
            return false;
        }

        const cloudBook = normalizeBook({
            ...book,
            ...(data || {}),
            id: data?.id ?? book.id,
            disabled: typeof data?.disabled !== 'undefined' ? data.disabled : book.disabled,
            photos: Array.isArray(data?.photos) ? data.photos : book.photos,
            tags: Array.isArray(data?.tags) ? data.tags : book.tags,
            summary_html: data?.summary_html ?? book.summaryHtml,
            summaryHtml: data?.summaryHtml ?? data?.summary_html ?? book.summaryHtml
        }, 0);

        upsertBookLocally(cloudBook);
        return true;
    }

async function toggleBookStatus(bookId) {
    const target = books.find(item => String(item.id) === String(bookId));
    if (!target) return;
    const next = { ...target, disabled: !target.disabled };

    const ok = await saveBook(next);
    if (!ok) {
        // 保存失败，仅重新渲染当前页（保持现有数据）
        renderProductsWithPagination();
    } else {
        // 保存成功，重新加载全量产品列表
        await loadBooks();
    }
}

function searchBooks() {
    const query = (elements.searchInput?.value || '').trim().toLowerCase();
    if (!query) {
        // 无搜索词时恢复全量产品列表
        productsFilteredBooks = books;
    } else {
        const filtered = books.filter(book => {
            const haystack = [book.id, book.title, book.author, book.description, book.publisher, book.isbn, ...book.tags].join(' ').toLowerCase();
            return haystack.includes(query);
        });
        productsFilteredBooks = filtered;
    }
    productsCurrentPage = 1;
    renderProductsWithPagination();
}

    async function updateOrderStatus(orderId, status) {
        const order = orders.find(item => String(item.id) === String(orderId));
        if (!order) return;
        const currentStatus = normalizeOrderStatus(order.status);
        const targetStatus = normalizeOrderStatus(status);

        if (!getAllowedTransitions(currentStatus).includes(targetStatus)) {
            alert('当前订单状态不允许执行这个操作');
            return;
        }

        if (client) {
            const payloadCandidates = [toOrderUpdatePayload(targetStatus), toOrderUpdatePayloadCamel(targetStatus), { status: targetStatus }];
            let updateError = null;

            for (const payload of payloadCandidates) {
                const { error } = await client
                    .from('orders')
                    .update(payload)
                    .eq('id', order.id);

                if (!error) {
                    updateError = null;
                    break;
                }

                updateError = error;
                const msg = String(error.message || '');
                const missingColumn = getMissingColumnName(error);
                if (missingColumn || msg.includes('schema cache')) {
                    continue;
                }
                break;
            }

            if (updateError) {
                console.error('update order status failed', updateError);
                const msg = String(updateError.message || updateError.details || updateError.hint || '未知错误');
                const hint = msg.toLowerCase().includes('row-level security') || msg.toLowerCase().includes('permission denied')
                    ? '可能是 orders 表缺少 UPDATE 策略，请执行 server/supabase_orders_schema_patch_existing.sql。'
                    : (msg.includes('schema cache') || msg.includes('column'))
                        ? '可能是 orders 字段结构与前端不一致，请执行 server/supabase_orders_schema_patch_existing.sql。'
                        : '';
                alert(`更新订单状态失败：${msg}${hint ? `\n${hint}` : ''}`);
                return;
            }
        }

order.status = targetStatus;
if (targetStatus === 'hold') order.holdDate = new Date().toISOString();
if (targetStatus === 'shipped') order.shipmentDate = new Date().toISOString();
if (targetStatus === 'arrived') order.arrivedDate = new Date().toISOString();
if (targetStatus === 'received') order.receivedDate = new Date().toISOString();
if (targetStatus === 'cancelled') order.cancelDate = new Date().toISOString();
persistOrders();
// 重新加载订单（会重置分页并重新渲染）
await loadOrders();
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
            <div>到货时间：${formatDate(order.arrivedDate)}</div>
            <div>收货时间：${formatDate(order.receivedDate)}</div>
            <div>取消时间：${formatDate(order.cancelDate)}</div>
            <div>暂缓时间：${formatDate(order.holdDate)}</div>
            <div class="status-hint">订单状态流转：待处理 → 暂缓/已发货/已取消；暂缓 → 已发货/已取消；已发货 → 已到货；已到货 → 已收货</div>
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
        elements.logoutBtn?.addEventListener('click', () => {
            sessionStorage.removeItem('loggedIn');
            sessionStorage.removeItem('username');
            sessionStorage.removeItem('userType');
            sessionStorage.removeItem('merchantAuthenticated');
            try { localStorage.removeItem('user'); } catch (err) { /* ignore */ }
        });

        elements.addProductBtn?.addEventListener('click', () => openProductModal());
        document.getElementById('add-photo-btn')?.addEventListener('click', () => {
            const input = document.getElementById('product-photo-input');
            const value = input?.value.trim();
            if (!value) return;
            editingPhotos.push(value);
            if (input) input.value = '';
            renderPhotoManager();
        });
        document.getElementById('product-photo-file')?.addEventListener('change', async event => {
            const input = event.target;
            await addLocalPhotoFiles(input?.files);
            if (input) input.value = '';
        });
        document.getElementById('product-photos')?.addEventListener('change', syncPhotosFromTextarea);
        elements.searchBtn?.addEventListener('click', searchBooks);
        elements.searchInput?.addEventListener('keydown', event => { if (event.key === 'Enter') searchBooks(); });
        elements.productForm?.addEventListener('submit', async event => {
            event.preventDefault();
            const book = getFormData();
            if (!book) return;
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
document.querySelectorAll('.admin-order-filter').forEach(button => {
    button.addEventListener('click', () => {
        document.querySelectorAll('.admin-order-filter').forEach(item => item.classList.remove('active'));
        button.classList.add('active');

        const status = button.dataset.status || 'all';
        if (status === 'all') {
            ordersFilteredOrders = orders;          // 全量订单
        } else {
            ordersFilteredOrders = orders.filter(order => order.status === status);
        }
        ordersCurrentPage = 1;                      // 重置到第一页
        renderOrdersWithPagination();               // 使用分页渲染
    });
});
        document.addEventListener('keydown', event => {
            if (event.key === 'Escape') {
                closeProductModal();
                document.getElementById('order-modal')?.classList.remove('active');
            }
        });
    }

    ensureUi();
    initAdminSectionTabs();
    await loadBooks();
    await loadOrders();

    bindEvents();
});
