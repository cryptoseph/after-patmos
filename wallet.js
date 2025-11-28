// Wallet connection logic with security improvements
// - Chain ID validation (Ethereum Mainnet)
// - Account/chain change listeners
// - EIP-6963 provider discovery support
// - Proper error handling

'use strict';

// Constants
const EXPECTED_CHAIN_ID = 1; // Ethereum Mainnet
const EXPECTED_CHAIN_ID_HEX = '0x1';

// Wallet state
let connectedWallet = null;
let userAddress = null;
let currentProvider = null;

// EIP-6963 provider store
const discoveredProviders = new Map();

// Initialize wallet connection UI
function initWalletConnect() {
    const connectWalletBtn = document.getElementById('connect-wallet-btn');
    const disconnectBtn = document.getElementById('disconnect-btn');
    const walletConnectModal = document.getElementById('wallet-connect-modal');
    const container = document.getElementById('thirdweb-connect-container');

    if (!container) return;

    // Setup EIP-6963 provider discovery
    setupEIP6963Discovery();

    // Create wallet options HTML
    container.innerHTML = `
        <h2 style="color: #fff; margin-bottom: 10px; font-size: 20px;">Connect Wallet</h2>
        <p style="color: #888; margin-bottom: 25px; font-size: 14px;">Choose how you want to connect</p>

        <div class="wallet-options" id="wallet-options-container">
            <button class="wallet-option" data-wallet="metamask">
                <div class="wallet-icon">🦊</div>
                <div class="wallet-info">
                    <div class="wallet-name">MetaMask</div>
                    <div class="wallet-desc">Browser extension</div>
                </div>
            </button>

            <button class="wallet-option" data-wallet="walletconnect">
                <div class="wallet-icon">
                    <svg width="28" height="28" viewBox="0 0 400 400" fill="none">
                        <path d="M81.9 146.6c65.5-64.1 171.8-64.1 237.3 0l7.9 7.7c3.3 3.2 3.3 8.4 0 11.6l-27 26.4c-1.6 1.6-4.3 1.6-5.9 0l-10.9-10.6c-45.7-44.7-119.8-44.7-165.5 0l-11.6 11.4c-1.6 1.6-4.3 1.6-5.9 0l-27-26.4c-3.3-3.2-3.3-8.4 0-11.6l8.6-8.5zm293.2 54.7l24 23.5c3.3 3.2 3.3 8.4 0 11.6l-108.2 105.9c-3.3 3.2-8.6 3.2-11.8 0l-76.8-75.2c-.8-.8-2.1-.8-3 0l-76.8 75.2c-3.3 3.2-8.6 3.2-11.8 0L2.5 236.4c-3.3-3.2-3.3-8.4 0-11.6l24-23.5c3.3-3.2 8.6-3.2 11.8 0l76.8 75.2c.8.8 2.1.8 3 0l76.8-75.2c3.3-3.2 8.6-3.2 11.8 0l76.8 75.2c.8.8 2.1.8 3 0l76.8-75.2c3.3-3.2 8.6-3.2 11.9 0z" fill="#3B99FC"/>
                    </svg>
                </div>
                <div class="wallet-info">
                    <div class="wallet-name">WalletConnect</div>
                    <div class="wallet-desc">Mobile & desktop wallets</div>
                </div>
            </button>

            <button class="wallet-option" data-wallet="coinbase">
                <div class="wallet-icon">
                    <svg width="28" height="28" viewBox="0 0 1024 1024" fill="none">
                        <rect width="1024" height="1024" rx="512" fill="#0052FF"/>
                        <path fill-rule="evenodd" clip-rule="evenodd" d="M512 784c-150.4 0-272-121.6-272-272s121.6-272 272-272 272 121.6 272 272-121.6 272-272 272zm-96-368h192v192H416V416z" fill="#fff"/>
                    </svg>
                </div>
                <div class="wallet-info">
                    <div class="wallet-name">Coinbase Wallet</div>
                    <div class="wallet-desc">Coinbase Wallet app</div>
                </div>
            </button>
        </div>

        <div id="wallet-connect-status" class="wallet-connect-status"></div>
        <div id="network-warning" class="network-warning" style="display: none;">
            <span style="color: #ff6b6b;">⚠️ Please switch to Ethereum Mainnet</span>
            <button id="switch-network-btn" class="switch-network-btn">Switch Network</button>
        </div>
    `;

    // Add event listeners to wallet buttons
    container.querySelectorAll('.wallet-option').forEach(btn => {
        btn.addEventListener('click', () => handleWalletSelection(btn.dataset.wallet));
    });

    // Switch network button
    const switchNetworkBtn = document.getElementById('switch-network-btn');
    if (switchNetworkBtn) {
        switchNetworkBtn.addEventListener('click', switchToMainnet);
    }

    // Connect button click - only opens modal when not connected
    if (connectWalletBtn) {
        connectWalletBtn.addEventListener('click', () => {
            if (!userAddress) {
                walletConnectModal.classList.add('active');
            }
        });
    }

    // Disconnect button
    if (disconnectBtn) {
        disconnectBtn.addEventListener('click', disconnectWallet);
    }

    // Check for existing connection
    checkExistingConnection();
}

