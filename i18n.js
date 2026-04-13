const translations = {
    zh: {
        // 导航栏
        "nav-logo": "懒得起名小书铺",
        "nav-tagline": "智能推荐 · 悦读无限",
        "nav-home": "首页",
        "nav-books": "图书",
        "nav-recommend": "智能推荐",
        "nav-account": "我的账户",
        "nav-not-logged-in": "未登录",
        "nav-guest": "游客",
        "nav-user-default": "用户",
        "nav-favorites": "我的收藏",
        "nav-orders": "订单查询",
        "nav-history": "浏览历史",
        "nav-system-messages": "系统消息",
        "nav-account-settings": "账户设置",
        "nav-logout": "退出登录",
        "search-placeholder": "搜索书名、作者或ISBN...",
        "lang-toggle-text": "EN",

        // 巨幕英雄区 (Hero Section)
        "hero-title": "发现属于你的下一本好书",
        "hero-subtitle": "基于AI智能推荐算法，根据您的阅读喜好个性化推荐书籍，让阅读更加精准有趣。",
        "hero-btn-explore": "浏览图书",
        "hero-btn-AI": "查看推荐",

        // 登录页
        "page-title-login": "懒得起名小书铺 - 登录",
        "login-nav-home": "返回首页",
        "login-nav-login": "登录",
        "login-nav-register": "注册",
        "login-left-title": "欢迎回到书的世界",
        "login-left-desc": "登录您的账户，探索个性化推荐，发现下一本好书。AI智能算法将根据您的阅读历史为您推荐最合适的书籍。",
        "login-feature-ai": "AI智能图书推荐",
        "login-feature-history": "个性化阅读历史记录",
        "login-feature-secure": "安全加密交易",
        "login-feature-sync": "跨设备同步书单",
        "login-feature-member": "专属会员优惠",
        "login-title-user": "用户登录",
        "login-title-merchant": "商家登录",
        "login-mode-user": "普通用户登录",
        "login-mode-merchant": "商家登录",
        "login-mode-tip-user": "请选择登录身份，普通用户和商家账号分开验证",
        "login-mode-tip-merchant": "仅商家（管理员）账号可登录管理后台",
        "login-username-label-user": "用户名或邮箱",
        "login-username-label-merchant": "商家用户名",
        "login-username-placeholder-user": "请输入用户名或邮箱",
        "login-username-placeholder-merchant": "请输入商家用户名",
        "login-password-label": "密码",
        "login-password-placeholder": "请输入密码",
        "login-remember-me": "记住我",
        "login-forgot-password": "忘记密码？",
        "login-button": "登录",
        "login-divider-or": "或",
        "login-guest-btn": "游客登录",
        "login-register-text": "还没有账户？",
        "login-register-link": "立即注册",
        "login-merchant-register-link": "商户注册",
        "login-enter-credentials-error": "请输入用户名和密码",
        "login-merchant-unavailable-error": "当前无法连接 Supabase，商家登录不可用",
        "login-merchant-invalid-error": "商家用户名或密码错误，请重试",
        "login-merchant-account-error": "该账号为商家账号，请切换到“商家登录”入口",
        "login-invalid-error": "用户名或密码错误，请检查后重试",
        "login-merchant-success": "欢迎，{name}！正在进入管理后台...",
        "login-success": "欢迎回来，{name}！正在跳转...",
        "login-guest-success": "您已使用游客身份登录，部分功能可能受限",
        "login-registered-success": "注册成功：{email}。请使用该邮箱登录。",

        // 特色功能
        "features-title": "平台特色功能",
        "features-subtitle": "集成人工智能技术，提供卓越的在线购书体验",
        "feature-ai-title": "AI智能推荐",
        "feature-ai-desc": "基于协同过滤算法和用户行为分析，为您推荐最可能感兴趣的书籍。",
        "feature-search-title": "智能搜索",
        "feature-search-desc": "支持多属性关键词搜索，可根据分类、价格、标签等多维度筛选书籍。",
        "feature-community-title": "用户社区",
        "feature-community-desc": "书评、评分和讨论区，让读者分享阅读体验，发现更多好书。",
        "feature-security-title": "安全交易",
        "feature-security-desc": "采用高级加密技术和安全支付，保护您的个人信息和交易安全。",
        "feature-learn-more": "了解更多",

        // 图书区域
        "books-section-title": "热门图书",
        "books-filter-all": "全部",
        "books-filter-fiction": "小说文学",
        "books-filter-nonfiction": "非虚构",
        "books-filter-academic": "学术",
        "books-filter-children": "儿童读物",
        "books-browse-more": "浏览更多图书",
        "search-results-title": "搜索结果",
        "search-results-clear-btn": "清除搜索",
        "search-filter-title": "搜索筛选",
        "search-filter-subtitle": "不改动原搜索逻辑，仅对当前搜索结果做二次筛选",
        "search-filter-reset-btn": "重置筛选",
        "search-filter-mode-category-price": "类别 + 价格范围",
        "search-filter-mode-tags": "一个或多个标签",
        "search-filter-category-label": "类别",
        "search-filter-all-categories": "全部类别",
        "search-filter-min-price-label": "最低价格",
        "search-filter-max-price-label": "最高价格",
        "search-filter-no-limit": "不限",
        "search-filter-tags-tip": "可多选标签（同时满足）",
        "search-filter-no-tags": "当前结果暂无可用标签",
        "search-filter-all": "全部",
        "search-filter-label-tags": "标签",
        "search-filter-label-category": "类别",
        "search-filter-label-price": "价格",
        "search-results-summary-template": "关键词“{query}”共找到 {base} 本图书；当前筛选后显示 {visible} 本。<br>筛选方式：{filter}。热门图书区域保留在下方，搜索结果与热门展示已分开。",
        "search-results-empty": "没有找到相关图书，请尝试更换关键词。",
        "search-results-cleared-notice": "已清除搜索结果，下面仍显示热门图书",
        "search-results-complete-notice-template": "搜索完成：找到 {count} 本相关图书，可继续按类别价格或标签筛选",

        // AI 推荐
        "recommendations-title": "为您推荐",
        "recommendations-subtitle": "基于您的浏览历史和偏好，AI为您精心挑选",
        "recommendations-refresh-info": "推荐每10分钟更新一次，确保内容新鲜度",
        "recommendations-refresh-tip-no-time": "推荐每10分钟自动更新一次，也可以手动刷新",
        "recommendations-refresh-tip-with-time": "推荐每10分钟自动更新一次，也可以手动刷新（最近更新：{time}）",
        "recommendations-refresh-btn": "刷新推荐",
        "recommendations-refreshing": "刷新中...",
        "recommendations-refresh-success": "推荐已更新",
        "recommendations-refresh-success-detailed": "推荐已按当前浏览、收藏和加购偏好更新",

        // 购物车 / 侧边栏
        "cart-title": "购物车",
        "cart-total-label": "总计：",
        "cart-checkout-btn": "前往结算",
        "cart-clear-btn": "清空购物车",
        "favorites-title": "我的收藏",
        "favorites-count-label": "已收藏：",
        "favorites-count-unit": " 本",
        "favorites-empty": "暂无收藏图书",
        "favorites-clear-btn": "清空收藏",
        "favorites-btn-active": "取消收藏",
        "favorites-btn-inactive": "收藏",
        "favorites-added-template": "已收藏《{title}》",
        "favorites-removed-template": "已取消收藏《{title}》",
        "orders-title": "我的订单",
        "orders-count-label": "订单数：",
        "orders-count-unit": " 单",
        "order-status-pending": "待处理",
        "order-status-hold": "暂缓",
        "order-status-shipped": "已发货",
        "order-status-arrived": "已到货",
        "order-status-received": "已收货",
        "order-status-cancelled": "已取消",
        "orders-guest-login-required": "游客无法查看订单，请登录后使用",
        "orders-empty": "暂无订单记录",
        "orders-empty-filtered": "当前状态下暂无订单",
        "order-number-label": "订单号：",
        "order-status-label": "状态：",
        "order-time-label": "下单时间：",
        "order-amount-label": "订单金额：",
        "order-address-label": "收货地址：",
        "order-shipped-time-label": "发货时间：",
        "order-arrived-time-label": "到货时间：",
        "order-received-time-label": "收货时间：",
        "order-cancel-time-label": "取消时间：",
        "order-pending-review-label": "待评价图书：",
        "order-click-detail": "点击查看订单详情",
        "order-btn-received": "已收货",
        "order-btn-review": "去评价",
        "order-not-found": "未找到对应订单",
        "order-detail-title": "订单详情",
        "order-detail-recipient": "收件人：",
        "order-detail-info": "订单信息",
        "order-detail-products": "商品明细",
        "order-detail-reviews": "用户评价",
        "order-items-missing": "该订单未记录商品明细",
        "order-items-missing-period": "该订单未记录商品明细。",
        "order-payment-method-label": "支付方式",
        "order-payment-method-unknown": "未记录",
        "order-auto-receive-soon": "未确认收货，系统即将自动收货",
        "order-auto-receive-remaining": "未确认收货，还剩 {days} 天自动收货",
        "history-view-time-label": "浏览时间：",
        "unknown-time": "时间未知",

        // 商家后台页面
        "admin-page-title": "懒得起名小书铺 - 管理门户",
        "admin-logo": "懒得起名小书铺 - 管理",
        "admin-nav-products": "产品管理",
        "admin-nav-orders": "订单管理",
        "admin-nav-moderation": "内容审核",
        "admin-nav-logout": "退出",
        "admin-products-title": "产品管理",
        "admin-add-product-btn": "添加产品",
        "admin-search-placeholder": "搜索产品ID、名称...",
        "admin-orders-title": "订单管理",
        "admin-moderation-title": "内容审核",

        // 商家后台脚本文案
        "admin-login-required": "请先通过商家登录后再访问管理后台",
        "admin-pagination-prev": "上一页",
        "admin-pagination-next": "下一页",
        "admin-order-filter-all": "全部订单",
        "admin-order-filter-chip": "Block B 订单处理",
        "admin-order-empty": "暂无订单",
        "admin-products-empty": "未找到产品",
        "admin-order-label": "订单号：",
        "admin-customer-label": "客户：",
        "admin-order-time-label": "下单时间：",
        "admin-total-label": "总额：",
        "admin-address-label": "收货地址：",
        "admin-order-view-detail": "查看详情",
        "admin-set-hold": "设为暂缓",
        "admin-set-shipped": "发货",
        "admin-set-arrived": "已到货",
        "admin-set-cancelled": "取消",
        "admin-unknown-customer": "未知客户",
        "admin-invalid-transition": "当前订单状态不允许执行这个操作",
        "admin-order-update-failed": "更新订单状态失败：",
        "admin-product-form-new": "新增产品",
        "admin-product-form-edit": "编辑产品",
        "admin-product-id-placeholder": "产品ID（留空自动生成）",
        "admin-product-title-placeholder": "标题",
        "admin-product-title-en-placeholder": "英文标题（可选）",
        "admin-product-author-placeholder": "作者",
        "admin-product-author-en-placeholder": "英文作者（可选）",
        "admin-product-price-placeholder": "价格",
        "admin-product-publisher-placeholder": "出版社",
        "admin-product-publisher-en-placeholder": "英文出版社（可选）",
        "admin-product-isbn-placeholder": "ISBN",
        "admin-product-rating-note": "评分由买家评价后自动生成，新上架商品默认显示“暂无评分”。",
        "admin-product-tags-placeholder": "标签（逗号分隔）",
        "admin-product-tags-en-placeholder": "英文标签（逗号分隔，可选）",
        "admin-product-description-placeholder": "简短描述",
        "admin-product-description-en-placeholder": "英文简短描述（可选）",
        "admin-product-summary-html-placeholder": "支持 HTML 的详情介绍",
        "admin-product-summary-html-en-placeholder": "英文详情介绍（支持 HTML，可选）",
        "admin-product-photos-label": "产品图片（支持多张，符合 Block B1）",
        "admin-product-photo-input-placeholder": "输入图片 URL 后点击添加",
        "admin-product-add-photo-btn": "添加图片",
        "admin-product-photo-hint": "可直接选择本地图片，无需先复制到项目目录；也支持继续粘贴图片 URL。",
        "admin-product-photos-textarea-placeholder": "也可直接粘贴图片 URL，多张请优先换行分隔",
        "admin-photo-default-cover": "默认封面",
        "admin-photo-default-cover-alt": "系统默认封面",
        "admin-photo-default-cover-note": "当前未添加自定义封面，系统默认封面将用于展示。",
        "admin-photo-empty-note": "暂无自定义图片，当前将保留系统默认封面。",
        "admin-photo-custom-cover-note": "已添加自定义封面，前台将不再显示系统默认封面。",
        "admin-photo-item-alt-prefix": "产品图片",
        "admin-photo-invalid": "图片失效",
        "admin-photo-remove-btn": "移除",
        "admin-product-disabled-label": "下架 / 禁用该产品",
        "admin-product-save-btn": "保存",
        "admin-product-cancel-btn": "取消",
        "admin-modal-close": "关闭",
        "admin-order-detail-title": "订单详情",
        "admin-status-label": "状态：",
        "admin-shipped-time-label": "发货时间：",
        "admin-arrived-time-label": "到货时间：",
        "admin-received-time-label": "收货时间：",
        "admin-cancel-time-label": "取消时间：",
        "admin-hold-time-label": "暂缓时间：",
        "admin-order-items-title": "订单商品",
        "admin-moderation-pending-reviews-title": "自动审核待处理",
        "admin-moderation-pending-reports-title": "用户举报待处理",
        "admin-moderation-empty-reviews": "暂无待审核评论",
        "admin-moderation-empty-reports": "暂无待处理举报",
        "admin-moderation-review-title": "待审核评论 #",
        "admin-moderation-report-title": "待处理举报 #",
        "admin-moderation-book-id-label": "图书ID：",
        "admin-moderation-user-label": "用户：",
        "admin-moderation-review-id-label": "评论ID：",
        "admin-moderation-reporter-label": "举报人：",
        "admin-moderation-submitted-at-label": "提交时间：",
        "admin-moderation-auto-trigger-label": "自动触发：",
        "admin-moderation-report-reason-label": "举报原因：",
        "admin-moderation-unknown-user": "未知用户",
        "admin-moderation-no-comment": "（无评论正文）",
        "admin-moderation-unknown-rule": "未知规则",
        "admin-moderation-review-reason-placeholder": "可选：填写审核说明（将发送给用户）",
        "admin-moderation-report-reason-placeholder": "可选：处理说明（驳回时会发送给举报用户）",
        "admin-moderation-approve-btn": "审核通过",
        "admin-moderation-reject-review-btn": "驳回评论",
        "admin-moderation-hide-btn": "通过举报并隐藏评论",
        "admin-moderation-reject-report-btn": "驳回举报",
        "admin-broadcast-title": "发布系统消息",
        "admin-broadcast-user-id-placeholder": "用户ID（留空=全站广播）",
        "admin-broadcast-title-placeholder": "消息标题",
        "admin-broadcast-content-placeholder": "消息内容",
        "admin-broadcast-send-btn": "发送消息",
        "admin-broadcast-fill-required": "请填写消息标题和内容",
        "admin-broadcast-send-failed": "系统消息发送失败：",
        "admin-broadcast-send-success": "系统消息已发送",
        "admin-unknown-error": "未知错误",
        "admin-reason-violence": "暴力/血腥",
        "admin-reason-sexual": "色情/低俗",
        "admin-reason-political": "政治敏感",
        "admin-reason-malicious": "恶意攻击/辱骂",
        "admin-reason-spam": "广告/垃圾信息",
        "admin-reason-other": "其他",
        "admin-reason-other-prefix": "其他说明：",
        "admin-no-reason": "未填写原因",
        "history-title": "浏览历史",
        "history-count-label": "历史记录：",
        "history-count-unit": " 条",
        "history-clear-btn": "清空历史",
        "system-messages-title": "系统消息",
        "system-messages-count-label": "消息数：",
        "system-messages-count-unit": " 条",
        "system-messages-empty": "暂无系统消息",
        "system-messages-default-title": "系统通知",
        "system-messages-no-content": "（无内容）",
        "system-messages-mark-read": "标记已读",
        "system-messages-guest-error": "游客无法查看系统消息，请登录后使用",

        // 页脚
        "footer-brand-title": "懒得起名小书铺",
        "footer-brand-desc": "一个由AI驱动的智能在线书店，致力于为读者提供个性化、便捷的购书体验。",
        "footer-quick-links-title": "快速链接",
        "footer-link-home": "首页",
        "footer-link-books": "所有图书",
        "footer-link-recommendations": "智能推荐",
        "footer-link-bestsellers": "畅销榜单",
        "footer-link-new-arrivals": "最新上架",
        "footer-service-title": "用户服务",
        "footer-service-account": "我的账户",
        "footer-service-orders": "订单查询",
        "footer-service-help": "帮助中心",
        "footer-service-contact": "联系我们",
        "footer-service-privacy": "隐私政策",
        "footer-service-terms": "服务条款",
        "footer-service-faq": "常见问题",
        "footer-project-title": "项目信息",
        "footer-project-desc-1": "CSAI3124课程项目 - 在线智能书店",
        "footer-project-desc-2": "开发团队：张徐瑞(项目经理)、吴军浩、吴莹莹、张玥冉、卢卓谦",
        "footer-project-desc-3": "指导老师：[教师姓名]",
        "footer-project-desc-4": "2025/2026学年",
        "footer-copyright": "© 2025-2026 懒得起名小书铺 - 在线智能书店. 保留所有权利. 本网站仅为课程项目演示.",
        "footer-security": "本网站采用HTTPS加密传输，符合OWASP安全标准",

        // 账户设置页面
        "account-title": "账户设置 - 懒得起名小书铺",
        "account-back-to-store": "返回书店",
        "account-overview-title": "账户概览",
        "account-current-username": "当前用户名",
        "account-email": "邮箱",
        "account-default-address": "默认地址",
        "account-basic-info-title": "基础信息",
        "account-username-label": "用户名",
        "account-username-placeholder": "请输入新的用户名",
        "account-email-label": "邮箱",
        "account-save-username-btn": "保存用户名",
        "account-address-management-title": "收货地址管理",
        "account-recipient-label": "收件人",
        "account-recipient-placeholder": "例如：张三",
        "account-phone-label": "联系电话",
        "account-phone-placeholder": "例如：13800000000",
        "account-address-label": "详细地址",
        "account-address-placeholder": "请输入完整的收货地址",
        "account-set-default-address": "设为默认收货地址",
        "account-add-address-btn": "新增地址",
        "account-login-required": "请先以普通用户身份登录后再使用账户设置。",

        // 账户设置页面脚本文本
        "account-script-error-demo-account": "当前登录的是本地演示账号，或该账号尚未同步到 Supabase users 表。请使用已注册的普通用户账号登录，或重新注册。",
        "account-script-no-addresses": "暂无收货地址，请先新增一个地址。",
        "account-script-default-contact": "默认联系人",
        "account-script-default-address": "默认地址",
        "account-script-phone-label": "联系电话：",
        "account-script-set-default": "设为默认",
        "account-script-delete": "删除",
        "account-script-default-updated": "默认地址已更新",
        "account-script-address-deleted": "地址已删除",
        "account-script-username-updated": "用户名已更新",
        "account-script-username-update-failed": "更新用户名失败：",
        "account-script-no-user-id": "未获取到当前用户标识，请重新登录后再试",
        "account-script-fill-required": "请填写收件人和详细地址",
        "account-script-address-saved": "地址已保存",
        "account-script-address-save-failed": "保存地址失败：",
        "account-script-no-supabase": "未连接到 Supabase，无法加载账户设置。",
        "account-script-load-failed": "加载账户信息失败：",
        "account-script-username-empty": "用户名不能为空",
        "account-script-generic-error": "未知错误",
        "register-title": "懒得起名小书铺 - 注册",
        "register-title-user": "用户注册",
        "register-title-merchant": "商家注册",
        "register-mode-user": "普通用户注册",
        "register-mode-merchant": "商家注册",
        "register-mode-tip-user": "请选择注册身份，普通用户和商家账号分开验证",
        "register-mode-tip-merchant": "仅商家（管理员）账号可注册管理后台",
        "register-username-label-user": "用户名",
        "register-username-label-merchant": "商家用户名",
        "register-username-label": "用户名",
        "register-username-placeholder-user": "请输入用户名",
        "register-username-placeholder-merchant": "请输入商家用户名",
        "register-username-placeholder": "请输入用户名",
        "register-email-label": "邮箱",
        "register-email-placeholder": "请输入邮箱地址",
        "register-password-label": "密码",
        "register-password-placeholder": "请输入密码",
        "register-confirm-password-label": "确认密码",
        "register-confirm-password-placeholder": "请再次输入密码",
        "register-agree-terms": "我已阅读并同意《服务条款》和《隐私政策》",
        "register-subscribe-news": "订阅最新图书推荐和优惠信息",
        "register-submit-btn": "注册账号",
        "register-divider-or": "已有账户？",
        "register-login-text": "已有账户？",
        "register-login-link": "立即登录",

        // 注册页面表单标签
        "register-shopname-label": "店铺名称 *",
        "register-shopname-placeholder": "请输入店铺名称",
        "register-merchant-contact-label": "商户联系电话",
        "register-merchant-contact-placeholder": "请输入联系电话（可选）",
        "register-shipping-address-label": "收货地址 *",
        "register-shipping-address-placeholder": "请输入详细收货地址（省/市/区 + 街道门牌）",
        "register-password-requirements": "密码长度至少8位，包含字母和数字",

        // 注册页面表单标签
        "register-fullname-label": "姓名",
        "register-fullname-placeholder": "请输入您的姓名",

        // 注册页面左侧内容
        "register-left-title": "加入阅读的世界",
        "register-left-desc": "创建您的账户，开启个性化阅读体验。AI智能算法将根据您的喜好推荐书籍，记录您的阅读历史，让每一本书都成为一次独特的旅程。",
        "register-feature-ai": "AI智能图书推荐",
        "register-feature-history": "个性化阅读历史记录",
        "register-feature-sync": "跨设备同步书单",
        "register-feature-secure": "安全加密交易",
        "register-feature-member": "会员专属优惠",
        "register-feature-community": "参与用户社区讨论",

        // 注册页导航栏
        "register-back-to-home": "返回首页",
        "nav-login": "登录",
        "nav-register": "注册",

        // 注册页脚本文本
        "register-script-merchant-title": "商户注册",
        "register-script-merchant-tip": "注册商户账户后可从商家登录入口进入管理后台",
        "register-script-user-title": "用户注册",
        "register-script-user-tip": "创建普通用户账户，用于浏览与购买图书",
        "register-script-username-min-length": "用户名至少需要3个字符",
        "register-script-username-invalid": "用户名只能包含字母、数字和下划线",
        "register-script-shop-name-min-length": "店铺名称至少需要2个字符",
        "register-script-email-invalid": "邮箱只需满足\"xxx@yyy\"格式",
        "register-script-password-min-length": "密码长度至少需要8个字符",
        "register-script-password-weak": "密码太弱，请使用更复杂的密码",
        "register-script-password-mismatch": "两次输入的密码不一致",
        "register-script-registering": "注册中...",
        "register-script-merchant-success": "商户注册成功！请返回登录页使用\"商家登录\"入口登录。",
        "register-script-user-success-confirm": "注册成功！请到邮箱完成验证后登录。",
        "register-script-user-success": "注册成功！稍后跳转到登录页。",
        "register-script-duplicate-error": "该邮箱或用户名已被注册",
        "register-script-invalid-error": "输入信息有误，请检查后重试",
        "register-script-rls-error": "注册失败：数据库安全策略阻止了写入（RLS）。请在 Supabase 控制台添加合适的 INSERT 策略，或让后端执行插入。",
        "register-script-generic-error": "注册失败：",
        "register-script-password-strength-weak": "密码强度：弱",
        "register-script-password-strength-fair": "密码强度：一般",
        "register-script-password-strength-good": "密码强度：良好",
        "register-script-password-strength-strong": "密码强度：强",
        "success-page-title": "支付成功 - 懒得起名小书铺",
        "success-title": "支付成功",
        "success-subtitle": "感谢您的购买！",
        "success-view-order-btn": "查看订单详情",
        "success-back-home-btn": "返回主页",
        "success-note": "订单详情已发送至您的邮箱",
        "success-footer-copy": "© 2025-2026 懒得起名小书铺",
        "review-video-attachment": "视频附件",
        "review-image-attachment": "图片附件",
        "review-gallery-video-title": "评价视频预览",
        "review-gallery-image-title": "评价图片预览",
        "book-detail-meta-category": "图书分类",
        "book-detail-meta-author": "作者",
        "book-title-default": "图书",
        "book-title-untitled": "未命名图书",
        "book-author-unknown": "未知作者",
        "book-detail-meta-rating": "评分",
        "book-rating-none": "暂无评分",
        "book-detail-meta-price": "价格",
        "book-detail-meta-review-count": "评价人数",
        "book-detail-unit-people": "人",
        "book-detail-meta-publisher": "出版社",
        "book-detail-meta-tags": "标签",
        "book-review-hint-own": "这是你发布的评价，不能给自己投票",
        "book-review-hint-login-vote": "登录后可标记这条评价是否有帮助",
        "book-review-hint-no-session-vote": "当前账号未建立云端会话，暂不可投票",
        "book-review-hint-question": "这条评价对你有帮助吗？",
        "book-report-hint-own": "这是你发布的评价，不能举报自己",
        "book-report-hint-login-report": "登录后可举报争议评论",
        "book-report-hint-no-session-report": "当前账号未建立云端会话，暂不可举报",
        "book-report-hint-new": "发现争议内容可发起举报",
        "book-report-hint-pending": "你已举报，管理员处理中",
        "book-report-hint-hidden": "举报已处理：评论已被隐藏",
        "book-report-hint-rejected": "举报已处理：管理员驳回举报",
        "book-report-hint-edit": "你已提交过举报，可再次修改原因",
        "book-reviews-empty": "暂无用户评价，欢迎购买后成为首位评价者。",
        "book-rating-unit": "分",
        "book-review-comment-empty": "该用户仅评分，未填写评论。",
        "book-review-helpful": "有帮助",
        "book-review-not-helpful": "没帮助",
        "book-review-report-btn": "举报",
        "book-review-report-other-placeholder": "若选择“其他”，请填写具体原因",
        "book-review-report-submit": "提交举报",
        "common-cancel": "取消",
        "book-review-report-collapse": "收起",
        "book-detail-author-prefix": "作者：",
        "book-description-empty": "暂无简介",
        "book-detail-add-cart": "加入购物车",
        "book-detail-continue": "继续逛逛",
        "book-detail-section-info": "图书信息",
        "book-detail-section-description": "图书简介",
        "book-detail-section-highlights": "内容亮点",
        "book-detail-highlight-category-prefix": "适合喜欢「",
        "book-detail-highlight-category-suffix": "」内容的读者。",
        "book-detail-highlight-rating-prefix": "当前读者评分为 ",
        "book-detail-highlight-rating-suffix": "，可作为选购参考。",
        "book-detail-highlight-no-rating": "当前暂无买家评分，欢迎首位读者完成购买后评价。",
        "book-detail-highlight-direct-cart": "页面支持直接加入购物车，无需返回列表页。",
        "book-detail-section-tags": "关键词",
        "book-detail-section-reviews": "用户评价"
    },
    en: {
        // 导航栏
        "nav-logo": "No-Name Bookstore",
        "nav-tagline": "Smart Picks · Endless Reading",
        "nav-home": "Home",
        "nav-books": "Books",
        "nav-recommend": "Smart Picks",
        "nav-account": "My account",
        "nav-not-logged-in": "Not logged in",
        "nav-guest": "Guest",
        "nav-user-default": "User",
        "nav-favorites": "My Favorites",
        "nav-orders": "Order History",
        "nav-history": "Browse History",
        "nav-system-messages": "System Messages",
        "nav-account-settings": "Account Settings",
        "nav-logout": "Logout",
        "search-placeholder": "Search for book title, author, or ISBN",
        "lang-toggle-text": "ZH",

        // 账户设置页面
        "account-title": "Account Settings - No-Name Bookstore",
        "account-back-to-store": "Back to Store",
        "account-overview-title": "Account Overview",
        "account-current-username": "Current Username",
        "account-email": "Email",
        "account-default-address": "Default Address",
        "account-basic-info-title": "Basic Information",
        "account-username-label": "Username",
        "account-username-placeholder": "Enter new username",
        "account-email-label": "Email",
        "account-save-username-btn": "Save Username",
        "account-address-management-title": "Address Management",
        "account-recipient-label": "Recipient",
        "account-recipient-placeholder": "e.g., John Doe",
        "account-phone-label": "Phone Number",
        "account-phone-placeholder": "e.g., 13800000000",
        "account-address-label": "Detailed Address",
        "account-address-placeholder": "Enter full shipping address",
        "account-set-default-address": "Set as default shipping address",
        "account-add-address-btn": "Add Address",
        "account-login-required": "Please log in as a regular user first to use account settings.",

        // 账户设置页面脚本文本
        "account-script-error-demo-account": "Currently logged in with a local demo account, or this account has not been synced to the Supabase users table. Please log in with a registered regular user account, or register again.",
        "account-script-no-addresses": "No shipping addresses yet, please add an address first.",
        "account-script-default-contact": "Default Contact",
        "account-script-default-address": "Default Address",
        "account-script-phone-label": "Phone: ",
        "account-script-set-default": "Set as Default",
        "account-script-delete": "Delete",
        "account-script-default-updated": "Default address updated",
        "account-script-address-deleted": "Address deleted",
        "account-script-username-updated": "Username updated",
        "account-script-username-update-failed": "Failed to update username: ",
        "account-script-no-user-id": "Current user ID not obtained, please log in again and try",
        "account-script-fill-required": "Please fill in recipient and detailed address",
        "account-script-address-saved": "Address saved",
        "account-script-address-save-failed": "Failed to save address: ",
        "account-script-no-supabase": "Not connected to Supabase, unable to load account settings.",
        "account-script-load-failed": "Failed to load account information: ",
        "account-script-username-empty": "Username cannot be empty",
        "account-script-generic-error": "Unknown error",

        // 巨幕英雄区 (Hero Section)
        "hero-title": "Find Your Next Great Book",
        "hero-subtitle": "AI-powered recommendations tailored to your reading tastes for a smarter reading journey.",
        "hero-btn-explore": "Explore Books",
        "hero-btn-AI": "View Recommendations",

        // 登录页
        "page-title-login": "No-Name Bookstore - Login",
        "login-nav-home": "Back to Home",
        "login-nav-login": "Login",
        "login-nav-register": "Register",
        "login-left-title": "Welcome Back to the World of Books",
        "login-left-desc": "Sign in to your account, explore personalized recommendations, and discover your next great read. Our AI algorithm will suggest books based on your reading history.",
        "login-feature-ai": "AI Book Recommendations",
        "login-feature-history": "Personalized reading history",
        "login-feature-secure": "Secure encrypted transactions",
        "login-feature-sync": "Cross-device booklist sync",
        "login-feature-member": "Exclusive member offers",
        "login-title-user": "User Login",
        "login-title-merchant": "Merchant Login",
        "login-mode-user": "User Login",
        "login-mode-merchant": "Merchant Login",
        "login-mode-tip-user": "Choose your login identity. User and merchant accounts are verified separately.",
        "login-mode-tip-merchant": "Only merchant (admin) accounts can log in to the admin backend.",
        "login-username-label-user": "Username or email",
        "login-username-label-merchant": "Merchant username",
        "login-username-placeholder-user": "Enter username or email",
        "login-username-placeholder-merchant": "Enter merchant username",
        "login-password-label": "Password",
        "login-password-placeholder": "Enter password",
        "login-remember-me": "Remember me",
        "login-forgot-password": "Forgot password?",
        "login-button": "Login",
        "login-divider-or": "or",
        "login-guest-btn": "Guest login",
        "login-register-text": "Don't have an account?",
        "login-register-link": "Register now",
        "login-merchant-register-link": "Merchant register",
        "login-enter-credentials-error": "Please enter username and password",
        "login-merchant-unavailable-error": "Cannot connect to Supabase; merchant login is unavailable",
        "login-merchant-invalid-error": "Merchant username or password is incorrect; please try again",
        "login-merchant-account-error": "This account belongs to a merchant. Please switch to the Merchant Login tab.",
        "login-merchant-success": "Welcome, {name}! Redirecting to the admin dashboard...",
        "login-success": "Welcome back, {name}! Redirecting...",
        "login-guest-success": "You are logged in as a guest; some features may be limited.",
        "login-registered-success": "Registration success: {email}. Please sign in with that email.",
        "login-invalid-error": "Invalid username or password. Please try again.",

        // 特色功能
        "features-title": "Platform Highlights",
        "features-subtitle": "AI-powered bookstore experience with smart discovery and easy shopping.",
        "feature-ai-title": "AI Recommendations",
        "feature-ai-desc": "Uses collaborative filtering and user behavior analysis to suggest books you will likely enjoy.",
        "feature-search-title": "Smart Search",
        "feature-search-desc": "Search by keywords, category, price, tags, and more to quickly find the right books.",
        "feature-community-title": "Community",
        "feature-community-desc": "Reviews, ratings, and discussions help readers share experiences and discover great books.",
        "feature-security-title": "Secure Checkout",
        "feature-security-desc": "Advanced encryption and secure payment protect your personal data and transactions.",
        "feature-learn-more": "Learn More",

        // 图书区域
        "books-section-title": "Popular Books",
        "books-filter-all": "All",
        "books-filter-fiction": "Fiction",
        "books-filter-nonfiction": "Nonfiction",
        "books-filter-academic": "Academic",
        "books-filter-children": "Children",
        "books-browse-more": "Browse More Books",
        "search-results-title": "Search Results",
        "search-results-clear-btn": "Clear Search",
        "search-filter-title": "Search Filters",
        "search-filter-subtitle": "Keeps the original search logic and applies secondary filtering only to current results.",
        "search-filter-reset-btn": "Reset Filters",
        "search-filter-mode-category-price": "Category + Price Range",
        "search-filter-mode-tags": "One or More Tags",
        "search-filter-category-label": "Category",
        "search-filter-all-categories": "All Categories",
        "search-filter-min-price-label": "Minimum Price",
        "search-filter-max-price-label": "Maximum Price",
        "search-filter-no-limit": "No limit",
        "search-filter-tags-tip": "Multi-select tags (must match all)",
        "search-filter-no-tags": "No available tags in current results",
        "search-filter-all": "All",
        "search-filter-label-tags": "Tags",
        "search-filter-label-category": "Category",
        "search-filter-label-price": "Price",
        "search-results-summary-template": "Keyword \"{query}\" matched {base} books; {visible} remain after filtering.<br>Filter mode: {filter}. The popular books section stays below, separated from search results.",
        "search-results-empty": "No matching books found. Try different keywords.",
        "search-results-cleared-notice": "Search results cleared. Popular books are still shown below.",
        "search-results-complete-notice-template": "Search complete: found {count} related books. You can continue filtering by category, price, or tags.",

        // AI 推荐
        "recommendations-title": "Recommended For You",
        "recommendations-subtitle": "AI selects books based on your browsing history and preferences.",
        "recommendations-refresh-info": "Recommendations refresh every 10 minutes to keep content fresh.",
        "recommendations-refresh-tip-no-time": "Recommendations auto-refresh every 10 minutes, or you can refresh manually.",
        "recommendations-refresh-tip-with-time": "Recommendations auto-refresh every 10 minutes, or you can refresh manually (Last updated: {time}).",
        "recommendations-refresh-btn": "Refresh Recommendations",
        "recommendations-refreshing": "Refreshing...",
        "recommendations-refresh-success": "Recommendations updated",
        "recommendations-refresh-success-detailed": "Recommendations updated based on your browsing, favorites, and cart preferences.",

        // 购物车 / 侧边栏
        "cart-title": "Shopping Cart",
        "cart-total-label": "Total:",
        "cart-checkout-btn": "Checkout",
        "cart-clear-btn": "Clear Cart",
        "favorites-title": "My Favorites",
        "favorites-count-label": "Saved:",
        "favorites-count-unit": " books",
        "favorites-empty": "No favorite books yet",
        "favorites-clear-btn": "Clear Favorites",
        "favorites-btn-active": "Remove from favorites",
        "favorites-btn-inactive": "Add to favorites",
        "favorites-added-template": "Added to favorites: \"{title}\"",
        "favorites-removed-template": "Removed from favorites: \"{title}\"",
        "orders-title": "My Orders",
        "orders-count-label": "Order Count:",
        "orders-count-unit": " orders",
        "order-status-pending": "Pending",
        "order-status-hold": "On Hold",
        "order-status-shipped": "Shipped",
        "order-status-arrived": "Arrived",
        "order-status-received": "Received",
        "order-status-cancelled": "Cancelled",
        "orders-guest-login-required": "Guests cannot view orders. Please log in first.",
        "orders-empty": "No order records yet",
        "orders-empty-filtered": "No orders under this status",
        "order-number-label": "Order No.: ",
        "order-status-label": "Status: ",
        "order-time-label": "Placed at: ",
        "order-amount-label": "Order amount: ",
        "order-address-label": "Shipping address: ",
        "order-shipped-time-label": "Shipped at: ",
        "order-arrived-time-label": "Arrived at: ",
        "order-received-time-label": "Received at: ",
        "order-cancel-time-label": "Cancelled at: ",
        "order-pending-review-label": "Books pending review: ",
        "order-click-detail": "Click to view order details",
        "order-btn-received": "Mark as received",
        "order-btn-review": "Write review",
        "order-not-found": "Order not found",
        "order-detail-title": "Order Details",
        "order-detail-recipient": "Recipient: ",
        "order-detail-info": "Order Information",
        "order-detail-products": "Items",
        "order-detail-reviews": "User Reviews",
        "order-items-missing": "No item details recorded for this order",
        "order-items-missing-period": "No item details recorded for this order.",
        "order-payment-method-label": "Payment Method",
        "order-payment-method-unknown": "Not recorded",
        "order-auto-receive-soon": "Not yet confirmed. The system will auto-confirm receipt soon.",
        "order-auto-receive-remaining": "Not yet confirmed. Auto-confirm in {days} day(s).",
        "history-view-time-label": "Viewed at: ",
        "unknown-time": "Unknown time",

        // Admin page
        "admin-page-title": "No-Name Bookstore - Admin Portal",
        "admin-logo": "No-Name Bookstore - Admin",
        "admin-nav-products": "Product Management",
        "admin-nav-orders": "Order Management",
        "admin-nav-moderation": "Content Moderation",
        "admin-nav-logout": "Logout",
        "admin-products-title": "Product Management",
        "admin-add-product-btn": "Add Product",
        "admin-search-placeholder": "Search product ID or name...",
        "admin-orders-title": "Order Management",
        "admin-moderation-title": "Content Moderation",

        // Admin script texts
        "admin-login-required": "Please log in via Merchant Login before accessing the admin portal",
        "admin-pagination-prev": "Previous",
        "admin-pagination-next": "Next",
        "admin-order-filter-all": "All Orders",
        "admin-order-filter-chip": "Block B Order Workflow",
        "admin-order-empty": "No orders",
        "admin-products-empty": "No products found",
        "admin-order-label": "Order No.: ",
        "admin-customer-label": "Customer: ",
        "admin-order-time-label": "Placed at: ",
        "admin-total-label": "Total: ",
        "admin-address-label": "Shipping address: ",
        "admin-order-view-detail": "View Details",
        "admin-set-hold": "Set On Hold",
        "admin-set-shipped": "Ship",
        "admin-set-arrived": "Mark Arrived",
        "admin-set-cancelled": "Cancel",
        "admin-unknown-customer": "Unknown customer",
        "admin-invalid-transition": "Current order status does not allow this action",
        "admin-order-update-failed": "Failed to update order status: ",
        "admin-product-form-new": "Add Product",
        "admin-product-form-edit": "Edit Product",
        "admin-product-id-placeholder": "Product ID (leave empty to auto-generate)",
        "admin-product-title-placeholder": "Title",
        "admin-product-title-en-placeholder": "English title (optional)",
        "admin-product-author-placeholder": "Author",
        "admin-product-author-en-placeholder": "English author (optional)",
        "admin-product-price-placeholder": "Price",
        "admin-product-publisher-placeholder": "Publisher",
        "admin-product-publisher-en-placeholder": "English publisher (optional)",
        "admin-product-isbn-placeholder": "ISBN",
        "admin-product-rating-note": "Ratings are generated from buyer reviews. New products default to \"No ratings yet\".",
        "admin-product-tags-placeholder": "Tags (comma-separated)",
        "admin-product-tags-en-placeholder": "English tags (comma-separated, optional)",
        "admin-product-description-placeholder": "Short description",
        "admin-product-description-en-placeholder": "English short description (optional)",
        "admin-product-summary-html-placeholder": "Detailed description with HTML support",
        "admin-product-summary-html-en-placeholder": "English detailed description (HTML supported, optional)",
        "admin-product-photos-label": "Product images (multiple supported, Block B1)",
        "admin-product-photo-input-placeholder": "Paste image URL and click Add",
        "admin-product-add-photo-btn": "Add Image",
        "admin-product-photo-hint": "You can upload local images directly, no need to copy files into project folders. Pasted URLs are also supported.",
        "admin-product-photos-textarea-placeholder": "You can also paste image URLs directly; for multiple images, prefer one URL per line",
        "admin-photo-default-cover": "Default Cover",
        "admin-photo-default-cover-alt": "System default cover",
        "admin-photo-default-cover-note": "No custom cover has been added. The system default cover will be used for display.",
        "admin-photo-empty-note": "No custom images yet. The system default cover will be kept.",
        "admin-photo-custom-cover-note": "A custom cover has been added. The storefront will no longer show the system default cover.",
        "admin-photo-item-alt-prefix": "Product image",
        "admin-photo-invalid": "Image unavailable",
        "admin-photo-remove-btn": "Remove",
        "admin-product-disabled-label": "Unlist / Disable this product",
        "admin-product-save-btn": "Save",
        "admin-product-cancel-btn": "Cancel",
        "admin-modal-close": "Close",
        "admin-order-detail-title": "Order Details",
        "admin-status-label": "Status: ",
        "admin-shipped-time-label": "Shipped at: ",
        "admin-arrived-time-label": "Arrived at: ",
        "admin-received-time-label": "Received at: ",
        "admin-cancel-time-label": "Cancelled at: ",
        "admin-hold-time-label": "On hold since: ",
        "admin-order-items-title": "Order Items",
        "admin-moderation-pending-reviews-title": "Auto-Moderation Queue",
        "admin-moderation-pending-reports-title": "User Report Queue",
        "admin-moderation-empty-reviews": "No reviews pending moderation",
        "admin-moderation-empty-reports": "No reports pending processing",
        "admin-moderation-review-title": "Pending Review #",
        "admin-moderation-report-title": "Pending Report #",
        "admin-moderation-book-id-label": "Book ID: ",
        "admin-moderation-user-label": "User: ",
        "admin-moderation-review-id-label": "Review ID: ",
        "admin-moderation-reporter-label": "Reporter: ",
        "admin-moderation-submitted-at-label": "Submitted at: ",
        "admin-moderation-auto-trigger-label": "Auto trigger: ",
        "admin-moderation-report-reason-label": "Report reason: ",
        "admin-moderation-unknown-user": "Unknown user",
        "admin-moderation-no-comment": "(No comment text)",
        "admin-moderation-unknown-rule": "Unknown rule",
        "admin-moderation-review-reason-placeholder": "Optional: add moderation note (will be sent to user)",
        "admin-moderation-report-reason-placeholder": "Optional: add handling note (sent when report is rejected)",
        "admin-moderation-approve-btn": "Approve",
        "admin-moderation-reject-review-btn": "Reject Review",
        "admin-moderation-hide-btn": "Accept Report & Hide Review",
        "admin-moderation-reject-report-btn": "Reject Report",
        "admin-broadcast-title": "Send System Message",
        "admin-broadcast-user-id-placeholder": "User ID (leave empty = broadcast)",
        "admin-broadcast-title-placeholder": "Message title",
        "admin-broadcast-content-placeholder": "Message content",
        "admin-broadcast-send-btn": "Send Message",
        "admin-broadcast-fill-required": "Please enter message title and content",
        "admin-broadcast-send-failed": "Failed to send system message: ",
        "admin-broadcast-send-success": "System message sent",
        "admin-unknown-error": "Unknown error",
        "admin-reason-violence": "Violence/Gore",
        "admin-reason-sexual": "Sexual/Explicit",
        "admin-reason-political": "Political sensitivity",
        "admin-reason-malicious": "Malicious/Abusive",
        "admin-reason-spam": "Ads/Spam",
        "admin-reason-other": "Other",
        "admin-reason-other-prefix": "Other details: ",
        "admin-no-reason": "No reason provided",
        "history-title": "Browsing History",
        "history-count-label": "History:",
        "history-count-unit": " items",
        "history-clear-btn": "Clear History",
        "system-messages-title": "System Messages",
        "system-messages-count-label": "Messages:",
        "system-messages-count-unit": " messages",
        "system-messages-empty": "No system messages",
        "system-messages-default-title": "System Notification",
        "system-messages-no-content": "(No content)",
        "system-messages-mark-read": "Mark as Read",
        "system-messages-guest-error": "Guests cannot view system messages, please log in to use",

        // 页脚
        "footer-brand-title": "No-Name Bookstore",
        "footer-brand-desc": "AI-driven online bookstore providing personalized and convenient book shopping.",
        "footer-quick-links-title": "Quick Links",
        "footer-link-home": "Home",
        "footer-link-books": "All Books",
        "footer-link-recommendations": "Smart Picks",
        "footer-link-bestsellers": "Bestsellers",
        "footer-link-new-arrivals": "New Arrivals",
        "footer-service-title": "Customer Service",
        "footer-service-account": "My Account",
        "footer-service-orders": "Order Lookup",
        "footer-service-help": "Help Center",
        "footer-service-contact": "Contact Us",
        "footer-service-privacy": "Privacy Policy",
        "footer-service-terms": "Terms of Service",
        "footer-service-faq": "FAQ",
        "footer-project-title": "Project Info",
        "footer-project-desc-1": "CSAI3124 course project - online intelligent bookstore",
        "footer-project-desc-2": "Team: Zhang Xurui (PM), Wu Junhao, Wu Yingying, Zhang Yueran, Lu Zhuoqian",
        "footer-project-desc-3": "Instructor: [Instructor Name]",
        "footer-project-desc-4": "Academic Year 2025/2026",
        "footer-copyright": "© 2025-2026 No-Name Bookstore. All rights reserved. This site is for course demonstration only.",
        "footer-security": "This site uses HTTPS encryption and complies with OWASP security standards.",

        // 注册页
        "register-title": "No-Name Bookstore - Register",
        "register-title-user": "User Registration",
        "register-title-merchant": "Merchant Registration",
        "register-mode-user": "User Registration",
        "register-mode-merchant": "Merchant Registration",
        "register-mode-tip-user": "Choose your registration identity. User and merchant accounts are verified separately.",
        "register-mode-tip-merchant": "Only merchant (admin) accounts can register for admin backend access.",
        "register-username-label-user": "Username",
        "register-username-label-merchant": "Merchant Username",
        "register-username-label": "Username",
        "register-username-placeholder-user": "Enter username",
        "register-username-placeholder-merchant": "Enter merchant username",
        "register-username-placeholder": "Enter username",
        "register-email-label": "Email",
        "register-email-placeholder": "Enter email address",
        "register-password-label": "Password",
        "register-password-placeholder": "Enter password",
        "register-confirm-password-label": "Confirm Password",
        "register-confirm-password-placeholder": "Re-enter password",
        "register-agree-terms": "I have read and agree to the Terms of Service and Privacy Policy",
        "register-subscribe-news": "Subscribe to latest book recommendations and offers",
        "register-submit-btn": "Register Account",
        "register-divider-or": "Already have an account?",
        "register-login-text": "Already have an account?",
        "register-login-link": "Login now",

        // 注册页面表单标签
        "register-shopname-label": "Shop Name *",
        "register-shopname-placeholder": "Enter shop name",
        "register-merchant-contact-label": "Merchant Contact Phone",
        "register-merchant-contact-placeholder": "Enter contact phone (optional)",
        "register-shipping-address-label": "Shipping Address *",
        "register-shipping-address-placeholder": "Enter full shipping address (Province/City/District + Street)",
        "register-password-requirements": "Password must be at least 8 characters with letters and numbers",

        // 注册页面表单标签
        "register-fullname-label": "Full Name",
        "register-fullname-placeholder": "Enter your full name",

        // 注册页面左侧内容
        "register-left-title": "Join the World of Reading",
        "register-left-desc": "Create your account and start a personalized reading experience. Our AI algorithms will recommend books based on your preferences, track your reading history, and make every book a unique journey.",
        "register-feature-ai": "AI Book Recommendations",
        "register-feature-history": "Personalized Reading History",
        "register-feature-sync": "Cross-device Booklist Sync",
        "register-feature-secure": "Secure Encrypted Transactions",
        "register-feature-member": "Member Exclusive Offers",
        "register-feature-community": "Join Community Discussions",

        // 注册页导航栏
        "register-back-to-home": "Back to Home",
        "nav-login": "Login",
        "nav-register": "Register",

        // 注册页脚本文本
        "register-script-merchant-title": "Merchant Registration",
        "register-script-merchant-tip": "After registering a merchant account, you can access the admin backend from the merchant login.",
        "register-script-user-title": "User Registration",
        "register-script-user-tip": "Create a regular user account for browsing and purchasing books.",
        "register-script-username-min-length": "Username must be at least 3 characters",
        "register-script-username-invalid": "Username can only contain letters, numbers, and underscores",
        "register-script-shop-name-min-length": "Shop name must be at least 2 characters",
        "register-script-email-invalid": "Email must be in \"xxx@yyy\" format",
        "register-script-password-min-length": "Password must be at least 8 characters",
        "register-script-password-weak": "Password is too weak, please use a more complex password",
        "register-script-password-mismatch": "Passwords do not match",
        "register-script-registering": "Registering...",
        "register-script-merchant-success": "Merchant registration successful! Please return to login page and use the \"Merchant Login\" option.",
        "register-script-user-success-confirm": "Registration successful! Please check your email to complete verification before logging in.",
        "register-script-user-success": "Registration successful! Redirecting to login page shortly.",
        "register-script-duplicate-error": "This email or username is already registered",
        "register-script-invalid-error": "Invalid information, please check and try again",
        "register-script-rls-error": "Registration failed: Database security policy prevented writing (RLS). Please add appropriate INSERT policies in Supabase console, or have backend perform the insertion.",
        "register-script-generic-error": "Registration failed: ",
        "register-script-password-strength-weak": "Password strength: Weak",
        "register-script-password-strength-fair": "Password strength: Fair",
        "register-script-password-strength-good": "Password strength: Good",
        "register-script-password-strength-strong": "Password strength: Strong",
        "success-page-title": "Payment Success - No-Name Bookstore",
        "success-title": "Payment Successful",
        "success-subtitle": "Thank you for your purchase!",
        "success-view-order-btn": "View Order Details",
        "success-back-home-btn": "Back to Home",
        "success-note": "Order details have been sent to your email",
        "success-footer-copy": "© 2025-2026 No-Name Bookstore",
        "review-video-attachment": "Video attachment",
        "review-image-attachment": "Image attachment",
        "review-gallery-video-title": "Review Video Preview",
        "review-gallery-image-title": "Review Image Preview",
        "book-detail-meta-category": "Category",
        "book-detail-meta-author": "Author",
        "book-title-default": "Book",
        "book-title-untitled": "Untitled Book",
        "book-author-unknown": "Unknown Author",
        "book-detail-meta-rating": "Rating",
        "book-rating-none": "No ratings yet",
        "book-detail-meta-price": "Price",
        "book-detail-meta-review-count": "Review Count",
        "book-detail-unit-people": "people",
        "book-detail-meta-publisher": "Publisher",
        "book-detail-meta-tags": "Tags",
        "book-review-hint-own": "This is your review, and you cannot vote for yourself.",
        "book-review-hint-login-vote": "Sign in to mark whether this review is helpful.",
        "book-review-hint-no-session-vote": "Your account has no cloud session yet, so voting is unavailable.",
        "book-review-hint-question": "Is this review helpful to you?",
        "book-report-hint-own": "This is your review, and you cannot report yourself.",
        "book-report-hint-login-report": "Sign in to report disputed comments.",
        "book-report-hint-no-session-report": "Your account has no cloud session yet, so reporting is unavailable.",
        "book-report-hint-new": "You can submit a report for disputed content.",
        "book-report-hint-pending": "You have reported this. Admin is processing it.",
        "book-report-hint-hidden": "Report processed: the comment has been hidden.",
        "book-report-hint-rejected": "Report processed: admin rejected the report.",
        "book-report-hint-edit": "You have reported this before. You can edit the reason and resubmit.",
        "book-reviews-empty": "No user reviews yet. Be the first reviewer after purchase.",
        "book-rating-unit": "pts",
        "book-review-comment-empty": "This user gave a rating only and left no comment.",
        "book-review-helpful": "Helpful",
        "book-review-not-helpful": "Not Helpful",
        "book-review-report-btn": "Report",
        "book-review-report-other-placeholder": "If you choose \"Other\", please describe the reason",
        "book-review-report-submit": "Submit Report",
        "common-cancel": "Cancel",
        "book-review-report-collapse": "Collapse",
        "book-detail-author-prefix": "Author: ",
        "book-description-empty": "No description available",
        "book-detail-add-cart": "Add to Cart",
        "book-detail-continue": "Continue Browsing",
        "book-detail-section-info": "Book Information",
        "book-detail-section-description": "Book Description",
        "book-detail-section-highlights": "Highlights",
        "book-detail-highlight-category-prefix": "Great for readers who enjoy \"",
        "book-detail-highlight-category-suffix": "\" content.",
        "book-detail-highlight-rating-prefix": "Current reader rating is ",
        "book-detail-highlight-rating-suffix": ", useful as a purchase reference.",
        "book-detail-highlight-no-rating": "No buyer ratings yet. Be the first to review after purchase.",
        "book-detail-highlight-direct-cart": "You can add this book to cart directly without returning to the list.",
        "book-detail-section-tags": "Keywords",
        "book-detail-section-reviews": "User Reviews"
    }
};


