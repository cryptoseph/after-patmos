// Main script for the After Patmos website
// NFT Contract: 0x83e2654994264333e6fdfe2e43eb862866746041
// Treasury Address: 0x764d2f2e65153a08c5509235334b08be2ae02915

const NFT_CONTRACT = '0x83e2654994264333e6fdfe2e43eb862866746041';
const TREASURY_ADDRESS = '0x764d2f2e65153a08c5509235334b08be2ae02915'.toLowerCase();
const CLAIMER_CONTRACT = '0xB0BF498288dff665e3129f63E1d010F9297205f1'.toLowerCase();
const OPENSEA_BASE_URL = 'https://opensea.io/assets/ethereum';
const ALCHEMY_API_URL = 'https://eth-mainnet.g.alchemy.com/nft/v3/demo/getNFTsForOwner';

// Grid mapping: Token ID to grid position
// Grid is 10x10, positions are [row, col] (0-indexed from top-left)
// #51 = top-left, #60 = top-right, #41 = bottom-left, #50 = bottom-right
const TOKEN_TO_GRID = {};

// Build the grid mapping based on the pattern:
// Row 0 (top): 51-60 (left to right)
// Row 1: 61-70
// Row 2: 71-80
// Row 3: 81-90
// Row 4: 91-100
// Row 5: 1-10 (left to right)
// Row 6: 11-20
// Row 7: 21-30
// Row 8: 31-40
// Row 9 (bottom): 41-50 (left to right)

function buildGridMapping() {
    // Top half: rows 0-4 (tokens 51-100)
    for (let row = 0; row < 5; row++) {
        for (let col = 0; col < 10; col++) {
            const tokenId = 51 + (row * 10) + col;
            TOKEN_TO_GRID[tokenId] = { row, col };
        }
    }

    // Middle section: rows 5-8 (tokens 1-40, left to right)
    for (let row = 5; row < 9; row++) {
        for (let col = 0; col < 10; col++) {
            const tokenId = 1 + ((row - 5) * 10) + col;
            TOKEN_TO_GRID[tokenId] = { row, col };
        }
    }

    // Bottom row: row 9 (tokens 41-50)
    for (let col = 0; col < 10; col++) {
        const tokenId = 41 + col;
        TOKEN_TO_GRID[tokenId] = { row: 9, col };
    }
}

buildGridMapping();

// =============================================================================
// CACHING SYSTEM - Phase 4: Client-side caching with TTL
// =============================================================================

const CACHE_TTL = 10 * 60 * 1000; // 10 minutes in milliseconds
const OWNERSHIP_CACHE_TTL = 5 * 60 * 1000; // 5 minutes for ownership data

/**
 * Generic fetch wrapper with localStorage caching and TTL
 * @param {string} key - Unique cache key
 * @param {Function} fetchFn - Async function that fetches fresh data
 * @param {number} ttl - Time-to-live in milliseconds (default: 10 minutes)
 * @returns {Promise<any>} - Cached or fresh data
 */
async function fetchWithCache(key, fetchFn, ttl = CACHE_TTL) {
    const cacheKey = `afterpatmos_${key}`;

    try {
        // Check for cached data
        const cached = localStorage.getItem(cacheKey);
        if (cached) {
            const { data, timestamp } = JSON.parse(cached);
            const age = Date.now() - timestamp;

            if (age < ttl) {
                console.log(`[Cache HIT] ${key} (age: ${Math.round(age / 1000)}s)`);
                return data;
            } else {
                console.log(`[Cache EXPIRED] ${key} (age: ${Math.round(age / 1000)}s, ttl: ${Math.round(ttl / 1000)}s)`);
            }
        } else {
            console.log(`[Cache MISS] ${key}`);
        }
    } catch (e) {
        console.warn(`[Cache ERROR] Reading ${key}:`, e);
    }

    // Fetch fresh data
    try {
        const freshData = await fetchFn();

        // Store in cache with timestamp
        try {
            localStorage.setItem(cacheKey, JSON.stringify({
                data: freshData,
                timestamp: Date.now()
            }));
            console.log(`[Cache SET] ${key}`);
        } catch (e) {
            // Handle localStorage quota exceeded
            if (e.name === 'QuotaExceededError') {
                console.warn('[Cache] localStorage quota exceeded, clearing old entries');
                clearOldCacheEntries();
            }
        }

        return freshData;
    } catch (fetchError) {
        // On fetch error, return stale cache if available
        try {
            const cached = localStorage.getItem(cacheKey);
            if (cached) {
                const { data } = JSON.parse(cached);
                console.warn(`[Cache STALE] ${key} - returning stale data due to fetch error`);
                return data;
            }
        } catch (e) {
            // Ignore cache read error
        }
        throw fetchError;
    }
}

