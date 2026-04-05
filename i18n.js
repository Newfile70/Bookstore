// i18n.js
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
        "favorites-clear-btn": "清空收藏",
        "orders-title": "我的订单",
        "orders-count-label": "订单数：",
        "history-title": "浏览历史",
        "history-count-label": "历史记录：",
        "history-clear-btn": "清空历史",
        "system-messages-title": "系统消息",
        "system-messages-count-label": "消息数：",

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
        "footer-project-title": "项目信息",
        "footer-project-desc-1": "CSAI3124课程项目 - 在线智能书店",
        "footer-project-desc-2": "开发团队：张徐瑞(项目经理)、吴军浩、吴莹莹、张玥冉、卢卓谦",
        "footer-project-desc-3": "指导老师：[教师姓名]",
        "footer-project-desc-4": "2025/2026学年",
        "footer-copyright": "© 2025-2026 懒得起名小书铺 - 在线智能书店. 保留所有权利. 本网站仅为课程项目演示.",
        "footer-security": "本网站采用HTTPS加密传输，符合OWASP安全标准"
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
        "lang-toggle-text": "中文",

        // 巨幕英雄区 (Hero Section)
        "hero-title": "Find Your Next Great Book",
        "hero-subtitle": "AI-powered recommendations tailored to your reading tastes for a smarter reading journey.",
        "hero-btn-explore": "Explore Books",
        "hero-btn-AI": "View Recommendations",

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
        "favorites-clear-btn": "Clear Favorites",
        "orders-title": "My Orders",
        "orders-count-label": "Order Count:",
        "history-title": "Browsing History",
        "history-count-label": "History:",
        "history-clear-btn": "Clear History",
        "system-messages-title": "System Messages",
        "system-messages-count-label": "Messages:",

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
        "footer-project-title": "Project Info",
        "footer-project-desc-1": "CSAI3124 course project - online intelligent bookstore",
        "footer-project-desc-2": "Team: Zhang Xurui (PM), Wu Junhao, Wu Yingying, Zhang Yueran, Lu Zhuoqian",
        "footer-project-desc-3": "Instructor: [Instructor Name]",
        "footer-project-desc-4": "Academic Year 2025/2026",
        "footer-copyright": "© 2025-2026 No-Name Bookstore. All rights reserved. This site is for course demonstration only.",
        "footer-security": "This site uses HTTPS encryption and complies with OWASP security standards."
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