let currentLang = localStorage.getItem('site_lang') || 'zh';
window.translations = translations;
window.currentLang = currentLang;


function updateLanguage(lang) {
    currentLang = lang;
    window.currentLang = lang;
    localStorage.setItem('site_lang', lang);
    document.documentElement.lang = lang === 'zh' ? 'zh-CN' : 'en';

    
    document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.getAttribute('data-i18n');
        if (translations[lang] && translations[lang][key]) {
            el.textContent = translations[lang][key];
        }
    });

    
    document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
        const key = el.getAttribute('data-i18n-placeholder');
        if (translations[lang] && translations[lang][key]) {
            el.placeholder = translations[lang][key];
        }
    });

    
    const toggleBtn = document.getElementById('lang-toggle-btn');
    if (toggleBtn) {
        toggleBtn.textContent = translations[lang]["lang-toggle-text"];
    }

    if (typeof window.onLanguageChanged === 'function') {
        window.onLanguageChanged(lang);
    }

    if (document.body) {
        translateResidualUiText(document.body);
        setTimeout(() => translateResidualUiText(document.body), 0);
    }
}

// 翻译函数，用于在JavaScript代码中获取翻译文本
function t(key) {
    if (translations[currentLang] && translations[currentLang][key]) {
        return translations[currentLang][key];
    }
    return key; // 如果找不到翻译，返回键名
}