/**
 * Clear old cache entries when quota is exceeded
 */
function clearOldCacheEntries() {
    const prefix = 'afterpatmos_';
    const entries = [];

    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith(prefix)) {
            try {
                const { timestamp } = JSON.parse(localStorage.getItem(key));
                entries.push({ key, timestamp });
            } catch (e) {
                // Invalid entry, mark for removal
                entries.push({ key, timestamp: 0 });
            }
        }
    }

    // Sort by timestamp (oldest first) and remove oldest 50%
    entries.sort((a, b) => a.timestamp - b.timestamp);
    const toRemove = Math.ceil(entries.length / 2);

    for (let i = 0; i < toRemove; i++) {
        localStorage.removeItem(entries[i].key);
    }

    console.log(`[Cache] Cleared ${toRemove} old entries`);
}

/**
 * Invalidate specific cache entry
 * @param {string} key - Cache key to invalidate
 */
function invalidateCache(key) {
    const cacheKey = `afterpatmos_${key}`;
    localStorage.removeItem(cacheKey);
    console.log(`[Cache INVALIDATE] ${key}`);
}

/**
 * Invalidate all cache entries
 */
function invalidateAllCache() {
    const prefix = 'afterpatmos_';
    const keysToRemove = [];

    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith(prefix)) {
            keysToRemove.push(key);
        }
    }

    keysToRemove.forEach(key => localStorage.removeItem(key));
    console.log(`[Cache] Cleared all ${keysToRemove.length} cache entries`);
}

// Legacy cache functions for backwards compatibility
const CACHE_KEY = 'afterpatmos_ownership_cache';
const CACHE_DURATION = OWNERSHIP_CACHE_TTL;

function getCachedOwnership() {
    try {
        const cached = localStorage.getItem(CACHE_KEY);
        if (cached) {
            const data = JSON.parse(cached);
            if (Date.now() - data.timestamp < CACHE_DURATION) {
                console.log('Using cached ownership data');
                return data.ownedTokens;
            }
        }
    } catch (e) {
        console.error('Error reading cache:', e);
    }
    return null;
}

function setCachedOwnership(ownedTokens) {
    try {
        localStorage.setItem(CACHE_KEY, JSON.stringify({
            timestamp: Date.now(),
            ownedTokens: ownedTokens
        }));
    } catch (e) {
        console.error('Error setting cache:', e);
    }
}

// Fetch NFTs available for claiming (held by the Claimer contract only)
async function fetchClaimableNFTs() {
    // Check cache first
    const cached = getCachedOwnership();
    if (cached) {
        return cached;
    }

    try {
        // Only fetch NFTs held by the Claimer contract (available for claiming)
        const response = await fetch(`https://eth-mainnet.g.alchemy.com/nft/v3/demo/getNFTsForOwner?owner=${CLAIMER_CONTRACT}&contractAddresses[]=${NFT_CONTRACT}&withMetadata=false&pageSize=100`);

        if (!response.ok) {
            throw new Error('API error');
        }

        const data = await response.json();
        const claimableTokens = data.ownedNfts.map(nft => parseInt(nft.tokenId, 10));

        console.log('Claimer contract holds tokens:', claimableTokens);
        console.log('Total available for claiming:', claimableTokens.length);

        setCachedOwnership(claimableTokens);
        return claimableTokens;

    } catch (error) {
        console.error('Error fetching claimable NFTs:', error);
        // Return empty array on error - will show all as not available
        return [];
    }
}

// Legacy alias for backwards compatibility
const fetchTreasuryNFTs = fetchClaimableNFTs;

// Alternative: Use Etherscan API for ownership check
async function fetchOwnershipEtherscan() {
    // This is a backup method using direct contract calls
    // For now, we'll use the Alchemy method above
    return [];
}

/**
 * Build visual order array for CSS Grid
 * Grid layout: 10 cols x 10 rows
 * Row 0: tokens 51-60, Row 1: 61-70, ... Row 4: 91-100
 * Row 5: tokens 1-10, Row 6: 11-20, ... Row 8: 31-40
 * Row 9: tokens 41-50
 */
