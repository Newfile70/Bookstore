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

        // AI 推荐
        "recommendations-title": "为您推荐",
        "recommendations-subtitle": "基于您的浏览历史和偏好，AI为您精心挑选",
        "recommendations-refresh-info": "推荐每10分钟更新一次，确保内容新鲜度",
        "recommendations-refresh-btn": "刷新推荐",

        // 购物车 / 侧边栏
        "cart-title": "购物车",
        "cart-total-label": "总计：",
        "cart-checkout-btn": "前往结算",
        "cart-clear-btn": "清空购物车",
        "favorites-title": "我的收藏",
        "favorites-count-label": "已收藏：",
        "favorites-count-unit": " 本",
        "favorites-clear-btn": "清空收藏",
        "orders-title": "我的订单",
        "orders-count-label": "订单数：",
        "orders-count-unit": " 单",
        "order-status-pending": "待处理",
        "order-status-hold": "暂缓",
        "order-status-shipped": "已发货",
        "order-status-arrived": "已到货",
        "order-status-received": "已收货",
        "order-status-cancelled": "已取消",
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
        "register-script-password-strength-strong": "密码强度：强"
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

        // AI 推荐
        "recommendations-title": "Recommended For You",
        "recommendations-subtitle": "AI selects books based on your browsing history and preferences.",
        "recommendations-refresh-info": "Recommendations refresh every 10 minutes to keep content fresh.",
        "recommendations-refresh-btn": "Refresh Recommendations",

        // 购物车 / 侧边栏
        "cart-title": "Shopping Cart",
        "cart-total-label": "Total:",
        "cart-checkout-btn": "Checkout",
        "cart-clear-btn": "Clear Cart",
        "favorites-title": "My Favorites",
        "favorites-count-label": "Saved:",
        "favorites-count-unit": " books",
        "favorites-clear-btn": "Clear Favorites",
        "orders-title": "My Orders",
        "orders-count-label": "Order Count:",
        "orders-count-unit": " orders",
        "order-status-pending": "Pending",
        "order-status-hold": "On Hold",
        "order-status-shipped": "Shipped",
        "order-status-arrived": "Arrived",
        "order-status-received": "Received",
        "order-status-cancelled": "Cancelled",
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
        "register-script-password-strength-strong": "Password strength: Strong"
    }
};


let currentLang = localStorage.getItem('site_lang') || 'zh';


function updateLanguage(lang) {
    currentLang = lang;
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
}

// 翻译函数，用于在JavaScript代码中获取翻译文本
function t(key) {
    if (translations[currentLang] && translations[currentLang][key]) {
        return translations[currentLang][key];
    }
    return key; // 如果找不到翻译，返回键名
}


document.addEventListener('DOMContentLoaded', () => {
    updateLanguage(currentLang);

    
    const toggleBtn = document.getElementById('lang-toggle-btn');
    if (toggleBtn) {
        toggleBtn.addEventListener('click', (e) => {
            e.preventDefault(); // 防止 a 标签默认跳转
            const newLang = currentLang === 'zh' ? 'en' : 'zh';
            updateLanguage(newLang);
        });
    }
});