const runtimeResidualMapEn = {
    '订单支付': 'Order Payment',
    '请选择支付方式': 'Please select a payment method',
    '选择收货地址': 'Choose Shipping Address',
    '正在加载收货地址...': 'Loading shipping addresses...',
    '微信': 'WeChat',
    '支付宝': 'Alipay',
    '银行卡': 'Bank Card',
    '下一步': 'Next',
    '返回购物车': 'Back to Cart',
    '支付处理中...': 'Processing payment...',
    '支付成功': 'Payment Successful',
    '感谢您的购买！': 'Thank you for your purchase!',
    '查看订单详情': 'View Order Details',
    '返回主页': 'Back to Home',
    '订单详情已发送至您的邮箱': 'Order details have been sent to your email',
    '支付时间：': 'Paid at: ',
    '暂无收藏图书': 'No favorite books yet',
    '购物车为空': 'Cart is empty',
    '未找到相关图书': 'No matching books found',
    '上一页': 'Previous',
    '下一页': 'Next',
    '默认地址': 'Default',
    '未知错误': 'Unknown error',
    '匿名用户': 'Anonymous User',
    '未命名图书': 'Untitled Book',
    '未知作者': 'Unknown Author',
    '暂无简介': 'No description available',
    '暂未评分': 'No ratings yet',
    '未登录': 'Not logged in',
    '游客': 'Guest',
    '用户': 'User',
    '重置密码': 'Reset Password',
    '验证身份': 'Verify Identity',
    '验证码验证': 'Code Verification',
    '设置新密码': 'Set New Password',
    '用户名': 'Username',
    '注册邮箱': 'Registered Email',
    '新密码': 'New Password',
    '确认新密码': 'Confirm New Password',
    '返回上一步': 'Back'
    ,'找回您的阅读世界': 'Recover Your Reading World'
    ,'忘记密码了吗？不用担心，我们为您提供安全的密码重置流程。只需几步，即可重新访问您的个性化阅读空间。': 'Forgot your password? No worries. Follow a secure reset flow to regain access to your personalized reading space in just a few steps.'
    ,'三重验证保障安全': 'Triple verification for security'
    ,'加密传输个人信息': 'Encrypted personal data transfer'
    ,'实时验证码保护': 'Real-time verification code protection'
    ,'云端同步更新': 'Cloud-synced updates'
    ,'即刻生效无需等待': 'Effective immediately'
    ,'下一步：获取验证码': 'Next: Get verification code'
    ,'验证码已发送到您的邮箱': 'A verification code has been sent to your email'
    ,'下一步：设置新密码': 'Next: Set new password'
    ,'重置中...': 'Resetting...'
    ,'想起了密码？': 'Remembered your password?'
    ,'返回登录': 'Back to login'
    ,'注册时使用的邮箱': 'Email used for registration'
    ,'请输入您的用户名': 'Enter your username'
    ,'请输入注册时使用的邮箱': 'Enter the email used at registration'
    ,'请输入6位验证码': 'Enter 6-digit verification code'
    ,'请输入新密码': 'Enter new password'
    ,'请再次输入新密码': 'Re-enter new password'
    ,'密码长度至少8位，包含字母和数字': 'Password must be at least 8 characters and include letters and numbers'
    ,'正在加载收货地址...': 'Loading shipping addresses...'
    ,'暂无收货地址，请先前往 账户设置 添加地址。': 'No shipping address found. Please add one in Account Settings.'
    ,'当前无法连接到数据库，暂时不能加载收货地址。': 'Database connection unavailable. Unable to load shipping addresses for now.'
    ,'请先选择收货地址，如暂无地址请前往账户设置添加': 'Please choose a shipping address first, or add one in Account Settings.'
    ,'订单商品为空，请返回购物车重新结算': 'Order items are empty. Please return to cart and retry.'
    ,'请先选择支付方式': 'Please select a payment method first'
    ,'保存失败：数据库 RLS/权限策略阻止了写入，请在 Supabase 为 books 表配置 INSERT/UPDATE 策略。': 'Save failed: blocked by database RLS/permission policy. Please configure INSERT/UPDATE policies for books in Supabase.'
    ,'产品ID 必须是正整数，或留空自动生成': 'Product ID must be a positive integer, or leave blank for auto-generation'
    ,'当前未连接到 Supabase，已先保存到本地缓存。': 'Supabase is unavailable; saved to local cache first.'
    ,'处理失败：': 'Process failed: '
    ,'处理举报失败：': 'Failed to process report: '
    ,'隐藏评论失败：': 'Failed to hide review: '
    ,'游客无法收藏，请登录后操作': 'Guests cannot favorite items. Please sign in first.'
    ,'收藏需要 Supabase 登录会话，请使用邮箱账号登录后重试': 'Favorites require a Supabase login session. Please sign in with your account and try again.'
    ,'收藏失败：未连接到数据库': 'Failed to favorite: database is not connected'
    ,'收藏失败：数据库权限策略阻止了写入': 'Failed to favorite: blocked by database permission policy'
    ,'订单已创建，请在订单列表中查看最新记录': 'Order created. Please check the latest record in your orders list.'
    ,'游客无法使用购物车，请登录后操作': 'Guests cannot use the cart. Please sign in first.'
    ,'已确认收货，请为订单内图书评分评价': 'Order received confirmed. Please rate and review the books in this order.'
    ,'请先选择 1-5 分评分': 'Please select a rating from 1 to 5 first'
    ,'评价提交失败：订单或图书信息异常': 'Review submission failed: invalid order or book information'
    ,'评价已提交，内容触发自动审核，待管理员复核后发布': 'Review submitted. The content has entered auto-moderation and will be published after admin review.'
    ,'购物车已清空': 'Cart cleared'
    ,'该图书已下架，暂时无法加入购物车': 'This book is unavailable and cannot be added to cart right now.'
    ,'游客无法操作购物车，请登录后使用': 'Guests cannot modify the cart. Please sign in first.'
    ,'游客无法访问购物车，请登录后使用此功能': 'Guests cannot access the cart. Please sign in to use this feature.'
    ,'图书信息': 'Book Information'
    ,'图书简介': 'Book Description'
    ,'内容亮点': 'Highlights'
    ,'关键词': 'Keywords'
    ,'用户评价': 'User Reviews'
    ,'加入购物车': 'Add to Cart'
    ,'继续逛逛': 'Continue Browsing'
    ,'有帮助': 'Helpful'
    ,'没帮助': 'Not Helpful'
    ,'举报': 'Report'
    ,'收起': 'Collapse'
    ,'提交举报': 'Submit Report'
    ,'取消': 'Cancel'
    ,'评价附件预览': 'Review Attachments Preview'
    ,'评价视频预览': 'Review Video Preview'
    ,'评价图片预览': 'Review Image Preview'
    ,'上一张': 'Previous'
    ,'下一张': 'Next'
    ,'关闭详情页': 'Close details'
    ,'关闭大图预览': 'Close gallery preview'
    ,'图书分类': 'Category'
    ,'作者': 'Author'
    ,'评分': 'Rating'
    ,'价格': 'Price'
    ,'评价人数': 'Review Count'
    ,'出版社': 'Publisher'
    ,'标签': 'Tags'
    ,'该用户仅评分，未填写评论。': 'This user gave a rating only and left no comment.'
    ,'暂无用户评价，欢迎购买后成为首位评价者。': 'No user reviews yet. Be the first reviewer after purchase.'
    ,'这是你发布的评价，不能给自己投票': 'This is your review, and you cannot vote for yourself.'
    ,'登录后可标记这条评价是否有帮助': 'Sign in to mark whether this review is helpful.'
    ,'当前账号未建立云端会话，暂不可投票': 'Your account has no cloud session yet, so voting is unavailable.'
    ,'这条评价对你有帮助吗？': 'Is this review helpful to you?'
    ,'这是你发布的评价，不能举报自己': 'This is your review, and you cannot report yourself.'
    ,'登录后可举报争议评论': 'Sign in to report disputed comments.'
    ,'当前账号未建立云端会话，暂不可举报': 'Your account has no cloud session yet, so reporting is unavailable.'
    ,'发现争议内容可发起举报': 'You can submit a report for disputed content.'
    ,'你已举报，管理员处理中': 'You have reported this. Admin is processing it.'
    ,'举报已处理：评论已被隐藏': 'Report processed: the comment has been hidden.'
    ,'举报已处理：管理员驳回举报': 'Report processed: admin rejected the report.'
    ,'你已提交过举报，可再次修改原因': 'You have reported this before. You can edit the reason and resubmit.'
    ,'游客无法举报评论，请登录后再操作': 'Guests cannot report comments. Please sign in first.'
    ,'未找到对应评论，可能已更新，请刷新后重试': 'Review not found. Data may have changed. Please refresh and try again.'
    ,'举报已提交，管理员将尽快处理': 'Report submitted. Admin will handle it as soon as possible.'
    ,'你已经提交过这个反馈了': 'You already submitted this feedback.'
    ,'反馈提交失败：': 'Failed to submit feedback: '
    ,'已记录这条评价的帮助反馈': 'Your helpfulness feedback has been recorded.'
    ,'未找到该图书详情': 'Book details not found'
    ,'支付成功 - 懒得起名小书铺': 'Payment Success - No-Name Bookstore'
    ,'智能推荐 · 悦读无限': 'Smart Picks · Endless Reading'
    ,'分': 'pts'
};