function getVisualOrder() {
    const order = [];
    // Top half: rows 0-4 (tokens 51-100)
    for (let row = 0; row < 5; row++) {
        for (let col = 0; col < 10; col++) {
            order.push(51 + (row * 10) + col);
        }
    }
    // Middle: rows 5-8 (tokens 1-40)
    for (let row = 0; row < 4; row++) {
        for (let col = 0; col < 10; col++) {
            order.push(1 + (row * 10) + col);
        }
    }
    // Bottom: row 9 (tokens 41-50)
    for (let col = 0; col < 10; col++) {
        order.push(41 + col);
    }
    return order;
}

// Create the interactive grid using CSS Grid (no manual positioning)
function createNFTGrid(ownedTokens) {
    const nftRegionsContainer = document.getElementById('nft-regions');
    if (!nftRegionsContainer) return;

    nftRegionsContainer.innerHTML = '';
    const ownedSet = new Set(ownedTokens);
    const visualOrder = getVisualOrder();

    // Create regions in visual order - CSS Grid handles positioning
    visualOrder.forEach((tokenId) => {
        const region = document.createElement('div');
        region.className = 'nft-region';
        region.dataset.tokenId = tokenId;

        const isOwned = ownedSet.has(tokenId);

        // Blackout if NOT owned by claimer contract
        if (!isOwned) {
            region.classList.add('blackout');
        }

        // Tooltip on hover (desktop)
        region.addEventListener('mouseenter', (e) => showTooltip(e, tokenId, isOwned));
        region.addEventListener('mouseleave', hideTooltip);
        region.addEventListener('mousemove', moveTooltip);

        // Click handler
        region.addEventListener('click', (e) => {
            // Prevent click when artwork is zoomed
            const wrapper = document.getElementById('artwork-wrapper');
            if (wrapper && wrapper.classList.contains('zoomed')) {
                e.stopPropagation();
                return;
            }
            handleRegionClick(tokenId, isOwned);
        });

        nftRegionsContainer.appendChild(region);
    });
}

// Mobile zoom functionality
function initMobileZoom() {
    const artworkWrapper = document.getElementById('artwork-wrapper');
    if (!artworkWrapper) return;

    // Only enable on mobile
    const isMobile = window.matchMedia('(max-width: 768px)').matches;
    if (!isMobile) return;

    artworkWrapper.addEventListener('click', (e) => {
        // Don't zoom if clicking on an NFT region
        if (e.target.classList.contains('nft-region')) return;

        artworkWrapper.classList.toggle('zoomed');
    });

    // Close zoom on escape key
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && artworkWrapper.classList.contains('zoomed')) {
            artworkWrapper.classList.remove('zoomed');
        }
    });
}

// Tooltip functions
function showTooltip(e, tokenId, isOwned) {
    const tooltip = document.getElementById('tooltip');
    if (!tooltip) return;

    const icon = isOwned ? '<span style="color: #4CAF50;">✓</span>' : '<span style="color: #f44336;">✗</span>';
    const status = isOwned ? 'Available to claim' : 'Already claimed';
    tooltip.innerHTML = `<strong>After Patmos #${tokenId}</strong> ${icon}<br>${status}`;
    tooltip.classList.add('active');
    moveTooltip(e);
}

function moveTooltip(e) {
    const tooltip = document.getElementById('tooltip');
    if (!tooltip) return;

    tooltip.style.left = `${e.clientX + 15}px`;
    tooltip.style.top = `${e.clientY + 15}px`;
}

function hideTooltip() {
    const tooltip = document.getElementById('tooltip');
    if (tooltip) {
        tooltip.classList.remove('active');
    }
}

// Handle click on NFT region
function handleRegionClick(tokenId, isOwned) {
    if (isOwned) {
        // Available to claim - open claim modal
        openClaimModal(tokenId);
    } else {
        // Already claimed - open OpenSea page
        const openseaUrl = `${OPENSEA_BASE_URL}/${NFT_CONTRACT}/${tokenId}`;
        window.open(openseaUrl, '_blank');
    }
}

// Backend API URL (change to your deployed backend)
const BACKEND_URL = 'http://localhost:3001';