// EIP-6963 Provider Discovery (modern wallet standard)
function setupEIP6963Discovery() {
    // Listen for provider announcements
    window.addEventListener('eip6963:announceProvider', (event) => {
        const { info, provider } = event.detail;
        discoveredProviders.set(info.uuid, { info, provider });

        if (window.AFTER_PATMOS_CONFIG?.DEBUG_MODE) {
            console.log('[Wallet] EIP-6963 provider discovered:', info.name);
        }
    });

    // Request providers to announce themselves
    window.dispatchEvent(new Event('eip6963:requestProvider'));
}

// Get provider by wallet type (with EIP-6963 support)
function getProviderForWallet(walletType) {
    // First, try EIP-6963 discovered providers
    for (const [, { info, provider }] of discoveredProviders) {
        const name = info.name.toLowerCase();
        if (walletType === 'metamask' && name.includes('metamask')) {
            return provider;
        }
        if (walletType === 'coinbase' && (name.includes('coinbase') || info.rdns?.includes('coinbase'))) {
            return provider;
        }
    }

    // Fallback to legacy window.ethereum
    if (!window.ethereum) return null;

    // Handle multiple providers
    if (window.ethereum.providers?.length) {
        if (walletType === 'metamask') {
            return window.ethereum.providers.find(p => p.isMetaMask && !p.isBraveWallet);
        }
        if (walletType === 'coinbase') {
            return window.ethereum.providers.find(p => p.isCoinbaseWallet);
        }
    }

    return window.ethereum;
}

// Validate network is Ethereum Mainnet
async function validateNetwork(provider) {
    try {
        const chainId = await provider.request({ method: 'eth_chainId' });
        const numericChainId = parseInt(chainId, 16);

        if (numericChainId !== EXPECTED_CHAIN_ID) {
            showNetworkWarning(true);
            throw new Error(`Wrong network. Please switch to Ethereum Mainnet (Chain ID: ${EXPECTED_CHAIN_ID})`);
        }

        showNetworkWarning(false);
        return true;
    } catch (error) {
        if (error.message.includes('Wrong network')) {
            throw error;
        }
        console.error('[Wallet] Network validation error:', error);
        return false;
    }
}

// Show/hide network warning
function showNetworkWarning(show) {
    const warning = document.getElementById('network-warning');
    if (warning) {
        warning.style.display = show ? 'flex' : 'none';
    }
}

// Switch to Ethereum Mainnet
async function switchToMainnet() {
    const provider = currentProvider || window.ethereum;
    if (!provider) return;

    try {
        await provider.request({
            method: 'wallet_switchEthereumChain',
            params: [{ chainId: EXPECTED_CHAIN_ID_HEX }],
        });
        showNetworkWarning(false);
    } catch (error) {
        // Chain not added to wallet
        if (error.code === 4902) {
            try {
                await provider.request({
                    method: 'wallet_addEthereumChain',
                    params: [{
                        chainId: EXPECTED_CHAIN_ID_HEX,
                        chainName: 'Ethereum Mainnet',
                        nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
                        rpcUrls: ['https://mainnet.infura.io/v3/'],
                        blockExplorerUrls: ['https://etherscan.io'],
                    }],
                });
            } catch (addError) {
                console.error('[Wallet] Failed to add Ethereum Mainnet:', addError);
            }
        } else {
            console.error('[Wallet] Failed to switch network:', error);
        }
    }
}

