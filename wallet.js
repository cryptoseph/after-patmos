// Wallet connection logic

// Wallet state
let connectedWallet = null;
let userAddress = null;

// Initialize wallet connection UI
function initWalletConnect() {
    const connectWalletBtn = document.getElementById('connect-wallet-btn');
    const disconnectBtn = document.getElementById('disconnect-btn');
    const galleryBtn = document.getElementById('gallery-btn');
    const walletConnectModal = document.getElementById('wallet-connect-modal');
    const container = document.getElementById('thirdweb-connect-container');

    if (!container) return;

    // Create wallet options HTML
    container.innerHTML = `
        <h2 style="color: #fff; margin-bottom: 10px; font-size: 20px;">Connect Wallet</h2>
        <p style="color: #888; margin-bottom: 25px; font-size: 14px;">Choose how you want to connect</p>

        <div class="wallet-options">
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
    `;

    // Add event listeners to wallet buttons
    container.querySelectorAll('.wallet-option').forEach(btn => {
        btn.addEventListener('click', () => handleWalletSelection(btn.dataset.wallet));
    });

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

// Handle wallet selection
async function handleWalletSelection(walletType) {
    const statusEl = document.getElementById('wallet-connect-status');

    statusEl.textContent = 'Connecting...';
    statusEl.className = 'wallet-connect-status loading';
    statusEl.style.display = 'block';

    try {
        if (walletType === 'metamask') {
            await connectMetaMask();
        } else if (walletType === 'walletconnect') {
            await connectWalletConnect();
        } else if (walletType === 'coinbase') {
            await connectCoinbase();
        }
    } catch (error) {
        console.error('Connection error:', error);
        statusEl.textContent = error.message || 'Connection failed';
        statusEl.className = 'wallet-connect-status error';
    }
}

// MetaMask connection
async function connectMetaMask() {
    if (typeof window.ethereum === 'undefined') {
        throw new Error('MetaMask not installed. Please install MetaMask extension.');
    }

    const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
    if (accounts.length > 0) {
        userAddress = accounts[0];
        onWalletConnected(userAddress);
    }
}

// WalletConnect connection
async function connectWalletConnect() {
    const statusEl = document.getElementById('wallet-connect-status');
    statusEl.textContent = 'WalletConnect requires additional setup. Please use MetaMask for now.';
    statusEl.className = 'wallet-connect-status error';
}

// Coinbase Wallet connection
async function connectCoinbase() {
    if (typeof window.ethereum === 'undefined') {
        throw new Error('No wallet found. Please install a wallet extension.');
    }

    // Check for Coinbase Wallet
    let coinbaseProvider = window.ethereum;

    // If multiple providers, find Coinbase
    if (window.ethereum.providers) {
        coinbaseProvider = window.ethereum.providers.find(p => p.isCoinbaseWallet) || window.ethereum;
    }

    const accounts = await coinbaseProvider.request({ method: 'eth_requestAccounts' });
    if (accounts.length > 0) {
        userAddress = accounts[0];
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
    connectWalletBtn.textContent = shortAddress;
    connectWalletBtn.classList.add('connected');

    // Show Gallery and Disconnect buttons
    if (galleryBtn) galleryBtn.style.display = 'inline-flex';
    if (disconnectBtn) disconnectBtn.style.display = 'inline-flex';

    // Close modal
    if (walletConnectModal) walletConnectModal.classList.remove('active');

    // Store in session
    sessionStorage.setItem('connectedWallet', address);

    console.log('Wallet connected:', address);
}

// Disconnect wallet
function disconnectWallet() {
    const connectWalletBtn = document.getElementById('connect-wallet-btn');
    const disconnectBtn = document.getElementById('disconnect-btn');
    const galleryBtn = document.getElementById('gallery-btn');

    userAddress = null;
    connectedWallet = null;

    // Reset connect button
    connectWalletBtn.textContent = 'Connect Wallet';
    connectWalletBtn.classList.remove('connected');

    // Hide Gallery and Disconnect buttons
    if (galleryBtn) galleryBtn.style.display = 'none';
    if (disconnectBtn) disconnectBtn.style.display = 'none';

    sessionStorage.removeItem('connectedWallet');
    console.log('Wallet disconnected');
}

// Check for existing connection
function checkExistingConnection() {
    const savedAddress = sessionStorage.getItem('connectedWallet');
    if (savedAddress) {
        userAddress = savedAddress;
        onWalletConnected(savedAddress);
    }
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', initWalletConnect);

// Export for use in other scripts
window.walletState = {
    getAddress: () => userAddress,
    isConnected: () => !!userAddress
};