// Open claim modal for available NFTs
function openClaimModal(tokenId) {
    const modal = document.getElementById('claim-modal');
    const modalTokenId = document.getElementById('modal-token-id');
    const claimStatus = document.getElementById('claim-status');

    if (modal && modalTokenId) {
        modalTokenId.textContent = tokenId;
        modal.dataset.tokenId = tokenId;

        // Reset to step 1
        document.getElementById('claim-step-1').style.display = 'block';
        document.getElementById('claim-step-2').style.display = 'none';
        document.getElementById('claim-step-3').style.display = 'none';

        // Clear inputs
        const observationInput = document.getElementById('claim-observation');
        const addressInput = document.getElementById('claim-eth-address');
        if (observationInput) observationInput.value = '';
        if (addressInput) {
            // Auto-fill with connected wallet if available
            const connectedAddress = sessionStorage.getItem('connectedWallet');
            addressInput.value = connectedAddress || '';
        }

        // Reset character count
        document.getElementById('observation-char-count').textContent = '0';

        // Reset status
        if (claimStatus) {
            claimStatus.className = '';
            claimStatus.style.display = 'none';
            claimStatus.textContent = '';
        }

        modal.classList.add('active');
    }
}

// Update progress steps UI
function updateProgressSteps(step) {
    const steps = document.querySelectorAll('.progress-step');
    const connectors = document.querySelectorAll('.progress-connector');
    const progressTitle = document.getElementById('progress-title');
    const progressDesc = document.getElementById('progress-description');
    const broadcastingStatus = document.getElementById('broadcasting-status');

    steps.forEach((stepEl, index) => {
        stepEl.classList.remove('active', 'completed');
        if (index < step - 1) {
            stepEl.classList.add('completed');
        } else if (index === step - 1) {
            stepEl.classList.add('active');
        }
    });

    connectors.forEach((conn, index) => {
        conn.classList.remove('active');
        if (index < step - 1) {
            conn.classList.add('active');
        }
    });

    // Update text based on step
    if (step === 1) {
        if (progressTitle) progressTitle.textContent = 'The Guardian is evaluating...';
        if (progressDesc) progressDesc.textContent = 'Your observation is being assessed for authenticity and depth.';
        if (broadcastingStatus) broadcastingStatus.style.display = 'none';
    } else if (step === 2) {
        if (progressTitle) progressTitle.textContent = 'Broadcasting Transaction...';
        if (progressDesc) progressDesc.textContent = 'Your observation has been approved! Sending your NFT now.';
        if (broadcastingStatus) broadcastingStatus.style.display = 'block';
    }
}