// Setup wallet event listeners
function setupWalletListeners(provider) {
    if (!provider) return;

    // Remove any existing listeners to prevent duplicates
    provider.removeAllListeners?.('accountsChanged');
    provider.removeAllListeners?.('chainChanged');
    provider.removeAllListeners?.('disconnect');

    // Account changed
    provider.on('accountsChanged', (accounts) => {
        if (accounts.length === 0) {
            // User disconnected
            disconnectWallet();
        } else if (accounts[0] !== userAddress) {
            // Account switched
            userAddress = accounts[0];
            onWalletConnected(userAddress);

            if (window.AFTER_PATMOS_CONFIG?.DEBUG_MODE) {
                console.log('[Wallet] Account changed:', userAddress);
            }
        }
    });

    // Chain changed - recommended by MetaMask to reload
    provider.on('chainChanged', (chainId) => {
        const numericChainId = parseInt(chainId, 16);

        if (numericChainId !== EXPECTED_CHAIN_ID) {
            showNetworkWarning(true);
        } else {
            showNetworkWarning(false);
        }

        if (window.AFTER_PATMOS_CONFIG?.DEBUG_MODE) {
            console.log('[Wallet] Chain changed:', numericChainId);
        }
    });

    // Disconnect event
    provider.on('disconnect', (error) => {
        console.log('[Wallet] Provider disconnected:', error);
        disconnectWallet();
    });
}

// Handle wallet selection
async function handleWalletSelection(walletType) {
    const statusEl = document.getElementById('wallet-connect-status');

    statusEl.textContent = 'Connecting...';
    statusEl.className = 'wallet-connect-status loading';
    statusEl.style.display = 'block';

    try {
        connectedWallet = walletType;

        if (walletType === 'metamask') {
            await connectMetaMask();
        } else if (walletType === 'walletconnect') {
            await connectWalletConnect();
        } else if (walletType === 'coinbase') {
            await connectCoinbase();
        }
    } catch (error) {
        console.error('[Wallet] Connection error:', error);
        statusEl.textContent = error.message || 'Connection failed';
        statusEl.className = 'wallet-connect-status error';
        connectedWallet = null;
    }
}

// MetaMask connection
async function connectMetaMask() {
    const provider = getProviderForWallet('metamask');

    if (!provider) {
        throw new Error('MetaMask not installed. Please install the MetaMask extension.');
    }

    // Validate network first
    await validateNetwork(provider);

    const accounts = await provider.request({ method: 'eth_requestAccounts' });

    if (accounts.length > 0) {
        currentProvider = provider;
        userAddress = accounts[0];
        setupWalletListeners(provider);
        onWalletConnected(userAddress);
    }
}

// WalletConnect connection (placeholder - requires WalletConnect SDK)
async function connectWalletConnect() {
    const statusEl = document.getElementById('wallet-connect-status');

    // Check if WalletConnect is available
    if (typeof window.WalletConnectProvider !== 'undefined') {
        try {
            const provider = new window.WalletConnectProvider({
                rpc: {
                    1: 'https://mainnet.infura.io/v3/your-infura-key',
                },
            });

            await provider.enable();
            const accounts = provider.accounts;

            if (accounts.length > 0) {
                currentProvider = provider;
                userAddress = accounts[0];
                setupWalletListeners(provider);
                onWalletConnected(userAddress);
            }
        } catch (error) {
            throw new Error('WalletConnect connection failed: ' + error.message);
        }
    } else {
        statusEl.textContent = 'WalletConnect requires additional setup. Please use MetaMask or Coinbase Wallet.';
        statusEl.className = 'wallet-connect-status error';
    }
}

// Coinbase Wallet connection
async function connectCoinbase() {
    const provider = getProviderForWallet('coinbase');

    if (!provider) {
        throw new Error('Coinbase Wallet not found. Please install the Coinbase Wallet extension.');
    }

    // Validate network first
    await validateNetwork(provider);

    const accounts = await provider.request({ method: 'eth_requestAccounts' });

    if (accounts.length > 0) {
        currentProvider = provider;
        userAddress = accounts[0];
        setupWalletListeners(provider);
        onWalletConnected(userAddress);
    }
}