const runtimeResidualRegexEn = [
    [/^(\d+)秒后重发$/, '$1s to resend'],
    [/^已发送到:\s*(.+)$/, 'Sent to: $1'],
    [/^未确认收货，还剩\s*(\d+)\s*天自动收货$/, 'Not confirmed. Auto-receive in $1 day(s).'],
    [/^第\s*(\d+)\s*\/\s*(\d+)\s*页$/, 'Page $1 / $2'],
    [/^第\s*(\d+)\s*页$/, 'Page $1'],
    [/^支付时间：\s*(.+)$/, 'Paid at: $1'],
    [/^加载收货地址失败：\s*(.+)$/, 'Failed to load shipping addresses: $1'],
    [/^系统消息发送失败：\s*(.+)$/, 'Failed to send system message: $1'],
    [/^保存失败：\s*(.+)$/, 'Save failed: $1'],
    [/^更新订单状态失败：\s*(.+)$/, 'Failed to update order status: $1']
    ,[/^处理失败：\s*(.+)$/, 'Process failed: $1']
    ,[/^处理举报失败：\s*(.+)$/, 'Failed to process report: $1']
    ,[/^隐藏评论失败：\s*(.+)$/, 'Failed to hide review: $1']
    ,[/^重置失败：(.+)$/, 'Reset failed: $1']
    ,[/^已发送到:\s*(.+)$/, 'Sent to: $1']
    ,[/^收藏失败：(.+)$/, 'Failed to favorite: $1']
    ,[/^自动收货同步失败：(.+)$/, 'Auto-receipt sync failed: $1']
    ,[/^确认收货失败：(.+)$/, 'Confirm receipt failed: $1']
    ,[/^评价提交失败：(.+)$/, 'Review submission failed: $1']
    ,[/^作者：\s*(.+)$/, 'Author: $1']
    ,[/^查看第\s*(\d+)\s*张图片$/, 'View image #$1']
    ,[/^适合喜欢「(.+)」内容的读者。$/, 'Great for readers who enjoy "$1" content.']
    ,[/^当前读者评分为\s*(.+)，可作为选购参考。$/, 'Current reader rating is $1, useful as a purchase reference.']
    ,[/^当前暂无买家评分，欢迎首位读者完成购买后评价。$/, 'No buyer ratings yet. Be the first to review after purchase.']
    ,[/^页面支持直接加入购物车，无需返回列表页。$/, 'You can add this book to cart directly without returning to the list.']
    ,[/^举报失败：(.+)$/, 'Report failed: $1']
    ,[/^反馈提交失败：(.+)$/, 'Failed to submit feedback: $1']
    ,[/^"(.+)"\s*已添加到购物车$/, '"$1" added to cart']
    ,[/^"(.+)"\s*已从购物车移除$/, '"$1" removed from cart']
    ,[/^"(.+)\.\.\."\s*已添加到购物车$/, '"$1..." added to cart']
    ,[/^"(.+)\.\.\."\s*已从购物车移除$/, '"$1..." removed from cart']
];