// Handle submission to Guardian (Gemini AI)
async function submitToGuardian() {
    const modal = document.getElementById('claim-modal');
    const tokenId = modal.dataset.tokenId;
    const observation = document.getElementById('claim-observation').value.trim();
    const ethAddress = document.getElementById('claim-eth-address').value.trim();
    const claimStatus = document.getElementById('claim-status');

    // Validate inputs
    if (!observation || observation.length < 1) {
        claimStatus.textContent = 'Please enter your observation';
        claimStatus.className = 'error';
        claimStatus.style.display = 'block';
        return;
    }

    if (observation.length > 250) {
        claimStatus.textContent = 'Observation must be 250 characters or less';
        claimStatus.className = 'error';
        claimStatus.style.display = 'block';
        return;
    }

    if (!/^0x[a-fA-F0-9]{40}$/.test(ethAddress)) {
        claimStatus.textContent = 'Please enter a valid Ethereum address';
        claimStatus.className = 'error';
        claimStatus.style.display = 'block';
        return;
    }

    // Hide step 1, show step 2 (loading with progress)
    document.getElementById('claim-step-1').style.display = 'none';
    document.getElementById('claim-step-2').style.display = 'block';
    claimStatus.style.display = 'none';

    // Update to Step 1: AI Analyzing
    updateProgressSteps(1);

    try {
        // Submit to backend for Gemini AI evaluation
        const response = await fetch(`${BACKEND_URL}/api/submit-observation`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                address: ethAddress,
                tokenId: parseInt(tokenId),
                observation: observation
            })
        });

        const result = await response.json();

        const resultContainer = document.getElementById('guardian-result');

        // Handle error responses (400, 500, etc.)
        if (result.error) {
            // Hide step 2, show step 3 (result)
            document.getElementById('claim-step-2').style.display = 'none';
            document.getElementById('claim-step-3').style.display = 'block';
            resultContainer.innerHTML = `
                <div class="guardian-rejected">
                    <div class="result-icon">⚠️</div>
                    <h3>Unable to Process</h3>
                    <p class="result-message">${result.error}</p>
                    <button class="try-again-btn" onclick="resetClaimModal()">
                        Try Again
                    </button>
                </div>
            `;
            return;
        }

        if (result.approved) {
            // Approved by Guardian - update to step 2 (broadcasting)
            updateProgressSteps(2);

            // Invalidate ownership cache so next load shows updated state
            invalidateCache('ownership_cache');
            localStorage.removeItem('afterpatmos_ownership_cache');

            // Check if this is a "broadcasting" response (optimistic - tx submitted but not confirmed)
            if (result.broadcasting && result.claimResult) {
                // Show broadcasting status while tx confirms in background
                // Hide step 2, show step 3 with pending status
                document.getElementById('claim-step-2').style.display = 'none';
                document.getElementById('claim-step-3').style.display = 'block';

                resultContainer.innerHTML = `
                    <div class="guardian-approved">
                        <div class="result-icon">🎉</div>
                        <h3>NFT Claim Submitted!</h3>
                        <p class="result-message">Your observation has been deemed worthy!</p>
                        <p class="result-reason">"${result.reason}"</p>
                        <p class="result-score">Authenticity Score: ${result.score}/10</p>
                        <div class="tx-info" style="margin-top: 20px; padding: 15px; background: rgba(255, 193, 7, 0.1); border-radius: 8px;">
                            <p style="margin: 0 0 10px 0; color: #ffc107; font-weight: 600;">Transaction Broadcasting...</p>
                            <p style="margin: 0; font-size: 12px; color: #888;">
                                After Patmos #${result.claimResult.tokenId} is being sent to your wallet.
                                <br>This usually takes 15-30 seconds.
                            </p>
                            <a href="${result.claimResult.etherscanUrl}" target="_blank"
                               style="display: inline-block; margin-top: 10px; color: #ffc107; text-decoration: none;">
                                Track on Etherscan →
                            </a>
                        </div>
                        <button class="try-again-btn" style="margin-top: 20px;" onclick="closeClaimModal(); location.reload();">
                            Close
                        </button>
                    </div>
                `;
                return;
            }

            // NFT was automatically claimed and confirmed
            if (result.claimed && result.claimResult) {
                // Hide step 2, show step 3 (result)
                document.getElementById('claim-step-2').style.display = 'none';
                document.getElementById('claim-step-3').style.display = 'block';

                resultContainer.innerHTML = `
                    <div class="guardian-approved">
                        <div class="result-icon">🎉</div>
                        <h3>NFT Claimed Successfully!</h3>
                        <p class="result-message">Your observation has been deemed worthy and your NFT has been sent!</p>
                        <p class="result-reason">"${result.reason}"</p>
                        <p class="result-score">Authenticity Score: ${result.score}/10</p>
                        <div class="tx-info" style="margin-top: 20px; padding: 15px; background: rgba(76, 175, 80, 0.1); border-radius: 8px;">
                            <p style="margin: 0 0 10px 0; color: #4CAF50; font-weight: 600;">Transaction Confirmed</p>
                            <p style="margin: 0; font-size: 12px; color: #888;">
                                After Patmos #${result.claimResult.tokenId} is now yours!
                            </p>
                            <a href="${result.claimResult.etherscanUrl}" target="_blank"
                               style="display: inline-block; margin-top: 10px; color: #4CAF50; text-decoration: none;">
                                View on Etherscan →
                            </a>
                        </div>
                        <button class="try-again-btn" style="margin-top: 20px;" onclick="closeClaimModal(); location.reload();">
                            Close
                        </button>
                    </div>
                `;
            } else if (result.claimData && result.claimData.manualClaimRequired) {
                // Automatic claim failed, manual claim needed
                document.getElementById('claim-step-2').style.display = 'none';
                document.getElementById('claim-step-3').style.display = 'block';

                resultContainer.innerHTML = `
                    <div class="guardian-approved">
                        <div class="result-icon">✨</div>
                        <h3>The Guardian Welcomes You</h3>
                        <p class="result-message">Your observation has been deemed worthy.</p>
                        <p class="result-reason">"${result.reason}"</p>
                        <p class="result-score">Authenticity Score: ${result.score}/10</p>
                        <p style="color: #ff9800; margin-top: 15px;">Automatic transfer failed. Please claim manually using the contract.</p>
                        <button class="try-again-btn" style="margin-top: 20px;" onclick="closeClaimModal()">
                            Close
                        </button>
                    </div>
                `;
            } else {
                // Legacy flow with signature
                document.getElementById('claim-step-2').style.display = 'none';
                document.getElementById('claim-step-3').style.display = 'block';

                resultContainer.innerHTML = `
                    <div class="guardian-approved">
                        <div class="result-icon">✨</div>
                        <h3>The Guardian Welcomes You</h3>
                        <p class="result-message">Your observation has been deemed worthy.</p>
                        <p class="result-reason">"${result.reason}"</p>
                        <p class="result-score">Authenticity Score: ${result.score}/10</p>
                        <button class="claim-action-btn" onclick="executeClaim('${ethAddress}', ${tokenId}, '${observation.replace(/'/g, "\\'")}', '${result.claimData?.signature || ''}', ${result.claimData?.nonce || 0})">
                            Claim Your NFT
                        </button>
                    </div>
                `;
                window.pendingClaimData = result.claimData;
            }

        } else {
            // Rejected by Guardian
            document.getElementById('claim-step-2').style.display = 'none';
            document.getElementById('claim-step-3').style.display = 'block';

            const reasonText = result.reason ? `<p class="result-reason">"${result.reason}"</p>` : '';
            const scoreText = result.score !== undefined ? `<p class="result-score">Score: ${result.score}/10 (minimum 5 required)</p>` : '';

            resultContainer.innerHTML = `
                <div class="guardian-rejected">
                    <div class="result-icon">🏔️</div>
                    <h3>The Guardian Has Spoken</h3>
                    <p class="result-message">${result.message || 'Your observation was not deemed worthy.'}</p>
                    ${reasonText}
                    ${scoreText}
                    <button class="try-again-btn" onclick="resetClaimModal()">
                        Try Again
                    </button>
                </div>
            `;
        }

    } catch (error) {
        console.error('Error submitting to Guardian:', error);

        // Show error
        document.getElementById('claim-step-2').style.display = 'none';
        document.getElementById('claim-step-1').style.display = 'block';

        claimStatus.textContent = 'Connection to The Guardian failed. Please try again.';
        claimStatus.className = 'error';
        claimStatus.style.display = 'block';
    }
}

