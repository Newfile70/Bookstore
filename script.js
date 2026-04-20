// script.js - 懒得起名小书铺交互脚本

function t(key, fallback) {
    const lang = (typeof currentLang !== 'undefined' && currentLang)
        ? currentLang
        : (localStorage.getItem('site_lang') || 'zh');
    const dict = (typeof translations !== 'undefined' && translations?.[lang])
        ? translations[lang]
        : (window.translations && window.translations[lang] ? window.translations[lang] : null);
    return (dict && dict[key]) || fallback || key;
}

document.addEventListener('DOMContentLoaded', async function() {
    let currentPage = 1;
    const pageSize = 12;
    const CHECKOUT_PAYLOAD_KEY = 'bookstore_checkout_payload_v1';
    const CART_STORAGE_PREFIX = 'bookstore_cart_v1';
    const HISTORY_STORAGE_PREFIX = 'bookstore_history_v1';
    const SYSTEM_MESSAGE_READ_STORAGE_PREFIX = 'bookstore_system_message_read_v1';
    const BOOKS_CACHE_KEY = 'bookstore_books_cache_v2';
    const ORDER_AUTO_RECEIVE_MS = 7 * 24 * 60 * 60 * 1000;
    const RECOMMENDATION_CACHE_PREFIX = 'bookstore_recommendation_cache_v2';
    const RECOMMENDATION_SERVED_CACHE_PREFIX = 'bookstore_recommendation_served_v2';
    const RECOMMENDATION_META_PREFIX = 'bookstore_recommendation_meta_v1';
    const RECOMMENDATION_CACHE_TTL_MS = 10 * 60 * 1000;
    const RECOMMENDATION_SERVED_TTL_MS = 10 * 60 * 1000;
    const RECOMMENDATION_FALLBACK_TTL_MS = 90 * 1000;
    const RECOMMENDATION_REFRESH_DEBOUNCE_MS = 2500;
    const RECOMMENDATION_FALLBACK_LIMIT = 4;
    const RECOMMENDATION_CANDIDATE_LIMIT = 12;
    function getOrderStatusLabel(status) {
        const normalized = normalizeOrderStatus(status);
        const keyMap = {
            pending: 'order-status-pending',
            hold: 'order-status-hold',
            shipped: 'order-status-shipped',
            arrived: 'order-status-arrived',
            received: 'order-status-received',
            cancelled: 'order-status-cancelled'
        };
        return t(keyMap[normalized] || '', status || '-');
    }
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
    let bookReviews = [];
    let reviewHelpfulnessVotes = [];
    let reviewReports = [];
    let systemMessages = [];
    let currentUserId = null;
    let currentOrderFilter = 'all';
    let browsingHistory = [];
    let recommendationRefreshTimer = null;
    let recommendationRequestToken = 0;
    let recommendationRefreshPromise = null;
    let recommendationRefreshPromiseLang = '';
    let recommendationAbortController = null;
    let recommendationMetaState = {
        dirty: false,
        dirtyReasons: [],
        dirtyHintShown: false,
        lastSuccessfulRefreshAt: '',
        lastAttemptAt: '',
        lastProfileHash: '',
        lastServedSource: 'idle'
    };
    let recommendationSummaryState = {
        summary: '',
        source: 'idle',
        updatedAt: '',
        traceId: ''
    };
    let detailGalleryAutoplayTimer = null;
    let activeBookDetailId = null;
    const DETAIL_GALLERY_INTERVAL_MS = 2000;
    const REVIEW_MEDIA_MAX_FILES = 4;
    const REVIEW_MEDIA_MAX_IMAGE_BYTES = 5 * 1024 * 1024;
    const REVIEW_MEDIA_MAX_VIDEO_BYTES = 15 * 1024 * 1024;
    const REVIEW_MEDIA_TOTAL_BYTES_LIMIT = 20 * 1024 * 1024;
    const favoriteBookIds = new Set();
    const reviewedOrderBookKeys = new Set();
    const bookRatingStatsMap = new Map();
    const reviewHelpfulnessStatsMap = new Map();
    const currentUserReviewVoteMap = new Map();
    const currentUserReportedReviewMap = new Map();
    const orderReviewMediaDraftMap = new Map();
    const cartItems = [];
    const AUTO_MODERATION_RULES = {
        violence: ['暴力', '砍死', '杀人', '血腥', '爆头', '炸弹', '枪击', 'terror', 'kill'],
        sexual: ['色情', '约炮', '裸照', '成人视频', '性行为', 'porn', 'nude', 'sex'],
        political: ['反动', '颠覆', '分裂国家', '敏感政治', '政治宣传', 'extremism'],
        malicious: ['骗子', '诈骗', '恶意攻击', '人肉', '辱骂', '诽谤', '去死', '傻逼', '操你']
    };

    function stopDetailGalleryAutoplay() {
        if (!detailGalleryAutoplayTimer) return;
        clearInterval(detailGalleryAutoplayTimer);
        detailGalleryAutoplayTimer = null;
    }

    function syncDetailOpenState() {
        const hasActiveModal = Boolean(
            document.querySelector('#book-detail-modal.active')
            || document.querySelector('#order-detail-modal.active')
            || document.querySelector('#review-media-gallery-modal.active')
        );
        document.body.classList.toggle('detail-open', hasActiveModal);
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
        if (!value) return '-';
        const locale = currentLang === 'en' ? 'en-US' : 'zh-CN';
        return new Date(value).toLocaleString(locale, { hour12: false });
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

    function toNullableBoolean(value) {
        if (typeof value === 'boolean') return value;
        const normalized = String(value ?? '').trim().toLowerCase();
        if (['true', '1', 'yes', 'y', 'on', 'helpful', 'up'].includes(normalized)) return true;
        if (['false', '0', 'no', 'n', 'off', 'not_helpful', 'not-helpful', 'unhelpful', 'down'].includes(normalized)) return false;
        return null;
    }

    function normalizeModerationStatus(value) {
        const normalized = String(value || '').trim().toLowerCase();
        if (['approved', 'pass', 'published'].includes(normalized)) return 'approved';
        if (['pending', 'reviewing', 'manual_review', 'queued'].includes(normalized)) return 'pending';
        if (['rejected', 'reject', 'denied'].includes(normalized)) return 'rejected';
        if (['hidden', 'removed', 'blocked'].includes(normalized)) return 'hidden';
        return 'approved';
    }

    function getModerationStatusLabel(status) {
        const normalized = normalizeModerationStatus(status);
        if (normalized === 'pending') return '待人工审核';
        if (normalized === 'rejected') return '审核未通过';
        if (normalized === 'hidden') return '已隐藏';
        return '已发布';
    }

    function getCurrentDisplayUsername() {
        const loginUsername = String(sessionStorage.getItem('loginUsername') || '').trim();
        const username = String(sessionStorage.getItem('username') || '').trim();
        return loginUsername || username || '匿名用户';
    }

    function evaluateReviewContentModeration(comment, reviewerName = '') {
        const content = `${String(comment || '')} ${String(reviewerName || '')}`.toLowerCase();
        const labels = [];

        Object.entries(AUTO_MODERATION_RULES).forEach(([label, keywords]) => {
            if ((keywords || []).some(keyword => content.includes(String(keyword).toLowerCase()))) {
                labels.push(label);
            }
        });

        if (!labels.length) {
            return { status: 'approved', labels: [], reason: '' };
        }

        const reason = `触发自动审核规则：${labels.join('、')}`;
        return { status: 'pending', labels, reason };
    }

    function normalizeStorefrontBook(raw, index = 0) {
        const photos = normalizePhotoList(raw?.photos ?? raw?.photo_urls ?? raw?.images ?? raw?.image_urls);
        return {
            photos,
            id: raw?.id ?? raw?._id ?? index + 1,
            title: raw?.title ?? raw?.name ?? '',
            titleEn: raw?.title_en ?? raw?.titleEn ?? '',
            author: raw?.author ?? raw?.writer ?? '',
            authorEn: raw?.author_en ?? raw?.authorEn ?? '',
            category: raw?.category ?? raw?.cat ?? 'all',
            price: parseFloat(raw?.price) || 0,
            rating: parseFloat(raw?.rating) || 0,
            description: raw?.description ?? raw?.desc ?? '',
            descriptionEn: raw?.description_en ?? raw?.descriptionEn ?? '',
            tags: normalizeTextList(raw?.tags),
            tagsEn: normalizeTextList(raw?.tags_en ?? raw?.tagsEn),
            publisher: raw?.publisher ?? '',
            publisherEn: raw?.publisher_en ?? raw?.publisherEn ?? '',
            isbn: raw?.isbn ?? '',
            disabled: toBooleanFlag(raw?.disabled),
            color: raw?.color ?? '#b09d7b',
            coverUrl: sanitizeImageUrl(raw?.cover_url ?? raw?.coverUrl ?? photos[0] ?? ''),
            summaryHtml: raw?.summary_html
                ?? raw?.summaryHtml
                ?? raw?.summary
                ?? raw?.intro_html
                ?? raw?.introduction_html
                ?? raw?.detail_html
                ?? '',
            summaryHtmlEn: raw?.summary_html_en
                ?? raw?.summaryHtmlEn
                ?? raw?.summary_en
                ?? raw?.summaryEn
                ?? ''
        };
    }

    function isEnglishContentMode() {
        const lang = (typeof window.currentLang === 'string' && window.currentLang)
            ? window.currentLang
            : (localStorage.getItem('site_lang') || 'zh');
        return lang === 'en';
    }

    function getRecommendationLang() {
        return isEnglishContentMode() ? 'en' : 'zh';
    }

    const RECOMMENDATION_RUNTIME_TEXTS = {
        zh: {
            badge: 'AI推荐',
            empty: '暂无可推荐图书',
            dirty_purchase: '已记录购买行为，将优先纳入下一次推荐刷新。',
            dirty_cart: '已记录购物车变化，将在下次刷新时纳入推荐。',
            dirty_favorite: '已记录收藏变化，将在下次刷新时纳入推荐。',
            dirty_history: '已记录最近浏览，将在下次刷新时纳入推荐。',
            dirty_review: '已记录评价反馈，将在下次刷新时纳入推荐。',
            dirty_history_clear: '已记录历史清空，将在下次刷新时更新推荐。',
            dirty_generic: '偏好变化已记录，将在下次刷新时纳入推荐。',
            toast_auth_required: '当前账号未建立云端会话，已切换为本地候选/热门推荐',
            toast_served_stale: '当前先继续展示上次推荐，系统会尽快刷新',
            toast_served_cache: '当前继续展示已缓存推荐',
            toast_updated: '推荐已更新',
            toast_fallback_candidates: '智能排序暂不可用，已切换为本地候选推荐',
            toast_fallback_popular: '智能排序暂不可用，已切换为热门推荐',
            toast_recovered: '推荐已按热门与评分恢复',
            refresh_ready: '最近更新：{time}。{source}',
            refresh_default: '推荐会结合浏览、收藏、购物车和购买行为更新，也可以手动刷新。',
            refresh_manual_suffix: '你也可以手动刷新推荐。',
            refresh_source_llm: '当前为智能精排结果。',
            refresh_source_profile_cache: '当前结果命中画像缓存。',
            refresh_source_fallback_candidates: '当前为本地候选兜底结果。',
            refresh_source_fallback_popular: '当前为热门兜底结果。',
            refresh_source_served_cache: '当前展示缓存推荐。',
            refresh_dirty_suffix: '偏好变化已记录，等待下一次刷新。',
            summary_low_signal: '行为信号不足，已按当前口碑与热门图书为你补充推荐。',
            summary_auth_required: '登录后可启用云端智能精排，当前已按本地候选与热门信号为你生成推荐。',
            summary_server_fallback: '服务端已切换为候选兜底排序，推荐区已稳定恢复。',
            summary_local_fallback: '智能排序暂时不可用，已按本地候选粗排为你稳定补齐推荐。',
            summary_popular_recovered: '推荐服务暂不可用，已按热门与评分为你恢复首页推荐。',
            summary_llm_default: '基于你最近的兴趣画像，已从 {count} 本候选中完成智能精排。',
            fallback_reason_default: '综合你的近期阅读偏好推荐',
            price_low: '偏好亲民价位',
            price_medium: '偏好中等价位',
            price_high: '偏好较高价位',
            recent_categories: '最近偏向{items}',
            recent_authors: '关注{items}等作者',
            recent_tags: '常看{items}相关主题',
            recent_cart: '购物车中已有 {count} 本意向图书',
            popular_reason_high_rating: '综合评分稳定靠前，适合作为首页推荐',
            popular_reason_review_stable: '近期口碑表现稳定，值得优先关注',
            popular_reason_default: '基于热门与评分表现，为你稳妥推荐',
            recall_purchase_favorite: '命中你的已购与收藏偏好',
            recall_purchase_cart: '结合你的已购与购物车兴趣优先推荐',
            recall_favorite_cart: '同时参考了你的收藏与购物车意向',
            recall_purchase: '延续你已购图书的阅读方向',
            recall_favorite_history: '同时参考了你的收藏与近期浏览',
            recall_favorite: '结合你的收藏偏好优先推荐',
            recall_cart: '结合你的购物车意向优先推荐',
            recall_history: '延续你最近浏览的阅读兴趣',
            recall_popular: '在当前候选中热度与口碑都较稳'
        },
        en: {
            badge: 'AI Pick',
            empty: 'No recommendations available',
            dirty_purchase: 'Purchase activity is recorded for the next refresh.',
            dirty_cart: 'Cart changes are recorded for the next refresh.',
            dirty_favorite: 'Favorite changes are recorded for the next refresh.',
            dirty_history: 'Recent browsing is recorded for the next refresh.',
            dirty_review: 'Review feedback is recorded for the next refresh.',
            dirty_history_clear: 'History clearing is recorded for the next refresh.',
            dirty_generic: 'Preference changes are recorded for the next refresh.',
            toast_auth_required: 'No cloud session was found for this account, so local candidate and popular recommendations are shown.',
            toast_served_stale: 'The previous recommendations are still shown while a refresh is prepared.',
            toast_served_cache: 'Showing cached recommendations for now.',
            toast_updated: 'Recommendations updated.',
            toast_fallback_candidates: 'AI ranking is unavailable, so local candidate recommendations are shown.',
            toast_fallback_popular: 'AI ranking is unavailable, so popular recommendations are shown.',
            toast_recovered: 'Recommendations recovered from popularity and ratings.',
            refresh_ready: 'Last updated: {time}. {source}',
            refresh_default: 'Recommendations react to browsing, favorites, cart, and purchases. You can refresh anytime.',
            refresh_manual_suffix: 'You can refresh recommendations anytime.',
            refresh_source_llm: 'Current result uses AI ranking.',
            refresh_source_profile_cache: 'Current result comes from the profile cache.',
            refresh_source_fallback_candidates: 'Current result uses local candidate fallback.',
            refresh_source_fallback_popular: 'Current result uses popular fallback.',
            refresh_source_served_cache: 'Current result is from cache.',
            refresh_dirty_suffix: 'Preference changes are queued for the next refresh.',
            summary_low_signal: 'Behavior signals are limited, so popular and highly rated books are used to fill recommendations.',
            summary_auth_required: 'Sign in to enable cloud AI ranking. Local candidate and popular signals are used for now.',
            summary_server_fallback: 'The server switched to candidate fallback ranking and the recommendation area has recovered.',
            summary_local_fallback: 'AI ranking is temporarily unavailable, so local candidates were used to fill recommendations.',
            summary_popular_recovered: 'The recommendation service is temporarily unavailable, so popular and highly rated books are shown.',
            summary_llm_default: 'Based on your recent interest profile, AI reranked {count} candidates.',
            fallback_reason_default: 'Recommended from your recent reading preferences',
            price_low: 'Prefers more affordable books',
            price_medium: 'Prefers mid-range books',
            price_high: 'Prefers higher-priced books',
            recent_categories: 'Recently leaning toward {items}',
            recent_authors: 'Paying attention to authors like {items}',
            recent_tags: 'Often browsing themes such as {items}',
            recent_cart: '{count} books already in the cart',
            popular_reason_high_rating: 'Consistently strong ratings make it a solid homepage pick',
            popular_reason_review_stable: 'Recent feedback has been steady and worth highlighting',
            popular_reason_default: 'A safe pick based on popularity and ratings',
            recall_purchase_favorite: 'Matches both your purchase and favorite preferences',
            recall_purchase_cart: 'Recommended from both your purchase and cart interests',
            recall_favorite_cart: 'Based on both your favorites and cart intent',
            recall_purchase: 'Continues the direction of books you already purchased',
            recall_favorite_history: 'Based on both your favorites and recent browsing',
            recall_favorite: 'Prioritized from your favorite preferences',
            recall_cart: 'Prioritized from your cart intent',
            recall_history: 'Continues your recent browsing interests',
            recall_popular: 'Performs steadily on both popularity and ratings within the current candidates'
        }
    };

    function getRecommendationText(key, vars = {}, lang = getRecommendationLang()) {
        const safeLang = String(lang || '').trim() === 'en' ? 'en' : 'zh';
        const baseDict = RECOMMENDATION_RUNTIME_TEXTS[safeLang] || RECOMMENDATION_RUNTIME_TEXTS.zh;
        const fallbackDict = RECOMMENDATION_RUNTIME_TEXTS.zh || {};
        const template = String(baseDict?.[key] ?? fallbackDict?.[key] ?? key);
        return template.replace(/\{(\w+)\}/g, (match, name) => (
            Object.prototype.hasOwnProperty.call(vars || {}, name) ? String(vars[name]) : match
        ));
    }

    function getRecommendationDefaultSummary(lang = getRecommendationLang()) {
        const safeLang = String(lang || '').trim() === 'en' ? 'en' : 'zh';
        const fallback = safeLang === 'en'
            ? 'AI recommendations shaped by your recent interests'
            : '基于您的浏览历史和偏好，AI为您精心挑选';
        const dict = (typeof translations !== 'undefined' && translations?.[safeLang])
            ? translations[safeLang]
            : (window.translations && window.translations[safeLang] ? window.translations[safeLang] : null);
        return String((dict && dict['recommendations-subtitle']) || t('recommendations-subtitle', fallback) || fallback).trim();
    }

    function formatRecommendationTime(timestamp, lang = getRecommendationLang()) {
        const date = new Date(timestamp);
        if (!Number.isFinite(date.getTime())) return '';
        const locale = String(lang || '').trim() === 'en' ? 'en-US' : 'zh-CN';
        return date.toLocaleTimeString(locale, {
            hour12: false,
            hour: '2-digit',
            minute: '2-digit'
        });
    }

    function joinLocalizedList(items, max = 3, lang = getRecommendationLang()) {
        const safeLang = String(lang || '').trim() === 'en' ? 'en' : 'zh';
        const values = (Array.isArray(items) ? items : [])
            .map(item => String(item || '').trim())
            .filter(Boolean)
            .slice(0, Math.max(1, Number(max) || 3));
        return values.join(safeLang === 'en' ? ', ' : '、');
    }

    function getLocalizedPreferenceLabel(item, lang = getRecommendationLang()) {
        const safeLang = String(lang || '').trim() === 'en' ? 'en' : 'zh';
        const categoryName = String(item?.name ?? item?.key ?? '').trim();
        const categoryKeyMap = {
            all: 'books-filter-all',
            fiction: 'books-filter-fiction',
            nonfiction: 'books-filter-nonfiction',
            academic: 'books-filter-academic',
            children: 'books-filter-children'
        };
        if (categoryKeyMap[categoryName]) {
            const dict = (typeof translations !== 'undefined' && translations?.[safeLang])
                ? translations[safeLang]
                : (window.translations && window.translations[safeLang] ? window.translations[safeLang] : null);
            const translatedCategory = String((dict && dict[categoryKeyMap[categoryName]]) || getCategoryName(categoryName) || '').trim();
            if (translatedCategory) return translatedCategory;
        }
        const localized = safeLang === 'en'
            ? (item?.labelEn ?? item?.label_en ?? item?.name ?? item?.label ?? item?.key)
            : (item?.labelZh ?? item?.label_zh ?? item?.name ?? item?.label ?? item?.key);
        return String(
            localized
            ?? item?.label
            ?? item?.labelEn
            ?? item?.labelZh
            ?? item?.name
            ?? item?.key
            ?? ''
        ).trim();
    }

    function getRecommendationBookContent(book, lang = getRecommendationLang()) {
        const safeLang = String(lang || '').trim() === 'en' ? 'en' : 'zh';
        const titleZh = String(book?.title || '').trim();
        const titleEn = String(book?.titleEn ?? book?.title_en ?? '').trim();
        const authorZh = String(book?.author || '').trim();
        const authorEn = String(book?.authorEn ?? book?.author_en ?? '').trim();
        const descriptionZh = String(book?.description || '').trim();
        const descriptionEn = String(book?.descriptionEn ?? book?.description_en ?? '').trim();
        const tagsZh = normalizeTextList(book?.tags).map(tag => String(tag || '').trim()).filter(Boolean);
        const tagsEn = normalizeTextList(book?.tagsEn ?? book?.tags_en).map(tag => String(tag || '').trim()).filter(Boolean);
        return {
            title: safeLang === 'en' ? (titleEn || titleZh || t('book-title-untitled', '未命名图书')) : (titleZh || titleEn || t('book-title-untitled', '未命名图书')),
            author: safeLang === 'en' ? (authorEn || authorZh || t('book-author-unknown', '未知作者')) : (authorZh || authorEn || t('book-author-unknown', '未知作者')),
            description: safeLang === 'en' ? (descriptionEn || descriptionZh || t('book-description-empty', '暂无简介')) : (descriptionZh || descriptionEn || t('book-description-empty', '暂无简介')),
            tags: safeLang === 'en' ? (tagsEn.length ? tagsEn : tagsZh) : (tagsZh.length ? tagsZh : tagsEn),
            titleZh: titleZh || titleEn || t('book-title-untitled', '未命名图书'),
            titleEn: titleEn || titleZh || t('book-title-untitled', '未命名图书'),
            authorZh: authorZh || authorEn || t('book-author-unknown', '未知作者'),
            authorEn: authorEn || authorZh || t('book-author-unknown', '未知作者'),
            descriptionZh: descriptionZh || descriptionEn || t('book-description-empty', '暂无简介'),
            descriptionEn: descriptionEn || descriptionZh || t('book-description-empty', '暂无简介'),
            tagsZh: tagsZh.length ? tagsZh : tagsEn,
            tagsEn: tagsEn.length ? tagsEn : tagsZh
        };
    }

    function formatPricePreference(preference, lang = getRecommendationLang()) {
        const average = Number(preference?.average || 0);
        const min = Number(preference?.min || 0);
        const max = Number(preference?.max || 0);
        if (!(average > 0 || min > 0 || max > 0)) return '';
        const bucket = String(preference?.bucket || 'medium').trim();
        if (bucket === 'low') return getRecommendationText('price_low', {}, lang);
        if (bucket === 'high') return getRecommendationText('price_high', {}, lang);
        return getRecommendationText('price_medium', {}, lang);
    }

    function buildRecentInterestSummaryParts(profile, lang = getRecommendationLang()) {
        return {
            categories: (Array.isArray(profile?.preferredCategories) ? profile.preferredCategories : []).map(item => ({
                name: String(item?.name || '').trim(),
                label: String(item?.label || '').trim(),
                labelZh: String(item?.labelZh ?? item?.label_zh ?? '').trim(),
                labelEn: String(item?.labelEn ?? item?.label_en ?? '').trim(),
                score: Number(item?.score || 0)
            })).filter(item => item.name),
            authors: (Array.isArray(profile?.preferredAuthors) ? profile.preferredAuthors : []).map(item => ({
                name: String(item?.name || '').trim(),
                label: String(item?.label || '').trim(),
                labelZh: String(item?.labelZh ?? item?.label_zh ?? '').trim(),
                labelEn: String(item?.labelEn ?? item?.label_en ?? '').trim(),
                score: Number(item?.score || 0)
            })).filter(item => item.name),
            tags: (Array.isArray(profile?.preferredTags) ? profile.preferredTags : []).map(item => ({
                name: String(item?.name || '').trim(),
                label: String(item?.label || '').trim(),
                labelZh: String(item?.labelZh ?? item?.label_zh ?? '').trim(),
                labelEn: String(item?.labelEn ?? item?.label_en ?? '').trim(),
                score: Number(item?.score || 0)
            })).filter(item => item.name),
            pricePreference: profile?.pricePreference ? {
                bucket: String(profile.pricePreference.bucket || 'medium').trim() || 'medium',
                average: Number(profile.pricePreference.average || 0),
                min: Number(profile.pricePreference.min || 0),
                max: Number(profile.pricePreference.max || 0),
                preferredRange: Array.isArray(profile.pricePreference.preferredRange) ? profile.pricePreference.preferredRange.slice(0, 2).map(value => Number(value) || 0) : [0, 0]
            } : null,
            cartCount: normalizeBookIdList(profile?.cartBookIds || []).length
        };
    }

    function formatRecentInterestSummary(parts, lang = getRecommendationLang()) {
        const categoryLabels = joinLocalizedList((parts?.categories || []).map(item => getLocalizedPreferenceLabel(item, lang)), 2, lang);
        const authorLabels = joinLocalizedList((parts?.authors || []).map(item => getLocalizedPreferenceLabel(item, lang)), 1, lang);
        const tagLabels = joinLocalizedList((parts?.tags || []).map(item => getLocalizedPreferenceLabel(item, lang)), 2, lang);
        const priceLabel = formatPricePreference(parts?.pricePreference, lang);
        const cartCount = Math.max(0, Number(parts?.cartCount || 0));
        const segments = [];

        if (categoryLabels) {
            segments.push(getRecommendationText('recent_categories', { items: categoryLabels }, lang));
        }
        if (authorLabels) {
            segments.push(getRecommendationText('recent_authors', { items: authorLabels }, lang));
        }
        if (tagLabels) {
            segments.push(getRecommendationText('recent_tags', { items: tagLabels }, lang));
        }
        if (priceLabel) {
            segments.push(priceLabel);
        }
        if (cartCount > 0) {
            segments.push(getRecommendationText('recent_cart', { count: cartCount }, lang));
        }
        if (!segments.length) {
            return getRecommendationText('summary_low_signal', {}, lang);
        }
        return `${segments.join(String(lang || '').trim() === 'en' ? ', ' : '，')}${String(lang || '').trim() === 'en' ? '.' : '。'}`;
    }

    function getBookDisplayTitle(book) {
        const zh = String(book?.title || '').trim();
        const en = String(book?.titleEn ?? book?.title_en ?? '').trim();
        return isEnglishContentMode() ? (en || zh || t('book-title-untitled', '未命名图书')) : (zh || en || t('book-title-untitled', '未命名图书'));
    }

    function getBookDisplayAuthor(book) {
        const zh = String(book?.author || '').trim();
        const en = String(book?.authorEn ?? book?.author_en ?? '').trim();
        return isEnglishContentMode() ? (en || zh || t('book-author-unknown', '未知作者')) : (zh || en || t('book-author-unknown', '未知作者'));
    }

    function getBookDisplayDescription(book) {
        const zh = String(book?.description || '').trim();
        const en = String(book?.descriptionEn ?? book?.description_en ?? '').trim();
        return isEnglishContentMode() ? (en || zh || t('book-description-empty', '暂无简介')) : (zh || en || t('book-description-empty', '暂无简介'));
    }

    function getBookDisplayTags(book) {
        const zh = normalizeTextList(book?.tags);
        const en = normalizeTextList(book?.tagsEn ?? book?.tags_en);
        return isEnglishContentMode() ? (en.length ? en : zh) : (zh.length ? zh : en);
    }

    function getOrderItemDisplayTitle(item) {
        const sourceBook = Number.isFinite(Number(item?.bookId))
            ? findBookById(item.bookId, { includeDisabled: true })
            : null;
        if (sourceBook) return getBookDisplayTitle(sourceBook);

        const zh = String(item?.title || '').trim();
        const en = String(item?.titleEn ?? item?.title_en ?? '').trim();
        return isEnglishContentMode()
            ? (en || zh || t('book-title-default', '图书'))
            : (zh || en || t('book-title-default', '图书'));
    }

    function normalizeOrderItem(rawItem) {
        const parsedBookId = Number(rawItem?.bookId ?? rawItem?.book_id ?? rawItem?.id);
        const bookId = Number.isFinite(parsedBookId) ? parsedBookId : null;
        const quantity = Number(rawItem?.quantity ?? 0) || 0;
        const price = Number(rawItem?.price ?? 0) || 0;
        const subtotal = Number(rawItem?.subtotal ?? (price * quantity));
        const fallbackBook = bookId !== null ? findBookById(bookId, { includeDisabled: true }) : null;
        return {
            bookId,
            title: String(rawItem?.title || fallbackBook?.title || '图书'),
            titleEn: String(rawItem?.titleEn ?? rawItem?.title_en ?? fallbackBook?.titleEn ?? fallbackBook?.title_en ?? ''),
            quantity,
            price,
            subtotal: Number.isFinite(subtotal) ? subtotal : 0
        };
    }

    function clampRating(value) {
        const numeric = Number(value);
        if (!Number.isFinite(numeric)) return 0;
        return Math.min(5, Math.max(1, Math.round(numeric)));
    }

    function getReviewOrderBookKey(orderId, bookId, userId = '') {
        return `${String(userId || '').trim()}::${String(orderId || '').trim()}::${String(bookId || '').trim()}`;
    }

    function getBookAggregateRating(bookId) {
        const stats = bookRatingStatsMap.get(String(bookId));
        if (!stats || !Number.isFinite(Number(stats.avg)) || Number(stats.count) <= 0) return null;
        return Number(stats.avg);
    }

    function formatRatingValue(value, fallback = t('book-rating-none', '暂无评分')) {
        const numeric = Number(value);
        return Number.isFinite(numeric) && numeric > 0 ? numeric.toFixed(1) : fallback;
    }

    function hasBookRating(book) {
        const aggregate = getBookAggregateRating(book?.id);
        const rating = Number.isFinite(aggregate) && aggregate > 0 ? aggregate : Number(book?.rating);
        return Number.isFinite(rating) && rating > 0;
    }

    function formatBookRating(book, fallback = t('book-rating-none', '暂无评分')) {
        const aggregate = getBookAggregateRating(book?.id);
        if (Number.isFinite(aggregate) && aggregate > 0) return Number(aggregate).toFixed(1);
        return hasBookRating(book) ? Number(book.rating).toFixed(1) : fallback;
    }

    function clearReviewCaches() {
        reviewedOrderBookKeys.clear();
        bookRatingStatsMap.clear();
    }

    function clearReviewHelpfulnessCaches() {
        reviewHelpfulnessStatsMap.clear();
        currentUserReviewVoteMap.clear();
    }

    function rebuildReviewCaches() {
        clearReviewCaches();
        const statBuckets = new Map();

        (Array.isArray(bookReviews) ? bookReviews : []).forEach(review => {
            const orderId = String(review?.orderId ?? '').trim();
            const bookId = Number(review?.bookId);
            const rating = Number(review?.rating);
            const moderationStatus = normalizeModerationStatus(review?.moderationStatus);

            const reviewUserId = String(review?.userId || '').trim();
            if (orderId && Number.isFinite(bookId) && moderationStatus !== 'rejected') {
                reviewedOrderBookKeys.add(getReviewOrderBookKey(orderId, bookId, reviewUserId));
            }

            if (moderationStatus !== 'approved') return;
            if (!Number.isFinite(bookId) || !Number.isFinite(rating) || rating <= 0) return;

            const key = String(bookId);
            const bucket = statBuckets.get(key) || { total: 0, count: 0 };
            bucket.total += rating;
            bucket.count += 1;
            statBuckets.set(key, bucket);
        });

        statBuckets.forEach((bucket, key) => {
            if (!bucket.count) return;
            bookRatingStatsMap.set(key, {
                avg: Number((bucket.total / bucket.count).toFixed(2)),
                count: bucket.count
            });
        });
    }

    function normalizeBookReview(raw, index = 0) {
        const parsedRating = clampRating(raw?.rating ?? raw?.score);
        const parsedBookId = Number(raw?.book_id ?? raw?.bookId);
        return {
            id: raw?.id ?? `review-${index}`,
            orderId: raw?.order_id ?? raw?.orderId ?? '',
            userId: raw?.user_id ?? raw?.userId ?? null,
            bookId: Number.isFinite(parsedBookId) ? parsedBookId : null,
            rating: parsedRating,
            comment: String(raw?.comment ?? raw?.content ?? '').trim(),
            media: normalizeReviewMediaList(raw?.review_media ?? raw?.reviewMedia ?? raw?.media ?? raw?.media_assets),
            moderationStatus: normalizeModerationStatus(raw?.moderation_status ?? raw?.moderationStatus),
            moderationReason: String(raw?.moderation_reason ?? raw?.moderationReason ?? '').trim(),
            moderationLabels: normalizeTextList(raw?.moderation_labels ?? raw?.moderationLabels),
            reviewerName: String(raw?.reviewer_name ?? raw?.reviewerName ?? raw?.customer_name ?? '').trim(),
            createdAt: raw?.created_at ?? raw?.createdAt ?? raw?.updated_at ?? raw?.updatedAt ?? ''
        };
    }

    function createClientSideId(prefix = 'id') {
        if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
            return `${prefix}-${crypto.randomUUID()}`;
        }
        return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    }

    function inferReviewMediaKind(value, mimeType = '') {
        const text = String(value || '').trim().toLowerCase();
        const mime = String(mimeType || '').trim().toLowerCase();
        if (['image', 'video'].includes(text)) return text;
        if (mime.startsWith('image/')) return 'image';
        if (mime.startsWith('video/')) return 'video';
        if (/^data:image\//i.test(text)) return 'image';
        if (/^data:video\//i.test(text)) return 'video';
        if (/\.(png|jpg|jpeg|gif|webp|bmp|svg)(\?|#|$)/i.test(text)) return 'image';
        if (/\.(mp4|webm|ogg|mov|m4v)(\?|#|$)/i.test(text)) return 'video';
        return '';
    }

    function sanitizeReviewMediaUrl(value) {
        const raw = String(value || '').trim();
        if (!raw) return '';
        if (/^javascript:/i.test(raw)) return '';
        if (/^https?:\/\//i.test(raw) || /^data:image\//i.test(raw) || /^data:video\//i.test(raw) || /^blob:/i.test(raw) || raw.startsWith('/')) {
            return raw;
        }
        if (!/^[a-z][a-z0-9+.-]*:/i.test(raw)) return raw;
        return '';
    }

    function normalizeReviewMediaItem(raw, index = 0) {
        if (!raw) return null;

        if (typeof raw === 'string') {
            const src = sanitizeReviewMediaUrl(raw);
            const kind = inferReviewMediaKind(src);
            if (!src || !kind) return null;
            return {
                id: createClientSideId(`review-media-${index}`),
                kind,
                mimeType: kind === 'image' ? 'image/*' : 'video/*',
                name: `${kind}-${index + 1}`,
                size: 0,
                src
            };
        }

        const src = sanitizeReviewMediaUrl(raw?.src ?? raw?.url ?? raw?.dataUrl ?? raw?.data_url ?? '');
        const mimeType = String(raw?.mimeType ?? raw?.mime_type ?? '').trim();
        const kind = inferReviewMediaKind(raw?.kind ?? raw?.type, mimeType) || inferReviewMediaKind(src, mimeType);
        if (!src || !kind) return null;

        return {
            id: String(raw?.id || createClientSideId(`review-media-${index}`)),
            kind,
            mimeType: mimeType || (kind === 'image' ? 'image/*' : 'video/*'),
            name: String(raw?.name || `${kind}-${index + 1}`),
            size: Number(raw?.size || 0) || 0,
            src
        };
    }

    function normalizeReviewMediaList(value) {
        let source = value;
        if (typeof source === 'string') {
            const trimmed = source.trim();
            if (!trimmed) return [];
            try {
                source = JSON.parse(trimmed);
            } catch {
                source = [trimmed];
            }
        }

        if (!Array.isArray(source)) return [];

        const seen = new Set();
        return source
            .map((item, index) => normalizeReviewMediaItem(item, index))
            .filter(item => {
                if (!item?.src || seen.has(item.src)) return false;
                seen.add(item.src);
                return true;
            });
    }

    function getReviewMediaDraftKey(orderId, bookId) {
        return `${String(orderId || '').trim()}::${String(bookId || '').trim()}`;
    }

    function setOrderReviewMediaDraft(orderId, bookId, mediaList) {
        const key = getReviewMediaDraftKey(orderId, bookId);
        orderReviewMediaDraftMap.set(key, normalizeReviewMediaList(mediaList));
    }

    function getOrderReviewMediaDraft(orderId, bookId) {
        const key = getReviewMediaDraftKey(orderId, bookId);
        return normalizeReviewMediaList(orderReviewMediaDraftMap.get(key) || []);
    }

    function formatFileSize(bytes) {
        const size = Number(bytes || 0);
        if (!Number.isFinite(size) || size <= 0) return '0 B';
        if (size < 1024) return `${size} B`;
        if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
        return `${(size / (1024 * 1024)).toFixed(1)} MB`;
    }

    function getReviewMediaTotalBytes(mediaList) {
        return normalizeReviewMediaList(mediaList).reduce((total, item) => total + (Number(item?.size || 0) || 0), 0);
    }

    function readFileAsDataUrl(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(String(reader.result || ''));
            reader.onerror = () => reject(reader.error || new Error('读取文件失败'));
            reader.readAsDataURL(file);
        });
    }

    async function convertFilesToReviewMedia(fileList, existingMedia = []) {
        const files = Array.from(fileList || []);
        const existing = normalizeReviewMediaList(existingMedia);
        const nextItems = [];
        const messages = [];
        let totalBytes = getReviewMediaTotalBytes(existing);
        const availableSlots = Math.max(0, REVIEW_MEDIA_MAX_FILES - existing.length);

        if (!files.length) {
            return { media: [], message: '' };
        }

        if (!availableSlots) {
            return { media: [], message: `每条评价最多上传 ${REVIEW_MEDIA_MAX_FILES} 个图片/视频附件` };
        }

        for (const file of files.slice(0, availableSlots)) {
            const mimeType = String(file?.type || '').trim().toLowerCase();
            const kind = inferReviewMediaKind('', mimeType);

            if (!kind) {
                messages.push(`“${file.name}” 不是支持的图片或视频格式`);
                continue;
            }

            const size = Number(file?.size || 0) || 0;
            if (kind === 'image' && size > REVIEW_MEDIA_MAX_IMAGE_BYTES) {
                messages.push(`图片“${file.name}”超过 ${formatFileSize(REVIEW_MEDIA_MAX_IMAGE_BYTES)}`);
                continue;
            }
            if (kind === 'video' && size > REVIEW_MEDIA_MAX_VIDEO_BYTES) {
                messages.push(`视频“${file.name}”超过 ${formatFileSize(REVIEW_MEDIA_MAX_VIDEO_BYTES)}`);
                continue;
            }
            if ((totalBytes + size) > REVIEW_MEDIA_TOTAL_BYTES_LIMIT) {
                messages.push(`附件总大小不能超过 ${formatFileSize(REVIEW_MEDIA_TOTAL_BYTES_LIMIT)}`);
                continue;
            }

            try {
                const dataUrl = await readFileAsDataUrl(file);
                const src = sanitizeReviewMediaUrl(dataUrl);
                if (!src) {
                    messages.push(`“${file.name}” 读取后格式无效`);
                    continue;
                }

                nextItems.push({
                    id: createClientSideId('review-media'),
                    kind,
                    mimeType,
                    name: String(file.name || `${kind}-${nextItems.length + 1}`),
                    size,
                    src
                });
                totalBytes += size;
            } catch {
                messages.push(`“${file.name}” 读取失败，请重试`);
            }
        }

        if (files.length > availableSlots) {
            messages.push(`超出数量限制，最多只能再添加 ${availableSlots} 个附件`);
        }

        return {
            media: nextItems,
            message: messages.slice(0, 3).join('；')
        };
    }

    function renderReviewMediaItemsHtml(mediaList, options = {}) {
        const items = normalizeReviewMediaList(mediaList);
        const removable = Boolean(options.removable);
        const emptyText = options.emptyText || '暂未添加图片或视频';

        if (!items.length) {
            return `<div class="review-media-empty">${escapeHtml(emptyText)}</div>`;
        }

        return items.map(item => {
            const src = sanitizeReviewMediaUrl(item?.src);
            if (!src) return '';
            const safeSrc = escapeHtml(src);
            const safeName = escapeHtml(item?.name || (item?.kind === 'video' ? '视频附件' : '图片附件'));
            const metaText = item?.size ? `${safeName} · ${escapeHtml(formatFileSize(item.size))}` : safeName;
            return `
                <div class="review-media-item" data-media-id="${escapeHtml(String(item?.id || ''))}">
                    <div class="review-media-preview ${item.kind === 'video' ? 'video' : 'image'}">
                        ${item.kind === 'video'
                            ? `<video controls preload="metadata" src="${safeSrc}"></video>`
                            : `<img src="${safeSrc}" alt="${safeName}">`}
                    </div>
                    <div class="review-media-meta">${metaText}</div>
                    ${removable ? `<button type="button" class="review-media-remove" data-media-id="${escapeHtml(String(item?.id || ''))}"><i class="fas fa-times"></i> 移除</button>` : ''}
                </div>
            `;
        }).join('');
    }

    function renderReviewMediaGalleryItemsHtml(mediaList, reviewId) {
        const items = normalizeReviewMediaList(mediaList);
        if (!items.length) return '';

        return items.map((item, index) => {
            const src = sanitizeReviewMediaUrl(item?.src);
            if (!src) return '';
            const safeSrc = escapeHtml(src);
            const safeName = escapeHtml(item?.name || (item?.kind === 'video' ? '视频附件' : '图片附件'));
            return `
                <button type="button" class="review-media-item review-media-trigger" data-review-id="${escapeHtml(String(reviewId || ''))}" data-media-index="${index}" aria-label="查看${safeName}">
                    <div class="review-media-preview ${item.kind === 'video' ? 'video' : 'image'}">
                        ${item.kind === 'video'
                            ? `<video preload="metadata" muted playsinline src="${safeSrc}"></video><span class="review-media-play-badge"><i class="fas fa-play"></i></span>`
                            : `<img src="${safeSrc}" alt="${safeName}">`}
                    </div>
                    <div class="review-media-meta">${safeName}</div>
                </button>
            `;
        }).join('');
    }

    function renderOrderReviewMediaDraft(card) {
        if (!card) return;
        const orderId = String(card.dataset.orderId || '').trim();
        const bookId = Number(card.dataset.bookId);
        if (!orderId || !Number.isFinite(bookId)) return;

        const mediaList = getOrderReviewMediaDraft(orderId, bookId);
        const grid = card.querySelector('.order-review-media-grid');
        const status = card.querySelector('.order-review-media-status');
        const clearButton = card.querySelector('.btn-clear-review-media');
        if (grid) {
            grid.innerHTML = renderReviewMediaItemsHtml(mediaList, { removable: !card.classList.contains('disabled'), emptyText: '尚未添加评价图片或视频' });
        }
        if (status) {
            const totalBytes = getReviewMediaTotalBytes(mediaList);
            status.textContent = mediaList.length
                ? `已添加 ${mediaList.length}/${REVIEW_MEDIA_MAX_FILES} 个附件 · ${formatFileSize(totalBytes)}`
                : `支持图片/视频上传，最多 ${REVIEW_MEDIA_MAX_FILES} 个附件`;
        }
        if (clearButton) {
            clearButton.disabled = !mediaList.length || card.classList.contains('disabled');
        }

        grid?.querySelectorAll('.review-media-remove').forEach(button => {
            button.addEventListener('click', function() {
                const mediaId = String(this.dataset.mediaId || '').trim();
                const nextMedia = mediaList.filter(item => String(item?.id || '').trim() !== mediaId);
                setOrderReviewMediaDraft(orderId, bookId, nextMedia);
                renderOrderReviewMediaDraft(card);
            });
        });
    }

    async function appendFilesToOrderReviewDraft(card, fileList) {
        if (!card || card.classList.contains('disabled')) return;
        const orderId = String(card.dataset.orderId || '').trim();
        const bookId = Number(card.dataset.bookId);
        if (!orderId || !Number.isFinite(bookId)) return;

        const currentMedia = getOrderReviewMediaDraft(orderId, bookId);
        const { media, message } = await convertFilesToReviewMedia(fileList, currentMedia);

        if (media.length) {
            setOrderReviewMediaDraft(orderId, bookId, [...currentMedia, ...media]);
            renderOrderReviewMediaDraft(card);
        }

        if (message) {
            showNotification(message, media.length ? 'info' : 'info');
        }
    }

    function normalizeReviewHelpfulnessVote(raw, index = 0) {
        const reviewId = String(raw?.review_id ?? raw?.reviewId ?? raw?.book_review_id ?? '').trim();
        const userId = String(raw?.user_id ?? raw?.userId ?? '').trim();
        return {
            id: raw?.id ?? `review-vote-${index}`,
            reviewId,
            userId,
            isHelpful: toNullableBoolean(raw?.is_helpful ?? raw?.isHelpful ?? raw?.vote ?? raw?.helpful),
            createdAt: raw?.created_at ?? raw?.createdAt ?? '',
            updatedAt: raw?.updated_at ?? raw?.updatedAt ?? raw?.created_at ?? raw?.createdAt ?? ''
        };
    }

    function normalizeReviewReport(raw, index = 0) {
        const reasons = Array.isArray(raw?.reasons)
            ? raw.reasons
            : normalizeTextList(raw?.reasons);
        return {
            id: raw?.id ?? `review-report-${index}`,
            reviewId: String(raw?.review_id ?? raw?.reviewId ?? '').trim(),
            reporterUserId: String(raw?.reporter_user_id ?? raw?.reporterUserId ?? '').trim(),
            reasons,
            reasonOther: String(raw?.reason_other ?? raw?.reasonOther ?? '').trim(),
            status: String(raw?.status || 'pending').trim().toLowerCase(),
            resultMessage: String(raw?.result_message ?? raw?.resultMessage ?? '').trim(),
            createdAt: raw?.created_at ?? raw?.createdAt ?? ''
        };
    }

    function normalizeSystemMessage(raw, index = 0) {
        return {
            id: raw?.id ?? `system-message-${index}`,
            userId: raw?.user_id ?? raw?.userId ?? null,
            type: String(raw?.type || 'general').trim().toLowerCase(),
            title: String(raw?.title || '系统通知').trim() || '系统通知',
            content: String(raw?.content || '').trim(),
            isRead: toBooleanFlag(raw?.is_read ?? raw?.isRead),
            metadata: raw?.metadata && typeof raw.metadata === 'object' ? raw.metadata : {},
            createdAt: raw?.created_at ?? raw?.createdAt ?? ''
        };
    }

    function rebuildCurrentUserReportedReviewMap() {
        currentUserReportedReviewMap.clear();
        const userKey = String(currentUserId || '').trim();
        if (!userKey) return;

        reviewReports.forEach(report => {
            if (String(report?.reporterUserId || '').trim() !== userKey) return;
            const reviewId = String(report?.reviewId || '').trim();
            if (!reviewId) return;
            currentUserReportedReviewMap.set(reviewId, report);
        });
    }

    async function loadCurrentUserReviewReportsFromSupabase() {
        reviewReports = [];
        currentUserReportedReviewMap.clear();
        if (!supabaseClient) return;
        if (!String(currentUserId || '').trim()) return;

        try {
            const { data, error } = await supabaseClient
                .from('review_reports')
                .select('*')
                .eq('reporter_user_id', currentUserId)
                .order('created_at', { ascending: false });

            if (error) {
                console.warn('Load review reports failed:', error);
                return;
            }

            reviewReports = Array.isArray(data)
                ? data.map((row, index) => normalizeReviewReport(row, index))
                : [];
            rebuildCurrentUserReportedReviewMap();
        } catch (e) {
            console.warn('Unexpected load review reports error:', e);
        }
    }

    async function loadSystemMessagesFromSupabase() {
        systemMessages = [];
        if (!supabaseClient) {
            updateSystemMessagesUnreadBadge();
            return;
        }

        try {
            const { data, error } = await supabaseClient
                .from('system_messages')
                .select('*')
                .order('created_at', { ascending: false })
                .limit(100);

            if (error) {
                console.warn('Load system messages failed:', error);
                updateSystemMessagesUnreadBadge();
                return;
            }

            const userKey = String(currentUserId || '').trim();
            const locallyReadIds = loadSystemMessageReadIds();
            systemMessages = (Array.isArray(data) ? data : [])
                .map((row, index) => normalizeSystemMessage(row, index))
                .filter(message => {
                    const targetUserId = String(message?.userId || '').trim();
                    if (!targetUserId) return true;
                    return userKey && targetUserId === userKey;
                })
                .map(message => {
                    const messageId = String(message?.id || '').trim();
                    if (message.isRead && messageId) {
                        locallyReadIds.add(messageId);
                    }
                    return {
                        ...message,
                        isRead: Boolean(message.isRead || (messageId && locallyReadIds.has(messageId)))
                    };
                });
            persistSystemMessageReadIds(locallyReadIds);
            updateSystemMessagesUnreadBadge();
        } catch (e) {
            console.warn('Unexpected load system messages error:', e);
            updateSystemMessagesUnreadBadge();
        }
    }

    function getSystemMessagesUnreadCount() {
        return (Array.isArray(systemMessages) ? systemMessages : [])
            .filter(message => !toBooleanFlag(message?.isRead))
            .length;
    }

    function updateSystemMessagesUnreadBadge() {
        if (!systemMessagesUnreadBadge) return;
        const unreadCount = isGuestUser() ? 0 : getSystemMessagesUnreadCount();
        systemMessagesUnreadBadge.textContent = String(unreadCount);
        systemMessagesUnreadBadge.hidden = unreadCount <= 0;
    }

    function getSystemMessageReadStorageKey() {
        const userType = sessionStorage.getItem('userType') || 'anon';
        const loginUsername = String(sessionStorage.getItem('loginUsername') || sessionStorage.getItem('username') || '').trim().toLowerCase();
        const identity = String(currentUserId || '').trim() || loginUsername || 'visitor';
        return `${SYSTEM_MESSAGE_READ_STORAGE_PREFIX}_${userType}_${identity}`;
    }

    function loadSystemMessageReadIds() {
        try {
            const parsed = JSON.parse(localStorage.getItem(getSystemMessageReadStorageKey()) || '[]');
            if (!Array.isArray(parsed)) return new Set();
            return new Set(parsed.map(item => String(item || '').trim()).filter(Boolean));
        } catch {
            return new Set();
        }
    }

    function persistSystemMessageReadIds(readIds) {
        try {
            const normalized = Array.from(readIds instanceof Set ? readIds : new Set(readIds || []))
                .map(item => String(item || '').trim())
                .filter(Boolean)
                .slice(-500);
            localStorage.setItem(getSystemMessageReadStorageKey(), JSON.stringify(normalized));
        } catch (e) {
            console.warn('Persist system message read ids failed:', e);
        }
    }

    function rememberSystemMessageRead(messageId) {
        const targetId = String(messageId || '').trim();
        if (!targetId) return;
        const readIds = loadSystemMessageReadIds();
        readIds.add(targetId);
        persistSystemMessageReadIds(readIds);
    }

    async function markSystemMessageRead(messageId) {
        const targetId = String(messageId || '').trim();
        if (!targetId) return { ok: false };

        rememberSystemMessageRead(targetId);

        const targetMessage = (Array.isArray(systemMessages) ? systemMessages : []).find(item => String(item?.id || '').trim() === targetId);
        const targetUserId = String(targetMessage?.userId || '').trim();
        const canSyncToCloud = Boolean(supabaseClient && targetUserId && String(currentUserId || '').trim() === targetUserId);

        if (!canSyncToCloud) {
            return { ok: true, synced: false };
        }

        try {
            const { error } = await supabaseClient
                .from('system_messages')
                .update({ is_read: true })
                .eq('id', targetId);
            if (error) {
                console.warn('Mark system message as read failed:', error);
                return { ok: true, synced: false };
            }
            return { ok: true, synced: true };
        } catch (e) {
            console.warn('Mark system message as read failed:', e);
            return { ok: true, synced: false };
        }
    }

    function rebuildReviewHelpfulnessCaches() {
        clearReviewHelpfulnessCaches();
        const currentUserKey = String(currentUserId || '').trim();

        (Array.isArray(reviewHelpfulnessVotes) ? reviewHelpfulnessVotes : []).forEach(vote => {
            const reviewId = String(vote?.reviewId || '').trim();
            const userId = String(vote?.userId || '').trim();
            const isHelpful = toNullableBoolean(vote?.isHelpful);
            if (!reviewId || !userId || isHelpful === null) return;

            const bucket = reviewHelpfulnessStatsMap.get(reviewId) || { helpfulCount: 0, notHelpfulCount: 0 };
            if (isHelpful) {
                bucket.helpfulCount += 1;
            } else {
                bucket.notHelpfulCount += 1;
            }
            reviewHelpfulnessStatsMap.set(reviewId, bucket);

            if (currentUserKey && userId === currentUserKey) {
                currentUserReviewVoteMap.set(reviewId, isHelpful);
            }
        });
    }

    function getReviewHelpfulnessStats(reviewId) {
        const key = String(reviewId || '').trim();
        const stats = reviewHelpfulnessStatsMap.get(key) || { helpfulCount: 0, notHelpfulCount: 0 };
        return {
            helpfulCount: Number(stats.helpfulCount || 0),
            notHelpfulCount: Number(stats.notHelpfulCount || 0),
            currentUserVote: currentUserReviewVoteMap.has(key) ? currentUserReviewVoteMap.get(key) : null
        };
    }

    function isOwnReview(review) {
        const reviewUserId = String(review?.userId || '').trim();
        const userKey = String(currentUserId || '').trim();
        if (reviewUserId && userKey && reviewUserId === userKey) return true;

        const reviewerName = String(review?.reviewerName || '').trim().toLowerCase();
        if (!reviewerName) return false;

        const aliases = new Set();
        const loginUsername = String(sessionStorage.getItem('loginUsername') || '').trim().toLowerCase();
        const username = String(sessionStorage.getItem('username') || '').trim().toLowerCase();

        if (loginUsername) aliases.add(loginUsername);
        if (username) aliases.add(username);
        if (loginUsername.includes('@')) aliases.add(loginUsername.split('@')[0]);
        if (username.includes('@')) aliases.add(username.split('@')[0]);

        return aliases.has(reviewerName);
    }

    function canVoteReviewHelpfulness(review) {
        if (!review?.id) return false;
        if (isGuestUser()) return false;
        return !isOwnReview(review);
    }

    async function loadBookReviewsFromSupabase() {
        bookReviews = [];
        clearReviewCaches();
        if (!supabaseClient) return;

        try {
            const { data, error } = await supabaseClient.from('book_reviews').select('*');
            if (error) {
                console.warn('Load book reviews failed:', error);
                return;
            }

            bookReviews = Array.isArray(data)
                ? data.map((row, index) => normalizeBookReview(row, index)).filter(row => Number.isFinite(Number(row.bookId)) && row.rating > 0)
                : [];
            rebuildReviewCaches();
        } catch (e) {
            console.warn('Unexpected load book reviews error:', e);
        }
    }

    async function loadReviewHelpfulnessVotesFromSupabase() {
        reviewHelpfulnessVotes = [];
        clearReviewHelpfulnessCaches();
        if (!supabaseClient) return;

        try {
            const { data, error } = await supabaseClient.from('review_helpfulness_votes').select('*');
            if (error) {
                console.warn('Load review helpfulness votes failed:', error);
                return;
            }

            reviewHelpfulnessVotes = Array.isArray(data)
                ? data
                    .map((row, index) => normalizeReviewHelpfulnessVote(row, index))
                    .filter(row => row.reviewId && row.userId && row.isHelpful !== null)
                : [];
            rebuildReviewHelpfulnessCaches();
        } catch (e) {
            console.warn('Unexpected load review helpfulness votes error:', e);
        }
    }

    function isOrderBookReviewed(orderId, bookId) {
        if (!orderId || !Number.isFinite(Number(bookId))) return false;
        const keyByCurrentUser = getReviewOrderBookKey(orderId, Number(bookId), currentUserId);
        const keyByAnonymous = getReviewOrderBookKey(orderId, Number(bookId), '');
        return reviewedOrderBookKeys.has(keyByCurrentUser) || reviewedOrderBookKeys.has(keyByAnonymous);
    }

    function getOrderPendingReviewCount(order) {
        const status = normalizeOrderStatus(order?.status);
        if (status !== 'received') return 0;
        const items = Array.isArray(order?.items) ? order.items : [];
        const targetBookIds = Array.from(new Set(items
            .map(item => Number(item?.bookId))
            .filter(bookId => Number.isFinite(bookId))));
        if (!targetBookIds.length) return 0;
        return targetBookIds.filter(bookId => !isOrderBookReviewed(order.id, bookId)).length;
    }

    async function saveBookReviewToCloud(reviewPayload) {
        if (!supabaseClient) return { ok: false, message: '未连接到数据库' };

        const userId = String(reviewPayload?.userId || '').trim();
        if (!userId) return { ok: false, message: '请先使用已注册账号登录后再提交评价' };

        const rating = clampRating(reviewPayload?.rating);
        if (!rating) return { ok: false, message: '评分必须在 1-5 分之间' };

        const bookId = Number(reviewPayload?.bookId);
        if (!Number.isFinite(bookId)) return { ok: false, message: '图书信息缺失，无法提交评价' };

        const reviewerName = String(reviewPayload?.reviewerName || '').trim() || getCurrentDisplayUsername();
        const moderationDecision = evaluateReviewContentModeration(reviewPayload?.comment, reviewerName);

        const payload = {
            order_id: String(reviewPayload?.orderId || '').trim(),
            user_id: userId,
            book_id: bookId,
            rating,
            comment: String(reviewPayload?.comment || '').trim() || null,
            review_media: normalizeReviewMediaList(reviewPayload?.media),
            reviewer_name: reviewerName,
            moderation_status: moderationDecision.status,
            moderation_reason: moderationDecision.reason || null,
            moderation_labels: moderationDecision.labels,
            updated_at: new Date().toISOString()
        };

        if (!payload.order_id) return { ok: false, message: '订单信息缺失，无法提交评价' };

        const conflictCandidates = ['user_id,order_id,book_id', 'order_id,user_id,book_id'];
        for (const conflict of conflictCandidates) {
            const { error } = await supabaseClient
                .from('book_reviews')
                .upsert([{ ...payload, created_at: new Date().toISOString() }], { onConflict: conflict });

            if (!error) {
                return {
                    ok: true,
                    moderationStatus: moderationDecision.status,
                    moderationReason: moderationDecision.reason,
                    moderationLabels: moderationDecision.labels
                };
            }

            const msg = String(error?.message || error?.details || error?.hint || '');
            const isConflictMissing = msg.includes('constraint') || msg.includes('on conflict') || msg.includes('unique') || msg.includes('there is no unique');
            if (!isConflictMissing) {
                if (msg.toLowerCase().includes('row-level security') || msg.toLowerCase().includes('permission denied')) {
                    return { ok: false, message: 'book_reviews 表权限策略未放行，请检查 Supabase RLS' };
                }
                if (msg.includes('relation') || msg.includes('does not exist')) {
                    return { ok: false, message: 'book_reviews 表不存在，请先执行建表 SQL' };
                }
                return { ok: false, message: msg || '未知错误' };
            }
        }

        const { error: updateError } = await supabaseClient
            .from('book_reviews')
            .update(payload)
            .eq('user_id', payload.user_id)
            .eq('order_id', payload.order_id)
            .eq('book_id', payload.book_id);

        if (!updateError) {
            return {
                ok: true,
                moderationStatus: moderationDecision.status,
                moderationReason: moderationDecision.reason,
                moderationLabels: moderationDecision.labels
            };
        }

        const { error: insertError } = await supabaseClient
            .from('book_reviews')
            .insert([{ ...payload, created_at: new Date().toISOString() }]);

        if (!insertError) {
            return {
                ok: true,
                moderationStatus: moderationDecision.status,
                moderationReason: moderationDecision.reason,
                moderationLabels: moderationDecision.labels
            };
        }

        const finalMessage = String(insertError?.message || insertError?.details || insertError?.hint || '未知错误');
        if (finalMessage.toLowerCase().includes('row-level security') || finalMessage.toLowerCase().includes('permission denied')) {
            return { ok: false, message: 'book_reviews 表权限策略未放行，请检查 Supabase RLS' };
        }
        if (finalMessage.includes('relation') || finalMessage.includes('does not exist')) {
            return { ok: false, message: 'book_reviews 表不存在，请先执行建表 SQL' };
        }
        return { ok: false, message: finalMessage };
    }

    async function submitReviewReportToCloud(review, reasons, reasonOther = '') {
        if (!supabaseClient) return { ok: false, message: '未连接到数据库' };

        const userId = String(currentUserId || '').trim();
        if (!userId) return { ok: false, message: '请先登录后再举报评论' };

        const reviewId = String(review?.id || '').trim();
        if (!reviewId) return { ok: false, message: '评论信息异常，无法举报' };
        if (isOwnReview(review)) return { ok: false, message: '不能举报自己发布的评论' };

        const normalizedReasons = Array.from(new Set((Array.isArray(reasons) ? reasons : []).map(item => String(item || '').trim()).filter(Boolean)));
        if (!normalizedReasons.length) return { ok: false, message: '请至少选择一个举报原因' };
        const normalizedOther = String(reasonOther || '').trim();
        if (normalizedReasons.includes('other') && !normalizedOther) {
            return { ok: false, message: '选择“其他”时请填写具体原因' };
        }

        const payload = {
            review_id: reviewId,
            reporter_user_id: userId,
            reasons: normalizedReasons,
            reason_other: normalizedOther || null,
            status: 'pending',
            result_message: null,
            updated_at: new Date().toISOString()
        };

        const conflictCandidates = ['review_id,reporter_user_id', 'reporter_user_id,review_id'];
        for (const conflict of conflictCandidates) {
            const { error } = await supabaseClient
                .from('review_reports')
                .upsert([{ ...payload, created_at: new Date().toISOString() }], { onConflict: conflict });

            if (!error) return { ok: true };

            const msg = String(error?.message || error?.details || error?.hint || '');
            const isConflictMissing = msg.includes('constraint') || msg.includes('on conflict') || msg.includes('unique') || msg.includes('there is no unique');
            if (!isConflictMissing) {
                if (msg.toLowerCase().includes('row-level security') || msg.toLowerCase().includes('permission denied')) {
                    return { ok: false, message: 'review_reports 表权限策略未放行，请检查 Supabase RLS' };
                }
                if (msg.includes('relation') || msg.includes('does not exist')) {
                    return { ok: false, message: 'review_reports 表不存在，请先执行建表 SQL' };
                }
                return { ok: false, message: msg || '未知错误' };
            }
        }

        const { error: updateError } = await supabaseClient
            .from('review_reports')
            .update(payload)
            .eq('review_id', reviewId)
            .eq('reporter_user_id', userId);

        if (!updateError) return { ok: true };

        const { error: insertError } = await supabaseClient
            .from('review_reports')
            .insert([{ ...payload, created_at: new Date().toISOString() }]);

        if (!insertError) return { ok: true };

        const finalMessage = String(insertError?.message || insertError?.details || insertError?.hint || '未知错误');
        if (finalMessage.toLowerCase().includes('row-level security') || finalMessage.toLowerCase().includes('permission denied')) {
            return { ok: false, message: 'review_reports 表权限策略未放行，请检查 Supabase RLS' };
        }
        if (finalMessage.includes('relation') || finalMessage.includes('does not exist')) {
            return { ok: false, message: 'review_reports 表不存在，请先执行建表 SQL' };
        }
        return { ok: false, message: finalMessage };
    }

    async function saveReviewHelpfulnessVoteToCloud(reviewId, isHelpful) {
        if (!supabaseClient) return { ok: false, message: '未连接到数据库' };

        const normalizedReviewId = String(reviewId || '').trim();
        if (!normalizedReviewId) return { ok: false, message: '评价信息缺失，无法提交反馈' };

        const userId = String(currentUserId || '').trim();
        if (!userId) return { ok: false, message: '请先登录后再标记评价是否有帮助' };

        const review = (Array.isArray(bookReviews) ? bookReviews : []).find(item => String(item?.id || '').trim() === normalizedReviewId);
        if (!review) return { ok: false, message: '未找到对应评价，页面数据可能已过期' };
        if (isOwnReview(review)) return { ok: false, message: '不能为自己发布的评价投票' };

        const helpfulFlag = toNullableBoolean(isHelpful);
        if (helpfulFlag === null) return { ok: false, message: '反馈类型无效' };

        const payload = {
            review_id: normalizedReviewId,
            user_id: userId,
            is_helpful: helpfulFlag,
            updated_at: new Date().toISOString()
        };

        const conflictCandidates = ['review_id,user_id', 'user_id,review_id'];
        for (const conflict of conflictCandidates) {
            const { error } = await supabaseClient
                .from('review_helpfulness_votes')
                .upsert([{ ...payload, created_at: new Date().toISOString() }], { onConflict: conflict });

            if (!error) return { ok: true };

            const msg = String(error?.message || error?.details || error?.hint || '');
            const isConflictMissing = msg.includes('constraint') || msg.includes('on conflict') || msg.includes('unique') || msg.includes('there is no unique');
            if (!isConflictMissing) {
                if (msg.toLowerCase().includes('row-level security') || msg.toLowerCase().includes('permission denied')) {
                    return { ok: false, message: 'review_helpfulness_votes 表权限策略未放行，请检查 Supabase RLS' };
                }
                if (msg.includes('relation') || msg.includes('does not exist')) {
                    return { ok: false, message: 'review_helpfulness_votes 表不存在，请先执行建表 SQL' };
                }
                return { ok: false, message: msg || '未知错误' };
            }
        }

        const { error: updateError } = await supabaseClient
            .from('review_helpfulness_votes')
            .update(payload)
            .eq('review_id', payload.review_id)
            .eq('user_id', payload.user_id);

        if (!updateError) return { ok: true };

        const { error: insertError } = await supabaseClient
            .from('review_helpfulness_votes')
            .insert([{ ...payload, created_at: new Date().toISOString() }]);

        if (!insertError) return { ok: true };

        const finalMessage = String(insertError?.message || insertError?.details || insertError?.hint || '未知错误');
        if (finalMessage.toLowerCase().includes('row-level security') || finalMessage.toLowerCase().includes('permission denied')) {
            return { ok: false, message: 'review_helpfulness_votes 表权限策略未放行，请检查 Supabase RLS' };
        }
        if (finalMessage.includes('relation') || finalMessage.includes('does not exist')) {
            return { ok: false, message: 'review_helpfulness_votes 表不存在，请先执行建表 SQL' };
        }
        return { ok: false, message: finalMessage };
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
            items: Array.isArray(items) ? items.map(normalizeOrderItem) : [],
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
        if (remaining <= 0) return t('order-auto-receive-soon', '未确认收货，系统即将自动收货');
        const days = Math.ceil(remaining / (24 * 60 * 60 * 1000));
        return t('order-auto-receive-remaining', '未确认收货，还剩 {days} 天自动收货').replace('{days}', String(days));
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
        markRecommendationDirty('history_update');
    }

    async function getCurrentSupabaseUserId() {
        if (!supabaseClient || !supabaseClient.auth || !supabaseClient.auth.getUser) return null;
        try {
            const { data, error } = await supabaseClient.auth.getUser();
            if (error) {
                const message = String(error?.message || '').toLowerCase();
                const isMissingSession = String(error?.name || '').includes('AuthSessionMissingError') || message.includes('auth session missing');
                if (!isMissingSession) {
                    console.warn('Get Supabase user failed:', error);
                }
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

    async function getCurrentSupabaseAccessToken() {
        if (!supabaseClient || !supabaseClient.auth || !supabaseClient.auth.getSession) return '';
        try {
            const { data, error } = await supabaseClient.auth.getSession();
            if (error) {
                console.warn('Get Supabase session failed:', error);
                return '';
            }
            return String(data?.session?.access_token || '').trim();
        } catch (e) {
            console.warn('Unexpected getSession error:', e);
            return '';
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
        const label = active
            ? t('favorites-btn-active', '取消收藏')
            : t('favorites-btn-inactive', '收藏');
        button.setAttribute('title', label);
        button.setAttribute('aria-label', label);
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
        const targetTitle = String(getBookDisplayTitle(targetBook) || t('book-title-default', '图书')).slice(0, 18);
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
                markRecommendationDirty('favorite_update');
                showNotification((t('favorites-added-template', '已收藏《{title}》') || '已收藏《{title}》').replace('{title}', targetTitle), 'success');
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
                markRecommendationDirty('favorite_update');
                showNotification((t('favorites-removed-template', '已取消收藏《{title}》') || '已取消收藏《{title}》').replace('{title}', targetTitle), 'info');
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
                        tags_en: normalizedBook.tagsEn?.length ? normalizedBook.tagsEn : cachedBook?.tagsEn,
                        title_en: normalizedBook.titleEn || cachedBook?.titleEn,
                        author_en: normalizedBook.authorEn || cachedBook?.authorEn,
                        description_en: normalizedBook.descriptionEn || cachedBook?.descriptionEn,
                        publisher: normalizedBook.publisher || cachedBook?.publisher,
                        publisher_en: normalizedBook.publisherEn || cachedBook?.publisherEn,
                        isbn: normalizedBook.isbn || cachedBook?.isbn,
                        summary_html: normalizedBook.summaryHtml || cachedBook?.summaryHtml,
                        summary_html_en: normalizedBook.summaryHtmlEn || cachedBook?.summaryHtmlEn,
                        photos: normalizedBook.photos?.length ? normalizedBook.photos : cachedBook?.photos,
                        cover_url: normalizedBook.coverUrl || cachedBook?.coverUrl
                    }, index);
                });
            }

            if (!books.length && cachedBooks.length) {
                books = cachedBooks;
            }
        } catch (e) {
            console.error('Unexpected error loading from Supabase:', e);
        }
    }

    // DOM元素
    const booksGrid = document.querySelector('.books-grid');
    const recommendationsGrid = document.querySelector('.recommendations-grid');
    const recommendationsSection = document.getElementById('recommendations');
    const recommendationsSectionSubtitle = recommendationsSection?.querySelector('.section-subtitle') || null;
    const defaultRecommendationSectionSubtitleText = String(
        recommendationsSectionSubtitle?.textContent
        || (window.currentLang === 'en'
            ? 'AI recommendations shaped by your recent interests'
            : '基于您的浏览历史和偏好，AI为您精心挑选')
    ).trim();
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
    const systemMessagesSidebar = document.getElementById('system-messages-sidebar');
    const systemMessagesItemsContainer = document.getElementById('system-messages-items');
    const closeSystemMessagesBtn = document.getElementById('close-system-messages');
    const systemMessagesCountElement = document.querySelector('.system-messages-count');
    const systemMessagesUnreadBadge = document.getElementById('system-messages-unread-badge');
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
                userModeBadge.textContent = t('nav-not-logged-in', '未登录');
                return;
            }

            if (userType === 'guest') {
                userModeBadge.textContent = t('nav-guest', '游客');
                return;
            }

            const preferredName = loginUsername || username;
            const displayName = preferredName.includes('@') ? preferredName.split('@')[0] : preferredName;
            userModeBadge.textContent = displayName || t('nav-user-default', '用户');
        } catch (e) {
            userModeBadge.textContent = t('nav-not-logged-in', '未登录');
        }
    }

    function normalizeBookIdValue(value) {
        const parsed = Number(value);
        if (Number.isFinite(parsed)) return parsed;
        const normalized = String(value || '').trim();
        return normalized || null;
    }

    function normalizeBookIdList(values) {
        const seen = new Set();
        return (Array.isArray(values) ? values : [])
            .map(normalizeBookIdValue)
            .filter(value => {
                const key = String(value || '');
                if (!key || seen.has(key)) return false;
                seen.add(key);
                return true;
            });
    }

    function normalizeRecommendationText(value, maxLength = 120) {
        const normalized = String(value || '')
            .replace(/<[^>]+>/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
        if (!normalized) return '';
        return normalized.length > maxLength ? `${normalized.slice(0, maxLength)}...` : normalized;
    }

    function normalizeRecommendationDisplayText(value) {
        return String(value || '')
            .replace(/<[^>]+>/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
    }

    function normalizePreferenceKey(value) {
        return String(value || '').trim().toLowerCase();
    }

    function getRecommendationProfileIdentity() {
        const loginUsername = String(sessionStorage.getItem('loginUsername') || sessionStorage.getItem('username') || '').trim().toLowerCase();
        if (currentUserId) return `user:${currentUserId}`;
        if (loginUsername) return `${sessionStorage.getItem('userType') || 'user'}:${loginUsername}`;
        return `${sessionStorage.getItem('userType') || 'anon'}:visitor`;
    }

    function hashRecommendationSeed(input) {
        let hash = 2166136261;
        const source = String(input || '');
        for (let index = 0; index < source.length; index += 1) {
            hash ^= source.charCodeAt(index);
            hash = Math.imul(hash, 16777619);
        }
        return (hash >>> 0).toString(36);
    }

    function getRecommendationServedCacheKey(lang = getRecommendationLang()) {
        const safeLang = String(lang || '').trim() === 'en' ? 'en' : 'zh';
        return `${RECOMMENDATION_SERVED_CACHE_PREFIX}_${safeLang}_${hashRecommendationSeed(getRecommendationProfileIdentity())}`;
    }

    function getRecommendationMetaStorageKey() {
        return `${RECOMMENDATION_META_PREFIX}_${hashRecommendationSeed(getRecommendationProfileIdentity())}`;
    }

    function getRecommendationCacheScopeKey(lang = getRecommendationLang()) {
        const safeLang = String(lang || '').trim() === 'en' ? 'en' : 'zh';
        return `scope_${safeLang}_${hashRecommendationSeed(getRecommendationProfileIdentity())}`;
    }

    function loadRecommendationMetaState() {
        try {
            const raw = safeParseJsonValue(localStorage.getItem(getRecommendationMetaStorageKey()), null);
            if (!raw || typeof raw !== 'object') return { ...recommendationMetaState };
            return {
                dirty: Boolean(raw?.dirty),
                dirtyReasons: Array.from(new Set((Array.isArray(raw?.dirtyReasons) ? raw.dirtyReasons : []).map(item => String(item || '').trim()).filter(Boolean))),
                dirtyHintShown: Boolean(raw?.dirtyHintShown),
                lastSuccessfulRefreshAt: String(raw?.lastSuccessfulRefreshAt || '').trim(),
                lastAttemptAt: String(raw?.lastAttemptAt || '').trim(),
                lastProfileHash: String(raw?.lastProfileHash || '').trim(),
                lastServedSource: String(raw?.lastServedSource || 'idle').trim() || 'idle'
            };
        } catch (e) {
            return { ...recommendationMetaState };
        }
    }

    function saveRecommendationMetaState(meta) {
        const nextMeta = {
            dirty: Boolean(meta?.dirty),
            dirtyReasons: Array.from(new Set((Array.isArray(meta?.dirtyReasons) ? meta.dirtyReasons : []).map(item => String(item || '').trim()).filter(Boolean))),
            dirtyHintShown: Boolean(meta?.dirtyHintShown),
            lastSuccessfulRefreshAt: String(meta?.lastSuccessfulRefreshAt || '').trim(),
            lastAttemptAt: String(meta?.lastAttemptAt || '').trim(),
            lastProfileHash: String(meta?.lastProfileHash || '').trim(),
            lastServedSource: String(meta?.lastServedSource || 'idle').trim() || 'idle'
        };
        recommendationMetaState = nextMeta;
        try {
            localStorage.setItem(getRecommendationMetaStorageKey(), JSON.stringify(nextMeta));
        } catch (e) {
            console.warn('Save recommendation meta state failed:', e);
        }
        return nextMeta;
    }

    function normalizeFrontendRecommendationEntries(value, lang = getRecommendationLang()) {
        const safeLang = String(lang || '').trim() === 'en' ? 'en' : 'zh';
        const seen = new Set();
        return (Array.isArray(value) ? value : []).map((item, index) => {
            const bookId = normalizeBookIdValue(item?.bookId ?? item?.book_id);
            const key = String(bookId || '');
            const reason = normalizeRecommendationDisplayText(item?.reason) || getRecommendationText('fallback_reason_default', {}, safeLang);
            if (!key || seen.has(key) || !findBookById(bookId)) return null;
            seen.add(key);
            return {
                id: index + 1,
                bookId: Number(bookId),
                reason
            };
        }).filter(Boolean);
    }

    function isRecommendationPayloadExpired(payload) {
        return !payload || Number(payload?.expiresAt || 0) <= Date.now();
    }

    function loadServedRecommendationCache(lang = getRecommendationLang()) {
        const safeLang = String(lang || '').trim() === 'en' ? 'en' : 'zh';
        try {
            const raw = safeParseJsonValue(localStorage.getItem(getRecommendationServedCacheKey(safeLang)), null);
            if (!raw || typeof raw !== 'object') return null;
            if (String(raw?.lang || '').trim() !== safeLang) return null;
            const normalizedRecommendations = normalizeFrontendRecommendationEntries(raw?.recommendations, safeLang);
            if (!normalizedRecommendations.length) return null;
            return {
                lang: safeLang,
                recommendations: normalizedRecommendations,
                summary: String(raw?.summary || '').trim(),
                source: String(raw?.source || 'served_cache').trim() || 'served_cache',
                traceId: String(raw?.traceId || '').trim(),
                savedAt: Number(raw?.savedAt || 0),
                expiresAt: Number(raw?.expiresAt || 0),
                profileHash: String(raw?.profileHash || '').trim()
            };
        } catch (e) {
            return null;
        }
    }

    function saveServedRecommendationCache(payload, ttlMs, lang = getRecommendationLang()) {
        const safeLang = String(lang || '').trim() === 'en' ? 'en' : 'zh';
        const recommendationsToSave = normalizeFrontendRecommendationEntries(payload?.recommendations, safeLang);
        if (!recommendationsToSave.length) return null;
        const savedAt = Date.now();
        const cachePayload = {
            lang: safeLang,
            recommendations: recommendationsToSave,
            summary: String(payload?.summary || '').trim(),
            source: String(payload?.source || 'served_cache').trim() || 'served_cache',
            traceId: String(payload?.traceId || '').trim(),
            savedAt,
            expiresAt: savedAt + Math.max(1000, Number(ttlMs) || RECOMMENDATION_SERVED_TTL_MS),
            profileHash: String(payload?.profileHash || '').trim()
        };
        try {
            localStorage.setItem(getRecommendationServedCacheKey(safeLang), JSON.stringify(cachePayload));
        } catch (e) {
            console.warn('Save served recommendation cache failed:', e);
        }
        return cachePayload;
    }

    function computeRecommendationProfileHash(profile, candidates, lang = getRecommendationLang()) {
        const safeLang = String(lang || '').trim() === 'en' ? 'en' : 'zh';
        const cacheSeed = JSON.stringify({
            lang: safeLang,
            identity: getRecommendationProfileIdentity(),
            isGuest: Boolean(profile?.isGuest),
            recentViewedBookIds: normalizeBookIdList(profile?.recentViewedBookIds || []),
            favoriteBookIds: normalizeBookIdList(profile?.favoriteBookIds || []),
            cartBookIds: normalizeBookIdList(profile?.cartBookIds || []),
            cartEntries: (Array.isArray(profile?.cartEntries) ? profile.cartEntries : []).map(entry => (
                `${normalizeBookIdValue(entry?.bookId)}:${Math.max(1, Number(entry?.quantity) || 1)}`
            )),
            purchasedBookIds: normalizeBookIdList(profile?.purchasedBookIds || []),
            preferredCategories: (Array.isArray(profile?.preferredCategories) ? profile.preferredCategories : []).map(item => ({
                name: String(item?.name || '').trim(),
                score: Number(item?.score || 0)
            })),
            preferredAuthors: (Array.isArray(profile?.preferredAuthors) ? profile.preferredAuthors : []).map(item => ({
                name: String(item?.name || '').trim(),
                score: Number(item?.score || 0)
            })),
            preferredTags: (Array.isArray(profile?.preferredTags) ? profile.preferredTags : []).map(item => ({
                name: String(item?.name || '').trim(),
                score: Number(item?.score || 0)
            })),
            pricePreference: {
                bucket: String(profile?.pricePreference?.bucket || ''),
                average: Number(profile?.pricePreference?.average || 0),
                preferredRange: Array.isArray(profile?.pricePreference?.preferredRange) ? profile.pricePreference.preferredRange.map(value => Number(value) || 0) : [0, 0]
            },
            candidateIds: (Array.isArray(candidates) ? candidates : []).map(candidate => String(candidate?.bookId || '')),
            candidateScores: (Array.isArray(candidates) ? candidates : []).map(candidate => (
                `${String(candidate?.bookId || '')}:${Number(candidate?.candidateScore || candidate?.coarseScore || 0).toFixed(2)}`
            ))
        });
        return hashRecommendationSeed(cacheSeed);
    }

    function computeRecommendationProfileCacheKey(profile, candidates, lang = getRecommendationLang()) {
        return `${RECOMMENDATION_CACHE_PREFIX}_${computeRecommendationProfileHash(profile, candidates, lang)}`;
    }

    function loadProfileRecommendationCache(cacheKey, lang = getRecommendationLang()) {
        const safeLang = String(lang || '').trim() === 'en' ? 'en' : 'zh';
        if (!cacheKey) return null;
        try {
            const raw = safeParseJsonValue(localStorage.getItem(cacheKey), null);
            if (!raw || typeof raw !== 'object') return null;
            if (String(raw?.lang || '').trim() !== safeLang) return null;
            const savedAt = Number(raw?.savedAt || 0);
            if (!savedAt || (Date.now() - savedAt) > RECOMMENDATION_CACHE_TTL_MS) {
                localStorage.removeItem(cacheKey);
                return null;
            }
            const cachedRecommendations = normalizeFrontendRecommendationEntries(raw?.recommendations, safeLang);
            if (!cachedRecommendations.length) return null;
            return {
                lang: safeLang,
                recommendations: cachedRecommendations,
                summary: String(raw?.summary || '').trim(),
                source: String(raw?.source || 'profile_cache').trim() || 'profile_cache',
                traceId: String(raw?.traceId || '').trim(),
                savedAt,
                profileHash: String(raw?.profileHash || '').trim()
            };
        } catch (e) {
            return null;
        }
    }

    function saveProfileRecommendationCache(cacheKey, payload, lang = getRecommendationLang()) {
        const safeLang = String(lang || '').trim() === 'en' ? 'en' : 'zh';
        if (!cacheKey) return;
        try {
            localStorage.setItem(cacheKey, JSON.stringify({
                ...payload,
                lang: safeLang,
                recommendations: normalizeFrontendRecommendationEntries(payload?.recommendations, safeLang),
                savedAt: Date.now()
            }));
        } catch (e) {
            console.warn('Save profile recommendation cache failed:', e);
        }
    }

    function buildRecommendationDirtyHint(dirtyReasons = [], lang = getRecommendationLang()) {
        const reasonSet = new Set((Array.isArray(dirtyReasons) ? dirtyReasons : []).map(item => String(item || '').trim()).filter(Boolean));
        if (reasonSet.has('purchase_update')) return getRecommendationText('dirty_purchase', {}, lang);
        if (reasonSet.has('cart_update')) return getRecommendationText('dirty_cart', {}, lang);
        if (reasonSet.has('favorite_update')) return getRecommendationText('dirty_favorite', {}, lang);
        if (reasonSet.has('history_update')) return getRecommendationText('dirty_history', {}, lang);
        if (reasonSet.has('review_update')) return getRecommendationText('dirty_review', {}, lang);
        if (reasonSet.has('history_clear')) return getRecommendationText('dirty_history_clear', {}, lang);
        if (!reasonSet.size) return '';
        return getRecommendationText('dirty_generic', {}, lang);
    }

    function markRecommendationDirty(reason, options = {}) {
        const normalizedReason = String(reason || '').trim();
        const dirtyReasons = Array.from(new Set([
            ...(Array.isArray(recommendationMetaState?.dirtyReasons) ? recommendationMetaState.dirtyReasons : []),
            ...(normalizedReason ? [normalizedReason] : [])
        ]));
        saveRecommendationMetaState({
            ...recommendationMetaState,
            dirty: options?.dirty === false ? false : true,
            dirtyReasons: options?.dirty === false ? [] : dirtyReasons,
            dirtyHintShown: false
        });
        if (options?.render !== false) {
            renderRecommendationSummaryState();
            updateRecommendationRefreshTip();
        }
        if (options?.schedule !== false) {
            scheduleRecommendationRefresh(normalizedReason || 'behavior_update');
        }
        return recommendationMetaState;
    }

    function isRetryableRecommendationSource(source) {
        const normalizedSource = String(source || '').trim().toLowerCase();
        return normalizedSource === 'fallback'
            || normalizedSource === 'fallback_candidates'
            || normalizedSource === 'fallback_popular';
    }

    function shouldRefreshRecommendations(options = {}) {
        const servedPayload = loadServedRecommendationCache();
        const servedExpired = isRecommendationPayloadExpired(servedPayload);
        const lastAttemptAt = recommendationMetaState?.lastAttemptAt ? new Date(recommendationMetaState.lastAttemptAt).getTime() : 0;
        const attemptAge = lastAttemptAt > 0 ? (Date.now() - lastAttemptAt) : Number.POSITIVE_INFINITY;
        const throttled = attemptAge < RECOMMENDATION_FALLBACK_TTL_MS;
        const shouldRetryExpiredFallback = servedExpired && isRetryableRecommendationSource(
            servedPayload?.source || recommendationMetaState?.lastServedSource
        );

        if (options?.force) {
            return {
                shouldRequest: true,
                shouldUseServedCache: Boolean(servedPayload?.recommendations?.length && !options?.skipServedApply),
                servedPayload,
                servedExpired,
                throttled: false,
                decision: 'force'
            };
        }

        if (!servedPayload?.recommendations?.length) {
            return {
                shouldRequest: true,
                shouldUseServedCache: false,
                servedPayload: null,
                servedExpired: true,
                throttled: false,
                decision: 'missing_served_cache'
            };
        }

        if (!servedExpired) {
            return {
                shouldRequest: Boolean(recommendationMetaState?.dirty) && !throttled,
                shouldUseServedCache: true,
                servedPayload,
                servedExpired: false,
                throttled,
                decision: recommendationMetaState?.dirty ? 'served_cache_fresh_dirty' : 'served_cache_fresh'
            };
        }

        return {
            shouldRequest: !throttled,
            shouldUseServedCache: true,
            servedPayload,
            servedExpired: true,
            throttled,
            decision: shouldRetryExpiredFallback
                ? 'served_cache_expired_fallback'
                : (recommendationMetaState?.dirty ? 'served_cache_expired_dirty' : 'served_cache_expired_clean')
        };
    }

    function ensureRecommendationSummaryElement() {
        if (!recommendationsSection) return null;
        const existingSummaryElement = document.getElementById('recommendation-profile-summary');
        if (recommendationsSectionSubtitle) {
            if (existingSummaryElement && existingSummaryElement !== recommendationsSectionSubtitle) {
                existingSummaryElement.remove();
            }
            recommendationsSectionSubtitle.id = 'recommendation-profile-summary';
            return recommendationsSectionSubtitle;
        }

        if (existingSummaryElement) return existingSummaryElement;

        const summaryElement = document.createElement('p');
        summaryElement.id = 'recommendation-profile-summary';
        summaryElement.className = 'section-subtitle';
        summaryElement.textContent = getRecommendationDefaultSummary();
        recommendationsSection.querySelector('.container')?.insertBefore(summaryElement, recommendationsGrid);
        return summaryElement;
    }

    function renderRecommendationSummaryState() {
        const summaryElement = ensureRecommendationSummaryElement();
        if (!summaryElement) return;
        summaryElement.textContent = recommendationSummaryState.summary || getRecommendationDefaultSummary();
    }

    function setRecommendationSummaryState(summary, source = 'idle', meta = {}) {
        const lang = getRecommendationLang();
        const baseSummary = String(summary || '').trim() || getRecommendationDefaultSummary(lang);
        const shouldShowDirtyHint = Boolean(
            meta?.allowDirtyHint
            && meta?.servedCacheContinuation
            && recommendationMetaState?.dirty
            && !recommendationMetaState?.dirtyHintShown
        );
        const dirtyHint = shouldShowDirtyHint ? buildRecommendationDirtyHint(recommendationMetaState?.dirtyReasons, lang) : '';
        const nextSummary = dirtyHint && !baseSummary.includes(dirtyHint)
            ? (lang === 'en' ? `${baseSummary} ${dirtyHint}` : `${baseSummary}${dirtyHint}`)
            : baseSummary;
        recommendationSummaryState = {
            summary: nextSummary,
            source: String(source || 'idle').trim() || 'idle',
            updatedAt: String(meta?.updatedAt || new Date().toISOString()),
            traceId: String(meta?.traceId || '').trim()
        };
        if (dirtyHint) {
            saveRecommendationMetaState({
                ...recommendationMetaState,
                dirtyHintShown: true
            });
        }
        renderRecommendationSummaryState();
    }

    function applyRecommendationPayload(payload, meta = {}) {
        const payloadLang = String(payload?.lang || getRecommendationLang()).trim() === 'en' ? 'en' : 'zh';
        if (payloadLang !== getRecommendationLang()) return false;
        const nextRecommendations = normalizeFrontendRecommendationEntries(payload?.recommendations, payloadLang);
        if (!nextRecommendations.length) return false;

        recommendations = nextRecommendations.map((item, index) => ({
            ...item,
            id: index + 1
        }));

        const summaryText = String(payload?.summary || '').trim() || getRecommendationDefaultSummary(payloadLang);
        const source = String(payload?.source || 'idle').trim() || 'idle';
        const traceId = String(payload?.traceId || '').trim();

        saveRecommendationMetaState({
            ...recommendationMetaState,
            lastServedSource: source
        });

        setRecommendationSummaryState(summaryText, source, {
            traceId,
            updatedAt: meta?.updatedAt || new Date().toISOString(),
            allowDirtyHint: meta?.allowDirtyHint,
            servedCacheContinuation: meta?.servedCacheContinuation
        });
        updateRecommendationRefreshTip();
        renderRecommendations();
        return true;
    }

    function getRecommendationRefreshToast(result, lang = getRecommendationLang()) {
        if (result?.authRequired) {
            return {
                message: getRecommendationText('toast_auth_required', {}, lang),
                type: 'info'
            };
        }
        if (result?.cache === 'served_stale') {
            return {
                message: getRecommendationText('toast_served_stale', {}, lang),
                type: 'info'
            };
        }
        if (result?.source === 'served_cache') {
            return {
                message: getRecommendationText('toast_served_cache', {}, lang),
                type: 'info'
            };
        }
        if (result?.source === 'llm' || result?.source === 'profile_cache') {
            return {
                message: getRecommendationText('toast_updated', {}, lang),
                type: 'success'
            };
        }
        if (result?.source === 'fallback' || result?.source === 'fallback_candidates') {
            return {
                message: getRecommendationText('toast_fallback_candidates', {}, lang),
                type: 'info'
            };
        }
        if (result?.source === 'fallback_popular') {
            return {
                message: getRecommendationText('toast_fallback_popular', {}, lang),
                type: 'info'
            };
        }
        return {
            message: getRecommendationText('toast_recovered', {}, lang),
            type: 'info'
        };
    }

    function updateRecommendationRefreshTip() {
        const tip = document.querySelector('.recommendation-refresh p');
        if (!tip) return;

        const lang = getRecommendationLang();
        const summaryText = String(recommendationSummaryState?.summary || '').trim();
        const source = String(recommendationSummaryState?.source || recommendationMetaState?.lastServedSource || 'idle').trim();
        const lastSuccessfulRefreshAt = recommendationMetaState?.lastSuccessfulRefreshAt
            ? new Date(recommendationMetaState.lastSuccessfulRefreshAt).getTime()
            : 0;

        const sourceTextKeyMap = {
            llm: 'refresh_source_llm',
            profile_cache: 'refresh_source_profile_cache',
            fallback_candidates: 'refresh_source_fallback_candidates',
            fallback: 'refresh_source_fallback_candidates',
            fallback_popular: 'refresh_source_fallback_popular',
            served_cache: 'refresh_source_served_cache'
        };
        const sourceHint = sourceTextKeyMap[source] ? getRecommendationText(sourceTextKeyMap[source], {}, lang) : '';
        const dirtyHint = recommendationMetaState?.dirty ? getRecommendationText('refresh_dirty_suffix', {}, lang) : '';
        const appendDirtyHint = text => {
            if (!dirtyHint) return text;
            if (!text) return dirtyHint;
            return lang === 'en' ? `${text} ${dirtyHint}` : `${text}${dirtyHint}`;
        };

        if (lastSuccessfulRefreshAt) {
            const timeText = formatRecommendationTime(lastSuccessfulRefreshAt, lang);
            const readyText = getRecommendationText('refresh_ready', {
                time: timeText,
                source: sourceHint || getRecommendationText('refresh_source_served_cache', {}, lang)
            }, lang);
            tip.textContent = appendDirtyHint(readyText);
            return;
        }

        if (summaryText) {
            const baseText = sourceHint || summaryText;
            const tipText = lang === 'en'
                ? `${baseText} ${getRecommendationText('refresh_manual_suffix', {}, lang)}`
                : `${baseText}${getRecommendationText('refresh_manual_suffix', {}, lang)}`;
            tip.textContent = appendDirtyHint(tipText);
            return;
        }

        tip.textContent = appendDirtyHint(getRecommendationText('refresh_default', {}, lang));
    }

    function getBookRecommendationRating(book) {
        const aggregate = getBookAggregateRating(book?.id);
        if (Number.isFinite(aggregate) && aggregate > 0) return aggregate;
        const fallback = Number(book?.rating);
        return Number.isFinite(fallback) ? fallback : 0;
    }

    function getBookReviewCount(bookId) {
        const stats = bookRatingStatsMap.get(String(bookId));
        if (stats && Number(stats.count) > 0) return Number(stats.count);
        return (Array.isArray(bookReviews) ? bookReviews : []).filter(review => (
            Number(review?.bookId) === Number(bookId)
            && normalizeModerationStatus(review?.moderationStatus) === 'approved'
        )).length;
    }

    function getVisiblePopularBooks(excludeBookIds = [], limit = RECOMMENDATION_CANDIDATE_LIMIT) {
        const exclude = new Set(normalizeBookIdList([
            ...extractPurchasedBookIds(),
            ...(Array.isArray(excludeBookIds) ? excludeBookIds : [])
        ]).map(value => String(value)));
        const titleSort = (left, right) => String(left?.title || '').localeCompare(String(right?.title || ''), 'zh-Hans-CN');
        return getVisibleBooks(books)
            .filter(book => !exclude.has(String(book?.id)))
            .map(book => ({
                book,
                popularityScore: (
                    getBookRecommendationRating(book) * 18
                    + getBookReviewCount(book?.id) * 6
                )
            }))
            .sort((left, right) => (
                right.popularityScore - left.popularityScore
                || getBookRecommendationRating(right.book) - getBookRecommendationRating(left.book)
                || titleSort(left.book, right.book)
            ))
            .slice(0, Math.max(limit, RECOMMENDATION_FALLBACK_LIMIT))
            .map(item => item.book);
    }

    function buildPopularFallbackReason(book, lang = getRecommendationLang()) {
        const rating = getBookRecommendationRating(book);
        const reviewCount = getBookReviewCount(book?.id);
        if (rating >= 4.5 && reviewCount > 0) return getRecommendationText('popular_reason_high_rating', {}, lang);
        if (reviewCount >= 2) return getRecommendationText('popular_reason_review_stable', {}, lang);
        return getRecommendationText('popular_reason_default', {}, lang);
    }

    function buildPopularFallbackRecommendations(limit = 4, lang = getRecommendationLang()) {
        const finalLimit = Math.max(1, Number(limit) || RECOMMENDATION_FALLBACK_LIMIT);
        return getVisiblePopularBooks([], finalLimit)
            .slice(0, finalLimit)
            .map((book, index) => ({
                id: index + 1,
                bookId: book.id,
                reason: buildPopularFallbackReason(book, lang)
            }));
    }

    function summarizeCandidateRecallSource(candidate, lang = getRecommendationLang()) {
        const sourceSet = new Set(Array.isArray(candidate?.recallSources) ? candidate.recallSources : []);
        if (sourceSet.has('purchase') && sourceSet.has('favorite')) return getRecommendationText('recall_purchase_favorite', {}, lang);
        if (sourceSet.has('purchase') && sourceSet.has('cart')) return getRecommendationText('recall_purchase_cart', {}, lang);
        if (sourceSet.has('favorite') && sourceSet.has('cart')) return getRecommendationText('recall_favorite_cart', {}, lang);
        if (sourceSet.has('purchase')) return getRecommendationText('recall_purchase', {}, lang);
        if (sourceSet.has('favorite') && sourceSet.has('history')) return getRecommendationText('recall_favorite_history', {}, lang);
        if (sourceSet.has('favorite')) return getRecommendationText('recall_favorite', {}, lang);
        if (sourceSet.has('cart')) return getRecommendationText('recall_cart', {}, lang);
        if (sourceSet.has('history')) return getRecommendationText('recall_history', {}, lang);
        if (sourceSet.has('popular')) return getRecommendationText('recall_popular', {}, lang);
        return getRecommendationText('fallback_reason_default', {}, lang);
    }

    function buildCandidateFallbackReason(candidate, lang = getRecommendationLang()) {
        const sourceText = summarizeCandidateRecallSource(candidate, lang);
        const hint = normalizeRecommendationText((Array.isArray(candidate?.reasonHints) ? candidate.reasonHints[0] : '') || '', 24);
        if (sourceText && hint) return lang === 'en' ? `${sourceText}, ${hint}` : `${sourceText}，${hint}`;
        return sourceText || hint || getRecommendationText('fallback_reason_default', {}, lang);
    }

    function buildFallbackFromCandidates(candidates, limit = 4, lang = getRecommendationLang()) {
        const finalLimit = Math.max(1, Number(limit) || RECOMMENDATION_FALLBACK_LIMIT);
        const pickedIds = new Set();
        const results = [];
        (Array.isArray(candidates) ? candidates : [])
            .map((candidate, index) => ({ candidate, index }))
            .sort((left, right) => (
                ((Number(left?.candidate?.candidateRank || 0) > 0 ? Number(left.candidate.candidateRank) : Number.POSITIVE_INFINITY)
                    - (Number(right?.candidate?.candidateRank || 0) > 0 ? Number(right.candidate.candidateRank) : Number.POSITIVE_INFINITY))
                || (Number(right?.candidate?.candidateScore || right?.candidate?.coarseScore || 0) - Number(left?.candidate?.candidateScore || left?.candidate?.coarseScore || 0))
                || (left.index - right.index)
            ))
            .forEach(({ candidate }) => {
                const book = findBookById(candidate?.bookId);
                const key = String(candidate?.bookId || '');
                if (!book || !key || pickedIds.has(key) || results.length >= finalLimit) return;
                pickedIds.add(key);
                results.push({
                    id: results.length + 1,
                    bookId: book.id,
                    reason: buildCandidateFallbackReason(candidate, lang)
                });
            });

        if (results.length < finalLimit) {
            getVisiblePopularBooks(Array.from(pickedIds), finalLimit).forEach(book => {
                if (results.length >= finalLimit || pickedIds.has(String(book.id))) return;
                pickedIds.add(String(book.id));
                results.push({
                    id: results.length + 1,
                    bookId: book.id,
                    reason: buildPopularFallbackReason(book, lang)
                });
            });
        }

        return results.slice(0, finalLimit);
    }

    function extractPurchasedBookIds() {
        const seen = new Set();
        const purchasedBookIds = [];
        (Array.isArray(userOrders) ? userOrders : []).forEach(order => {
            if (normalizeOrderStatus(order?.status) === 'cancelled') return;
            (Array.isArray(order?.items) ? order.items : []).forEach(item => {
                const normalizedId = normalizeBookIdValue(item?.bookId);
                const key = String(normalizedId || '');
                if (!normalizedId || seen.has(key)) return;
                seen.add(key);
                purchasedBookIds.push(normalizedId);
            });
        });
        return purchasedBookIds;
    }

    function collectBehaviorBooks() {
        const behaviorBooks = [];
        const appendBehaviorBook = (bookId, source, weight) => {
            const book = findBookById(bookId, { includeDisabled: true });
            if (!book) return;
            behaviorBooks.push({ book, source, weight });
        };

        normalizeBookIdList((Array.isArray(browsingHistory) ? browsingHistory : []).map(entry => entry?.id)).slice(0, 8).forEach(bookId => {
            appendBehaviorBook(bookId, 'history', 1.4);
        });

        normalizeBookIdList(Array.from(favoriteBookIds)).slice(0, 8).forEach(bookId => {
            appendBehaviorBook(bookId, 'favorite', 2.2);
        });

        (Array.isArray(cart) ? cart : [])
            .map(item => ({
                bookId: normalizeBookIdValue(item?.bookId),
                quantity: Math.max(1, Number(item?.quantity) || 1)
            }))
            .filter(item => item.bookId !== null)
            .slice(0, 8)
            .forEach(entry => {
                appendBehaviorBook(entry.bookId, 'cart', 2.6 + Math.min(4, entry.quantity) * 0.45);
            });

        extractPurchasedBookIds().slice(0, 8).forEach(bookId => {
            appendBehaviorBook(bookId, 'purchase', 3.0);
        });

        return behaviorBooks;
    }

    function rankBehaviorPreferences(behaviorBooks, extractor, limit = 5) {
        const buckets = new Map();
        (Array.isArray(behaviorBooks) ? behaviorBooks : []).forEach(entry => {
            const output = extractor(entry?.book, entry);
            const items = Array.isArray(output) ? output : [output];
            const seen = new Set();
            items.forEach(item => {
                const sourceItem = typeof item === 'string' ? {
                    key: item,
                    name: item,
                    label: item,
                    labelZh: item,
                    labelEn: item
                } : (item || {});
                const key = normalizePreferenceKey(sourceItem?.key ?? sourceItem?.name ?? sourceItem?.label);
                const name = String(sourceItem?.name ?? sourceItem?.label ?? sourceItem?.key ?? '').trim();
                const label = String(sourceItem?.label ?? sourceItem?.name ?? sourceItem?.key ?? '').trim() || name;
                const labelZh = String(sourceItem?.labelZh ?? sourceItem?.label_zh ?? sourceItem?.label ?? sourceItem?.name ?? sourceItem?.key ?? '').trim() || name;
                const labelEn = String(sourceItem?.labelEn ?? sourceItem?.label_en ?? sourceItem?.label ?? sourceItem?.name ?? sourceItem?.key ?? '').trim() || name;
                if (!key || !name || seen.has(key)) return;
                seen.add(key);
                const bucket = buckets.get(key) || { name, label, labelZh, labelEn, score: 0 };
                bucket.score += Number(entry?.weight) || 0;
                if (!bucket.label) bucket.label = label;
                if (!bucket.labelZh) bucket.labelZh = labelZh;
                if (!bucket.labelEn) bucket.labelEn = labelEn;
                buckets.set(key, bucket);
            });
        });

        return Array.from(buckets.values())
            .sort((left, right) => (
                right.score - left.score
                || String(left.label || left.name || '').localeCompare(String(right.label || right.name || ''), 'zh-Hans-CN')
            ))
            .slice(0, Math.max(1, Number(limit) || 5))
            .map(item => ({
                ...item,
                score: Number(item.score.toFixed(2))
            }));
    }

    function inferPreferredCategories(behaviorBooks) {
        return rankBehaviorPreferences(behaviorBooks, book => ({
            key: book?.category,
            name: String(book?.category || '').trim(),
            label: getCategoryName(book?.category)
        }), 4);
    }

    function inferPreferredAuthors(behaviorBooks) {
        return rankBehaviorPreferences(behaviorBooks, book => ({
            key: book?.author,
            name: String(book?.author || '').trim(),
            labelZh: String(book?.author || '').trim(),
            labelEn: String((book?.authorEn ?? book?.author_en ?? book?.author) || '').trim()
        }), 4);
    }

    function inferPreferredTags(behaviorBooks) {
        return rankBehaviorPreferences(behaviorBooks, book => {
            const tagsZh = normalizeTextList(book?.tags).map(tag => String(tag || '').trim()).filter(Boolean);
            const tagsEn = normalizeTextList(book?.tagsEn ?? book?.tags_en).map(tag => String(tag || '').trim()).filter(Boolean);
            return tagsZh.map((tag, index) => ({
                key: tag,
                name: tag,
                labelZh: tag,
                labelEn: String(tagsEn[index] || tag).trim()
            }));
        }, 6);
    }

    function inferPricePreference(behaviorBooks) {
        const priceSamples = (Array.isArray(behaviorBooks) ? behaviorBooks : [])
            .map(entry => ({
                price: Number(entry?.book?.price),
                weight: Number(entry?.weight) || 0
            }))
            .filter(item => Number.isFinite(item.price) && item.price > 0 && item.weight > 0);

        if (!priceSamples.length) {
            return {
                bucket: 'medium',
                average: 0,
                min: 0,
                max: 0,
                preferredRange: [0, 0]
            };
        }

        const weightedTotal = priceSamples.reduce((sum, item) => sum + item.price * item.weight, 0);
        const weightTotal = priceSamples.reduce((sum, item) => sum + item.weight, 0) || 1;
        const average = Number((weightedTotal / weightTotal).toFixed(2));
        const min = Number(Math.min(...priceSamples.map(item => item.price)).toFixed(2));
        const max = Number(Math.max(...priceSamples.map(item => item.price)).toFixed(2));
        const lowerBound = Number(Math.max(0, average * 0.7).toFixed(2));
        const upperBound = Number(Math.max(max, average * 1.3).toFixed(2));
        let bucket = 'medium';
        if (average < 50) {
            bucket = 'low';
        } else if (average > 90) {
            bucket = 'high';
        }

        return {
            bucket,
            average,
            min,
            max,
            preferredRange: [lowerBound, upperBound]
        };
    }

    function buildRecentInterestSummary(profile, lang = getRecommendationLang()) {
        const parts = buildRecentInterestSummaryParts(profile, lang);
        return formatRecentInterestSummary(parts, lang);
    }

    function buildProfileConfidence(profile) {
        const signalScore = (
            normalizeBookIdList(profile?.recentViewedBookIds || []).length * 1.4
            + normalizeBookIdList(profile?.favoriteBookIds || []).length * 2.2
            + normalizeBookIdList(profile?.cartBookIds || []).length * 2.6
            + normalizeBookIdList(profile?.purchasedBookIds || []).length * 3.0
        );
        if (signalScore >= 18) return 'high';
        if (signalScore >= 7) return 'medium';
        return 'low';
    }

    function buildUserPreferenceProfile() {
        const recentViewedBookIds = normalizeBookIdList((Array.isArray(browsingHistory) ? browsingHistory : []).map(entry => entry?.id)).slice(0, 8);
        const favoriteIds = normalizeBookIdList(Array.from(favoriteBookIds)).slice(0, 12);
        const cartEntries = (Array.isArray(cart) ? cart : [])
            .map(item => ({
                bookId: normalizeBookIdValue(item?.bookId),
                quantity: Math.max(1, Number(item?.quantity) || 1)
            }))
            .filter(item => item.bookId !== null)
            .slice(0, 12);
        const cartBookIds = normalizeBookIdList(cartEntries.map(entry => entry.bookId));
        const purchasedBookIds = extractPurchasedBookIds();
        const behaviorBooks = collectBehaviorBooks();

        const profile = {
            userId: currentUserId || getRecommendationProfileIdentity(),
            isGuest: isGuestUser(),
            recentViewedBookIds,
            favoriteBookIds: favoriteIds,
            cartBookIds,
            cartEntries,
            purchasedBookIds,
            preferredCategories: inferPreferredCategories(behaviorBooks),
            preferredAuthors: inferPreferredAuthors(behaviorBooks),
            preferredTags: inferPreferredTags(behaviorBooks),
            pricePreference: inferPricePreference(behaviorBooks),
            recentInterestSummary: '',
            profileConfidence: 'low'
        };

        profile.recentInterestSummary = buildRecentInterestSummary(profile);
        profile.profileConfidence = buildProfileConfidence(profile);
        return profile;
    }

    function buildCandidateFromBook(book, source, seedScore = 0, sourceBookId = null) {
        if (!book || !Number.isFinite(Number(book.id))) return null;
        const rating = getBookRecommendationRating(book);
        return {
            bookId: Number(book.id),
            title: String(book.title || '未命名图书').trim(),
            author: String(book.author || '未知作者').trim(),
            category: String(book.category || '').trim(),
            price: Number(book.price || 0) || 0,
            rating: Number.isFinite(rating) ? Number(rating.toFixed(2)) : 0,
            tags: normalizeTextList(book.tags).map(tag => String(tag || '').trim()).filter(Boolean),
            description: normalizeRecommendationText(book.description, 180),
            content: getRecommendationBookContent(book),
            candidateScore: Number(seedScore || 0),
            seedScore: Number(seedScore || 0),
            contentScore: 0,
            coarseScore: Number(seedScore || 0),
            recallSources: source ? [String(source).trim()] : [],
            sourceBookIds: sourceBookId !== null && sourceBookId !== undefined ? [normalizeBookIdValue(sourceBookId)] : [],
            reasonHints: []
        };
    }

    function mergeDedupCandidates(candidateGroups) {
        const mergedMap = new Map();
        (Array.isArray(candidateGroups) ? candidateGroups : []).forEach(group => {
            (Array.isArray(group) ? group : []).forEach(candidate => {
                if (!candidate || !candidate.bookId) return;
                const key = String(candidate.bookId);
                const existing = mergedMap.get(key);
                if (!existing) {
                    mergedMap.set(key, {
                        ...candidate,
                        recallSources: Array.from(new Set(candidate.recallSources || [])),
                        sourceBookIds: normalizeBookIdList(candidate.sourceBookIds || []),
                        reasonHints: Array.from(new Set((candidate.reasonHints || []).filter(Boolean)))
                    });
                    return;
                }

                existing.seedScore += Number(candidate.seedScore || 0);
                existing.candidateScore += Number(candidate.candidateScore || 0);
                existing.coarseScore = existing.seedScore + Number(existing.contentScore || 0);
                existing.recallSources = Array.from(new Set([
                    ...(existing.recallSources || []),
                    ...(candidate.recallSources || [])
                ]));
                existing.sourceBookIds = normalizeBookIdList([
                    ...(existing.sourceBookIds || []),
                    ...(candidate.sourceBookIds || [])
                ]);
                existing.reasonHints = Array.from(new Set([
                    ...(existing.reasonHints || []),
                    ...(candidate.reasonHints || [])
                ].filter(Boolean)));
            });
        });
        return Array.from(mergedMap.values());
    }

    function collectRecallCandidatesBySource(bookIds, source, limitPerBook, sourceBoost) {
        const results = [];
        normalizeBookIdList(bookIds).forEach(bookId => {
            const sourceBook = findBookById(bookId, { includeDisabled: true });
            if (!sourceBook) return;
            getRelatedBooks(sourceBook, limitPerBook).forEach((item, index) => {
                const candidate = buildCandidateFromBook(
                    item?.book,
                    source,
                    Number(item?.score || 0) + Number(sourceBoost || 0) + Math.max(0, limitPerBook - index),
                    sourceBook.id
                );
                if (!candidate) return;
                if (item?.reason) candidate.reasonHints.push(normalizeRecommendationText(item.reason, 30));
                results.push(candidate);
            });
        });
        return results;
    }

    function collectHistoryRecallCandidates(profile, limitPerBook = 6) {
        return collectRecallCandidatesBySource(profile?.recentViewedBookIds?.slice(0, 3) || [], 'history', limitPerBook, 6);
    }

    function collectFavoriteRecallCandidates(profile, limitPerBook = 6) {
        return collectRecallCandidatesBySource(profile?.favoriteBookIds?.slice(0, 4) || [], 'favorite', limitPerBook, 10);
    }

    function collectCartRecallCandidates(profile, limitPerBook = 6) {
        return collectRecallCandidatesBySource(profile?.cartBookIds?.slice(0, 4) || [], 'cart', limitPerBook, 12);
    }

    function collectPurchaseRecallCandidates(profile, limitPerBook = 6) {
        return collectRecallCandidatesBySource(profile?.purchasedBookIds?.slice(0, 4) || [], 'purchase', limitPerBook, 14);
    }

    function collectPopularRecallCandidates(limit = 8, excludeBookIds = []) {
        return getVisiblePopularBooks(excludeBookIds, limit).map((book, index) => {
            const candidate = buildCandidateFromBook(book, 'popular', Math.max(1, limit - index) + getBookRecommendationRating(book) * 4);
            if (!candidate) return null;
            candidate.reasonHints.push(buildPopularFallbackReason(book));
            return candidate;
        }).filter(Boolean);
    }

    function buildPreferenceWeightMap(preferences) {
        const map = new Map();
        (Array.isArray(preferences) ? preferences : []).forEach(item => {
            const key = normalizePreferenceKey(item?.name ?? item?.label ?? item?.key);
            if (!key) return;
            map.set(key, Number(item?.score) || 0);
        });
        return map;
    }

    function applyCandidateContentScore(candidate, profile) {
        if (!candidate) return null;
        const authorWeights = buildPreferenceWeightMap(profile?.preferredAuthors);
        const categoryWeights = buildPreferenceWeightMap(profile?.preferredCategories);
        const tagWeights = buildPreferenceWeightMap(profile?.preferredTags);
        const candidateAuthorKey = normalizePreferenceKey(candidate.author);
        const candidateCategoryKey = normalizePreferenceKey(candidate.category);
        const candidateTagKeys = normalizeTextList(candidate.tags).map(tag => normalizePreferenceKey(tag)).filter(Boolean);
        const matchedSignals = [];
        let contentScore = 0;

        if (authorWeights.has(candidateAuthorKey)) {
            const authorWeight = authorWeights.get(candidateAuthorKey) || 0;
            contentScore += 18 + authorWeight * 2.4;
            matchedSignals.push('author');
        }

        if (categoryWeights.has(candidateCategoryKey)) {
            const categoryWeight = categoryWeights.get(candidateCategoryKey) || 0;
            contentScore += 12 + categoryWeight * 2;
            matchedSignals.push('category');
        }

        const sharedTags = [];
        candidateTagKeys.forEach(tag => {
            if (!tagWeights.has(tag) || sharedTags.includes(tag) || sharedTags.length >= 3) return;
            sharedTags.push(tag);
            contentScore += 5 + (tagWeights.get(tag) || 0) * 1.6;
        });
        if (sharedTags.length) matchedSignals.push('tags');

        const preferredRange = Array.isArray(profile?.pricePreference?.preferredRange) ? profile.pricePreference.preferredRange : [];
        const averagePrice = Number(profile?.pricePreference?.average || 0);
        const candidatePrice = Number(candidate.price || 0);
        if (candidatePrice > 0 && preferredRange.length === 2) {
            const [lowerBound, upperBound] = preferredRange.map(value => Number(value) || 0);
            if (candidatePrice >= lowerBound && candidatePrice <= upperBound) {
                contentScore += 8;
                matchedSignals.push('price');
            } else if (averagePrice > 0 && Math.abs(candidatePrice - averagePrice) / averagePrice <= 0.35) {
                contentScore += 4;
                matchedSignals.push('price');
            }
        }

        const rating = Number(candidate.rating || 0);
        contentScore += Math.min(10, Math.max(0, rating) * 2);

        candidate.contentScore = Number(contentScore.toFixed(2));
        candidate.candidateScore = Number((Number(candidate.seedScore || 0) + candidate.contentScore).toFixed(2));
        candidate.coarseScore = candidate.candidateScore;
        candidate.matchedSignals = matchedSignals;
        return candidate;
    }

    function applyCandidateBusinessFilters(candidates, profile) {
        const purchasedBookIdSet = new Set(normalizeBookIdList(profile?.purchasedBookIds || []).map(value => String(value)));
        return (Array.isArray(candidates) ? candidates : []).filter(candidate => {
            const key = String(candidate?.bookId || '');
            const book = findBookById(candidate?.bookId);
            if (!key || !book) return false;
            if (purchasedBookIdSet.has(key)) return false;
            if (!isBookVisible(book)) return false;
            if (!String(book?.title || '').trim()) return false;
            return Number.isFinite(Number(book?.id));
        });
    }

    function rerankCandidatesForDiversity(candidates, limit = 18) {
        const pool = (Array.isArray(candidates) ? candidates : []).slice().sort((left, right) => (
            Number(right?.candidateScore || 0) - Number(left?.candidateScore || 0)
            || Number(right?.rating || 0) - Number(left?.rating || 0)
            || String(left?.title || '').localeCompare(String(right?.title || ''), 'zh-Hans-CN')
        ));
        const selected = [];
        const authorCounts = new Map();
        const categoryCounts = new Map();

        while (pool.length && selected.length < Math.max(1, Number(limit) || RECOMMENDATION_CANDIDATE_LIMIT)) {
            let bestIndex = 0;
            let bestScore = -Infinity;

            pool.forEach((candidate, index) => {
                const authorKey = normalizePreferenceKey(candidate?.author);
                const categoryKey = normalizePreferenceKey(candidate?.category);
                const authorPenalty = (authorCounts.get(authorKey) || 0) * 18;
                const categoryPenalty = (categoryCounts.get(categoryKey) || 0) * 6;
                const sourceBonus = (candidate?.recallSources || []).length > 1 ? 4 : 0;
                const adjustedScore = Number(candidate?.candidateScore || 0) - authorPenalty - categoryPenalty + sourceBonus;
                if (adjustedScore > bestScore) {
                    bestScore = adjustedScore;
                    bestIndex = index;
                }
            });

            const [chosen] = pool.splice(bestIndex, 1);
            selected.push(chosen);

            const authorKey = normalizePreferenceKey(chosen?.author);
            const categoryKey = normalizePreferenceKey(chosen?.category);
            if (authorKey) authorCounts.set(authorKey, (authorCounts.get(authorKey) || 0) + 1);
            if (categoryKey) categoryCounts.set(categoryKey, (categoryCounts.get(categoryKey) || 0) + 1);
        }

        return selected;
    }

    function buildRecommendationCandidates(profile, options = {}) {
        const targetLimit = Math.min(16, Math.max(12, Number(options?.limit) || RECOMMENDATION_CANDIDATE_LIMIT));
        const historyCandidates = collectHistoryRecallCandidates(profile, 6);
        const favoriteCandidates = collectFavoriteRecallCandidates(profile, 6);
        const cartCandidates = collectCartRecallCandidates(profile, 6);
        const purchaseCandidates = collectPurchaseRecallCandidates(profile, 6);
        const seedBookIds = [
            ...(profile?.recentViewedBookIds || []),
            ...(profile?.favoriteBookIds || []),
            ...(profile?.cartBookIds || []),
            ...(profile?.purchasedBookIds || [])
        ];
        const popularCandidates = collectPopularRecallCandidates(targetLimit, seedBookIds);

        let mergedCandidates = mergeDedupCandidates([
            purchaseCandidates,
            cartCandidates,
            favoriteCandidates,
            historyCandidates,
            popularCandidates
        ]);

        mergedCandidates = applyCandidateBusinessFilters(mergedCandidates, profile)
            .map(candidate => applyCandidateContentScore(candidate, profile))
            .filter(Boolean);

        if (mergedCandidates.length < targetLimit) {
            const additionalPopularCandidates = collectPopularRecallCandidates(targetLimit + 6, mergedCandidates.map(candidate => candidate.bookId));
            mergedCandidates = mergeDedupCandidates([mergedCandidates, additionalPopularCandidates]);
            mergedCandidates = applyCandidateBusinessFilters(mergedCandidates, profile)
                .map(candidate => applyCandidateContentScore(candidate, profile))
                .filter(Boolean);
        }

        return rerankCandidatesForDiversity(mergedCandidates, targetLimit).map((candidate, index) => ({
            ...candidate,
            candidateRank: index + 1,
            recallSources: Array.from(new Set(candidate.recallSources || [])),
            sourceBookIds: normalizeBookIdList(candidate.sourceBookIds || [])
        }));
    }

    function buildRecommendationRequestPayload(profile, candidates, options = {}) {
        const lang = String(options?.lang || getRecommendationLang()).trim() === 'en' ? 'en' : 'zh';
        const serializeRecommendationProfile = (sourceProfile, requestLang) => ({
            userId: sourceProfile?.isGuest ? 'guest' : 'authenticated_user',
            isGuest: Boolean(sourceProfile?.isGuest),
            recentViewedBookIds: normalizeBookIdList(sourceProfile?.recentViewedBookIds || []).slice(0, 8),
            favoriteBookIds: normalizeBookIdList(sourceProfile?.favoriteBookIds || []).slice(0, 12),
            purchasedBookIds: normalizeBookIdList(sourceProfile?.purchasedBookIds || []).slice(0, 12),
            preferredCategories: (Array.isArray(sourceProfile?.preferredCategories) ? sourceProfile.preferredCategories : []).map(item => ({
                name: String(item?.name || '').trim(),
                label: getLocalizedPreferenceLabel(item, requestLang),
                score: Number(item?.score || 0)
            })).filter(item => item.name),
            preferredAuthors: (Array.isArray(sourceProfile?.preferredAuthors) ? sourceProfile.preferredAuthors : []).map(item => ({
                name: String(item?.name || '').trim(),
                label: getLocalizedPreferenceLabel(item, requestLang),
                score: Number(item?.score || 0)
            })).filter(item => item.name),
            preferredTags: (Array.isArray(sourceProfile?.preferredTags) ? sourceProfile.preferredTags : []).map(item => ({
                name: String(item?.name || '').trim(),
                label: getLocalizedPreferenceLabel(item, requestLang),
                score: Number(item?.score || 0)
            })).filter(item => item.name),
            pricePreference: {
                bucket: String(sourceProfile?.pricePreference?.bucket || 'medium'),
                label: formatPricePreference(sourceProfile?.pricePreference, requestLang),
                average: Number(sourceProfile?.pricePreference?.average || 0),
                min: Number(sourceProfile?.pricePreference?.min || 0),
                max: Number(sourceProfile?.pricePreference?.max || 0),
                preferredRange: Array.isArray(sourceProfile?.pricePreference?.preferredRange) ? sourceProfile.pricePreference.preferredRange.slice(0, 2).map(value => Number(value) || 0) : [0, 0]
            },
            recentInterestSummary: normalizeRecommendationText(buildRecentInterestSummary(sourceProfile, requestLang), 80),
            profileConfidence: String(sourceProfile?.profileConfidence || 'low')
        });
        const serializeRecommendationCandidate = (candidate, requestLang) => {
            const sourceBook = findBookById(candidate?.bookId, { includeDisabled: true });
            const tagsZh = normalizeTextList(candidate?.content?.tagsZh);
            const tagsEn = normalizeTextList(candidate?.content?.tagsEn);
            const projectedContentSource = sourceBook || {
                title: String(candidate?.content?.titleZh || candidate?.title || '').trim(),
                titleEn: String(candidate?.content?.titleEn || candidate?.content?.title || candidate?.title || '').trim(),
                author: String(candidate?.content?.authorZh || candidate?.author || '').trim(),
                authorEn: String(candidate?.content?.authorEn || candidate?.content?.author || candidate?.author || '').trim(),
                description: String(candidate?.content?.descriptionZh || candidate?.description || '').trim(),
                descriptionEn: String(candidate?.content?.descriptionEn || candidate?.content?.description || candidate?.description || '').trim(),
                tags: tagsZh.length ? tagsZh : normalizeTextList(candidate?.tags),
                tagsEn: tagsEn.length ? tagsEn : normalizeTextList(candidate?.content?.tags || candidate?.tags)
            };
            const content = getRecommendationBookContent(projectedContentSource, requestLang);
            return {
                book_id: Number(candidate?.bookId),
                title: String(content?.title || candidate?.title || '').trim(),
                author: String(content?.author || candidate?.author || '').trim(),
                category: String(candidate?.category || '').trim(),
                price: Number(candidate?.price || 0),
                rating: Number(candidate?.rating || 0),
                tags: normalizeTextList(content?.tags).map(tag => String(tag || '').trim()).filter(Boolean).slice(0, 6),
                description: normalizeRecommendationText(content?.description || candidate?.description, 120),
                candidate_rank: Number(candidate?.candidateRank || 0),
                candidate_score: Number(candidate?.candidateScore || candidate?.coarseScore || 0),
                recall_sources: Array.from(new Set(candidate?.recallSources || [])).slice(0, 4),
                source_book_ids: normalizeBookIdList(candidate?.sourceBookIds || []).slice(0, 4)
            };
        };

        return {
            lang,
            scene: {
                name: 'homepage_recommendations_mvp',
                reason: String(options?.reason || 'init')
            },
            cacheScopeKey: String(options?.cacheScopeKey || '').trim(),
            profileHash: String(options?.profileHash || '').trim(),
            force: Boolean(options?.force),
            profile: serializeRecommendationProfile(profile, lang),
            candidates: (Array.isArray(candidates) ? candidates : []).map(candidate => (
                serializeRecommendationCandidate(candidate, lang)
            )).filter(candidate => Number.isFinite(candidate.book_id))
        };
    }

    async function fetchWithTimeout(url, options, timeoutMs) {
        const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
        const externalSignal = options?.signal;
        let timeoutId = null;
        let removeAbortListener = null;
        if (controller) {
            if (externalSignal) {
                if (externalSignal.aborted) {
                    controller.abort(externalSignal.reason);
                } else if (externalSignal.addEventListener) {
                    const onAbort = () => controller.abort(externalSignal.reason);
                    externalSignal.addEventListener('abort', onAbort, { once: true });
                    removeAbortListener = () => externalSignal.removeEventListener('abort', onAbort);
                }
            }
            timeoutId = window.setTimeout(() => controller.abort(new DOMException('Request timeout', 'AbortError')), Math.max(1, Number(timeoutMs) || 10000));
        }

        try {
            return await fetch(url, {
                ...(options || {}),
                signal: controller?.signal || externalSignal
            });
        } finally {
            if (timeoutId) window.clearTimeout(timeoutId);
            if (removeAbortListener) removeAbortListener();
        }
    }

    function getRecommendationApiUrl() {
        if (!SUPABASE_URL) return '';
        return `${SUPABASE_URL.replace(/\/$/, '')}/functions/v1/recommendations-rank`;
    }

    async function fetchLLMRecommendations(profile, candidates, options = {}) {
        const apiUrl = getRecommendationApiUrl();
        if (!apiUrl) throw new Error('Recommendation API URL is not configured');

        const bearerToken = String(options?.accessToken || '').trim() || await getCurrentSupabaseAccessToken();
        if (!bearerToken) {
            throw new Error('Recommendation API requires an authenticated session');
        }

        const response = await fetchWithTimeout(apiUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'apikey': SUPABASE_ANON_KEY,
                'Authorization': `Bearer ${bearerToken}`
            },
            body: JSON.stringify(buildRecommendationRequestPayload(profile, candidates, options)),
            signal: options?.signal
        }, 32000);

        const rawText = await response.text();
        let parsed;
        try {
            parsed = rawText ? JSON.parse(rawText) : {};
        } catch (e) {
            throw new Error('Recommendation API returned invalid JSON');
        }

        if (!response.ok) {
            const message = String(parsed?.error || parsed?.message || response.statusText || 'Recommendation API request failed');
            throw new Error(message);
        }

        return parsed;
    }

    function validateRecommendationApiItems(items, candidates) {
        const candidateMap = new Map((Array.isArray(candidates) ? candidates : []).map(candidate => [String(candidate?.bookId), candidate]));
        const seen = new Set();
        return (Array.isArray(items) ? items : []).map(item => {
            const bookId = normalizeBookIdValue(item?.book_id ?? item?.bookId);
            const key = String(bookId || '');
            const reason = normalizeRecommendationDisplayText(item?.reason);
            if (!key || !candidateMap.has(key) || seen.has(key) || !reason || !findBookById(bookId)) return null;
            seen.add(key);
            return {
                book_id: Number(bookId),
                reason
            };
        }).filter(Boolean);
    }

    function normalizeRecommendationApiResult(raw, candidates) {
        const items = validateRecommendationApiItems(raw?.items || raw?.result?.items, candidates);
        return {
            ok: items.length > 0,
            items,
            profileSummary: normalizeRecommendationDisplayText(
                raw?.profile_summary || raw?.profileSummary || raw?.summary || raw?.result?.profile_summary || raw?.result?.profileSummary,
            ),
            source: String(raw?.source || raw?.meta?.source || 'llm').trim() || 'llm',
            meta: {
                traceId: String(raw?.meta?.trace_id || raw?.trace_id || '').trim(),
                candidateCount: Number(raw?.meta?.candidate_count || (Array.isArray(candidates) ? candidates.length : 0)),
                message: String(raw?.meta?.message || raw?.message || '').trim(),
                cacheHit: Boolean(raw?.meta?.cache_hit),
                cacheTtlMs: Number(raw?.meta?.cache_ttl_ms || 0)
            }
        };
    }

    function mapRecommendationItemsToFrontend(items, lang = getRecommendationLang()) {
        return (Array.isArray(items) ? items : []).map((item, index) => ({
            id: index + 1,
            bookId: Number(item?.book_id),
            reason: normalizeRecommendationDisplayText(item?.reason) || getRecommendationText('fallback_reason_default', {}, lang)
        })).filter(item => Number.isFinite(item.bookId));
    }

    async function executeRecommendationRefresh({ force = false, reason = 'init', source = 'soft' } = {}) {
        const requestLang = getRecommendationLang();
        const requestToken = ++recommendationRequestToken;
        const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
        recommendationAbortController = controller;
        let profileHash = '';
        const applyIfLatest = callback => {
            if (requestToken !== recommendationRequestToken) return false;
            callback();
            return true;
        };
        const updateMeta = patch => saveRecommendationMetaState({
            ...recommendationMetaState,
            ...patch
        });

        try {
            updateMeta({
                lastAttemptAt: new Date().toISOString()
            });

            const profile = buildUserPreferenceProfile();
            const candidates = buildRecommendationCandidates(profile, { limit: RECOMMENDATION_CANDIDATE_LIMIT });
            profileHash = computeRecommendationProfileHash(profile, candidates, requestLang);
            updateMeta({
                lastProfileHash: profileHash
            });

            if (!candidates.length) {
                const emptyPayload = {
                    lang: requestLang,
                    recommendations: buildPopularFallbackRecommendations(RECOMMENDATION_FALLBACK_LIMIT, requestLang),
                    summary: getRecommendationText('summary_low_signal', {}, requestLang),
                    source: 'fallback_popular',
                    traceId: '',
                    profileHash
                };
                saveServedRecommendationCache(emptyPayload, RECOMMENDATION_SERVED_TTL_MS, requestLang);
                updateMeta({
                    dirty: false,
                    dirtyReasons: [],
                    lastSuccessfulRefreshAt: new Date().toISOString(),
                    lastServedSource: emptyPayload.source
                });
                applyIfLatest(() => applyRecommendationPayload(emptyPayload, { allowDirtyHint: false }));
                return {
                    ok: true,
                    source: emptyPayload.source,
                    recommendations: emptyPayload.recommendations
                };
            }

            const profileCacheKey = computeRecommendationProfileCacheKey(profile, candidates, requestLang);
            if (!force) {
                const cachedPayload = loadProfileRecommendationCache(profileCacheKey, requestLang);
                if (cachedPayload?.recommendations?.length) {
                    const profilePayload = {
                        ...cachedPayload,
                        lang: requestLang,
                        source: 'profile_cache',
                        profileHash
                    };
                    saveServedRecommendationCache(profilePayload, RECOMMENDATION_SERVED_TTL_MS, requestLang);
                    updateMeta({
                        dirty: false,
                        dirtyReasons: [],
                        lastSuccessfulRefreshAt: new Date().toISOString(),
                        lastServedSource: profilePayload.source,
                        lastProfileHash: profileHash
                    });
                    applyIfLatest(() => applyRecommendationPayload(profilePayload, { allowDirtyHint: false }));
                    return {
                        ok: true,
                        source: profilePayload.source,
                        traceId: profilePayload.traceId || '',
                        recommendations: profilePayload.recommendations
                    };
                }
            }

            const accessToken = await getCurrentSupabaseAccessToken();
            if (!accessToken) {
                const fallbackRecommendations = buildFallbackFromCandidates(candidates, RECOMMENDATION_FALLBACK_LIMIT, requestLang);
                const privateFallbackPayload = {
                    lang: requestLang,
                    recommendations: fallbackRecommendations.length ? fallbackRecommendations : buildPopularFallbackRecommendations(RECOMMENDATION_FALLBACK_LIMIT, requestLang),
                    summary: getRecommendationText('summary_auth_required', {}, requestLang),
                    source: fallbackRecommendations.length ? 'fallback_candidates' : 'fallback_popular',
                    traceId: '',
                    profileHash
                };
                saveServedRecommendationCache(privateFallbackPayload, RECOMMENDATION_FALLBACK_TTL_MS, requestLang);
                updateMeta({
                    dirty: false,
                    dirtyReasons: [],
                    lastSuccessfulRefreshAt: new Date().toISOString(),
                    lastServedSource: privateFallbackPayload.source,
                    lastProfileHash: profileHash
                });
                applyIfLatest(() => applyRecommendationPayload(privateFallbackPayload, { allowDirtyHint: false }));
                return {
                    ok: true,
                    source: privateFallbackPayload.source,
                    recommendations: privateFallbackPayload.recommendations,
                    authRequired: true
                };
            }

            try {
                const apiRawResult = await fetchLLMRecommendations(profile, candidates, {
                    reason,
                    force,
                    source,
                    cacheScopeKey: getRecommendationCacheScopeKey(requestLang),
                    profileHash,
                    accessToken,
                    signal: controller?.signal,
                    lang: requestLang
                });
                const normalizedResult = normalizeRecommendationApiResult(apiRawResult, candidates);
                const normalizedItems = normalizedResult.ok ? normalizedResult.items.slice(0, RECOMMENDATION_FALLBACK_LIMIT) : [];
                if (!normalizedItems.length) {
                    throw new Error(normalizedResult.meta?.message || 'Recommendation API returned no valid items');
                }

                let frontendRecommendations = mapRecommendationItemsToFrontend(normalizedItems, requestLang);
                if (frontendRecommendations.length < RECOMMENDATION_FALLBACK_LIMIT) {
                    const fallbackRecommendations = buildFallbackFromCandidates(candidates, RECOMMENDATION_FALLBACK_LIMIT, requestLang)
                        .filter(rec => !frontendRecommendations.some(existing => String(existing.bookId) === String(rec.bookId)));
                    frontendRecommendations = frontendRecommendations.concat(
                        fallbackRecommendations.slice(0, RECOMMENDATION_FALLBACK_LIMIT - frontendRecommendations.length)
                    ).map((item, index) => ({
                        ...item,
                        id: index + 1
                    }));
                }

                const summarySource = normalizedResult.source || 'llm';
                const isFallbackSource = summarySource === 'fallback';
                const responsePayload = {
                    lang: requestLang,
                    recommendations: frontendRecommendations.slice(0, RECOMMENDATION_FALLBACK_LIMIT),
                    summary: summarySource === 'llm'
                        ? (normalizedResult.profileSummary || getRecommendationText('summary_llm_default', { count: candidates.length }, requestLang))
                        : getRecommendationText('summary_server_fallback', {}, requestLang),
                    source: summarySource,
                    traceId: normalizedResult.meta?.traceId || '',
                    profileHash
                };

                saveServedRecommendationCache(responsePayload, isFallbackSource ? RECOMMENDATION_FALLBACK_TTL_MS : RECOMMENDATION_SERVED_TTL_MS, requestLang);
                if (!isFallbackSource) {
                    saveProfileRecommendationCache(profileCacheKey, responsePayload, requestLang);
                }

                updateMeta({
                    dirty: isFallbackSource ? true : false,
                    dirtyReasons: isFallbackSource ? recommendationMetaState.dirtyReasons : [],
                    lastSuccessfulRefreshAt: isFallbackSource ? recommendationMetaState.lastSuccessfulRefreshAt : new Date().toISOString(),
                    lastServedSource: responsePayload.source,
                    lastProfileHash: profileHash
                });
                applyIfLatest(() => applyRecommendationPayload(responsePayload, { allowDirtyHint: isFallbackSource }));
                return {
                    ok: true,
                    source: responsePayload.source,
                    traceId: responsePayload.traceId,
                    recommendations: responsePayload.recommendations,
                    meta: normalizedResult.meta
                };
            } catch (error) {
                if (error?.name === 'AbortError') {
                    throw error;
                }

                console.warn('Homepage recommendation refresh fallback:', error);
                const fallbackRecommendations = buildFallbackFromCandidates(candidates, RECOMMENDATION_FALLBACK_LIMIT, requestLang);
                const fallbackPayload = {
                    lang: requestLang,
                    recommendations: fallbackRecommendations.length ? fallbackRecommendations : buildPopularFallbackRecommendations(RECOMMENDATION_FALLBACK_LIMIT, requestLang),
                    summary: fallbackRecommendations.length
                        ? getRecommendationText('summary_local_fallback', {}, requestLang)
                        : getRecommendationText('summary_popular_recovered', {}, requestLang),
                    source: fallbackRecommendations.length ? 'fallback_candidates' : 'fallback_popular',
                    traceId: '',
                    profileHash
                };
                saveServedRecommendationCache(fallbackPayload, RECOMMENDATION_FALLBACK_TTL_MS, requestLang);
                updateMeta({
                    dirty: true,
                    dirtyReasons: recommendationMetaState.dirtyReasons,
                    lastServedSource: fallbackPayload.source,
                    lastProfileHash: profileHash
                });
                applyIfLatest(() => applyRecommendationPayload(fallbackPayload, { allowDirtyHint: true }));
                return {
                    ok: false,
                    source: fallbackPayload.source,
                    recommendations: fallbackPayload.recommendations,
                    error
                };
            }
        } catch (error) {
            if (error?.name === 'AbortError') {
                return {
                    ok: false,
                    source: 'aborted',
                    recommendations: normalizeFrontendRecommendationEntries(recommendations, requestLang),
                    aborted: true
                };
            }
            console.error('Refresh homepage recommendations failed:', error);
            const fallbackPayload = {
                lang: requestLang,
                recommendations: buildPopularFallbackRecommendations(RECOMMENDATION_FALLBACK_LIMIT, requestLang),
                summary: getRecommendationText('summary_popular_recovered', {}, requestLang),
                source: 'fallback_popular',
                traceId: '',
                profileHash
            };
            saveServedRecommendationCache(fallbackPayload, RECOMMENDATION_FALLBACK_TTL_MS, requestLang);
            updateMeta({
                dirty: true,
                dirtyReasons: recommendationMetaState.dirtyReasons,
                lastServedSource: fallbackPayload.source
            });
            applyIfLatest(() => applyRecommendationPayload(fallbackPayload, { allowDirtyHint: true }));
            return {
                ok: false,
                source: 'fallback_popular',
                recommendations: fallbackPayload.recommendations,
                error
            };
        } finally {
            if (recommendationAbortController === controller) {
                recommendationAbortController = null;
            }
        }
    }

    function requestRecommendationRefresh(options = {}) {
        const requestLang = getRecommendationLang();
        const requestOptions = {
            force: Boolean(options?.force),
            reason: String(options?.reason || 'manual').trim() || 'manual',
            source: String(options?.source || 'soft').trim() || 'soft'
        };
        const decision = shouldRefreshRecommendations(requestOptions);

        if (!requestOptions.force && recommendationRefreshPromise) {
            if (recommendationRefreshPromiseLang === requestLang) {
                return recommendationRefreshPromise;
            }
            if (recommendationAbortController) {
                recommendationAbortController.abort(new DOMException('Superseded by a language change', 'AbortError'));
            }
        }

        if (!requestOptions.force && decision.shouldUseServedCache && decision.servedPayload?.recommendations?.length) {
            applyRecommendationPayload(decision.servedPayload, {
                allowDirtyHint: true,
                servedCacheContinuation: true
            });
            if (!decision.shouldRequest) {
                return Promise.resolve({
                    ok: true,
                    source: decision.servedPayload.source || 'served_cache',
                    recommendations: decision.servedPayload.recommendations,
                    cache: 'served'
                });
            }
            if (decision.throttled) {
                return Promise.resolve({
                    ok: true,
                    source: decision.servedPayload.source || 'served_cache',
                    recommendations: decision.servedPayload.recommendations,
                    cache: 'served_stale'
                });
            }
        }

        if (requestOptions.force && recommendationAbortController) {
            recommendationAbortController.abort(new DOMException('Superseded by a forced refresh', 'AbortError'));
        }

        const refreshPromise = executeRecommendationRefresh(requestOptions).finally(() => {
            if (recommendationRefreshPromise === refreshPromise) {
                recommendationRefreshPromise = null;
                recommendationRefreshPromiseLang = '';
            }
        });
        recommendationRefreshPromise = refreshPromise;
        recommendationRefreshPromiseLang = requestLang;
        return refreshPromise;
    }

    async function bootstrapHomepageRecommendations() {
        recommendationMetaState = loadRecommendationMetaState();
        const servedPayload = loadServedRecommendationCache();
        if (servedPayload?.recommendations?.length) {
            applyRecommendationPayload(servedPayload, {
                allowDirtyHint: true,
                servedCacheContinuation: true
            });
            const servedExpired = isRecommendationPayloadExpired(servedPayload);
            if (!servedExpired && !recommendationMetaState?.dirty) {
                return {
                    ok: true,
                    source: servedPayload.source || 'served_cache',
                    recommendations: servedPayload.recommendations,
                    cache: 'served'
                };
            }

            requestRecommendationRefresh({ force: false, reason: 'init', source: 'bootstrap' }).catch(error => {
                console.warn('Bootstrap recommendation refresh failed:', error);
            });
            return {
                ok: true,
                source: servedPayload.source || 'served_cache',
                recommendations: servedPayload.recommendations,
                cache: servedExpired ? 'served_stale' : 'served'
            };
        }

        return requestRecommendationRefresh({ force: false, reason: 'init', source: 'bootstrap' });
    }

    function scheduleRecommendationRefresh(reason) {
        if (recommendationRefreshTimer) {
            window.clearTimeout(recommendationRefreshTimer);
        }
        const baseDelay = Math.max(250, Number(RECOMMENDATION_REFRESH_DEBOUNCE_MS) || 2500);
        recommendationRefreshTimer = window.setTimeout(() => {
            recommendationRefreshTimer = null;
            requestRecommendationRefresh({ force: false, reason, source: 'soft' });
        }, baseDelay);
    }
    
    // 初始化页面
    async function initPage() {
        currentUserId = await getCurrentSupabaseUserId();
        await loadFavoritesFromSupabase();
        await loadUserOrdersFromSupabase();
        await loadBookReviewsFromSupabase();
        await loadReviewHelpfulnessVotesFromSupabase();
        await loadCurrentUserReviewReportsFromSupabase();
        await loadSystemMessagesFromSupabase();
        browsingHistory = loadHistoryFromStorage();
        syncCartWithVisibleBooks();
        syncHistoryWithVisibleBooks();
        renderBooks(books);
        renderFavoritesSidebar();
        renderOrdersSidebar();
        renderHistorySidebar();
        renderSystemMessagesSidebar();
        renderCart();
        updateCartCount();
        calculateTotal();
        recommendationMetaState = loadRecommendationMetaState();
        await bootstrapHomepageRecommendations();

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
            showNotification(t('orders-guest-login-required', '游客无法查看订单，请登录后使用'), 'info');
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
            const displayTitle = getBookDisplayTitle(book);
            const displayAuthor = getBookDisplayAuthor(book);
            const displayDescription = getBookDisplayDescription(book);

            bookCard.innerHTML = `
                <div class="book-image" style="${getBookBrowseCoverStyle(book)}">
                    ${coverUrl ? '' : `<span style="color: white; font-weight: 500;">${escapeHtml((displayTitle || '').substring(0, 10))}${(displayTitle || '').length > 10 ? '...' : ''}</span>`}
                </div>
                <div class="book-content">
                    <div class="book-category">${escapeHtml(getCategoryName(book.category))}</div>
                    <h3 class="book-title">${escapeHtml(displayTitle || t('book-title-untitled', '未命名图书'))}</h3>
                    <p class="book-author">${escapeHtml(displayAuthor || t('book-author-unknown', '未知作者'))}</p>
                    <p class="book-description">${escapeHtml(String(displayDescription || '').replace(/<[^>]+>/g, '').slice(0, 80) || t('book-description-empty', '暂无简介'))}</p>
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
            pagination.setAttribute('aria-label', '图书分页导航');

            const jumpToPage = (page) => {
                if (page < 1 || page > totalPages || page === currentPage) return;
                currentPage = page;
                renderBooks(booksToRender);
            };

            const createPageButton = ({ label, page, disabled = false, active = false, title = '' }) => {
                const btn = document.createElement('button');
                btn.type = 'button';
                btn.textContent = label;
                btn.className = 'pagination-btn';
                if (active) btn.classList.add('active');
                if (disabled) btn.classList.add('disabled');
                if (title) btn.title = title;
                btn.disabled = disabled;
                if (!disabled && Number.isFinite(page)) {
                    btn.addEventListener('click', () => jumpToPage(page));
                }
                return btn;
            };

            const buildPageItems = () => {
                if (totalPages <= 7) {
                    return Array.from({ length: totalPages }, (_, idx) => idx + 1);
                }

                const items = [1];
                const windowStart = Math.max(2, currentPage - 1);
                const windowEnd = Math.min(totalPages - 1, currentPage + 1);

                if (windowStart > 2) items.push('ellipsis-left');
                for (let page = windowStart; page <= windowEnd; page += 1) {
                    items.push(page);
                }
                if (windowEnd < totalPages - 1) items.push('ellipsis-right');

                items.push(totalPages);
                return items;
            };

            pagination.appendChild(createPageButton({
                label: '上一页',
                page: currentPage - 1,
                disabled: currentPage === 1,
                title: '上一页'
            }));

            buildPageItems().forEach(item => {
                if (typeof item === 'number') {
                    pagination.appendChild(createPageButton({
                        label: String(item),
                        page: item,
                        active: item === currentPage,
                        title: `第 ${item} 页`
                    }));
                    return;
                }

                const ellipsis = document.createElement('span');
                ellipsis.className = 'pagination-ellipsis';
                ellipsis.textContent = '...';
                pagination.appendChild(ellipsis);
            });

            pagination.appendChild(createPageButton({
                label: '下一页',
                page: currentPage + 1,
                disabled: currentPage === totalPages,
                title: '下一页'
            }));

            const info = document.createElement('span');
            info.className = 'pagination-info';
            info.textContent = `第 ${currentPage} / ${totalPages} 页`;
            pagination.appendChild(info);
        } else {
            pagination.removeAttribute('aria-label');
            pagination.innerHTML = '';
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
        if (!recommendationsGrid) return;
        renderRecommendationSummaryState();
        recommendationsGrid.innerHTML = '';

        if (!Array.isArray(recommendations) || !recommendations.length) {
            recommendationsGrid.innerHTML = `<div class="no-results"><p>${escapeHtml(getRecommendationText('empty'))}</p></div>`;
            return;
        }

        recommendations.forEach(rec => {
            const book = findBookById(rec.bookId);
            if (!book) return;
            const displayTitle = getBookDisplayTitle(book);
            const displayAuthor = getBookDisplayAuthor(book);
            const displayDescription = getBookDisplayDescription(book);
            
            const recommendationCard = document.createElement('div');
            recommendationCard.className = 'recommendation-card';
            recommendationCard.dataset.id = book.id;
            
            recommendationCard.innerHTML = `
                <div class="recommendation-header">
                    <p class="recommendation-reason"><i class="fas fa-lightbulb"></i> ${escapeHtml(rec.reason || '')}</p>
                    <div class="recommendation-badge">${escapeHtml(getRecommendationText('badge'))}</div>
                </div>
                <div class="book-category">${getCategoryName(book.category)}</div>
                <h3 class="book-title">${escapeHtml(displayTitle)}</h3>
                <p class="book-author">${escapeHtml(displayAuthor)}</p>
                <p class="book-description">${escapeHtml(displayDescription)}</p>
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

        if (!recommendationsGrid.children.length) {
            recommendationsGrid.innerHTML = `<div class="no-results"><p>${escapeHtml(getRecommendationText('empty'))}</p></div>`;
            return;
        }
        
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
            cartItemsContainer.innerHTML = `<div class="empty-cart"><p>${t('cart-empty', '购物车为空')}</p></div>`;
            return;
        }
        
        cart.forEach(item => {
            const book = findBookById(item.bookId);
            if (!book) return;
            const coverUrl = getBookBrowseCoverUrl(book);
            const displayTitle = getBookDisplayTitle(book);
            const displayAuthor = getBookDisplayAuthor(book);
            
            const cartItem = document.createElement('div');
            cartItem.className = 'cart-item';
            cartItem.dataset.id = item.id;
            
            cartItem.innerHTML = `
                <div class="cart-item-image cart-open-detail" data-book-id="${book.id}" role="button" tabindex="0" aria-label="${(t('cart-open-detail-aria-template', '查看《{title}》详情') || '查看《{title}》详情').replace('{title}', escapeHtml(displayTitle || t('book-title-untitled', '未命名图书')))}" style="${getBookBrowseCoverStyle(book)}">
                    ${coverUrl ? '' : `<span style="color: white; font-size: 12px; padding: 5px;">${escapeHtml((displayTitle || t('book-title-default', '图书')).substring(0, 6))}...</span>`}
                </div>
                <div class="cart-item-details">
                    <h4 class="cart-item-title cart-open-detail" data-book-id="${book.id}" role="button" tabindex="0">${escapeHtml(displayTitle || t('book-title-untitled', '未命名图书'))}</h4>
                    <p class="cart-item-author cart-open-detail" data-book-id="${book.id}" role="button" tabindex="0">${escapeHtml(displayAuthor || t('book-author-unknown', '未知作者'))}</p>
                    <div class="cart-item-meta cart-open-detail" data-book-id="${book.id}" role="button" tabindex="0" style="font-size:12px;color:var(--text-light);margin-bottom:8px;">${t('cart-click-detail', '点击查看详情')}</div>
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
            favoritesCountElement.textContent = `${favoriteBooks.length}${t('favorites-count-unit', ' 本')}`;
        }

        if (!favoriteBooks.length) {
            favoritesItemsContainer.innerHTML = `<div class="empty-cart"><p>${t('favorites-empty', '暂无收藏图书')}</p></div>`;
            return;
        }

        favoriteBooks.forEach(book => {
            const displayTitle = getBookDisplayTitle(book);
            const displayAuthor = getBookDisplayAuthor(book);
            const item = document.createElement('div');
            item.className = 'cart-item';
            item.dataset.id = book.id;
            item.innerHTML = `
                <div class="cart-item-image" style="background-color: ${sanitizeColor(book.color)}">
                    <span style="color: white; font-size: 12px; padding: 5px;">${escapeHtml((displayTitle || t('book-title-default', '图书')).substring(0, 6))}...</span>
                </div>
                <div class="cart-item-details">
                    <h4 class="cart-item-title">${escapeHtml(displayTitle || t('book-title-untitled', '未命名图书'))}</h4>
                    <p class="cart-item-author">${escapeHtml(displayAuthor || t('book-author-unknown', '未知作者'))}</p>
                    <div class="cart-item-controls">
                        <div class="cart-item-price">¥ ${Number(book.price || 0).toFixed(2)}</div>
                        <button class="remove-item remove-favorite" data-id="${book.id}" title="${t('favorites-btn-active', '取消收藏')}">
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
        currentUserId = userId || currentUserId;
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
            showNotification(t('order-not-found', '未找到对应订单'), 'info');
        }
    }

    function renderOrdersSidebar() {
        if (!ordersItemsContainer) return;
        ordersItemsContainer.innerHTML = '';

        const filterBar = document.createElement('div');
        filterBar.className = 'orders-filter-bar';
        filterBar.innerHTML = `
            <button type="button" class="orders-filter-btn ${currentOrderFilter === 'all' ? 'active' : ''}" data-status="all">${t('books-filter-all')}</button>
            <button type="button" class="orders-filter-btn ${currentOrderFilter === 'pending' ? 'active' : ''}" data-status="pending">${t('order-status-pending')}</button>
            <button type="button" class="orders-filter-btn ${currentOrderFilter === 'hold' ? 'active' : ''}" data-status="hold">${t('order-status-hold')}</button>
            <button type="button" class="orders-filter-btn ${currentOrderFilter === 'shipped' ? 'active' : ''}" data-status="shipped">${t('order-status-shipped')}</button>
            <button type="button" class="orders-filter-btn ${currentOrderFilter === 'arrived' ? 'active' : ''}" data-status="arrived">${t('order-status-arrived')}</button>
            <button type="button" class="orders-filter-btn ${currentOrderFilter === 'received' ? 'active' : ''}" data-status="received">${t('order-status-received')}</button>
            <button type="button" class="orders-filter-btn ${currentOrderFilter === 'cancelled' ? 'active' : ''}" data-status="cancelled">${t('order-status-cancelled')}</button>
        `;

        if (ordersCountElement) {
            ordersCountElement.textContent = `${userOrders.length}${t('orders-count-unit', ' 单')}`;
        }

        if (isGuestUser()) {
            ordersItemsContainer.appendChild(filterBar);
            const guestEmpty = document.createElement('div');
            guestEmpty.className = 'empty-cart';
            guestEmpty.innerHTML = `<p>${t('orders-guest-login-required', '游客无法查看订单，请登录后使用')}</p>`;
            ordersItemsContainer.appendChild(guestEmpty);
            return;
        }

        ordersItemsContainer.appendChild(filterBar);

        if (!userOrders.length) {
            const empty = document.createElement('div');
            empty.className = 'empty-cart';
            empty.innerHTML = `<p>${t('orders-empty', '暂无订单记录')}</p>`;
            ordersItemsContainer.appendChild(empty);
            bindOrdersFilterButtons();
            return;
        }

        const filteredOrders = getFilteredUserOrders();
        if (!filteredOrders.length) {
            const empty = document.createElement('div');
            empty.className = 'empty-cart';
            empty.innerHTML = `<p>${t('orders-empty-filtered', '当前状态下暂无订单')}</p>`;
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
                ? `<ul style="margin:8px 0 0 18px;padding:0;">${order.items.map(product => `<li>${escapeHtml(getOrderItemDisplayTitle(product) || t('book-title-default', '图书'))} × ${Number(product.quantity || 0)}</li>`).join('')}</ul>`
                : `<div style="margin-top:8px;color:var(--text-light);">${t('order-items-missing', '该订单未记录商品明细')}</div>`;
            const canReceive = normalizeOrderStatus(order.status) === 'arrived';
            const isCancelled = normalizeOrderStatus(order.status) === 'cancelled';
            const remainingText = getOrderRemainingText(order);
            const pendingReviewCount = getOrderPendingReviewCount(order);
            const canReviewNow = normalizeOrderStatus(order.status) === 'received' && pendingReviewCount > 0;

            item.innerHTML = `
                <div class="cart-item-details order-open-detail" data-order-id="${order.id}" role="button" tabindex="0" style="width:100%;cursor:pointer;">
                    <h4 class="cart-item-title">${t('order-number-label', '订单号：')}${escapeHtml(order.poNumber || String(order.id))}</h4>
                    <p class="cart-item-author">${t('order-status-label', '状态：')}${escapeHtml(getOrderStatusLabel(order.status))}</p>
                    <div style="font-size:13px;color:var(--text-light);line-height:1.8;">
                        <div>${t('order-time-label', '下单时间：')}${escapeHtml(formatOrderDate(order.purchaseDate))}</div>
                        <div>${t('order-amount-label', '订单金额：')}¥ ${Number(order.totalAmount || 0).toFixed(2)}</div>
                        <div>${t('order-address-label', '收货地址：')}${escapeHtml(order.shippingAddress || '-')}</div>
                        <div>${t('order-shipped-time-label', '发货时间：')}${escapeHtml(formatOrderDate(order.shipmentDate))}</div>
                        <div>${t('order-arrived-time-label', '到货时间：')}${escapeHtml(formatOrderDate(order.arrivedDate))}</div>
                        <div>${t('order-received-time-label', '收货时间：')}${escapeHtml(formatOrderDate(order.receivedDate))}</div>
                        ${isCancelled && order.cancelDate ? `<div>${t('order-cancel-time-label', '取消时间：')}${escapeHtml(formatOrderDate(order.cancelDate))}</div>` : ''}
                        ${remainingText ? `<div style="color:#8b5e3c;">${escapeHtml(remainingText)}</div>` : ''}
                        ${canReviewNow ? `<div style="color:#8b5e3c;">${t('order-pending-review-label', '待评价图书：')}${pendingReviewCount}${t('favorites-count-unit', ' 本')}</div>` : ''}
                    </div>
                    <div style="margin-top:8px;font-size:12px;color:#8b5e3c;">${t('order-click-detail', '点击查看订单详情')}</div>
                    ${itemsHtml}
                    ${(canReceive || canReviewNow) ? `<div class="cart-item-controls" style="margin-top:10px;justify-content:flex-end;gap:8px;">${canReceive ? `<button class="btn btn-primary btn-confirm-received" data-id="${order.id}">${t('order-btn-received', '已收货')}</button>` : ''}${canReviewNow ? `<button class="btn btn-secondary btn-open-review" data-id="${order.id}">${t('order-btn-review', '去评价')}</button>` : ''}</div>` : ''}
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
                showNotification('已确认收货，请为订单内图书评分评价', 'success');
                openOrderDetail(orderId);
            });
        });

        ordersItemsContainer.querySelectorAll('.btn-open-review').forEach(button => {
            button.addEventListener('click', function(e) {
                e.stopPropagation();
                openOrderDetail(this.dataset.id, { focusReview: true });
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
                <button type="button" class="order-detail-close" data-role="close-order-detail" aria-label="${t('order-detail-close-aria', '关闭订单详情')}">
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
        syncDetailOpenState();
    }

    function findExistingOrderBookReview(orderId, bookId) {
        const targetOrderId = String(orderId || '').trim();
        const targetBookId = Number(bookId);
        if (!targetOrderId || !Number.isFinite(targetBookId)) return null;

        const userKey = String(currentUserId || '').trim();
        return bookReviews.find(review => {
            if (String(review?.orderId || '').trim() !== targetOrderId) return false;
            if (Number(review?.bookId) !== targetBookId) return false;
            const reviewUserKey = String(review?.userId || '').trim();
            if (!userKey) return !reviewUserKey;
            return !reviewUserKey || reviewUserKey === userKey;
        }) || null;
    }

    function renderOrderReviewCard(order, item) {
        const bookId = Number(item?.bookId);
        const review = Number.isFinite(bookId) ? findExistingOrderBookReview(order.id, bookId) : null;
        const initialRating = clampRating(review?.rating || 0);
        const initialComment = String(review?.comment || '').trim();
        const initialMedia = normalizeReviewMediaList(review?.media);
        const moderationStatus = normalizeModerationStatus(review?.moderationStatus);
        const moderationHint = review
            ? (moderationStatus === 'approved'
                ? t('order-review-status-approved', '该评价已发布')
                : moderationStatus === 'pending'
                    ? t('order-review-status-pending', '该评价正在人工审核中，审核通过后会公开展示')
                    : moderationStatus === 'rejected'
                        ? `${t('order-review-status-rejected', '该评价未通过审核')}${review?.moderationReason ? `：${review.moderationReason}` : ''}`
                        : t('order-review-status-hidden', '该评价当前不可见'))
            : t('order-review-status-empty', '尚未提交评价');
        const canReviewOrder = normalizeOrderStatus(order?.status) === 'received';

        if (!Number.isFinite(bookId)) {
            return `
                <div class="order-review-card disabled">
                    <div class="order-review-header">
                        <strong>${escapeHtml(getOrderItemDisplayTitle(item) || t('book-title-default', '图书'))}</strong>
                        <span class="order-review-hint">${t('order-review-missing-bookid', '该商品缺少 bookId，无法关联评价')}</span>
                    </div>
                </div>
            `;
        }

        return `
            <div class="order-review-card ${canReviewOrder ? '' : 'disabled'}" data-order-id="${escapeHtml(order.id)}" data-book-id="${bookId}">
                <div class="order-review-header">
                    <strong>${escapeHtml(getOrderItemDisplayTitle(item) || t('book-title-default', '图书'))}</strong>
                    <span class="order-review-hint">${canReviewOrder ? (review ? t('order-review-hint-reviewed', '已评价，可修改，可补充图片/视频') : t('order-review-hint-prompt', '请为该图书评分，可选文字和图片/视频')) : t('order-review-hint-disabled', '订单未收货，暂不可评价')}</span>
                </div>
                <div class="order-review-stars" data-rating="${initialRating}">
                    ${[1, 2, 3, 4, 5].map(score => `<button type="button" class="order-review-star ${score <= initialRating ? 'active' : ''}" data-score="${score}" ${canReviewOrder ? '' : 'disabled'}><i class="fas fa-star"></i></button>`).join('')}
                </div>
                <textarea class="order-review-comment" rows="3" maxlength="300" placeholder="${t('order-review-comment-placeholder', '可选：写下你的评价（最多 300 字）')}" ${canReviewOrder ? '' : 'disabled'}>${escapeHtml(initialComment)}</textarea>
                <div class="order-review-media-block">
                    <div class="order-review-media-toolbar">
                        <button type="button" class="btn btn-outline btn-pick-review-media" ${canReviewOrder ? '' : 'disabled'}><i class="fas fa-photo-film"></i> ${t('order-review-media-pick-btn', '选择图片/视频')}</button>
                        <button type="button" class="btn btn-outline btn-clear-review-media" ${canReviewOrder && initialMedia.length ? '' : 'disabled'}><i class="fas fa-trash"></i> ${t('order-review-media-clear-btn', '清空附件')}</button>
                        <span class="order-review-media-status">${initialMedia.length ? t('order-review-media-status-added', '已添加 {count}/{max} 个附件').replace('{count}', String(initialMedia.length)).replace('{max}', String(REVIEW_MEDIA_MAX_FILES)) : t('order-review-media-status-empty', '支持图片/视频上传，最多 {max} 个附件').replace('{max}', String(REVIEW_MEDIA_MAX_FILES))}</span>
                    </div>
                    <input class="order-review-media-input" type="file" accept="image/*,video/*" multiple ${canReviewOrder ? '' : 'disabled'} hidden>
                    <div class="order-review-dropzone ${canReviewOrder ? '' : 'disabled'}" tabindex="0">
                        <i class="fas fa-cloud-upload-alt"></i>
                        <strong>${t('order-review-dropzone-title', '拖拽图片或视频到这里')}</strong>
                        <span>${t('order-review-dropzone-subtitle', '也可点击上方按钮直接选择，无需单独上传到存储桶')}</span>
                        <small>单张图片不超过 ${formatFileSize(REVIEW_MEDIA_MAX_IMAGE_BYTES)}，单个视频不超过 ${formatFileSize(REVIEW_MEDIA_MAX_VIDEO_BYTES)}</small>
                    </div>
                    <div class="order-review-media-grid">${renderReviewMediaItemsHtml(initialMedia, { removable: canReviewOrder, emptyText: '尚未添加评价图片或视频' })}</div>
                </div>
                <div class="order-review-actions">
                    <button type="button" class="btn btn-primary btn-submit-order-review" ${canReviewOrder ? '' : 'disabled'}>提交评价</button>
                    <span class="order-review-status">${review ? `当前评分：${initialRating} 分 · ${escapeHtml(getModerationStatusLabel(moderationStatus))}` : '尚未提交评价'}</span>
                </div>
                <div class="order-review-hint" style="margin-top:6px;">${escapeHtml(moderationHint)}</div>
            </div>
        `;
    }

    function bindOrderReviewInteractions(container) {
        if (!container) return;

        container.querySelectorAll('.order-review-card').forEach(card => {
            const orderId = String(card.dataset.orderId || '').trim();
            const bookId = Number(card.dataset.bookId);
            if (!orderId || !Number.isFinite(bookId)) return;

            const review = findExistingOrderBookReview(orderId, bookId);
            setOrderReviewMediaDraft(orderId, bookId, review?.media || []);
            renderOrderReviewMediaDraft(card);

            const pickButton = card.querySelector('.btn-pick-review-media');
            const clearButton = card.querySelector('.btn-clear-review-media');
            const input = card.querySelector('.order-review-media-input');
            const dropzone = card.querySelector('.order-review-dropzone');

            pickButton?.addEventListener('click', function() {
                if (this.disabled) return;
                input?.click();
            });

            clearButton?.addEventListener('click', function() {
                if (this.disabled) return;
                setOrderReviewMediaDraft(orderId, bookId, []);
                renderOrderReviewMediaDraft(card);
                this.disabled = true;
            });

            input?.addEventListener('change', async function() {
                await appendFilesToOrderReviewDraft(card, this.files);
                this.value = '';
                const nextMedia = getOrderReviewMediaDraft(orderId, bookId);
                if (clearButton) clearButton.disabled = !nextMedia.length;
            });

            ['dragenter', 'dragover'].forEach(eventName => {
                dropzone?.addEventListener(eventName, function(e) {
                    e.preventDefault();
                    e.stopPropagation();
                    if (card.classList.contains('disabled')) return;
                    this.classList.add('dragover');
                });
            });

            ['dragleave', 'dragend', 'drop'].forEach(eventName => {
                dropzone?.addEventListener(eventName, function(e) {
                    e.preventDefault();
                    e.stopPropagation();
                    this.classList.remove('dragover');
                });
            });

            dropzone?.addEventListener('drop', async function(e) {
                if (card.classList.contains('disabled')) return;
                await appendFilesToOrderReviewDraft(card, e.dataTransfer?.files);
                const nextMedia = getOrderReviewMediaDraft(orderId, bookId);
                if (clearButton) clearButton.disabled = !nextMedia.length;
            });

            dropzone?.addEventListener('click', function() {
                if (card.classList.contains('disabled')) return;
                input?.click();
            });

            dropzone?.addEventListener('keydown', function(e) {
                if (card.classList.contains('disabled')) return;
                if (e.key !== 'Enter' && e.key !== ' ') return;
                e.preventDefault();
                input?.click();
            });
        });

        container.querySelectorAll('.order-review-stars').forEach(starWrap => {
            const syncStars = (rating) => {
                starWrap.dataset.rating = String(rating);
                starWrap.querySelectorAll('.order-review-star').forEach(button => {
                    const score = Number(button.dataset.score || 0);
                    button.classList.toggle('active', score <= rating);
                });
            };

            starWrap.querySelectorAll('.order-review-star').forEach(button => {
                button.addEventListener('click', function() {
                    const score = clampRating(this.dataset.score);
                    if (!score) return;
                    syncStars(score);
                });
            });
        });

        container.querySelectorAll('.btn-submit-order-review').forEach(button => {
            button.addEventListener('click', async function() {
                const card = this.closest('.order-review-card');
                if (!card) return;

                const orderId = String(card.dataset.orderId || '').trim();
                const bookId = Number(card.dataset.bookId);
                const starWrap = card.querySelector('.order-review-stars');
                const rating = clampRating(starWrap?.dataset.rating);
                const comment = String(card.querySelector('.order-review-comment')?.value || '').trim();
                const media = getOrderReviewMediaDraft(orderId, bookId);

                if (!rating) {
                    showNotification('请先选择 1-5 分评分', 'info');
                    return;
                }

                if (!orderId || !Number.isFinite(bookId)) {
                    showNotification('评价提交失败：订单或图书信息异常', 'info');
                    return;
                }

                const reviewerName = String(sessionStorage.getItem('loginUsername') || sessionStorage.getItem('username') || '').trim() || '匿名用户';
                this.disabled = true;
                const result = await saveBookReviewToCloud({
                    orderId,
                    userId: currentUserId,
                    bookId,
                    rating,
                    comment,
                    media,
                    reviewerName
                });
                this.disabled = false;

                if (!result.ok) {
                    showNotification(`评价提交失败：${result.message}`, 'info');
                    return;
                }

                await loadBookReviewsFromSupabase();
                await loadSystemMessagesFromSupabase();
                renderBooks(books);
                markRecommendationDirty('review_update');
                renderOrdersSidebar();
                renderSystemMessagesSidebar();
                openOrderDetail(orderId, { focusReview: true });
                if (normalizeModerationStatus(result.moderationStatus) === 'pending') {
                    showNotification('评价已提交，内容触发自动审核，待管理员复核后发布', 'info');
                } else {
                    showNotification('评价提交成功，已正常发布并计入图书综合评分', 'success');
                }
            });
        });
    }

    function openOrderDetail(orderId, options = {}) {
        const order = userOrders.find(item => String(item.id) === String(orderId));
        if (!order) {
            showNotification('未找到该订单详情', 'info');
            return;
        }

        const modal = ensureOrderDetailModal();
        const body = modal.querySelector('.order-detail-body');
        if (!body) return;

        const statusLabel = getOrderStatusLabel(order.status);
        const remainingText = getOrderRemainingText(order);
        const items = Array.isArray(order.items) ? order.items : [];
        const isCancelled = normalizeOrderStatus(order.status) === 'cancelled';
        const canReviewOrder = normalizeOrderStatus(order.status) === 'received';
        const reviewableItems = items.filter(item => Number.isFinite(Number(item?.bookId)));
        const pendingReviewCount = getOrderPendingReviewCount(order);

        body.innerHTML = `
            <div class="order-detail-header">
                <span class="book-detail-category">${t('order-detail-title', '订单详情')}</span>
                <h2 id="order-detail-title" class="book-detail-title">${t('order-number-label', '订单号：')}${escapeHtml(order.poNumber || String(order.id))}</h2>
                <p class="book-detail-author">${t('order-detail-recipient', '收件人：')}${escapeHtml(order.customerName || '用户')}</p>
                <div class="book-detail-rating-row">
                    <span class="book-detail-price">¥ ${Number(order.totalAmount || 0).toFixed(2)}</span>
                    <span class="book-detail-rating"><i class="fas fa-box"></i> ${escapeHtml(statusLabel)}</span>
                </div>
                ${remainingText ? `<p class="book-detail-description" style="color:#8b5e3c;">${escapeHtml(remainingText)}</p>` : ''}
            </div>
            <div class="book-detail-section">
                <h3>${t('order-detail-info', '订单信息')}</h3>
                <div class="book-detail-meta-grid">
                    <div class="book-detail-meta-item"><span class="book-detail-meta-label">${t('order-time-label', '下单时间：').replace(/：$/, '')}</span><strong class="book-detail-meta-value">${escapeHtml(formatOrderDate(order.purchaseDate))}</strong></div>
                    <div class="book-detail-meta-item"><span class="book-detail-meta-label">${t('order-payment-method-label', '支付方式')}</span><strong class="book-detail-meta-value">${escapeHtml(order.paymentMethod || t('order-payment-method-unknown', '未记录'))}</strong></div>
                    <div class="book-detail-meta-item"><span class="book-detail-meta-label">${t('order-shipped-time-label', '发货时间：').replace(/：$/, '')}</span><strong class="book-detail-meta-value">${escapeHtml(formatOrderDate(order.shipmentDate))}</strong></div>
                    <div class="book-detail-meta-item"><span class="book-detail-meta-label">${t('order-arrived-time-label', '到货时间：').replace(/：$/, '')}</span><strong class="book-detail-meta-value">${escapeHtml(formatOrderDate(order.arrivedDate))}</strong></div>
                    <div class="book-detail-meta-item"><span class="book-detail-meta-label">${t('order-received-time-label', '收货时间：').replace(/：$/, '')}</span><strong class="book-detail-meta-value">${escapeHtml(formatOrderDate(order.receivedDate))}</strong></div>
                    ${isCancelled && order.cancelDate ? `<div class="book-detail-meta-item"><span class="book-detail-meta-label">${t('order-cancel-time-label', '取消时间：').replace(/：$/, '')}</span><strong class="book-detail-meta-value">${escapeHtml(formatOrderDate(order.cancelDate))}</strong></div>` : ''}
                    <div class="book-detail-meta-item"><span class="book-detail-meta-label">${t('order-address-label', '收货地址：').replace(/：$/, '')}</span><strong class="book-detail-meta-value">${escapeHtml(order.shippingAddress || '-')}</strong></div>
                </div>
            </div>
            <div class="book-detail-section">
                <h3>${t('order-detail-products', '商品明细')}</h3>
                ${items.length ? `
                    <div class="order-detail-items">
                        ${items.map(product => `
                            <div class="order-detail-item">
                                <strong>${escapeHtml(getOrderItemDisplayTitle(product) || t('book-title-default', '图书'))}</strong>
                                <span>数量：${Number(product.quantity || 0)}</span>
                                <span>单价：¥ ${Number(product.price || 0).toFixed(2)}</span>
                                <span>小计：¥ ${Number(product.subtotal ?? (Number(product.price || 0) * Number(product.quantity || 0))).toFixed(2)}</span>
                            </div>
                        `).join('')}
                    </div>
                ` : `<p class="book-detail-description">${t('order-items-missing-period', '该订单未记录商品明细。')}</p>`}
            </div>
            <div class="book-detail-section" data-section="order-reviews">
                <h3>${t('order-detail-reviews', '用户评价')}</h3>
                <p class="book-detail-description">${canReviewOrder ? `请为本订单内图书逐本评分（可选评论），最高 5 分。${pendingReviewCount > 0 ? `还有 ${pendingReviewCount} 本待评价。` : '已全部评价完成。'}` : '订单签收后才能评价图书。'}</p>
                ${reviewableItems.length ? `
                    <div class="order-review-list">
                        ${reviewableItems.map(item => renderOrderReviewCard(order, item)).join('')}
                    </div>
                ` : '<p class="book-detail-description">该订单商品缺少图书编号，无法提交评价。</p>'}
            </div>
        `;

        bindOrderReviewInteractions(body);

        modal.classList.add('active');
        syncDetailOpenState();

        if (options.focusReview) {
            const reviewSection = body.querySelector('[data-section="order-reviews"]');
            reviewSection?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    }

    function renderHistorySidebar() {
        if (!historyItemsContainer) return;
        syncHistoryWithVisibleBooks();
        historyItemsContainer.innerHTML = '';

        if (historyCountElement) {
            historyCountElement.textContent = `${browsingHistory.length}${t('history-count-unit', ' 条')}`;
        }

        if (!browsingHistory.length) {
            historyItemsContainer.innerHTML = '<div class="empty-cart"><p>暂无浏览历史</p></div>';
            return;
        }

        browsingHistory.forEach(entry => {
            const sourceBook = findBookById(entry.id, { includeDisabled: true }) || entry;
            const displayTitle = getBookDisplayTitle(sourceBook);
            const displayAuthor = getBookDisplayAuthor(sourceBook);
            const item = document.createElement('div');
            item.className = 'cart-item';
            item.dataset.id = entry.id;
            item.innerHTML = `
                <div class="cart-item-image" style="background-color: ${sanitizeColor(entry.color)}">
                    <span style="color: white; font-size: 12px; padding: 5px;">${escapeHtml((displayTitle || t('book-title-default', '图书')).substring(0, 6))}...</span>
                </div>
                <div class="cart-item-details">
                    <h4 class="cart-item-title">${escapeHtml(displayTitle || t('book-title-untitled', '未命名图书'))}</h4>
                    <p class="cart-item-author">${escapeHtml(displayAuthor || t('book-author-unknown', '未知作者'))}</p>
                    <div style="font-size:13px;color:var(--text-light);">${t('history-view-time-label', '浏览时间：')}${escapeHtml(formatOrderDate(entry.viewedAt))}</div>
                    <div class="cart-item-controls">
                        <button class="btn btn-secondary history-open-btn" data-id="${entry.id}">${t('history-open-btn', '再次查看')}</button>
                        <button class="remove-item remove-history" data-id="${entry.id}" title="${t('history-remove-title', '移除记录')}">
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

    function renderSystemMessagesSidebar() {
        if (!systemMessagesItemsContainer) return;
        systemMessagesItemsContainer.innerHTML = '';
        updateSystemMessagesUnreadBadge();

        if (systemMessagesCountElement) {
            systemMessagesCountElement.textContent = `${systemMessages.length}${t('system-messages-count-unit', ' 条')}`;
        }

        if (!systemMessages.length) {
            systemMessagesItemsContainer.innerHTML = `<div class="empty-cart"><p>${t('system-messages-empty')}</p></div>`;
            return;
        }

        systemMessages.forEach(message => {
            const item = document.createElement('div');
            item.className = `cart-item system-message-item ${message.isRead ? 'read' : 'unread'}`;
            item.dataset.id = String(message.id);
            item.innerHTML = `
                <div class="cart-item-details" style="width:100%;">
                    <h4 class="cart-item-title">${escapeHtml(message.title || t('system-messages-default-title'))}</h4>
                    <div style="font-size:12px;color:#6b7280;margin-bottom:6px;">${escapeHtml(formatOrderDate(message.createdAt))}</div>
                    <div style="font-size:13px;line-height:1.7;color:#374151;">${escapeHtml(message.content || t('system-messages-no-content'))}</div>
                    <div class="cart-item-controls" style="justify-content:flex-end;">
                        <button class="btn btn-outline mark-system-message-read" data-id="${escapeHtml(message.id)}" ${message.isRead ? 'disabled' : ''}>${t('system-messages-mark-read')}</button>
                    </div>
                </div>
            `;
            systemMessagesItemsContainer.appendChild(item);
        });

        systemMessagesItemsContainer.querySelectorAll('.mark-system-message-read').forEach(button => {
            button.addEventListener('click', async function() {
                const messageId = String(this.dataset.id || '').trim();
                await markSystemMessageRead(messageId);
                systemMessages = systemMessages.map(item => String(item.id) === messageId ? { ...item, isRead: true } : item);
                renderSystemMessagesSidebar();
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
        if (refreshRecommendationsBtn) refreshRecommendationsBtn.addEventListener('click', async function() {
            if (recommendationRefreshTimer) {
                window.clearTimeout(recommendationRefreshTimer);
                recommendationRefreshTimer = null;
            }
            this.innerHTML = `<i class="fas fa-spinner fa-spin"></i> ${t('recommendations-refreshing') || '刷新中...'}`;
            this.disabled = true;

            try {
                const result = await requestRecommendationRefresh({ force: true, reason: 'manual_refresh', source: 'manual' });
                const feedback = getRecommendationRefreshToast(result);
                showNotification(feedback.message, feedback.type);
            } finally {
                this.innerHTML = `<i class="fas fa-sync-alt"></i> ${t('recommendations-refresh-btn') || '刷新推荐'}`;
                this.disabled = false;
            }
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
        if (closeSystemMessagesBtn) closeSystemMessagesBtn.addEventListener('click', closeSystemMessages);
        if (cartOverlay) cartOverlay.addEventListener('click', function() {
            closeCart();
            closeFavorites();
            closeOrders();
            closeHistory();
            closeSystemMessages();
        });
        
        // 清空购物车
        if (clearCartBtn) clearCartBtn.addEventListener('click', function() {
            if (isGuestUser()) {
                showNotification('游客无法操作购物车，请登录后使用', 'info');
                return;
            }

            if (cart.length === 0) return;

            const isEnglish = window.currentLang === 'en';
            const confirmText = isEnglish ? 'Are you sure you want to clear the cart?' : '确定要清空购物车吗？';
            if (confirm(confirmText)) {
                cart = [];
                persistCart();
                renderCart();
                updateCartCount();
                calculateTotal();
                markRecommendationDirty('cart_update');
                showNotification(isEnglish ? 'Cart cleared' : '购物车已清空', 'info');
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
                    showNotification(t('orders-guest-login-required', '游客无法查看订单，请登录后使用'), 'info');
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

        const mySystemMessagesLink = document.getElementById('my-system-messages-link');
        if (mySystemMessagesLink) {
            mySystemMessagesLink.addEventListener('click', async function(e) {
                e.preventDefault();
                if (isGuestUser()) {
                    showNotification(t('system-messages-guest-error'), 'info');
                    return;
                }
                await loadSystemMessagesFromSupabase();
                renderSystemMessagesSidebar();
                openSystemMessages();
            });
        }

        if (clearHistoryBtn) {
            clearHistoryBtn.addEventListener('click', function() {
                if (!browsingHistory.length) return;
                browsingHistory = [];
                persistHistory();
                renderHistorySidebar();
                markRecommendationDirty('history_update');
                showNotification(t('history-clear-success', '浏览历史已清空'), 'info');
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

                showNotification(t('logout-success-notice', '已退出登录，正在返回首页...'), 'info');
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

// 语言切换回调函数
window.onLanguageChanged = function(lang) {
    // 重新渲染购物车，避免切语言后必须手动刷新
    renderCart();
    // 重新渲染订单侧边栏以更新按钮文本
    renderOrdersSidebar();
    // 重新渲染收藏侧边栏（如果需要）
    renderFavoritesSidebar();
    // 重新渲染历史侧边栏（如果需要）
    renderHistorySidebar();
    // 重新渲染系统消息侧边栏（如果需要）
    renderSystemMessagesSidebar();
    // 重新按登录态刷新账号徽标，避免被 data-i18n 默认文案覆盖
    updateUserModeBadge();
    // 同步更新游客态按钮提示文案
    applyGuestUIRestrictions();

    if (recommendationAbortController) {
        recommendationAbortController.abort(new DOMException('Superseded by a language change', 'AbortError'));
    }
    recommendationMetaState = loadRecommendationMetaState();
    const servedPayload = loadServedRecommendationCache(getRecommendationLang());

    if (Array.isArray(searchFilterState.baseResults) && searchFilterState.baseResults.length && searchFilterState.lastQuery) {
        renderSearchResults(getSearchFilteredBooks(), searchFilterState.lastQuery);
    } else {
        renderBooks(books);
    }

    if (servedPayload?.recommendations?.length) {
        applyRecommendationPayload(servedPayload, {
            allowDirtyHint: true,
            servedCacheContinuation: true
        });
        const servedExpired = isRecommendationPayloadExpired(servedPayload);
        if (servedExpired || recommendationMetaState?.dirty) {
            requestRecommendationRefresh({ force: false, reason: 'language_switch', source: 'soft' }).catch(error => {
                console.warn('Recommendation refresh after language switch failed:', error);
            });
        }
    } else {
        recommendations = [];
        setRecommendationSummaryState(getRecommendationDefaultSummary(), 'idle', { allowDirtyHint: false });
        updateRecommendationRefreshTip();
        renderRecommendations();
        requestRecommendationRefresh({ force: false, reason: 'language_switch', source: 'soft' }).catch(error => {
            console.warn('Recommendation refresh after language switch failed:', error);
        });
    }

    const detailModal = document.getElementById('book-detail-modal');
    const modalBookId = Number(detailModal?.dataset?.bookId || activeBookDetailId || 0);
    if (detailModal?.classList.contains('active') && modalBookId) {
        openBookDetail(modalBookId, { skipHistory: true });
    }
};
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
                        <h2 class="section-title">${t('search-results-title', '搜索结果')}</h2>
                        <p class="section-subtitle" id="search-results-summary"> </p>
                    </div>
                    <button type="button" class="btn btn-outline" id="clear-search-results">${t('search-results-clear-btn', '清除搜索')}</button>
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
                    <div style="font-weight:700;color:#5c4937;margin-bottom:4px;">${t('search-filter-title', '搜索筛选')}</div>
                    <div style="font-size:13px;color:#7a6857;">${t('search-filter-subtitle', '不改动原搜索逻辑，仅对当前搜索结果做二次筛选')}</div>
                </div>
                <button type="button" class="btn btn-outline" id="reset-search-filters">${t('search-filter-reset-btn', '重置筛选')}</button>
            </div>
            <div style="display:flex;flex-wrap:wrap;gap:10px;margin-bottom:16px;">
                <label style="display:flex;align-items:center;gap:6px;padding:8px 12px;border:1px solid rgba(176,157,123,.35);border-radius:999px;cursor:pointer;background:${searchFilterState.mode === 'category-price' ? 'rgba(176,157,123,.15)' : 'transparent'};">
                    <input type="radio" name="search-filter-mode" value="category-price" ${searchFilterState.mode === 'category-price' ? 'checked' : ''}>
                    <span>${t('search-filter-mode-category-price', '类别 + 价格范围')}</span>
                </label>
                <label style="display:flex;align-items:center;gap:6px;padding:8px 12px;border:1px solid rgba(176,157,123,.35);border-radius:999px;cursor:pointer;background:${searchFilterState.mode === 'tags' ? 'rgba(176,157,123,.15)' : 'transparent'};">
                    <input type="radio" name="search-filter-mode" value="tags" ${searchFilterState.mode === 'tags' ? 'checked' : ''}>
                    <span>${t('search-filter-mode-tags', '一个或多个标签')}</span>
                </label>
            </div>
            <div id="category-price-filters" style="display:${searchFilterState.mode === 'category-price' ? 'block' : 'none'};">
                <div style="display:flex;flex-wrap:wrap;gap:12px;align-items:flex-end;">
                    <label style="display:flex;flex-direction:column;gap:6px;min-width:180px;">
                        <span style="font-size:13px;color:#6b5a49;">${t('search-filter-category-label', '类别')}</span>
                        <select id="search-filter-category" style="padding:10px 12px;border-radius:10px;border:1px solid rgba(176,157,123,.35);background:#fff;">
                            <option value="all">${t('search-filter-all-categories', '全部类别')}</option>
                            ${categories.map(category => `<option value="${escapeHtml(category)}" ${searchFilterState.category === category ? 'selected' : ''}>${escapeHtml(getCategoryName(category))}</option>`).join('')}
                        </select>
                    </label>
                    <label style="display:flex;flex-direction:column;gap:6px;min-width:140px;">
                        <span style="font-size:13px;color:#6b5a49;">${t('search-filter-min-price-label', '最低价格')}</span>
                        <input id="search-filter-min-price" type="number" min="0" step="0.01" placeholder="${t('search-filter-no-limit', '不限')}" value="${escapeHtml(searchFilterState.minPrice)}" style="padding:10px 12px;border-radius:10px;border:1px solid rgba(176,157,123,.35);background:#fff;">
                    </label>
                    <label style="display:flex;flex-direction:column;gap:6px;min-width:140px;">
                        <span style="font-size:13px;color:#6b5a49;">${t('search-filter-max-price-label', '最高价格')}</span>
                        <input id="search-filter-max-price" type="number" min="0" step="0.01" placeholder="${t('search-filter-no-limit', '不限')}" value="${escapeHtml(searchFilterState.maxPrice)}" style="padding:10px 12px;border-radius:10px;border:1px solid rgba(176,157,123,.35);background:#fff;">
                    </label>
                </div>
            </div>
            <div id="tag-filters" style="display:${searchFilterState.mode === 'tags' ? 'block' : 'none'};">
                <div style="font-size:13px;color:#6b5a49;margin-bottom:10px;">${t('search-filter-tags-tip', '可多选标签（同时满足）')}</div>
                <div style="display:flex;flex-wrap:wrap;gap:10px;">
                    ${tags.length ? tags.map(tag => `
                        <label style="display:inline-flex;align-items:center;gap:6px;padding:8px 12px;border-radius:999px;border:1px solid rgba(176,157,123,.35);background:${searchFilterState.selectedTags.includes(tag) ? 'rgba(176,157,123,.15)' : '#fff'};cursor:pointer;">
                            <input type="checkbox" class="search-filter-tag" value="${escapeHtml(tag)}" ${searchFilterState.selectedTags.includes(tag) ? 'checked' : ''}>
                            <span>${escapeHtml(tag)}</span>
                        </label>`).join('') : `<span style="color:#7a6857;">${t('search-filter-no-tags', '当前结果暂无可用标签')}</span>`}
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
        const isEnglish = window.currentLang === 'en';
        const allText = t('search-filter-all', '全部');
        const noLimitText = t('search-filter-no-limit', '不限');
        const filterLabelTags = t('search-filter-label-tags', '标签');
        const filterLabelCategory = t('search-filter-label-category', '类别');
        const filterLabelPrice = t('search-filter-label-price', '价格');
        const filterDescription = searchFilterState.mode === 'tags'
            ? (searchFilterState.selectedTags.length ? `${filterLabelTags}: ${searchFilterState.selectedTags.join(isEnglish ? ', ' : '、')}` : `${filterLabelTags}: ${allText}`)
            : `${filterLabelCategory}: ${searchFilterState.category === 'all' ? allText : getCategoryName(searchFilterState.category)}${isEnglish ? ', ' : '，'}${filterLabelPrice}: ${searchFilterState.minPrice || noLimitText} - ${searchFilterState.maxPrice || noLimitText}`;

        section.style.display = 'block';
        syncSearchFilterPanel(section);
        grid.innerHTML = '';
        summary.innerHTML = t('search-results-summary-template', '关键词“{query}”共找到 {base} 本图书；当前筛选后显示 {visible} 本。<br>筛选方式：{filter}。热门图书区域保留在下方，搜索结果与热门展示已分开。')
            .replace('{query}', safeQuery)
            .replace('{base}', String(baseCount))
            .replace('{visible}', String(visibleResults.length))
            .replace('{filter}', escapeHtml(filterDescription));

        if (!visibleResults.length) {
            grid.innerHTML = `<div class="no-results"><p>${t('search-results-empty', '没有找到相关图书，请尝试更换关键词。')}</p></div>`;
            section.scrollIntoView({ behavior: 'smooth', block: 'start' });
            return;
        }

        visibleResults.forEach(book => {
            const bookCard = document.createElement('div');
            bookCard.className = 'book-card';
            bookCard.dataset.id = book.id;
            bookCard.dataset.category = book.category;
            const coverUrl = getBookBrowseCoverUrl(book);
            const displayTitle = getBookDisplayTitle(book);
            const displayAuthor = getBookDisplayAuthor(book);
            const displayDescription = getBookDisplayDescription(book);

            bookCard.innerHTML = `
                <div class="book-image" style="${getBookBrowseCoverStyle(book)}">
                    ${coverUrl ? '' : `<span style="color: white; font-weight: 500;">${escapeHtml((displayTitle || t('book-title-default', '图书')).substring(0, 10))}${(displayTitle || '').length > 10 ? '...' : ''}</span>`}
                </div>
                <div class="book-content">
                    <div class="book-category">${escapeHtml(getCategoryName(book.category))}</div>
                    <h3 class="book-title">${escapeHtml(displayTitle || t('book-title-untitled', '未命名图书'))}</h3>
                    <p class="book-author">${escapeHtml(displayAuthor || t('book-author-unknown', '未知作者'))}</p>
                    <p class="book-description">${escapeHtml(String(displayDescription || '').replace(/<[^>]+>/g, '').slice(0, 80) || t('book-description-empty', '暂无简介'))}</p>
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
            showNotification(t('search-results-cleared-notice', '已清除搜索结果，下面仍显示热门图书'), 'info');
            return;
        }

        const keywords = query.split(/\s+/).filter(Boolean);
        const scoredBooks = getVisibleBooks(books).map(book => {
            const fields = [
                book.title,
                book.titleEn,
                book.author,
                book.authorEn,
                book.description,
                book.descriptionEn,
                getCategoryName(book.category),
                ...(normalizeTextList(book.tags)),
                ...(normalizeTextList(book.tagsEn)),
                book.publisher,
                book.publisherEn,
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
        showNotification(
            t('search-results-complete-notice-template', '搜索完成：找到 {count} 本相关图书，可继续按类别价格或标签筛选')
                .replace('{count}', String(searchFilterState.baseResults.length)),
            'info'
        );
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
        markRecommendationDirty('cart_update');
        const isEnglish = window.currentLang === 'en';
        const bookTitleSnippet = String(getBookDisplayTitle(book) || (isEnglish ? 'Untitled Book' : '未命名图书')).substring(0, 15);
        const addMessage = isEnglish
            ? `"${bookTitleSnippet}..." added to cart`
            : `"${bookTitleSnippet}..." 已添加到购物车`;
        showNotification(addMessage, 'success');
        
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
        markRecommendationDirty('cart_update');
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
        markRecommendationDirty('cart_update');
        
        if (book) {
            const isEnglish = window.currentLang === 'en';
            const bookTitleSnippet = String(getBookDisplayTitle(book) || (isEnglish ? 'Untitled Book' : '未命名图书')).substring(0, 15);
            const removeMessage = isEnglish
                ? `"${bookTitleSnippet}..." removed from cart`
                : `"${bookTitleSnippet}..." 已从购物车移除`;
            showNotification(removeMessage, 'info');
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
        closeSystemMessages();
        cartSidebar.classList.add('active');
        cartOverlay.classList.add('active');
        document.body.style.overflow = 'hidden';
    }
    
    // 关闭购物车
    function closeCart() {
        cartSidebar.classList.remove('active');
        if ((!favoritesSidebar || !favoritesSidebar.classList.contains('active')) && (!ordersSidebar || !ordersSidebar.classList.contains('active')) && (!historySidebar || !historySidebar.classList.contains('active')) && (!systemMessagesSidebar || !systemMessagesSidebar.classList.contains('active'))) {
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
        closeSystemMessages();
        favoritesSidebar?.classList.add('active');
        cartOverlay.classList.add('active');
        document.body.style.overflow = 'hidden';
    }

    function closeFavorites() {
        favoritesSidebar?.classList.remove('active');
        if (!cartSidebar.classList.contains('active') && (!ordersSidebar || !ordersSidebar.classList.contains('active')) && (!historySidebar || !historySidebar.classList.contains('active')) && (!systemMessagesSidebar || !systemMessagesSidebar.classList.contains('active'))) {
            cartOverlay.classList.remove('active');
            document.body.style.overflow = 'auto';
        }
    }

    function openOrders() {
        if (isGuestUser()) {
            showNotification(t('orders-guest-login-required', '游客无法查看订单，请登录后使用'), 'info');
            return;
        }
        closeCart();
        closeFavorites();
        closeHistory();
        closeSystemMessages();
        ordersSidebar?.classList.add('active');
        cartOverlay.classList.add('active');
        document.body.style.overflow = 'hidden';
    }

    function closeOrders() {
        ordersSidebar?.classList.remove('active');
        if (!cartSidebar.classList.contains('active') && (!favoritesSidebar || !favoritesSidebar.classList.contains('active')) && (!historySidebar || !historySidebar.classList.contains('active')) && (!systemMessagesSidebar || !systemMessagesSidebar.classList.contains('active'))) {
            cartOverlay.classList.remove('active');
            document.body.style.overflow = 'auto';
        }
    }

    function openHistory() {
        closeCart();
        closeFavorites();
        closeOrders();
        closeSystemMessages();
        historySidebar?.classList.add('active');
        cartOverlay.classList.add('active');
        document.body.style.overflow = 'hidden';
    }

    function closeHistory() {
        historySidebar?.classList.remove('active');
        if (!cartSidebar.classList.contains('active') && (!favoritesSidebar || !favoritesSidebar.classList.contains('active')) && (!ordersSidebar || !ordersSidebar.classList.contains('active')) && (!systemMessagesSidebar || !systemMessagesSidebar.classList.contains('active'))) {
            cartOverlay.classList.remove('active');
            document.body.style.overflow = 'auto';
        }
    }

    function openSystemMessages() {
        if (isGuestUser()) {
            showNotification(t('system-messages-guest-error'), 'info');
            return;
        }
        closeCart();
        closeFavorites();
        closeOrders();
        closeHistory();
        renderSystemMessagesSidebar();
        systemMessagesSidebar?.classList.add('active');
        cartOverlay.classList.add('active');
        document.body.style.overflow = 'hidden';
    }

    function closeSystemMessages() {
        systemMessagesSidebar?.classList.remove('active');
        if (!cartSidebar.classList.contains('active') && (!favoritesSidebar || !favoritesSidebar.classList.contains('active')) && (!ordersSidebar || !ordersSidebar.classList.contains('active')) && (!historySidebar || !historySidebar.classList.contains('active'))) {
            cartOverlay.classList.remove('active');
            document.body.style.overflow = 'auto';
        }
    }
    
    // 显示通知
    function showNotification(message, type) {
        if (window.currentLang === 'en' && typeof window.runtimeTranslateString === 'function') {
            message = window.runtimeTranslateString(message);
        }
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
            'all': t('books-filter-all'),
            'fiction': t('books-filter-fiction'),
            'nonfiction': t('books-filter-nonfiction'),
            'academic': t('books-filter-academic'),
            'children': t('books-filter-children')
        };
        
        return names[category] || category;
    }
    

    function escapeHtml(value) {
        return String(value ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
    }

    function sanitizeBookSummaryHtml(html) {
        const raw = String(html || '').trim();
        if (!raw) return '<p>暂无简介</p>';

        const wrapper = document.createElement('div');
        wrapper.innerHTML = raw;

        wrapper.querySelectorAll('script, iframe, object, embed, style, link').forEach(node => node.remove());

        wrapper.querySelectorAll('*').forEach(node => {
            [...node.attributes].forEach(attr => {
                const name = String(attr.name || '').toLowerCase();
                const value = String(attr.value || '').trim();

                if (name.startsWith('on')) {
                    node.removeAttribute(attr.name);
                    return;
                }

                if (['href', 'src'].includes(name) && /^javascript:/i.test(value)) {
                    node.removeAttribute(attr.name);
                    return;
                }

                if (name === 'target' && value === '_blank') {
                    node.setAttribute('rel', 'noopener noreferrer');
                }
            });
        });

        const sanitized = wrapper.innerHTML.trim();
        return sanitized || '<p>暂无简介</p>';
    }

    function getBookSummaryHtml(book) {
        const preferEnglish = isEnglishContentMode();
        const rawSummary = String(preferEnglish
            ? (book?.summaryHtmlEn ?? book?.summary_html_en ?? book?.summaryHtml ?? '')
            : (book?.summaryHtml ?? book?.summaryHtmlEn ?? book?.summary_html_en ?? '')).trim();
        if (rawSummary) return sanitizeBookSummaryHtml(rawSummary);

        const rawDescription = getBookDisplayDescription(book);
        if (/<[a-z][\s\S]*>/i.test(rawDescription)) {
            return sanitizeBookSummaryHtml(rawDescription);
        }

        const fallbackText = escapeHtml(String(rawDescription || t('book-description-empty', '暂无简介')).replace(/<[^>]+>/g, '').trim() || t('book-description-empty', '暂无简介'));
        return `<p>${fallbackText}</p>`;
    }

    function sanitizeColor(value) {
        const color = String(value || '').trim();
        if (/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(color)) return color;
        return '#b09d7b';
    }

    function createDefaultCoverImage(book) {
        const label = String(getBookDisplayTitle(book) || t('book-title-default', '图书')).slice(0, 12).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
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

    function getIntersectionCount(listA, listB) {
        const source = Array.isArray(listA) ? listA : [];
        const targetSet = new Set(Array.isArray(listB) ? listB : []);
        const seen = new Set();
        let count = 0;
        source.forEach(item => {
            if (!item || seen.has(item) || !targetSet.has(item)) return;
            seen.add(item);
            count += 1;
        });
        return count;
    }

    function getSharedItems(listA, listB, limit = 3) {
        const source = Array.isArray(listA) ? listA : [];
        const targetSet = new Set(Array.isArray(listB) ? listB : []);
        const seen = new Set();
        const shared = [];
        source.forEach(item => {
            if (!item || shared.length >= limit || seen.has(item) || !targetSet.has(item)) return;
            seen.add(item);
            shared.push(item);
        });
        return shared;
    }

    function calculatePriceClosenessScore(sourcePrice, candidatePrice) {
        const left = Number(sourcePrice);
        const right = Number(candidatePrice);
        if (!Number.isFinite(left) || !Number.isFinite(right) || left <= 0 || right <= 0) return 0;
        const ratio = Math.abs(left - right) / Math.max(left, right, 1);
        if (ratio <= 0.15) return 6;
        if (ratio <= 0.3) return 3;
        return 0;
    }

    function getBookSimilarityProfile(book) {
        const normalizeLowerTrim = value => String(value || '').trim().toLowerCase();
        const normalizedTags = normalizeTextList(book?.tags)
            .map(item => normalizeLowerTrim(item))
            .filter(Boolean);
        return {
            id: book?.id,
            author: normalizeLowerTrim(book?.author),
            category: normalizeLowerTrim(book?.category),
            publisher: normalizeLowerTrim(book?.publisher),
            price: Number(book?.price) || 0,
            tags: Array.from(new Set(normalizedTags))
        };
    }

    function getLocalizedSharedTags(sourceBook, candidateBook, limit = 3) {
        const maxCount = Math.max(1, Number(limit) || 3);
        const sourceTagMap = new Map();
        const candidateTags = getBookDisplayTags(candidateBook);

        getBookDisplayTags(sourceBook).forEach(tag => {
            const normalized = String(tag || '').trim().toLowerCase();
            if (!normalized || sourceTagMap.has(normalized)) return;
            sourceTagMap.set(normalized, String(tag || '').trim());
        });

        const shared = [];
        candidateTags.forEach(tag => {
            const normalized = String(tag || '').trim().toLowerCase();
            if (!normalized || !sourceTagMap.has(normalized) || shared.includes(sourceTagMap.get(normalized))) return;
            shared.push(sourceTagMap.get(normalized));
        });

        return shared.slice(0, maxCount);
    }

    function buildRelatedReason(match, sourceBook, candidateBook) {
        if (match?.sameAuthor) return t('related-book-reason-same-author', '同作者作品');
        const sharedTags = getLocalizedSharedTags(sourceBook, candidateBook, 3);
        if (sharedTags.length) {
            return t('related-book-reason-shared-tags', '共同标签：{tags}').replace('{tags}', sharedTags.join(isEnglishContentMode() ? ', ' : '、'));
        }
        if (match?.sameCategory) {
            return t('related-book-reason-same-category', '同属“{category}”分类')
                .replace('{category}', getCategoryName(candidateBook?.category || sourceBook?.category));
        }
        if (match?.samePublisher) return t('related-book-reason-same-publisher', '同出版社相关图书');
        if (Number(match?.priceClosenessScore) > 0) return t('related-book-reason-close-price', '价格区间接近，适合继续比较');
        return t('related-book-reason-general', '相关图书推荐');
    }

    function scoreRelatedBook(sourceBook, candidateBook) {
        if (!sourceBook || !candidateBook) {
            return { score: 0, reason: '', match: null };
        }
        if (String(sourceBook.id) === String(candidateBook.id)) {
            return { score: 0, reason: '', match: null };
        }
        if (!isBookVisible(candidateBook)) {
            return { score: 0, reason: '', match: null };
        }

        const sourceProfile = getBookSimilarityProfile(sourceBook);
        const candidateProfile = getBookSimilarityProfile(candidateBook);

        const sameAuthor = Boolean(sourceProfile.author) && sourceProfile.author === candidateProfile.author;
        const sameCategory = Boolean(sourceProfile.category) && sourceProfile.category === candidateProfile.category;
        const samePublisher = Boolean(sourceProfile.publisher) && sourceProfile.publisher === candidateProfile.publisher;
        const sharedTagCount = getIntersectionCount(sourceProfile.tags, candidateProfile.tags);
        const sharedTags = getSharedItems(sourceProfile.tags, candidateProfile.tags, 3);
        const hasCoreRelation = (
            sameAuthor
            || sameCategory
            || samePublisher
            || sharedTagCount > 0
        );

        if (!hasCoreRelation) {
            return { score: 0, reason: '', match: null };
        }

        const priceClosenessScore = calculatePriceClosenessScore(sourceProfile.price, candidateProfile.price);

        let score = 0;
        if (sameAuthor) score += 40;
        if (sameCategory) score += 20;
        if (samePublisher) score += 8;
        score += Math.min(sharedTagCount, 3) * 8;
        score += priceClosenessScore;

        const match = {
            sameAuthor,
            sameCategory,
            samePublisher,
            sharedTags,
            sharedTagCount,
            hasCoreRelation,
            priceClosenessScore
        };

        return {
            score,
            reason: buildRelatedReason(match, sourceBook, candidateBook),
            match
        };
    }

    function getRelatedBooks(sourceBook, limit = 4) {
        const maxCount = Math.max(1, Number(limit) || 4);
        if (!sourceBook) return [];

        const sourceId = String(sourceBook.id);
        const visibleBooks = getVisibleBooks(books);
        const getSortRating = book => {
            const aggregate = getBookAggregateRating(book?.id);
            if (Number.isFinite(aggregate) && aggregate > 0) return aggregate;
            const fallback = Number(book?.rating);
            return Number.isFinite(fallback) ? fallback : 0;
        };
        const titleSort = (left, right) => String(left?.title || '').localeCompare(String(right?.title || ''), 'zh-Hans-CN');

        const ranked = visibleBooks
            .filter(candidate => String(candidate?.id) !== sourceId)
            .map(candidate => {
                const result = scoreRelatedBook(sourceBook, candidate);
                return { book: candidate, ...result };
            })
            .filter(item => item.match && item.score > 0)
            .sort((a, b) => (
                b.score - a.score
                || getSortRating(b.book) - getSortRating(a.book)
                || titleSort(a.book, b.book)
            ));

        const selected = ranked.slice(0, maxCount);
        if (selected.length >= maxCount) return selected;

        const sourceCategory = String(sourceBook?.category || '').trim().toLowerCase();
        if (!sourceCategory) return selected;

        const pickedIds = new Set([sourceId, ...selected.map(item => String(item?.book?.id))]);
        const fallback = visibleBooks
            .filter(candidate => !pickedIds.has(String(candidate?.id)))
            .filter(candidate => String(candidate?.category || '').trim().toLowerCase() === sourceCategory)
            .sort((a, b) => (
                getSortRating(b) - getSortRating(a)
                || titleSort(a, b)
            ));

        fallback.forEach(candidate => {
            if (selected.length >= maxCount) return;
            const fallbackMatch = {
                sameAuthor: false,
                sameCategory: true,
                samePublisher: false,
                sharedTags: [],
                sharedTagCount: 0,
                priceClosenessScore: 0
            };
            selected.push({
                book: candidate,
                score: 20,
                reason: buildRelatedReason(fallbackMatch, sourceBook, candidate),
                match: fallbackMatch
            });
        });

        return selected;
    }

    function renderRelatedBooksSection(sourceBook) {
        const relatedBooks = getRelatedBooks(sourceBook, 4);
        if (!relatedBooks.length) return '';

        return `
            <div class="book-detail-section related-books-section" data-section="related-books">
                <div class="related-books-header">
                    <h3>${t('related-books-title', '相关图书')}</h3>
                    <p>${t('related-books-subtitle', '基于作者、分类与标签为你推荐')}</p>
                </div>
                <div class="related-books-grid">
                    ${relatedBooks.map(item => {
                        const relatedBook = item.book;
                        const coverUrl = getBookBrowseCoverUrl(relatedBook);
                        const displayTitle = getBookDisplayTitle(relatedBook);
                        const displayAuthor = getBookDisplayAuthor(relatedBook);
                        return `
                            <article class="related-book-card" data-book-id="${escapeHtml(relatedBook.id)}">
                                <div class="related-book-cover" style="${getBookBrowseCoverStyle(relatedBook)}">
                                    ${coverUrl ? '' : `<span>${escapeHtml((displayTitle || t('book-title-default', '图书')).slice(0, 10))}</span>`}
                                </div>
                                <div class="related-book-body">
                                    <div class="related-book-category">${escapeHtml(getCategoryName(relatedBook.category))}</div>
                                    <h4 class="related-book-title">${escapeHtml(displayTitle || t('book-title-untitled', '未命名图书'))}</h4>
                                    <p class="related-book-author">${escapeHtml(displayAuthor || t('book-author-unknown', '未知作者'))}</p>
                                    <p class="related-book-reason">${escapeHtml(item.reason || t('related-book-reason-default', '图书属性相近，值得继续浏览'))}</p>
                                    <div class="related-book-footer">
                                        <span class="related-book-price">¥ ${Number(relatedBook.price || 0).toFixed(2)}</span>
                                        <div class="related-book-actions">
                                            <button type="button" class="favorite-btn related-book-favorite ${isFavoriteBook(relatedBook.id) ? 'active' : ''} ${isGuestUser() ? 'disabled' : ''}" data-id="${escapeHtml(relatedBook.id)}" ${isGuestUser() ? 'disabled' : ''} aria-label="${t('related-book-favorite-aria', '收藏图书')}">
                                                <i class="${isFavoriteBook(relatedBook.id) ? 'fas' : 'far'} fa-heart"></i>
                                            </button>
                                            <button type="button" class="add-to-cart related-book-add-cart ${isGuestUser() ? 'disabled' : ''}" data-id="${escapeHtml(relatedBook.id)}" ${isGuestUser() ? 'disabled' : ''} aria-label="${t('related-book-add-cart-aria', '加入购物车')}">
                                                <i class="fas fa-cart-plus"></i>
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </article>
                        `;
                    }).join('')}
                </div>
            </div>
        `;
    }

    function bindRelatedBookInteractions(container) {
        if (!container) return;

        container.querySelectorAll('.related-book-card').forEach(card => {
            if (card.dataset.relatedDetailBound === '1') return;
            card.dataset.relatedDetailBound = '1';
            card.addEventListener('click', function(e) {
                if (e.target.closest('.related-book-favorite') || e.target.closest('.related-book-add-cart')) return;
                const bookId = this.dataset.bookId;
                if (!bookId) return;
                openBookDetail(bookId);
            });
        });

        container.querySelectorAll('.related-book-favorite').forEach(button => {
            if (button.dataset.relatedFavBound === '1') return;
            button.dataset.relatedFavBound = '1';
            button.addEventListener('click', function(e) {
                e.preventDefault();
                e.stopPropagation();
                if (isGuestUser()) {
                    showNotification('游客无法收藏，请登录后操作', 'info');
                    return;
                }
                toggleFavorite(this.dataset.id);
            });
        });

        container.querySelectorAll('.related-book-add-cart').forEach(button => {
            if (button.dataset.relatedCartBound === '1') return;
            button.dataset.relatedCartBound = '1';
            button.addEventListener('click', function(e) {
                e.preventDefault();
                e.stopPropagation();
                if (isGuestUser()) {
                    showNotification('游客无法使用购物车，请登录后操作', 'info');
                    return;
                }
                const bookId = Number(this.dataset.id);
                if (!Number.isFinite(bookId)) return;
                addToCart(bookId);
            });
        });
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
                <button type="button" class="book-detail-close" data-role="close-detail" aria-label="${t('book-detail-close-aria', '关闭详情页')}">
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

    function ensureReviewMediaGalleryModal() {
        let modal = document.getElementById('review-media-gallery-modal');
        if (modal) return modal;

        modal = document.createElement('div');
        modal.id = 'review-media-gallery-modal';
        modal.className = 'review-media-gallery-modal';
        modal.innerHTML = `
            <div class="review-media-gallery-overlay" data-role="close-review-media-gallery"></div>
            <div class="review-media-gallery-panel" role="dialog" aria-modal="true" aria-labelledby="review-media-gallery-title">
                <button type="button" class="review-media-gallery-close" data-role="close-review-media-gallery" aria-label="${t('review-media-gallery-close-aria', '关闭大图预览')}">
                    <i class="fas fa-times"></i>
                </button>
                <div class="review-media-gallery-header">
                    <strong id="review-media-gallery-title">${t('review-media-gallery-title', '评价附件预览')}</strong>
                    <span class="review-media-gallery-counter">1 / 1</span>
                </div>
                <div class="review-media-gallery-stage-wrap">
                    <button type="button" class="review-media-gallery-nav prev" aria-label="${t('common-prev', '上一张')}"><i class="fas fa-chevron-left"></i></button>
                    <div class="review-media-gallery-stage"></div>
                    <button type="button" class="review-media-gallery-nav next" aria-label="${t('common-next', '下一张')}"><i class="fas fa-chevron-right"></i></button>
                </div>
                <div class="review-media-gallery-thumbs"></div>
            </div>
        `;

        modal.addEventListener('click', function(e) {
            if (e.target.closest('[data-role="close-review-media-gallery"]')) {
                closeReviewMediaGallery();
            }
        });

        const prevButton = modal.querySelector('.review-media-gallery-nav.prev');
        const nextButton = modal.querySelector('.review-media-gallery-nav.next');
        prevButton?.addEventListener('click', () => modal._setIndex?.((Number(modal._currentIndex || 0) - 1)));
        nextButton?.addEventListener('click', () => modal._setIndex?.((Number(modal._currentIndex || 0) + 1)));

        const stageWrap = modal.querySelector('.review-media-gallery-stage-wrap');
        stageWrap?.addEventListener('touchstart', function(e) {
            const touch = e.changedTouches?.[0];
            modal._touchStartX = touch ? Number(touch.clientX) : null;
        }, { passive: true });
        stageWrap?.addEventListener('touchend', function(e) {
            const touch = e.changedTouches?.[0];
            const startX = Number(modal._touchStartX);
            const endX = touch ? Number(touch.clientX) : startX;
            if (!Number.isFinite(startX) || !Number.isFinite(endX)) return;
            const delta = endX - startX;
            if (Math.abs(delta) < 40) return;
            if (delta < 0) {
                modal._setIndex?.((Number(modal._currentIndex || 0) + 1));
            } else {
                modal._setIndex?.((Number(modal._currentIndex || 0) - 1));
            }
        }, { passive: true });

        document.addEventListener('keydown', function(e) {
            if (!modal.classList.contains('active')) return;
            if (e.key === 'Escape') {
                closeReviewMediaGallery();
                return;
            }
            if (e.key === 'ArrowRight') {
                modal._setIndex?.((Number(modal._currentIndex || 0) + 1));
            }
            if (e.key === 'ArrowLeft') {
                modal._setIndex?.((Number(modal._currentIndex || 0) - 1));
            }
        });

        document.body.appendChild(modal);
        return modal;
    }

    function openReviewMediaGallery(mediaList, startIndex = 0) {
        const items = normalizeReviewMediaList(mediaList);
        if (!items.length) return;

        const modal = ensureReviewMediaGalleryModal();
        const stage = modal.querySelector('.review-media-gallery-stage');
        const counter = modal.querySelector('.review-media-gallery-counter');
        const thumbs = modal.querySelector('.review-media-gallery-thumbs');
        const prevButton = modal.querySelector('.review-media-gallery-nav.prev');
        const nextButton = modal.querySelector('.review-media-gallery-nav.next');
        const title = modal.querySelector('#review-media-gallery-title');

        modal._items = items;
        modal._setIndex = nextIndex => {
            const galleryItems = Array.isArray(modal._items) ? modal._items : [];
            if (!galleryItems.length) return;

            const normalizedIndex = (Number(nextIndex) + galleryItems.length) % galleryItems.length;
            modal._currentIndex = normalizedIndex;
            const currentItem = galleryItems[normalizedIndex];
            const currentSrc = escapeHtml(sanitizeReviewMediaUrl(currentItem?.src));
            const currentName = escapeHtml(currentItem?.name || (currentItem?.kind === 'video' ? t('review-video-attachment', '视频附件') : t('review-image-attachment', '图片附件')));

            if (stage) {
                stage.innerHTML = currentItem?.kind === 'video'
                    ? `<video controls autoplay playsinline src="${currentSrc}"></video>`
                    : `<img src="${currentSrc}" alt="${currentName}">`;
            }

            if (title) {
                title.textContent = currentItem?.kind === 'video'
                    ? t('review-gallery-video-title', '评价视频预览')
                    : t('review-gallery-image-title', '评价图片预览');
            }

            if (counter) {
                counter.textContent = `${normalizedIndex + 1} / ${galleryItems.length}`;
            }

            if (thumbs) {
                thumbs.innerHTML = galleryItems.map((item, index) => {
                    const src = escapeHtml(sanitizeReviewMediaUrl(item?.src));
                    const label = escapeHtml(item?.name || (item?.kind === 'video' ? t('review-video-attachment', '视频附件') : t('review-image-attachment', '图片附件')));
                    return `
                        <button type="button" class="review-media-gallery-thumb ${index === normalizedIndex ? 'active' : ''}" data-index="${index}" aria-label="${(t('review-media-open-label-template', '查看{label}') || '查看{label}').replace('{label}', label)}">
                            ${item?.kind === 'video'
                                ? `<video muted playsinline preload="metadata" src="${src}"></video><span class="review-media-play-badge small"><i class="fas fa-play"></i></span>`
                                : `<img src="${src}" alt="${label}">`}
                        </button>
                    `;
                }).join('');

                thumbs.querySelectorAll('.review-media-gallery-thumb').forEach(button => {
                    button.addEventListener('click', function() {
                        modal._setIndex?.(Number(this.dataset.index || 0));
                    });
                });
            }

            if (prevButton) prevButton.disabled = galleryItems.length <= 1;
            if (nextButton) nextButton.disabled = galleryItems.length <= 1;
        };

        modal.classList.add('active');
        syncDetailOpenState();
        modal._setIndex(startIndex);
    }

    function closeReviewMediaGallery() {
        const modal = document.getElementById('review-media-gallery-modal');
        if (!modal) return;
        modal.classList.remove('active');
        syncDetailOpenState();
    }

    function getBookMetaRows(book) {
        const ratingStats = bookRatingStatsMap.get(String(book?.id));
        const displayAuthor = getBookDisplayAuthor(book);
        const displayPublisher = isEnglishContentMode()
            ? (String(book?.publisherEn ?? book?.publisher_en ?? '').trim() || String(book?.publisher || '').trim())
            : (String(book?.publisher || '').trim() || String(book?.publisherEn ?? book?.publisher_en ?? '').trim());
        const rows = [
            { label: t('book-detail-meta-category', '图书分类'), value: getCategoryName(book.category) },
            { label: t('book-detail-meta-author', '作者'), value: displayAuthor || t('book-author-unknown', '未知作者') },
            { label: t('book-detail-meta-rating', '评分'), value: hasBookRating(book) ? `${formatBookRating(book)} / 5.0` : t('book-rating-none', '暂无评分') },
            { label: t('book-detail-meta-price', '价格'), value: `¥ ${Number(book.price || 0).toFixed(2)}` }
        ];

        if (ratingStats?.count) {
            rows.push({ label: t('book-detail-meta-review-count', '评价人数'), value: `${Number(ratingStats.count)} ${t('book-detail-unit-people', '人')}` });
        }

        if (displayPublisher) rows.push({ label: t('book-detail-meta-publisher', '出版社'), value: displayPublisher });
        if (book.isbn) rows.push({ label: 'ISBN', value: book.isbn });
        const tags = getBookDisplayTags(book);
        if (tags.length) rows.push({ label: t('book-detail-meta-tags', '标签'), value: tags.join(' / ') });

        return rows;
    }

    function getBookReviewsForDisplay(bookId, limit = 12) {
        const targetBookId = Number(bookId);
        if (!Number.isFinite(targetBookId)) return [];
        return (Array.isArray(bookReviews) ? bookReviews : [])
            .filter(review => Number(review?.bookId) === targetBookId && Number(review?.rating) > 0 && normalizeModerationStatus(review?.moderationStatus) === 'approved')
            .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime())
            .slice(0, limit);
    }

    function getBookReviewHelpfulnessHint(review) {
        if (isOwnReview(review)) return t('book-review-hint-own', '这是你发布的评价，不能给自己投票');
        if (isGuestUser()) return t('book-review-hint-login-vote', '登录后可标记这条评价是否有帮助');
        if (!String(currentUserId || '').trim()) return t('book-review-hint-no-session-vote', '当前账号未建立云端会话，暂不可投票');
        return t('book-review-hint-question', '这条评价对你有帮助吗？');
    }

    function getReviewReportHint(review) {
        if (isOwnReview(review)) return t('book-report-hint-own', '这是你发布的评价，不能举报自己');
        if (isGuestUser()) return t('book-report-hint-login-report', '登录后可举报争议评论');
        if (!String(currentUserId || '').trim()) return t('book-report-hint-no-session-report', '当前账号未建立云端会话，暂不可举报');

        const report = currentUserReportedReviewMap.get(String(review?.id || '').trim());
        if (!report) return t('book-report-hint-new', '发现争议内容可发起举报');
        if (report.status === 'pending') return t('book-report-hint-pending', '你已举报，管理员处理中');
        if (report.status === 'resolved_hidden') return t('book-report-hint-hidden', '举报已处理：评论已被隐藏');
        if (report.status === 'resolved_rejected') return t('book-report-hint-rejected', '举报已处理：管理员驳回举报');
        return t('book-report-hint-edit', '你已提交过举报，可再次修改原因');
    }

    function renderBookReviewsSection(book) {
        const reviews = getBookReviewsForDisplay(book?.id, 12);
        if (!reviews.length) {
            return `<p class="book-detail-description">${t('book-reviews-empty', '暂无用户评价，欢迎购买后成为首位评价者。')}</p>`;
        }

        return `
            <div class="book-review-list">
                ${reviews.map(review => {
                    const rating = clampRating(review?.rating);
                    const createdText = review?.createdAt ? formatOrderDate(review.createdAt) : t('unknown-time', '时间未知');
                    const reviewerName = String(review?.reviewerName || '匿名用户').trim();
                    const comment = String(review?.comment || '').trim();
                    const media = normalizeReviewMediaList(review?.media);
                    const stats = getReviewHelpfulnessStats(review?.id);
                    const canVote = canVoteReviewHelpfulness(review);
                    const reviewId = escapeHtml(String(review?.id || ''));
                    const existingReport = currentUserReportedReviewMap.get(String(review?.id || '').trim());
                    const existingReasons = Array.isArray(existingReport?.reasons) ? existingReport.reasons : [];
                    const canReport = !isOwnReview(review) && !isGuestUser() && Boolean(String(currentUserId || '').trim());
                    return `
                        <div class="book-review-item">
                            <div class="book-review-header">
                                <strong>${escapeHtml(reviewerName)}</strong>
                                <span class="book-review-date">${escapeHtml(createdText)}</span>
                            </div>
                            <div class="book-review-rating">${[1, 2, 3, 4, 5].map(score => `<i class="fas fa-star ${score <= rating ? 'active' : ''}"></i>`).join('')}<span>${rating}.0 ${t('book-rating-unit', '分')}</span></div>
                            <p class="book-review-comment">${comment ? escapeHtml(comment) : t('book-review-comment-empty', '该用户仅评分，未填写评论。')}</p>
                            ${media.length ? `<div class="book-review-media-grid">${renderReviewMediaGalleryItemsHtml(media, review?.id)}</div>` : ''}
                            <div class="book-review-helpfulness">
                                <span class="book-review-helpfulness-label">${escapeHtml(getBookReviewHelpfulnessHint(review))}</span>
                                <div class="book-review-helpfulness-actions">
                                    <button type="button" class="review-helpfulness-btn helpful ${stats.currentUserVote === true ? 'active' : ''}" data-review-id="${reviewId}" data-helpful="true" ${canVote ? '' : 'disabled'}>
                                        <i class="fas fa-thumbs-up"></i>
                                        <span>${t('book-review-helpful', '有帮助')}</span>
                                        <strong>${stats.helpfulCount}</strong>
                                    </button>
                                    <button type="button" class="review-helpfulness-btn not-helpful ${stats.currentUserVote === false ? 'active' : ''}" data-review-id="${reviewId}" data-helpful="false" ${canVote ? '' : 'disabled'}>
                                        <i class="fas fa-thumbs-down"></i>
                                        <span>${t('book-review-not-helpful', '没帮助')}</span>
                                        <strong>${stats.notHelpfulCount}</strong>
                                    </button>
                                </div>
                            </div>
                            <div class="book-review-report">
                                <button type="button" class="btn btn-outline btn-open-review-report" data-review-id="${reviewId}" aria-expanded="false" ${isOwnReview(review) ? 'disabled' : ''}>${t('book-review-report-btn', '举报')}</button>
                                <div class="book-review-report-body" data-review-id="${reviewId}" hidden>
                                    <div class="book-review-helpfulness-label">${escapeHtml(getReviewReportHint(review))}</div>
                                    <form class="review-report-form" data-review-id="${reviewId}">
                                        <div class="review-report-reasons">
                                            ${[
                                                { value: 'violence', label: t('admin-reason-violence', '暴力/血腥') },
                                                { value: 'sexual', label: t('admin-reason-sexual', '色情/低俗') },
                                                { value: 'political', label: t('admin-reason-political', '政治敏感') },
                                                { value: 'malicious', label: t('admin-reason-malicious', '恶意攻击/辱骂') },
                                                { value: 'spam', label: t('admin-reason-spam', '广告/垃圾信息') },
                                                { value: 'other', label: t('admin-reason-other', '其他') }
                                            ].map(reason => `
                                                <label>
                                                    <input type="checkbox" name="report-reason" value="${reason.value}" ${existingReasons.includes(reason.value) ? 'checked' : ''}>
                                                    <span>${reason.label}</span>
                                                </label>
                                            `).join('')}
                                        </div>
                                        <textarea class="review-report-other" rows="2" maxlength="200" placeholder="${t('book-review-report-other-placeholder', '若选择“其他”，请填写具体原因')}">${escapeHtml(existingReport?.reasonOther || '')}</textarea>
                                        <div class="review-report-actions">
                                            <button type="submit" class="btn btn-primary" ${canReport ? '' : 'disabled'}>${t('book-review-report-submit', '提交举报')}</button>
                                            <button type="button" class="btn btn-outline btn-cancel-review-report">${t('common-cancel', '取消')}</button>
                                        </div>
                                    </form>
                                </div>
                            </div>
                        </div>
                    `;
                }).join('')}
            </div>
        `;
    }

    function renderBookReviewContent(container, book) {
        if (!container) return;
        container.innerHTML = renderBookReviewsSection(book);
        bindBookReviewHelpfulnessInteractions(container, book);
        bindBookReviewMediaInteractions(container, book);
        bindBookReviewReportInteractions(container, book);
    }

    function bindBookReviewReportInteractions(container, book) {
        if (!container) return;

        container.querySelectorAll('.btn-open-review-report').forEach(button => {
            button.addEventListener('click', function() {
                const reviewId = String(this.dataset.reviewId || '').trim();
                const reportBody = container.querySelector(`.book-review-report-body[data-review-id="${reviewId}"]`);
                if (!reportBody) return;
                const nextHidden = !reportBody.hidden;
                reportBody.hidden = nextHidden;
                this.setAttribute('aria-expanded', nextHidden ? 'false' : 'true');
                this.textContent = nextHidden ? t('book-review-report-btn', '举报') : t('book-review-report-collapse', '收起');
            });
        });

        container.querySelectorAll('.btn-cancel-review-report').forEach(button => {
            button.addEventListener('click', function() {
                const form = this.closest('.review-report-form');
                if (!form) return;
                const reportBody = form.closest('.book-review-report-body');
                if (reportBody) {
                    reportBody.hidden = true;
                    const reviewId = String(reportBody.dataset.reviewId || '').trim();
                    const toggleButton = container.querySelector(`.btn-open-review-report[data-review-id="${reviewId}"]`);
                    if (toggleButton) {
                        toggleButton.setAttribute('aria-expanded', 'false');
                        toggleButton.textContent = t('book-review-report-btn', '举报');
                    }
                }
            });
        });

        container.querySelectorAll('.review-report-form').forEach(form => {
            form.addEventListener('submit', async function(event) {
                event.preventDefault();

                if (isGuestUser()) {
                    showNotification('游客无法举报评论，请登录后再操作', 'info');
                    return;
                }

                if (!String(currentUserId || '').trim()) {
                    currentUserId = await getCurrentSupabaseUserId();
                }

                const reviewId = String(this.dataset.reviewId || '').trim();
                const review = getBookReviewsForDisplay(book?.id, 100).find(item => String(item?.id || '').trim() === reviewId);
                if (!review) {
                    showNotification('未找到对应评论，可能已更新，请刷新后重试', 'info');
                    return;
                }

                const reasons = Array.from(this.querySelectorAll('input[name="report-reason"]:checked')).map(input => String(input.value || '').trim());
                const otherReason = String(this.querySelector('.review-report-other')?.value || '').trim();

                const submitButton = this.querySelector('button[type="submit"]');
                if (submitButton) submitButton.disabled = true;
                const result = await submitReviewReportToCloud(review, reasons, otherReason);
                if (submitButton) submitButton.disabled = false;

                if (!result.ok) {
                    showNotification(`举报失败：${result.message}`, 'info');
                    return;
                }

                await loadCurrentUserReviewReportsFromSupabase();
                await loadSystemMessagesFromSupabase();
                renderBookReviewContent(container, book);
                renderSystemMessagesSidebar();
                showNotification('举报已提交，管理员将尽快处理', 'success');
            });
        });
    }

    function bindBookReviewMediaInteractions(container, book) {
        if (!container) return;

        container.querySelectorAll('.review-media-trigger').forEach(button => {
            button.addEventListener('click', function() {
                const reviewId = String(this.dataset.reviewId || '').trim();
                const mediaIndex = Number(this.dataset.mediaIndex || 0);
                const review = getBookReviewsForDisplay(book?.id, 100).find(item => String(item?.id || '').trim() === reviewId);
                const mediaList = normalizeReviewMediaList(review?.media);
                if (!mediaList.length) return;
                openReviewMediaGallery(mediaList, mediaIndex);
            });
        });
    }

    function bindBookReviewHelpfulnessInteractions(container, book) {
        if (!container) return;

        container.querySelectorAll('.review-helpfulness-btn').forEach(button => {
            button.addEventListener('click', async function() {
                if (!String(currentUserId || '').trim()) {
                    currentUserId = await getCurrentSupabaseUserId();
                }
                const reviewId = String(this.dataset.reviewId || '').trim();
                const helpfulFlag = this.dataset.helpful === 'true';
                const currentVote = getReviewHelpfulnessStats(reviewId).currentUserVote;

                if (currentVote === helpfulFlag) {
                    showNotification('你已经提交过这个反馈了', 'info');
                    return;
                }

                const actionWrap = this.closest('.book-review-helpfulness');
                actionWrap?.querySelectorAll('.review-helpfulness-btn').forEach(item => {
                    item.disabled = true;
                });

                const result = await saveReviewHelpfulnessVoteToCloud(reviewId, helpfulFlag);
                if (!result.ok) {
                    renderBookReviewContent(container, book);
                    showNotification(`反馈提交失败：${result.message}`, 'info');
                    return;
                }

                await loadReviewHelpfulnessVotesFromSupabase();
                renderBookReviewContent(container, book);
                showNotification('已记录这条评价的帮助反馈', 'success');
            });
        });
    }

    function openBookDetail(bookId, options = {}) {
        const { skipHistory = false } = options;
        const book = findBookById(bookId);
        if (!book) {
            showNotification('未找到该图书详情', 'info');
            return;
        }

        if (!skipHistory) {
            recordBrowsingHistory(book);
        }

        stopDetailGalleryAutoplay();

        const modal = ensureBookDetailModal();
        activeBookDetailId = Number(book.id) || null;
        modal.dataset.bookId = String(activeBookDetailId || '');
        const body = modal.querySelector('.book-detail-body');
        if (!body) return;

        const tags = getBookDisplayTags(book);
        const photoUrls = getBookPhotoUrls(book);
        const safeSummaryHtml = getBookSummaryHtml(book);
        const displayTitle = getBookDisplayTitle(book);
        const displayAuthor = getBookDisplayAuthor(book);
        const displayDescription = getBookDisplayDescription(book);
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
                            <img class="book-detail-cover-image" src="${photoUrls[0]}" alt="${escapeHtml(displayTitle || t('book-title-default', '图书'))} 图片 1">
                            <button type="button" class="book-gallery-nav next" aria-label="下一张图片"><i class="fas fa-chevron-right"></i></button>
                        ` : `<span>${escapeHtml(displayTitle || t('book-title-default', '图书'))}</span>`}
                    </div>
                    ${hasGallery && photoUrls.length > 1 ? `
                        <div class="book-detail-thumbs">
                            ${photoUrls.map((url, index) => `
                                <button type="button" class="book-detail-thumb ${index === 0 ? 'active' : ''}" data-index="${index}" aria-label="查看第 ${index + 1} 张图片">
                                    <img src="${url}" alt="${escapeHtml(displayTitle || t('book-title-default', '图书'))} 缩略图 ${index + 1}">
                                </button>
                            `).join('')}
                        </div>
                    ` : ''}
                </div>
                <div class="book-detail-summary">
                    <div class="book-detail-category">${escapeHtml(getCategoryName(book.category))}</div>
                    <h2 id="book-detail-title" class="book-detail-title">${escapeHtml(displayTitle || t('book-title-untitled', '未命名图书'))}</h2>
                    <p class="book-detail-author">${t('book-detail-author-prefix', '作者：')}${escapeHtml(displayAuthor || t('book-author-unknown', '未知作者'))}</p>
                    <div class="book-detail-rating-row">
                        <span class="book-detail-price">¥ ${Number(book.price || 0).toFixed(2)}</span>
                        <span class="book-detail-rating"><i class="fas fa-star"></i> ${formatBookRating(book)}</span>
                    </div>
                    <p class="book-detail-description">${escapeHtml(String(displayDescription || t('book-description-empty', '暂无简介')).replace(/<[^>]+>/g, ''))}</p>
                    <div class="book-detail-actions">
                        <button class="btn btn-primary detail-add-cart ${isGuestUser() ? 'disabled' : ''}" data-id="${book.id}" ${isGuestUser() ? 'disabled' : ''}>
                            <i class="fas fa-cart-plus"></i> ${t('book-detail-add-cart', '加入购物车')}
                        </button>
                        <button class="favorite-btn detail-favorite ${isFavoriteBook(book.id) ? 'active' : ''} ${isGuestUser() ? 'disabled' : ''}" data-id="${book.id}" ${isGuestUser() ? 'disabled' : ''}>
                            <i class="${isFavoriteBook(book.id) ? 'fas' : 'far'} fa-heart"></i>
                        </button>
                        <button class="btn btn-outline" type="button" data-role="close-detail">${t('book-detail-continue', '继续逛逛')}</button>
                    </div>
                </div>
            </div>
            <div class="book-detail-section">
                <h3>${t('book-detail-section-info', '图书信息')}</h3>
                <div class="book-detail-meta-grid">${metaRows}</div>
            </div>
            <div class="book-detail-section">
                <h3>${t('book-detail-section-description', '图书简介')}</h3>
                <div class="book-detail-richtext">${safeSummaryHtml}</div>
            </div>
            <div class="book-detail-section">
                <h3>${t('book-detail-section-highlights', '内容亮点')}</h3>
                <ul class="book-detail-highlights">
                    <li>${t('book-detail-highlight-category-prefix', '适合喜欢「')}${escapeHtml(getCategoryName(book.category))}${t('book-detail-highlight-category-suffix', '」内容的读者。')}</li>
                    <li>${hasBookRating(book) ? `${t('book-detail-highlight-rating-prefix', '当前读者评分为 ')}${formatBookRating(book)}${t('book-detail-highlight-rating-suffix', '，可作为选购参考。')}` : t('book-detail-highlight-no-rating', '当前暂无买家评分，欢迎首位读者完成购买后评价。')}</li>
                    <li>${t('book-detail-highlight-direct-cart', '页面支持直接加入购物车，无需返回列表页。')}</li>
                </ul>
            </div>
            ${tags.length ? `
            <div class="book-detail-section">
                <h3>${t('book-detail-section-tags', '关键词')}</h3>
                <div class="book-detail-tags">${tags.map(tag => `<span class="book-detail-tag">${escapeHtml(tag)}</span>`).join('')}</div>
            </div>` : ''}
            ${renderRelatedBooksSection(book)}
            <div class="book-detail-section" data-section="book-reviews">
                <h3>${t('book-detail-section-reviews', '用户评价')}</h3>
                <div data-role="book-review-content"></div>
            </div>
        `;

        renderBookReviewContent(body.querySelector('[data-role="book-review-content"]'), book);

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

        bindRelatedBookInteractions(body);

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
                    coverImage.alt = `${displayTitle || t('book-title-default', '图书')} 图片 ${currentPhotoIndex + 1}`;
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
        syncDetailOpenState();
    }

    function closeBookDetail() {
        const modal = document.getElementById('book-detail-modal');
        if (!modal) return;
        stopDetailGalleryAutoplay();
        modal.classList.remove('active');
        activeBookDetailId = null;
        delete modal.dataset.bookId;
        syncDetailOpenState();
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

        .book-detail-richtext {
            color: #374151;
            line-height: 1.8;
            word-break: break-word;
        }

        .book-detail-richtext p,
        .book-detail-richtext ul,
        .book-detail-richtext ol,
        .book-detail-richtext blockquote,
        .book-detail-richtext pre,
        .book-detail-richtext table,
        .book-detail-richtext h1,
        .book-detail-richtext h2,
        .book-detail-richtext h3,
        .book-detail-richtext h4 {
            margin: 0 0 12px;
        }

        .book-detail-richtext ul,
        .book-detail-richtext ol {
            padding-left: 20px;
        }

        .book-detail-richtext a {
            color: #8c5a30;
            text-decoration: underline;
        }

        .book-detail-richtext img {
            max-width: 100%;
            height: auto;
            border-radius: 10px;
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

        .related-books-header h3 {
            margin-bottom: 8px;
        }

        .related-books-header p {
            margin: 0;
            color: #6b7280;
            font-size: 14px;
        }

        .related-books-grid {
            margin-top: 16px;
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(190px, 1fr));
            gap: 14px;
        }

        .related-book-card {
            border: 1px solid rgba(15, 23, 42, 0.08);
            border-radius: 16px;
            overflow: hidden;
            background: #fff;
            cursor: pointer;
            display: grid;
            grid-template-rows: 150px 1fr;
            transition: transform 0.2s ease, box-shadow 0.2s ease;
        }

        .related-book-card:hover {
            transform: translateY(-2px);
            box-shadow: 0 12px 24px rgba(15, 23, 42, 0.12);
        }

        .related-book-cover {
            background-size: cover;
            background-position: center;
            display: flex;
            align-items: center;
            justify-content: center;
            color: #fff;
            font-weight: 600;
            text-align: center;
            padding: 10px;
        }

        .related-book-body {
            padding: 12px;
            display: grid;
            gap: 8px;
            align-content: start;
        }

        .related-book-category {
            display: inline-flex;
            align-items: center;
            width: fit-content;
            padding: 4px 10px;
            border-radius: 999px;
            background: rgba(140, 90, 48, 0.12);
            color: #8c5a30;
            font-size: 12px;
        }

        .related-book-title {
            margin: 0;
            font-size: 16px;
            color: #111827;
            line-height: 1.4;
        }

        .related-book-author {
            margin: 0;
            font-size: 13px;
            color: #4b5563;
        }

        .related-book-reason {
            margin: 0;
            font-size: 12px;
            color: #6b7280;
            line-height: 1.5;
            min-height: 36px;
        }

        .related-book-footer {
            display: flex;
            justify-content: space-between;
            align-items: center;
            gap: 8px;
            margin-top: 4px;
        }

        .related-book-price {
            color: #8c5a30;
            font-weight: 700;
            font-size: 16px;
        }

        .related-book-actions {
            display: inline-flex;
            align-items: center;
            gap: 8px;
        }

        .related-book-favorite {
            width: 34px;
            height: 34px;
            display: inline-flex;
            align-items: center;
            justify-content: center;
        }

        .related-book-add-cart {
            border: 1px solid rgba(140, 90, 48, 0.22);
            border-radius: 999px;
            padding: 6px 10px;
            font-size: 12px;
            background: rgba(140, 90, 48, 0.08);
            color: #8c5a30;
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

        .order-review-list,
        .book-review-list {
            display: grid;
            gap: 12px;
        }

        .order-review-card,
        .book-review-item {
            border: 1px solid rgba(15, 23, 42, 0.08);
            border-radius: 14px;
            padding: 14px;
            background: #fff;
        }

        .order-review-card.disabled {
            background: #f8f8f8;
            opacity: 0.8;
        }

        .order-review-header,
        .book-review-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            gap: 10px;
            margin-bottom: 8px;
            color: #4b5563;
        }

        .order-review-hint,
        .book-review-date {
            font-size: 12px;
            color: #6b7280;
        }

        .order-review-stars,
        .book-review-rating {
            display: flex;
            align-items: center;
            gap: 6px;
            margin-bottom: 8px;
            color: #9ca3af;
        }

        .order-review-star {
            border: none;
            background: transparent;
            color: inherit;
            cursor: pointer;
            font-size: 16px;
        }

        .order-review-star.active,
        .book-review-rating .fa-star.active {
            color: #f59e0b;
        }

        .order-review-comment,
        .book-review-comment {
            width: 100%;
            border: 1px solid rgba(15, 23, 42, 0.12);
            border-radius: 10px;
            padding: 10px;
            font: inherit;
            color: #374151;
            background: #fff;
            resize: vertical;
        }

        .book-review-comment {
            border: none;
            padding: 0;
            margin: 0;
        }

        .order-review-media-block {
            display: grid;
            gap: 12px;
            margin-top: 12px;
        }

        .order-review-media-toolbar {
            display: flex;
            gap: 10px;
            align-items: center;
            flex-wrap: wrap;
        }

        .order-review-media-status {
            color: #6b7280;
            font-size: 12px;
        }

        .order-review-dropzone {
            border: 1.5px dashed rgba(140, 90, 48, 0.35);
            border-radius: 14px;
            padding: 18px 16px;
            background: rgba(140, 90, 48, 0.04);
            color: #6b7280;
            display: grid;
            gap: 6px;
            justify-items: center;
            text-align: center;
            cursor: pointer;
            transition: all 0.2s ease;
        }

        .order-review-dropzone i {
            font-size: 24px;
            color: #8c5a30;
        }

        .order-review-dropzone.dragover {
            border-color: #8c5a30;
            background: rgba(140, 90, 48, 0.1);
            transform: translateY(-1px);
        }

        .order-review-dropzone.disabled {
            opacity: 0.65;
            cursor: not-allowed;
            background: #f8fafc;
        }

        .order-review-media-grid,
        .book-review-media-grid {
            display: grid;
            gap: 12px;
        }

        .order-review-media-grid {
            grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
        }

        .book-review-media-grid {
            grid-template-columns: repeat(auto-fit, minmax(88px, 88px));
            gap: 8px;
            justify-content: flex-start;
        }

        .review-media-item {
            border: 1px solid rgba(15, 23, 42, 0.08);
            border-radius: 14px;
            padding: 10px;
            background: #fff;
            display: grid;
            gap: 8px;
        }

        .review-media-trigger {
            border: 1px solid rgba(15, 23, 42, 0.08);
            cursor: zoom-in;
            width: 100%;
            text-align: left;
            font: inherit;
        }

        .review-media-preview {
            border-radius: 12px;
            overflow: hidden;
            background: #f3f4f6;
            aspect-ratio: 4 / 3;
            display: flex;
            align-items: center;
            justify-content: center;
        }

        .review-media-preview img,
        .review-media-preview video {
            width: 100%;
            height: 100%;
            object-fit: cover;
            display: block;
            background: #111827;
        }

        .review-media-play-badge {
            position: absolute;
            inset: auto auto 8px 8px;
            width: 28px;
            height: 28px;
            border-radius: 50%;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            background: rgba(17, 24, 39, 0.75);
            color: #fff;
            pointer-events: none;
        }

        .review-media-play-badge.small {
            width: 22px;
            height: 22px;
            inset: auto auto 6px 6px;
            font-size: 11px;
        }

        .review-media-preview.video {
            position: relative;
        }

        .book-review-media-grid .review-media-item {
            padding: 4px;
            gap: 4px;
            border-radius: 10px;
        }

        .book-review-media-grid .review-media-preview {
            aspect-ratio: 1 / 1;
            border-radius: 8px;
        }

        .book-review-media-grid .review-media-meta {
            display: none;
        }

        .review-media-gallery-modal {
            position: fixed;
            inset: 0;
            z-index: 3600;
            display: none;
        }

        .review-media-gallery-modal.active {
            display: block;
        }

        .review-media-gallery-overlay {
            position: absolute;
            inset: 0;
            background: rgba(2, 6, 23, 0.84);
            backdrop-filter: blur(3px);
        }

        .review-media-gallery-panel {
            position: absolute;
            inset: 24px;
            display: grid;
            grid-template-rows: auto 1fr auto;
            gap: 14px;
            padding: 20px;
            border-radius: 24px;
            background: rgba(15, 23, 42, 0.96);
            color: #fff;
            box-shadow: 0 24px 80px rgba(15, 23, 42, 0.32);
        }

        .review-media-gallery-close {
            position: absolute;
            top: 16px;
            right: 16px;
            width: 42px;
            height: 42px;
            border: none;
            border-radius: 50%;
            background: rgba(255, 255, 255, 0.12);
            color: #fff;
            cursor: pointer;
        }

        .review-media-gallery-header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 12px;
            padding-right: 54px;
        }

        .review-media-gallery-counter {
            color: rgba(255, 255, 255, 0.72);
            font-size: 13px;
        }

        .review-media-gallery-stage-wrap {
            position: relative;
            display: grid;
            align-items: center;
            justify-items: center;
            min-height: 0;
        }

        .review-media-gallery-stage {
            width: 100%;
            height: 100%;
            min-height: 320px;
            display: flex;
            align-items: center;
            justify-content: center;
            overflow: hidden;
            border-radius: 18px;
            background: rgba(255, 255, 255, 0.04);
        }

        .review-media-gallery-stage img,
        .review-media-gallery-stage video {
            max-width: 100%;
            max-height: min(72vh, 820px);
            width: auto;
            height: auto;
            border-radius: 18px;
            object-fit: contain;
            background: #000;
        }

        .review-media-gallery-nav {
            position: absolute;
            top: 50%;
            transform: translateY(-50%);
            width: 44px;
            height: 44px;
            border: none;
            border-radius: 50%;
            background: rgba(255, 255, 255, 0.14);
            color: #fff;
            cursor: pointer;
            z-index: 1;
        }

        .review-media-gallery-nav.prev {
            left: 12px;
        }

        .review-media-gallery-nav.next {
            right: 12px;
        }

        .review-media-gallery-nav:disabled {
            opacity: 0.35;
            cursor: default;
        }

        .review-media-gallery-thumbs {
            display: flex;
            gap: 10px;
            overflow-x: auto;
            padding-bottom: 4px;
        }

        .review-media-gallery-thumb {
            position: relative;
            flex: 0 0 auto;
            width: 72px;
            height: 72px;
            padding: 0;
            border-radius: 12px;
            overflow: hidden;
            border: 2px solid transparent;
            background: rgba(255, 255, 255, 0.08);
            cursor: pointer;
        }

        .review-media-gallery-thumb.active {
            border-color: #f59e0b;
        }

        .review-media-gallery-thumb img,
        .review-media-gallery-thumb video {
            width: 100%;
            height: 100%;
            object-fit: cover;
            display: block;
            background: #000;
        }

        .review-media-meta {
            font-size: 12px;
            color: #6b7280;
            word-break: break-word;
        }

        .review-media-remove {
            border: none;
            background: rgba(239, 68, 68, 0.08);
            color: #b91c1c;
            border-radius: 10px;
            padding: 8px 10px;
            cursor: pointer;
            font-size: 12px;
        }

        .review-media-empty {
            border: 1px dashed rgba(15, 23, 42, 0.12);
            border-radius: 12px;
            padding: 16px;
            color: #6b7280;
            background: #fafafa;
            font-size: 13px;
            text-align: center;
        }

        .book-review-helpfulness {
            margin-top: 12px;
            display: grid;
            gap: 10px;
        }

        .book-review-report {
            margin-top: 10px;
            display: grid;
            gap: 8px;
            justify-items: start;
        }

        .btn-open-review-report {
            padding: 3px 10px;
            font-size: 12px;
            line-height: 1.3;
            border-radius: 999px;
            min-height: 28px;
        }

        .book-review-report-body {
            width: 100%;
            display: grid;
            gap: 8px;
        }

        .book-review-report-body[hidden] {
            display: none !important;
        }

        .review-report-form {
            border: 1px solid rgba(15, 23, 42, 0.08);
            border-radius: 12px;
            padding: 10px;
            display: grid;
            gap: 10px;
            background: #fdfcf8;
        }

        .review-report-reasons {
            display: flex;
            flex-wrap: wrap;
            gap: 8px 10px;
        }

        .review-report-reasons label {
            display: inline-flex;
            align-items: center;
            gap: 6px;
            font-size: 12px;
            color: #4b5563;
            padding: 6px 8px;
            border-radius: 999px;
            background: #fff;
            border: 1px solid rgba(15, 23, 42, 0.1);
        }

        .review-report-other {
            width: 100%;
            border: 1px solid rgba(15, 23, 42, 0.12);
            border-radius: 10px;
            padding: 8px 10px;
            font: inherit;
            resize: vertical;
            min-height: 56px;
            background: #fff;
        }

        .review-report-actions {
            display: flex;
            justify-content: flex-end;
            gap: 8px;
            flex-wrap: wrap;
        }

        .book-review-helpfulness-label {
            font-size: 12px;
            color: #6b7280;
        }

        .book-review-helpfulness-actions {
            display: flex;
            flex-wrap: wrap;
            gap: 10px;
        }

        .review-helpfulness-btn {
            border: 1px solid rgba(15, 23, 42, 0.12);
            background: #fff;
            color: #4b5563;
            border-radius: 999px;
            padding: 8px 14px;
            display: inline-flex;
            align-items: center;
            gap: 8px;
            cursor: pointer;
            transition: all 0.2s ease;
        }

        .review-helpfulness-btn strong {
            color: #111827;
            font-size: 13px;
        }

        .review-helpfulness-btn.active,
        .review-helpfulness-btn:not(:disabled):hover {
            border-color: rgba(140, 90, 48, 0.38);
            background: rgba(140, 90, 48, 0.08);
            color: #8c5a30;
        }

        .review-helpfulness-btn:disabled {
            cursor: not-allowed;
            opacity: 0.72;
            background: #f8fafc;
        }

        .system-message-item.unread {
            border-left: 3px solid #8c5a30;
            background: #fffaf0;
        }

        .system-message-item.read {
            opacity: 0.92;
        }

        .system-message-unread-badge {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            min-width: 18px;
            height: 18px;
            padding: 0 6px;
            margin-left: 6px;
            border-radius: 999px;
            background: #ef4444;
            color: #ffffff;
            font-size: 11px;
            line-height: 1;
            font-weight: 700;
            vertical-align: middle;
        }

        .system-message-unread-badge[hidden] {
            display: none !important;
        }

        .order-review-actions {
            margin-top: 10px;
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 10px;
            flex-wrap: wrap;
        }

        .order-review-status {
            color: #6b7280;
            font-size: 13px;
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

            .review-media-gallery-panel {
                inset: 10px;
                padding: 16px;
                border-radius: 18px;
            }

            .review-media-gallery-stage {
                min-height: 240px;
            }

            .review-media-gallery-stage img,
            .review-media-gallery-stage video {
                max-height: 60vh;
            }

            .review-media-gallery-nav {
                width: 38px;
                height: 38px;
            }

            .review-media-gallery-thumb {
                width: 60px;
                height: 60px;
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

        const mySystemMessagesLink = document.getElementById('my-system-messages-link');
        if (mySystemMessagesLink) {
            if (guest) {
                mySystemMessagesLink.classList.add('disabled');
                mySystemMessagesLink.setAttribute('title', t('system-messages-guest-error'));
            } else {
                mySystemMessagesLink.classList.remove('disabled');
                mySystemMessagesLink.removeAttribute('title');
            }
        }
    } catch (e) {
        // 忽略错误，保持页面可用
        console.error('applyGuestUIRestrictions error', e);
    }
}