function runtimeTranslateString(text, lang = currentLang) {
    const raw = String(text ?? '');
    if (!raw || lang !== 'en') return raw;
    if (runtimeResidualMapEn[raw]) return runtimeResidualMapEn[raw];

    const trimmed = raw.trim();
    if (trimmed && runtimeResidualMapEn[trimmed]) {
        return raw.replace(trimmed, runtimeResidualMapEn[trimmed]);
    }

    let translated = raw;
    runtimeResidualRegexEn.forEach(([pattern, replacement]) => {
        translated = translated.replace(pattern, replacement);
    });
    return translated;
}

function runtimeTranslateElementAttributes(el) {
    if (!el || currentLang !== 'en') return;
    ['placeholder', 'title', 'aria-label'].forEach(attr => {
        const value = el.getAttribute && el.getAttribute(attr);
        if (!value) return;
        const translated = runtimeTranslateString(value);
        if (translated !== value) el.setAttribute(attr, translated);
    });

    if ((el.tagName === 'INPUT' || el.tagName === 'BUTTON') && el.value) {
        const translatedValue = runtimeTranslateString(el.value);
        if (translatedValue !== el.value) el.value = translatedValue;
    }
}

function translateResidualUiText(root = document.body) {
    if (!root || currentLang !== 'en') return;

    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
        acceptNode(node) {
            if (!node || !node.parentElement) return NodeFilter.FILTER_REJECT;
            const tag = node.parentElement.tagName;
            if (['SCRIPT', 'STYLE', 'NOSCRIPT'].includes(tag)) return NodeFilter.FILTER_REJECT;
            if (!node.nodeValue || !node.nodeValue.trim()) return NodeFilter.FILTER_REJECT;
            return NodeFilter.FILTER_ACCEPT;
        }
    });

    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    nodes.forEach(node => {
        const translated = runtimeTranslateString(node.nodeValue);
        if (translated !== node.nodeValue) node.nodeValue = translated;
    });

    const elements = root.querySelectorAll ? root.querySelectorAll('*') : [];
    elements.forEach(runtimeTranslateElementAttributes);
}