// Execute the actual claim after Guardian approval
async function executeClaim(address, tokenId, observation, signature, nonce) {
    const resultContainer = document.getElementById('guardian-result');

    // For now, store the approved claim locally
    // In production, this would interact with the smart contract
    const approvedClaims = JSON.parse(localStorage.getItem('approved_claims') || '[]');
    approvedClaims.push({
        address: address,
        tokenId: tokenId,
        observation: observation,
        signature: signature,
        nonce: nonce,
        timestamp: new Date().toISOString(),
        status: 'pending_transfer'
    });
    localStorage.setItem('approved_claims', JSON.stringify(approvedClaims));

    resultContainer.innerHTML = `
        <div class="guardian-approved">
            <div class="result-icon">🎉</div>
            <h3>Claim Submitted!</h3>
            <p class="result-message">Your claim for After Patmos #${tokenId} has been approved and recorded.</p>
            <p class="result-reason">Your observation: "${observation}"</p>
            <p style="color: #888; font-size: 13px; margin-top: 20px;">
                The NFT will be transferred to:<br>
                <code style="color: #4CAF50;">${address}</code>
            </p>
            <button class="try-again-btn" style="margin-top: 20px;" onclick="closeClaimModal()">
                Close
            </button>
        </div>
    `;
}

// Reset claim modal to step 1
function resetClaimModal() {
    document.getElementById('claim-step-1').style.display = 'block';
    document.getElementById('claim-step-2').style.display = 'none';
    document.getElementById('claim-step-3').style.display = 'none';

    // Clear observation but keep address
    document.getElementById('claim-observation').value = '';
    document.getElementById('observation-char-count').textContent = '0';
    document.getElementById('claim-status').style.display = 'none';
}

// Close claim modal
function closeClaimModal() {
    const modal = document.getElementById('claim-modal');
    modal.classList.remove('active');
}

// View on OpenSea button in modal
function handleOpenSeaClick() {
    const modal = document.getElementById('claim-modal');
    const tokenId = modal.dataset.tokenId;
    const openseaUrl = `${OPENSEA_BASE_URL}/${NFT_CONTRACT}/${tokenId}`;
    window.open(openseaUrl, '_blank');
}

