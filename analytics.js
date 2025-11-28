/**
 * Analytics and Error Tracking for After Patmos
 *
 * Improvements:
 * - No global fetch override (prevents breaking third-party scripts)
 * - Event debouncing for high-frequency events
 * - Performance metrics tracking (Core Web Vitals)
 * - Batch event sending support
 * - Better error context capture
 * - Session ID for event correlation
 *
 * Respects user privacy preferences and doesn't track sensitive data.
 */

(function() {
    'use strict';

    // Configuration
    const ANALYTICS_ENABLED = window.AFTER_PATMOS_CONFIG?.ENABLE_ANALYTICS || false;
    const DEBUG_MODE = window.AFTER_PATMOS_CONFIG?.DEBUG_MODE || false;
    const BATCH_SIZE = 10;
    const BATCH_INTERVAL = 30000; // 30 seconds
    const DEBOUNCE_DELAY = 100; // 100ms

    // Storage for events
    const analyticsQueue = [];
    const errorQueue = [];
    let batchTimer = null;

    // Generate session ID for event correlation
    const sessionId = generateSessionId();

    function generateSessionId() {
        try {
            // Try to get existing session ID
            let id = sessionStorage.getItem('analytics_session_id');
            if (!id) {
                id = 'sess_' + Date.now().toString(36) + Math.random().toString(36).substring(2, 9);
                sessionStorage.setItem('analytics_session_id', id);
            }
            return id;
        } catch {
            return 'sess_' + Date.now().toString(36);
        }
    }

    // Privacy: Check if user opted out
    function isOptedOut() {
        try {
            return localStorage.getItem('analytics_opt_out') === 'true';
        } catch {
            return false;
        }
    }

    // Opt out of analytics
    function optOut() {
        try {
            localStorage.setItem('analytics_opt_out', 'true');
            analyticsQueue.length = 0;
            errorQueue.length = 0;
        } catch {
            // Storage not available
        }
    }

    // Opt back in
    function optIn() {
        try {
            localStorage.removeItem('analytics_opt_out');
        } catch {
            // Storage not available
        }
    }

    // Sanitize sensitive data
    function sanitizeData(data) {
        if (!data || typeof data !== 'object') return data;

        const sanitized = { ...data };

        // Don't track full Ethereum addresses
        if (sanitized.address && typeof sanitized.address === 'string' && sanitized.address.length > 10) {
            sanitized.address = sanitized.address.substring(0, 6) + '...' + sanitized.address.slice(-4);
        }

        // Remove sensitive fields
        const sensitiveKeys = ['privateKey', 'secret', 'password', 'token', 'apiKey', 'signature'];
        for (const key of sensitiveKeys) {
            if (key in sanitized) {
                delete sanitized[key];
            }
        }

        // Recursively sanitize nested objects (one level deep)
        for (const [key, value] of Object.entries(sanitized)) {
            if (value && typeof value === 'object' && !Array.isArray(value)) {
                sanitized[key] = sanitizeData(value);
            }
        }

        return sanitized;
    }

    // Debounce function for high-frequency events
    function debounce(fn, delay) {
        let timeoutId;
        return function(...args) {
            clearTimeout(timeoutId);
            timeoutId = setTimeout(() => fn.apply(this, args), delay);
        };
    }

    // Throttle function for rate limiting
    function throttle(fn, limit) {
        let lastCall = 0;
        return function(...args) {
            const now = Date.now();
            if (now - lastCall >= limit) {
                lastCall = now;
                return fn.apply(this, args);
            }
        };
    }

    /**
     * Track a custom event
     * @param {string} eventName - Name of the event
     * @param {Object} properties - Event properties
     */
    function trackEvent(eventName, properties = {}) {
        if (!ANALYTICS_ENABLED || isOptedOut()) {
            return;
        }

        const event = {
            type: 'event',
            name: eventName,
            properties: sanitizeData(properties),
            timestamp: Date.now(),
            sessionId: sessionId,
            url: window.location.pathname,
            referrer: document.referrer ? new URL(document.referrer).pathname : null,
        };

        analyticsQueue.push(event);

        if (DEBUG_MODE) {
            console.log('[Analytics] Event tracked:', event);
        }

        // Limit queue size
        if (analyticsQueue.length > 100) {
            analyticsQueue.shift();
        }

        // Schedule batch send
        scheduleBatchSend();
    }

    // Debounced version for high-frequency events
    const trackEventDebounced = debounce(trackEvent, DEBOUNCE_DELAY);

    /**
     * Track an error
     * @param {Error|Object} error - Error object or error information
     * @param {Object} context - Additional context about the error
     */
    function trackError(error, context = {}) {
        const errorInfo = {
            type: 'error',
            message: error?.message || String(error),
            stack: error?.stack?.split('\n').slice(0, 5).join('\n'), // Limit stack trace
            name: error?.name || 'Error',
            context: sanitizeData(context),
            timestamp: Date.now(),
            sessionId: sessionId,
            url: window.location.pathname,
        };

        errorQueue.push(errorInfo);

        if (DEBUG_MODE) {
            console.error('[Analytics] Error tracked:', errorInfo);
        }

        // Limit queue size
        if (errorQueue.length > 50) {
            errorQueue.shift();
        }
    }

    /**
     * Track API errors (use this instead of wrapping global fetch)
     * @param {string} endpoint - API endpoint
     * @param {number} status - HTTP status code
     * @param {string} message - Error message
     * @param {number} duration - Request duration in ms
     */
    function trackAPIError(endpoint, status, message, duration = null) {
        trackError(
            {
                name: 'APIError',
                message: `${status}: ${message}`,
            },
            {
                type: 'api_error',
                endpoint: endpoint,
                status: status,
                duration: duration,
            }
        );
    }

    /**
     * Track API request (for monitoring)
     * @param {string} endpoint - API endpoint
     * @param {number} duration - Request duration in ms
     * @param {boolean} success - Whether request succeeded
     */
    function trackAPIRequest(endpoint, duration, success) {
        if (!ANALYTICS_ENABLED || isOptedOut()) return;

        trackEventDebounced('api_request', {
            endpoint: endpoint,
            duration: duration,
            success: success,
        });
    }

    /**
     * Track wallet connection events
     * @param {string} walletType - Type of wallet (metamask, walletconnect, etc.)
     * @param {string} address - Wallet address (will be sanitized)
     */
    function trackWalletConnection(walletType, address) {
        trackEvent('wallet_connected', {
            walletType: walletType,
            address: address,
        });
    }

    /**
     * Track wallet disconnection
     * @param {string} walletType - Type of wallet
     */
    function trackWalletDisconnection(walletType) {
        trackEvent('wallet_disconnected', {
            walletType: walletType,
        });
    }

    /**
     * Track claim attempts
     * @param {number} tokenId - Token ID being claimed
     * @param {number} observationLength - Length of observation text
     */
    function trackClaimAttempt(tokenId, observationLength) {
        trackEvent('claim_attempted', {
            tokenId: tokenId,
            observationLength: observationLength,
        });
    }

    /**
     * Track successful claims
     * @param {number} tokenId - Token ID claimed
     * @param {number} score - Guardian score
     */
    function trackClaimSuccess(tokenId, score) {
        trackEvent('claim_successful', {
            tokenId: tokenId,
            guardianScore: score,
        });
    }

    /**
     * Track claim rejections
     * @param {number} tokenId - Token ID attempted
     * @param {number} score - Guardian score
     * @param {boolean} softReject - Whether it was a soft rejection
     */
    function trackClaimRejection(tokenId, score, softReject = false) {
        trackEvent('claim_rejected', {
            tokenId: tokenId,
            guardianScore: score,
            softReject: softReject,
        });
    }

    /**
     * Track page views
     * @param {string} pageName - Name of the page
     */
    function trackPageView(pageName) {
        trackEvent('page_view', {
            page: pageName || window.location.pathname,
            title: document.title,
        });
    }

    /**
     * Track user interactions (clicks, form submissions, etc.)
     * @param {string} action - Action type (click, submit, etc.)
     * @param {string} element - Element identifier
     * @param {Object} metadata - Additional metadata
     */
    const trackInteraction = throttle((action, element, metadata = {}) => {
        trackEvent('interaction', {
            action: action,
            element: element,
            ...metadata,
        });
    }, 500); // Max once per 500ms

    /**
     * Track performance metrics (Core Web Vitals)
     */
    function trackPerformance() {
        if (!ANALYTICS_ENABLED || isOptedOut()) return;

        // Use Performance Observer for Core Web Vitals
        if ('PerformanceObserver' in window) {
            try {
                // Largest Contentful Paint (LCP)
                const lcpObserver = new PerformanceObserver((list) => {
                    const entries = list.getEntries();
                    const lastEntry = entries[entries.length - 1];
                    trackEvent('performance_lcp', {
                        value: Math.round(lastEntry.startTime),
                        element: lastEntry.element?.tagName,
                    });
                });
                lcpObserver.observe({ type: 'largest-contentful-paint', buffered: true });

                // First Input Delay (FID)
                const fidObserver = new PerformanceObserver((list) => {
                    const entries = list.getEntries();
                    entries.forEach(entry => {
                        trackEvent('performance_fid', {
                            value: Math.round(entry.processingStart - entry.startTime),
                            eventType: entry.name,
                        });
                    });
                });
                fidObserver.observe({ type: 'first-input', buffered: true });

                // Cumulative Layout Shift (CLS)
                let clsValue = 0;
                const clsObserver = new PerformanceObserver((list) => {
                    for (const entry of list.getEntries()) {
                        if (!entry.hadRecentInput) {
                            clsValue += entry.value;
                        }
                    }
                });
                clsObserver.observe({ type: 'layout-shift', buffered: true });

                // Report CLS on page hide
                window.addEventListener('visibilitychange', () => {
                    if (document.visibilityState === 'hidden' && clsValue > 0) {
                        trackEvent('performance_cls', {
                            value: Math.round(clsValue * 1000) / 1000,
                        });
                    }
                }, { once: true });

            } catch (e) {
                if (DEBUG_MODE) {
                    console.warn('[Analytics] Performance tracking not supported:', e);
                }
            }
        }

        // Basic timing metrics
        window.addEventListener('load', () => {
            setTimeout(() => {
                const timing = performance.timing;
                if (timing) {
                    trackEvent('performance_timing', {
                        dns: timing.domainLookupEnd - timing.domainLookupStart,
                        tcp: timing.connectEnd - timing.connectStart,
                        ttfb: timing.responseStart - timing.requestStart,
                        domLoad: timing.domContentLoadedEventEnd - timing.navigationStart,
                        fullLoad: timing.loadEventEnd - timing.navigationStart,
                    });
                }
            }, 0);
        });
    }

    /**
     * Setup global error handling (without wrapping fetch)
     */
    function setupGlobalErrorHandling() {
        // Catch unhandled JavaScript errors
        window.addEventListener('error', (event) => {
            // Ignore errors from browser extensions
            if (event.filename && (
                event.filename.includes('extension://') ||
                event.filename.includes('chrome-extension://') ||
                event.filename.includes('moz-extension://')
            )) {
                return;
            }

            trackError(event.error || {
                message: event.message,
                filename: event.filename,
                lineno: event.lineno,
                colno: event.colno,
            }, {
                type: 'unhandled_error',
            });
        });

        // Catch unhandled promise rejections
        window.addEventListener('unhandledrejection', (event) => {
            trackError(event.reason, {
                type: 'unhandled_promise_rejection',
            });
        });
    }

    /**
     * Schedule batch sending of events
     */
    function scheduleBatchSend() {
        if (batchTimer) return;

        batchTimer = setTimeout(() => {
            batchTimer = null;
            sendBatch();
        }, BATCH_INTERVAL);
    }

    /**
     * Send batch of events to analytics service
     */
    function sendBatch() {
        if (analyticsQueue.length === 0 && errorQueue.length === 0) return;

        const batch = {
            events: analyticsQueue.splice(0, BATCH_SIZE),
            errors: errorQueue.splice(0, BATCH_SIZE),
            sessionId: sessionId,
            timestamp: Date.now(),
        };

        if (DEBUG_MODE) {
            console.log('[Analytics] Would send batch:', batch);
            // In production, send to analytics service:
            // sendToAnalyticsService(batch);
        }

        // In production, implement actual sending:
        // navigator.sendBeacon('/api/analytics', JSON.stringify(batch));
    }

    /**
     * Flush all pending events (call before page unload)
     */
    function flush() {
        if (batchTimer) {
            clearTimeout(batchTimer);
            batchTimer = null;
        }
        sendBatch();
    }

    /**
     * Initialize analytics
     */
    function init() {
        if (!ANALYTICS_ENABLED || isOptedOut()) {
            if (DEBUG_MODE) {
                console.log('[Analytics] Analytics disabled or user opted out');
            }
            return;
        }

        setupGlobalErrorHandling();
        trackPerformance();

        // Track initial page view
        trackPageView(window.location.pathname);

        // Send events before page unload
        window.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'hidden') {
                flush();
            }
        });

        window.addEventListener('pagehide', flush);

        if (DEBUG_MODE) {
            console.log('[Analytics] Analytics initialized with session:', sessionId);
        }
    }

    // Expose analytics API
    window.afterPatmosAnalytics = {
        // Core tracking
        trackEvent,
        trackEventDebounced,
        trackError,
        trackAPIError,
        trackAPIRequest,

        // Specific trackers
        trackWalletConnection,
        trackWalletDisconnection,
        trackClaimAttempt,
        trackClaimSuccess,
        trackClaimRejection,
        trackPageView,
        trackInteraction,

        // Privacy controls
        isOptedOut,
        optOut,
        optIn,

        // Utility
        getSessionId: () => sessionId,
        getEvents: () => [...analyticsQueue],
        getErrors: () => [...errorQueue],
        flush,
        clear: () => {
            analyticsQueue.length = 0;
            errorQueue.length = 0;
        },
    };

    // Initialize on load
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
