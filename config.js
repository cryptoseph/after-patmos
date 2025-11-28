/**
 * Frontend Configuration for After Patmos
 *
 * This file centralizes all configuration values.
 * Configuration priority: meta tags > environment variables > defaults
 *
 * Improvements:
 * - Safe environment variable detection (no process.env crashes)
 * - Vite/build tool support via import.meta.env
 * - Better production URL handling
 * - Validation and type safety
 */

'use strict';

// Helper: Safely get meta tag content
function getMetaContent(name) {
    try {
        const metaTag = document.querySelector(`meta[name="${name}"]`);
        return metaTag?.content || null;
    } catch {
        return null;
    }
}

// Helper: Safely check for Vite environment variables
function getViteEnv(key) {
    try {
        // Vite uses import.meta.env
        if (typeof import.meta !== 'undefined' && import.meta.env) {
            return import.meta.env[key] || null;
        }
    } catch {
        // import.meta not available (older browsers or non-module context)
    }
    return null;
}

// Helper: Check if running locally
function isLocalhost() {
    const hostname = window.location.hostname;
    return hostname === 'localhost' ||
           hostname === '127.0.0.1' ||
           hostname.startsWith('192.168.') ||
           hostname.endsWith('.local');
}

// Get backend URL with fallback chain
function getBackendUrl() {
    // 1. Check meta tag (highest priority - set in HTML)
    const metaUrl = getMetaContent('backend-url');
    if (metaUrl) return metaUrl;

    // 2. Check Vite environment variable
    const viteUrl = getViteEnv('VITE_BACKEND_URL');
    if (viteUrl) return viteUrl;

    // 3. Local development
    if (isLocalhost()) {
        return 'http://localhost:3001';
    }

    // 4. Production - use explicit production API URL
    // This should match your deployed backend
    return 'https://api.afterpatmos.com';
}

// Get Alchemy API key with fallback
function getAlchemyApiKey() {
    // 1. Check meta tag
    const metaKey = getMetaContent('alchemy-api-key');
    if (metaKey) return metaKey;

    // 2. Check Vite environment variable
    const viteKey = getViteEnv('VITE_ALCHEMY_API_KEY');
    if (viteKey) return viteKey;

    // 3. Fallback to demo (with warning in debug mode)
    if (isLocalhost()) {
        console.warn('[Config] Using Alchemy demo API key. Set meta tag: <meta name="alchemy-api-key" content="your-key">');
    }
    return 'demo';
}

// Build Alchemy URLs
function buildAlchemyUrls(apiKey) {
    const baseUrl = 'https://eth-mainnet.g.alchemy.com';
    return {
        nftsForOwner: `${baseUrl}/nft/v3/${apiKey}/getNFTsForOwner`,
        nftMetadata: `${baseUrl}/nft/v3/${apiKey}/getNFTMetadata`,
    };
}

// Validate Ethereum address format
function isValidAddress(address) {
    return /^0x[a-fA-F0-9]{40}$/.test(address);
}

// Get contract addresses with validation
function getContractAddresses() {
    const addresses = {
        NFT_CONTRACT: getMetaContent('nft-contract') || '0x83e2654994264333e6fdfe2e43eb862866746041',
        CLAIMER_CONTRACT: getMetaContent('claimer-contract') || '0x83FB8FF0eAB0f036c4b3dC301483D571C5573a07',
        TREASURY_ADDRESS: getMetaContent('treasury-address') || '0x764d2f2e65153a08c5509235334b08be2ae02915',
    };

    // Validate addresses in debug mode
    if (isLocalhost()) {
        for (const [key, value] of Object.entries(addresses)) {
            if (!isValidAddress(value)) {
                console.error(`[Config] Invalid ${key}: ${value}`);
            }
        }
    }

    return addresses;
}

// Get feature flags
function getFeatureFlags() {
    return {
        ENABLE_ANALYTICS: getMetaContent('enable-analytics') === 'true' || false,
        DEBUG_MODE: isLocalhost() || getMetaContent('debug-mode') === 'true',
    };
}

// Build the configuration object
const alchemyApiKey = getAlchemyApiKey();
const alchemyUrls = buildAlchemyUrls(alchemyApiKey);
const contractAddresses = getContractAddresses();
const featureFlags = getFeatureFlags();

// Main configuration object
// Use window.AFTER_PATMOS_CONFIG to avoid conflicts with other scripts
window.AFTER_PATMOS_CONFIG = Object.freeze({
    // Smart Contracts
    ...contractAddresses,

    // API Endpoints
    BACKEND_URL: getBackendUrl(),
    ALCHEMY_API_KEY: alchemyApiKey,
    ALCHEMY_API_URL: alchemyUrls.nftsForOwner,
    ALCHEMY_METADATA_URL: alchemyUrls.nftMetadata,
    OPENSEA_BASE_URL: 'https://opensea.io/assets/ethereum',

    // Network
    CHAIN_ID: 1, // Ethereum Mainnet
    CHAIN_NAME: 'Ethereum Mainnet',

    // Cache settings (in milliseconds)
    CACHE_TTL: 10 * 60 * 1000, // 10 minutes
    OWNERSHIP_CACHE_TTL: 5 * 60 * 1000, // 5 minutes
    STALE_CACHE_TTL: 60 * 60 * 1000, // 1 hour for stale fallback

    // Feature flags
    ...featureFlags,

    // UI Settings
    MAX_OBSERVATION_LENGTH: 250,
    MIN_OBSERVATION_LENGTH: 1,

    // Grid settings
    GRID_SIZE: 10, // 10x10 grid
    TOTAL_NFTS: 100,

    // Rate limiting (client-side awareness)
    MAX_RETRIES: 3,
    RETRY_DELAY: 1000, // 1 second

    // Timeouts
    API_TIMEOUT: 30000, // 30 seconds
    WALLET_TIMEOUT: 60000, // 60 seconds for wallet interactions
});

// Helper function to get config value with fallback
window.AFTER_PATMOS_CONFIG.get = function(key, fallback = null) {
    return this[key] !== undefined ? this[key] : fallback;
};

// Log configuration in debug mode (without sensitive data)
if (window.AFTER_PATMOS_CONFIG.DEBUG_MODE) {
    const safeConfig = {
        BACKEND_URL: window.AFTER_PATMOS_CONFIG.BACKEND_URL,
        ALCHEMY_API_KEY: alchemyApiKey === 'demo' ? 'demo' : alchemyApiKey.substring(0, 8) + '...',
        NFT_CONTRACT: window.AFTER_PATMOS_CONFIG.NFT_CONTRACT,
        CLAIMER_CONTRACT: window.AFTER_PATMOS_CONFIG.CLAIMER_CONTRACT,
        CHAIN_ID: window.AFTER_PATMOS_CONFIG.CHAIN_ID,
        DEBUG_MODE: true,
        ENABLE_ANALYTICS: window.AFTER_PATMOS_CONFIG.ENABLE_ANALYTICS,
    };
    console.log('[Config] After Patmos Configuration:', safeConfig);
}

// Export for ES modules if supported
if (typeof module !== 'undefined' && module.exports) {
    module.exports = window.AFTER_PATMOS_CONFIG;
}