// Called when wallet is successfully connected
function onWalletConnected(address) {
    const connectWalletBtn = document.getElementById('connect-wallet-btn');
    const disconnectBtn = document.getElementById('disconnect-btn');
    const galleryBtn = document.getElementById('gallery-btn');
    const walletConnectModal = document.getElementById('wallet-connect-modal');

    const shortAddress = `${address.substring(0, 6)}...${address.substring(address.length - 4)}`;

    // Update connect button to show address
    if (connectWalletBtn) {
        connectWalletBtn.textContent = shortAddress;
        connectWalletBtn.classList.add('connected');
    }

    // Show Gallery and Disconnect buttons
    if (galleryBtn) galleryBtn.style.display = 'inline-flex';
    if (disconnectBtn) disconnectBtn.style.display = 'inline-flex';

    // Close modal
    if (walletConnectModal) walletConnectModal.classList.remove('active');

    // Store in session (with wallet type for reconnection)
    sessionStorage.setItem('connectedWallet', address);
    sessionStorage.setItem('walletType', connectedWallet || 'unknown');

    // Track wallet connection
    if (window.afterPatmosAnalytics) {
        window.afterPatmosAnalytics.trackWalletConnection(connectedWallet || 'unknown', address);
    }

    if (window.AFTER_PATMOS_CONFIG?.DEBUG_MODE) {
        console.log('[Wallet] Connected:', address, 'via', connectedWallet);
    }
}

// Disconnect wallet
function disconnectWallet() {
    const connectWalletBtn = document.getElementById('connect-wallet-btn');
    const disconnectBtn = document.getElementById('disconnect-btn');
    const galleryBtn = document.getElementById('gallery-btn');

    // Clean up provider listeners
    if (currentProvider?.removeAllListeners) {
        currentProvider.removeAllListeners('accountsChanged');
        currentProvider.removeAllListeners('chainChanged');
        currentProvider.removeAllListeners('disconnect');
    }

    userAddress = null;
    connectedWallet = null;
    currentProvider = null;

    // Reset connect button
    if (connectWalletBtn) {
        connectWalletBtn.textContent = 'Connect Wallet';
        connectWalletBtn.classList.remove('connected');
    }

    // Hide Gallery and Disconnect buttons
    if (galleryBtn) galleryBtn.style.display = 'none';
    if (disconnectBtn) disconnectBtn.style.display = 'none';

    // Hide network warning
    showNetworkWarning(false);

    sessionStorage.removeItem('connectedWallet');
    sessionStorage.removeItem('walletType');

    if (window.AFTER_PATMOS_CONFIG?.DEBUG_MODE) {
        console.log('[Wallet] Disconnected');
    }
}

// Check for existing connection
async function checkExistingConnection() {
    const savedAddress = sessionStorage.getItem('connectedWallet');
    const savedWalletType = sessionStorage.getItem('walletType');

    if (savedAddress && savedWalletType) {
        const provider = getProviderForWallet(savedWalletType) || window.ethereum;

        if (provider) {
            try {
                // Verify the account is still connected
                const accounts = await provider.request({ method: 'eth_accounts' });

                if (accounts.length > 0 && accounts[0].toLowerCase() === savedAddress.toLowerCase()) {
                    // Validate network
                    try {
                        await validateNetwork(provider);
                    } catch {
                        // Network wrong but still connected - show warning
                        showNetworkWarning(true);
                    }

                    currentProvider = provider;
                    userAddress = accounts[0];
                    connectedWallet = savedWalletType;
                    setupWalletListeners(provider);
                    onWalletConnected(accounts[0]);
                } else {
                    // Account no longer connected
                    sessionStorage.removeItem('connectedWallet');
                    sessionStorage.removeItem('walletType');
                }
            } catch (error) {
                console.error('[Wallet] Failed to restore connection:', error);
                sessionStorage.removeItem('connectedWallet');
                sessionStorage.removeItem('walletType');
            }
        }
    }
}

// Get current provider for external use
function getCurrentProvider() {
    return currentProvider || window.ethereum;
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', initWalletConnect);

// Export for use in other scripts
window.walletState = {
    getAddress: () => userAddress,
    isConnected: () => !!userAddress,
    getWalletType: () => connectedWallet,
    getProvider: getCurrentProvider,
    disconnect: disconnectWallet,
    switchNetwork: switchToMainnet,
};
