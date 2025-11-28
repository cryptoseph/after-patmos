/**
 * Metadata Service for After Patmos NFTs
 *
 * This service handles:
 * 1. Fetching current NFT metadata from Arweave/IPFS
 * 2. Creating new metadata JSON with observation
 * 3. Uploading to Arweave for permanent storage
 * 4. Updating Manifold contract's tokenURI
 *
 * IMPORTANT: Requires OWNER_PRIVATE_KEY to be set - this is the wallet
 * that deployed the NFT contract and has admin rights to call setTokenURI
 */

const { ethers } = require('ethers');
const Arweave = require('arweave');
const fs = require('fs');
const path = require('path');

// Arweave client setup
const arweave = Arweave.init({
    host: 'arweave.net',
    port: 443,
    protocol: 'https',
    timeout: 60000,
    logging: false
});

// Manifold ERC721Creator ABI (only the functions we need)
const MANIFOLD_ABI = [
    "function setTokenURI(uint256 tokenId, string calldata uri) external",
    "function setTokenURI(uint256[] memory tokenIds, string[] calldata uris) external",
    "function tokenURI(uint256 tokenId) view returns (string)",
    "function owner() view returns (address)"
];

// Cache for original metadata
const originalMetadataCache = new Map();

/**
 * Initialize the metadata service
 * Returns null if owner wallet is not configured
 */
function initMetadataService(provider) {
    if (!process.env.OWNER_PRIVATE_KEY) {
        console.warn('[MetadataService] OWNER_PRIVATE_KEY not set - metadata updates disabled');
        return null;
    }

    const ownerWallet = new ethers.Wallet(process.env.OWNER_PRIVATE_KEY, provider);
    const nftContract = new ethers.Contract(
        process.env.NFT_CONTRACT,
        MANIFOLD_ABI,
        ownerWallet
    );

    console.log(`[MetadataService] Initialized with owner wallet: ${ownerWallet.address}`);

    return {
        ownerWallet,
        nftContract,
        provider
    };
}

/**
 * Load Arweave wallet from keyfile or base64
 */
async function loadArweaveWallet() {
    // Try keyfile first
    if (process.env.ARWEAVE_KEY_FILE) {
        try {
            const keyPath = path.resolve(process.env.ARWEAVE_KEY_FILE);
            const keyData = fs.readFileSync(keyPath, 'utf8');
            return JSON.parse(keyData);
        } catch (err) {
            console.warn('[MetadataService] Could not load Arweave keyfile:', err.message);
        }
    }

    // Try base64 encoded key
    if (process.env.ARWEAVE_KEY_BASE64) {
        try {
            const keyData = Buffer.from(process.env.ARWEAVE_KEY_BASE64, 'base64').toString('utf8');
            return JSON.parse(keyData);
        } catch (err) {
            console.warn('[MetadataService] Could not decode Arweave key from base64:', err.message);
        }
    }

    return null;
}

/**
 * Fetch original metadata for a token
 * Caches result to avoid repeated fetches
 */
async function fetchOriginalMetadata(tokenId, nftContract) {
    // Check cache
    if (originalMetadataCache.has(tokenId)) {
        return originalMetadataCache.get(tokenId);
    }

    try {
        const tokenURI = await nftContract.tokenURI(tokenId);
        console.log(`[MetadataService] Fetched tokenURI for #${tokenId}: ${tokenURI}`);

        let metadataUrl = tokenURI;

        // Handle different URI schemes
        if (tokenURI.startsWith('ar://')) {
            metadataUrl = `https://arweave.net/${tokenURI.slice(5)}`;
        } else if (tokenURI.startsWith('ipfs://')) {
            metadataUrl = `https://ipfs.io/ipfs/${tokenURI.slice(7)}`;
        }

        const response = await fetch(metadataUrl);
        if (!response.ok) {
            throw new Error(`Failed to fetch metadata: ${response.status}`);
        }

        const metadata = await response.json();
        originalMetadataCache.set(tokenId, metadata);

        return metadata;

    } catch (error) {
        console.error(`[MetadataService] Error fetching metadata for token ${tokenId}:`, error);
        return null;
    }
}