if (!window.__i18nAlertWrapped) {
    const nativeAlert = window.alert?.bind(window);
    if (nativeAlert) {
        window.alert = function(message) {
            nativeAlert(runtimeTranslateString(String(message ?? '')));
        };
    }
    window.__i18nAlertWrapped = true;
}

window.runtimeTranslateString = runtimeTranslateString;


document.addEventListener('DOMContentLoaded', () => {
    updateLanguage(currentLang);

    if (!window.__i18nResidualObserverBound && document.body) {
        const observer = new MutationObserver(mutations => {
            if (currentLang !== 'en') return;
            mutations.forEach(mutation => {
                mutation.addedNodes.forEach(node => {
                    if (node.nodeType === Node.TEXT_NODE && node.parentElement) {
                        const translated = runtimeTranslateString(node.nodeValue);
                        if (translated !== node.nodeValue) node.nodeValue = translated;
                        runtimeTranslateElementAttributes(node.parentElement);
                        return;
                    }
                    if (node.nodeType === Node.ELEMENT_NODE) {
                        translateResidualUiText(node);
                    }
                });
            });
        });
        observer.observe(document.body, { childList: true, subtree: true, characterData: true });
        window.__i18nResidualObserverBound = true;
    }

    
    const toggleBtn = document.getElementById('lang-toggle-btn');
    if (toggleBtn) {
        toggleBtn.addEventListener('click', (e) => {
            e.preventDefault(); // 防止 a 标签默认跳转
            const newLang = currentLang === 'zh' ? 'en' : 'zh';
            updateLanguage(newLang);
        });
    }
});