// Main initialization
document.addEventListener('DOMContentLoaded', async () => {
    const videoContainer = document.getElementById('video-container');
    const artworkContainer = document.getElementById('artwork-container');
    const skipButton = document.getElementById('skip-button');
    const promoVideo = document.getElementById('promo-video');

    // Check if the video has been watched in this session
    if (sessionStorage.getItem('afterPatmosVideoWatched')) {
        videoContainer.style.display = 'none';
        artworkContainer.classList.add('active');
    } else {
        videoContainer.classList.add('active');
    }

    // Unmute button
    const unmuteButton = document.getElementById('unmute-button');
    if (unmuteButton && promoVideo) {
        unmuteButton.addEventListener('click', () => {
            if (promoVideo.muted) {
                promoVideo.muted = false;
                unmuteButton.textContent = '🔊 Sound On';
                unmuteButton.classList.add('unmuted');
            } else {
                promoVideo.muted = true;
                unmuteButton.textContent = '🔇 Tap for Sound';
                unmuteButton.classList.remove('unmuted');
            }
        });
    }

    // Skip video button
    if (skipButton) {
        skipButton.addEventListener('click', () => {
            promoVideo.pause();
            videoContainer.classList.remove('active');
            artworkContainer.classList.add('active');
            sessionStorage.setItem('afterPatmosVideoWatched', 'true');
        });
    }

    // Back to video button (in header on artwork page)
    const backToVideoBtn = document.getElementById('back-to-video-btn');
    const backToArtworkBtn = document.getElementById('back-to-artwork-btn');

    if (backToVideoBtn) {
        backToVideoBtn.addEventListener('click', () => {
            artworkContainer.classList.remove('active');
            videoContainer.style.display = '';
            videoContainer.classList.add('active');
            // Show "Back to Artwork" button, hide "Skip to Artwork" button
            if (skipButton) skipButton.style.display = 'none';
            if (backToArtworkBtn) backToArtworkBtn.style.display = '';
            if (promoVideo) {
                promoVideo.currentTime = 0;
                promoVideo.play();
            }
        });
    }

    // Back to artwork button (in video container, shown when returning to video)
    if (backToArtworkBtn) {
        backToArtworkBtn.addEventListener('click', () => {
            promoVideo.pause();
            videoContainer.classList.remove('active');
            artworkContainer.classList.add('active');
        });
    }

    // When video ends, show artwork
    if (promoVideo) {
        promoVideo.addEventListener('ended', () => {
            videoContainer.classList.remove('active');
            artworkContainer.classList.add('active');
            sessionStorage.setItem('afterPatmosVideoWatched', 'true');
        });
    }

    // Disclaimer toggle
    const disclaimerToggle = document.getElementById('disclaimer-toggle');
    const disclaimerPanel = document.getElementById('disclaimer-panel');
    if (disclaimerToggle) {
        disclaimerToggle.addEventListener('click', () => {
            disclaimerPanel.classList.toggle('active');
        });
    }

    // Modal handling
    const modals = document.querySelectorAll('.modal');
    const closeModals = document.querySelectorAll('.close-modal, .cancel-btn');

    closeModals.forEach(btn => {
        btn.addEventListener('click', () => {
            modals.forEach(modal => modal.classList.remove('active'));
        });
    });

    // Close modal on outside click
    modals.forEach(modal => {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modals.forEach(m => m.classList.remove('active'));
            }
        });
    });

    // Submit to Guardian button
    const submitToGuardianBtn = document.getElementById('submit-to-guardian');
    if (submitToGuardianBtn) {
        submitToGuardianBtn.addEventListener('click', submitToGuardian);
    }

    // Observation character count
    const observationTextarea = document.getElementById('claim-observation');
    if (observationTextarea) {
        observationTextarea.addEventListener('input', () => {
            document.getElementById('observation-char-count').textContent = observationTextarea.value.length;
        });
    }

    // OpenSea button in claim modal
    const claimOpenseaBtn = document.getElementById('claim-opensea-btn');
    if (claimOpenseaBtn) {
        claimOpenseaBtn.addEventListener('click', handleOpenSeaClick);
    }

    // Initialize mobile zoom
    initMobileZoom();

    // Fetch ownership and create grid
    console.log('Fetching NFT ownership data...');
    const ownedTokens = await fetchTreasuryNFTs();
    console.log(`Treasury owns ${ownedTokens.length} NFTs`);
    createNFTGrid(ownedTokens);
});