/**
 * Create new metadata JSON with observation embedded
 */
function createObservationMetadata(originalMetadata, tokenId, observation, observer, timestamp) {
    // Start with original metadata
    const newMetadata = {
        ...originalMetadata,
        name: originalMetadata.name || `After Patmos #${tokenId}`,
        description: originalMetadata.description || 'A fragment of the After Patmos collection by IKONBERG',

        // Add observation data
        observation: {
            text: observation,
            observer: observer,
            timestamp: timestamp,
            observed_at: new Date(timestamp * 1000).toISOString()
        }
    };

    // Add or update attributes
    const existingAttributes = originalMetadata.attributes || [];
    const newAttributes = [
        ...existingAttributes.filter(attr =>
            attr.trait_type !== 'Observer' &&
            attr.trait_type !== 'Has Observation' &&
            attr.trait_type !== 'Observation Date'
        ),
        {
            trait_type: 'Has Observation',
            value: 'Yes'
        },
        {
            trait_type: 'Observer',
            value: `${observer.slice(0, 6)}...${observer.slice(-4)}`
        },
        {
            trait_type: 'Observation Date',
            value: new Date(timestamp * 1000).toISOString().split('T')[0]
        }
    ];

    newMetadata.attributes = newAttributes;

    // Add collection info if not present
    if (!newMetadata.external_url) {
        newMetadata.external_url = 'https://afterpatmos.ikonberg.com';
    }

    return newMetadata;
}

/**
 * Upload metadata to Arweave
 * Returns the Arweave transaction ID (ar://txId)
 */
async function uploadToArweave(metadata, tokenId) {
    const arweaveWallet = await loadArweaveWallet();

    if (!arweaveWallet) {
        throw new Error('Arweave wallet not configured. Set ARWEAVE_KEY_FILE or ARWEAVE_KEY_BASE64');
    }

    const metadataJson = JSON.stringify(metadata, null, 2);

    // Create transaction
    const transaction = await arweave.createTransaction({
        data: metadataJson
    }, arweaveWallet);

    // Add tags for discoverability
    transaction.addTag('Content-Type', 'application/json');
    transaction.addTag('App-Name', 'AfterPatmos');
    transaction.addTag('App-Version', '1.0');
    transaction.addTag('Token-Id', tokenId.toString());
    transaction.addTag('Type', 'NFT-Metadata');
    transaction.addTag('Collection', 'After Patmos by IKONBERG');

    // Sign transaction
    await arweave.transactions.sign(transaction, arweaveWallet);

    // Get transaction fee
    const fee = arweave.ar.winstonToAr(transaction.reward);
    console.log(`[MetadataService] Arweave upload fee: ${fee} AR`);

    // Submit transaction
    const response = await arweave.transactions.post(transaction);

    if (response.status !== 200 && response.status !== 202) {
        throw new Error(`Arweave upload failed: ${response.status} ${response.statusText}`);
    }

    const arweaveUri = `ar://${transaction.id}`;
    console.log(`[MetadataService] Uploaded to Arweave: ${arweaveUri}`);

    return {
        txId: transaction.id,
        uri: arweaveUri,
        gatewayUrl: `https://arweave.net/${transaction.id}`
    };
}

/**
 * Update token URI on Manifold contract
 * This requires the owner wallet to have admin rights
 */
async function updateManifoldTokenURI(nftContract, tokenId, newUri) {
    console.log(`[MetadataService] Updating tokenURI for #${tokenId} to ${newUri}`);

    try {
        // Estimate gas
        const gasEstimate = await nftContract.setTokenURI.estimateGas(tokenId, newUri);
        console.log(`[MetadataService] Gas estimate: ${gasEstimate.toString()}`);

        // Send transaction with 20% buffer
        const tx = await nftContract.setTokenURI(tokenId, newUri, {
            gasLimit: gasEstimate * 120n / 100n
        });

        console.log(`[MetadataService] TX submitted: ${tx.hash}`);

        // Wait for confirmation
        const receipt = await tx.wait();
        console.log(`[MetadataService] TX confirmed in block ${receipt.blockNumber}`);

        return {
            txHash: tx.hash,
            blockNumber: receipt.blockNumber,
            gasUsed: receipt.gasUsed.toString()
        };

    } catch (error) {
        console.error('[MetadataService] Error updating tokenURI:', error);
        throw error;
    }
}

/**
 * Full flow: Update NFT metadata with observation
 * 1. Fetch original metadata
 * 2. Create new metadata with observation
 * 3. Upload to Arweave
 * 4. Update Manifold contract
 */
async function updateNFTWithObservation(service, tokenId, observation, observer, timestamp) {
    if (!service) {
        throw new Error('Metadata service not initialized (OWNER_PRIVATE_KEY not set)');
    }

    console.log(`[MetadataService] Starting metadata update for token #${tokenId}`);

    // Step 1: Fetch original metadata
    const originalMetadata = await fetchOriginalMetadata(tokenId, service.nftContract);
    if (!originalMetadata) {
        throw new Error(`Could not fetch original metadata for token ${tokenId}`);
    }

    // Step 2: Create new metadata with observation
    const newMetadata = createObservationMetadata(
        originalMetadata,
        tokenId,
        observation,
        observer,
        timestamp
    );

    console.log(`[MetadataService] Created new metadata with observation`);

    // Step 3: Upload to Arweave
    const arweaveResult = await uploadToArweave(newMetadata, tokenId);

    // Step 4: Update Manifold contract
    const txResult = await updateManifoldTokenURI(
        service.nftContract,
        tokenId,
        arweaveResult.uri
    );

    return {
        success: true,
        tokenId,
        observation,
        observer,
        arweave: arweaveResult,
        transaction: txResult,
        newMetadata
    };
}

/**
 * Batch update multiple tokens (more gas efficient)
 */
async function batchUpdateTokenURIs(service, updates) {
    if (!service) {
        throw new Error('Metadata service not initialized');
    }

    const tokenIds = updates.map(u => u.tokenId);
    const uris = updates.map(u => u.uri);

    console.log(`[MetadataService] Batch updating ${tokenIds.length} tokens`);

    try {
        const gasEstimate = await service.nftContract['setTokenURI(uint256[],string[])'].estimateGas(tokenIds, uris);

        const tx = await service.nftContract['setTokenURI(uint256[],string[])'](tokenIds, uris, {
            gasLimit: gasEstimate * 120n / 100n
        });

        const receipt = await tx.wait();

        return {
            success: true,
            txHash: tx.hash,
            blockNumber: receipt.blockNumber,
            tokensUpdated: tokenIds.length
        };

    } catch (error) {
        console.error('[MetadataService] Batch update failed:', error);
        throw error;
    }
}

/**
 * Check if the owner wallet has admin rights on the contract
 */
async function verifyOwnerPermissions(service) {
    if (!service) {
        return { hasPermission: false, reason: 'Service not initialized' };
    }

    try {
        const contractOwner = await service.nftContract.owner();
        const walletAddress = service.ownerWallet.address;

        if (contractOwner.toLowerCase() === walletAddress.toLowerCase()) {
            return { hasPermission: true, owner: contractOwner };
        }

        // Note: Manifold contracts may have multiple admins
        // For now, we only check ownership
        return {
            hasPermission: false,
            reason: `Wallet ${walletAddress} is not the contract owner (${contractOwner})`,
            contractOwner,
            walletAddress
        };

    } catch (error) {
        return { hasPermission: false, reason: error.message };
    }
}

module.exports = {
    initMetadataService,
    fetchOriginalMetadata,
    createObservationMetadata,
    uploadToArweave,
    updateManifoldTokenURI,
    updateNFTWithObservation,
    batchUpdateTokenURIs,
    verifyOwnerPermissions,
    loadArweaveWallet
};
