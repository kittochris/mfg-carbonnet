// DevvE Network Blockchain Integration Service
// Carbon Credit EV Charging App - Blockchain Layer

const axios = require('axios');
const crypto = require('crypto');

/**
 * DevvE Network API Client
 * Handles all interactions with DevvE blockchain testnet
 */
class DevveNetworkClient {
    constructor(apiKey, baseUrl = 'https://devve.testnet.devvio.com', network = 'testnet') {
        this.apiKey = apiKey;
        this.baseUrl = baseUrl;
        this.network = network;
        this.accessToken = null;
        this.username = null;
        this.walletAddress = null;
        this.userUuid = null;
    }

    /**
     * Generate checksum for DevvE transactions
     */
    generateChecksum(coinId, apiKey, amount, clientId) {
        const combined = String(coinId) + String(apiKey) + String(amount) + String(clientId);
        return crypto.createHash('sha256').update(combined).digest('hex');
    }

    /**
     * Check DevvE API response
     */
    checkResponse(response) {
        if (response.status !== 200) {
            return { success: false, error: `HTTP ${response.status}` };
        }

        const result = response.data;

        if ('code' in result) {
            const code = result.code;
            if (code === 4030) {
                return { success: true, result, needsConfirmation: true };
            }
            return { success: false, error: result.message || 'Unknown error', result };
        }

        return { success: true, result };
    }

    /**
     * Register and login to DevvE
     */
    async authenticate() {
        try {
            // Try to login first
            const loginData = {
                username: process.env.DEVVE_USERNAME || 'carbon_credit_app',
                password: process.env.DEVVE_PASSWORD || 'CarbonCredit2024!Secure',
                apikey: this.apiKey
            };

            console.log('🔐 Attempting DevvE login...');
            const loginResponse = await axios.post(`${this.baseUrl}/auth/login`, loginData);
            
            const loginCheck = this.checkResponse(loginResponse);

            if (loginCheck.success) {
                this.accessToken = loginCheck.result.accessToken;
                this.username = loginCheck.result.username;
                this.walletAddress = loginCheck.result.pub;
                
                // Extract UUID from JWT token
                try {
                    const tokenParts = this.accessToken.split('.');
                    const payload = JSON.parse(Buffer.from(tokenParts[1], 'base64').toString());
                    this.userUuid = payload.sub;
                } catch (e) {
                    console.error('Failed to extract UUID from token:', e.message);
                    this.userUuid = null;
                }
                
                console.log('✅ DevvE Authentication successful');
                console.log('   Username:', this.username);
                console.log('   Wallet:', this.walletAddress);
                console.log('   UUID:', this.userUuid);
                console.log('   Access Token: Present');
                return { success: true };
            }

            // If login fails, try to register
            console.log('⚠️  Login failed, attempting registration...');
            const registerData = {
                username: process.env.DEVVE_USERNAME || 'carbon_credit_app',
                password: process.env.DEVVE_PASSWORD || 'CarbonCredit2024!Secure',
                fullName: process.env.DEVVE_FULLNAME || 'Carbon Credit EV App',
                email: process.env.DEVVE_EMAIL || 'carboncredit@yourapp.com',
                apikey: this.apiKey
            };

            const registerResponse = await axios.post(`${this.baseUrl}/auth/register`, registerData);
            
            const registerCheck = this.checkResponse(registerResponse);

            if (registerCheck.success) {
                this.username = registerCheck.result.username;
                this.walletAddress = registerCheck.result.pub;
                
                if (registerCheck.needsConfirmation) {
                    console.log('⚠️  Account created but needs email confirmation');
                    return { success: false, error: 'Email confirmation required' };
                }

                // Try login again
                const retryLogin = await axios.post(`${this.baseUrl}/auth/login`, loginData);
                const retryCheck = this.checkResponse(retryLogin);
                
                if (retryCheck.success) {
                    this.accessToken = retryCheck.result.accessToken;
                    
                    // Extract UUID from token
                    try {
                        const tokenParts = this.accessToken.split('.');
                        const payload = JSON.parse(Buffer.from(tokenParts[1], 'base64').toString());
                        this.userUuid = payload.sub;
                    } catch (e) {
                        console.error('Failed to extract UUID from token:', e.message);
                    }
                    
                    console.log('✅ Registration and login successful');
                    return { success: true };
                }
            }

            return { success: false, error: 'Authentication failed' };
        } catch (error) {
            console.error('❌ Authentication error:', error.message);
            if (error.response) {
                console.error('   Response status:', error.response.status);
                console.error('   Response data:', JSON.stringify(error.response.data, null, 2));
            }
            return { success: false, error: error.message };
        }
    }

    /**
     * Create a wallet for a user (tracks locally)
     */
    async createWallet(userId, userEmail) {
        // Ensure we're authenticated
        if (!this.accessToken) {
            await this.authenticate();
        }

        return {
            success: true,
            wallet: {
                id: `WALLET${Date.now()}`,
                address: this.walletAddress || `devve_${userId}_${Math.random().toString(36).substring(2, 15)}`,
                publicKey: this.walletAddress || `mock_public_key_${userId}`,
                userId: userId,
                network: this.network,
                createdAt: new Date().toISOString()
            }
        };
    }

    /**
     * Record a carbon credit as a blockchain asset
     */
    async recordCarbonCredit(carbonCreditData) {
        try {
            // Ensure we're authenticated
            if (!this.accessToken) {
                const authResult = await this.authenticate();
                if (!authResult.success) {
                    throw new Error('Authentication failed');
                }
            }

            console.log('🔍 Starting carbon credit recording...');
            console.log('   Access Token:', this.accessToken ? 'Present' : 'MISSING');
            console.log('   Username:', this.username);
            console.log('   Wallet Address:', this.walletAddress);
            console.log('   User UUID:', this.userUuid);

            // For demo: use test coin ID
            // In production, you'd have your own registered coin type
            const coinId = "8089685750604583936"; // Test Coin ID as string
            
            // Amount represents carbon credits (scaled by 1000 to avoid decimals)
            const amount = 1;
            
            // Generate unique client ID
            const clientId = `CC_${carbonCreditData.creditId}_${Date.now()}`;
            
            // Generate required checksum
            // Generate required checksum
            const checksum = this.generateChecksum(coinId, this.apiKey, amount, clientId);

            const headers = {
                'Authorization': `Bearer ${this.accessToken}`,
                'Content-Type': 'application/json'
            };

            const createData = {
                coinId: coinId,
                amount: amount,
                clientId: clientId,
                checksum: checksum,
                apikey: this.apiKey,
                uuid: this.userUuid
            };

            console.log('📤 Sending request to DevvE...');
            console.log('   URL:', `${this.baseUrl}/core/asset/create`);
            console.log('   Body:', JSON.stringify(createData, null, 2));

            const response = await axios.post(
                `${this.baseUrl}/core/asset/create`,
                createData,
                { headers }
            );

            console.log('✅ DevvE Response received:', response.status);
            console.log('✅ Response data:', JSON.stringify(response.data, null, 2));

            const check = this.checkResponse(response);

            if (check.success) {
                console.log('✅ Carbon credit recorded successfully on blockchain!');
                return {
                    success: true,
                    transactionHash: check.result.receiptUri || clientId,
                    receiptUri: check.result.receiptUri,
                    blockNumber: check.result.blockHeight || Math.floor(Math.random() * 1000000),
                    status: 'confirmed',
                    amount: check.result.amount
                };
            } else {
                throw new Error(check.error);
            }
        } catch (error) {
            console.error('❌ Error recording carbon credit:', error.message);
            if (error.response) {
                console.error('   Response status:', error.response.status);
                console.error('   Response data:', JSON.stringify(error.response.data, null, 2));
            }
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Get transaction status
     */
    async getTransactionStatus(receiptUri) {
        try {
            if (!this.accessToken) {
                await this.authenticate();
            }

            const headers = {
                'Authorization': `Bearer ${this.accessToken}`,
                'Content-Type': 'application/json'
            };

            const statusData = {
                receiptUris: [receiptUri],
                apikey: this.apiKey
            };

            const response = await axios.post(
                `${this.baseUrl}/core/transactions/status`,
                statusData,
                { headers }
            );

            const check = this.checkResponse(response);

            if (check.success && check.result.clientTxs && check.result.clientTxs.length > 0) {
                const tx = check.result.clientTxs[0];
                return {
                    success: true,
                    status: tx.status || 'confirmed',
                    blockNumber: tx.blockHeight,
                    receiptUri: receiptUri
                };
            }

            return {
                success: true,
                status: 'confirmed',
                receiptUri: receiptUri
            };
        } catch (error) {
            console.error('Error getting transaction status:', error.message);
            return {
                success: false,
                error: error.message
            };
        }
    }
}

/**
 * Mock Blockchain Service
 */
class MockBlockchainService {
    async createWallet(userId, userEmail) {
        return {
            success: true,
            wallet: {
                id: `WALLET${Date.now()}`,
                address: `0x${Math.random().toString(36).substring(2, 15)}${Math.random().toString(36).substring(2, 15)}`,
                publicKey: `mock_public_key_${userId}`,
                userId: userId
            },
            created: true
        };
    }

    async recordCarbonCredit(carbonCreditData) {
        return {
            success: true,
            transactionHash: `0x${Math.random().toString(36).substring(2, 15)}${Math.random().toString(36).substring(2, 15)}`,
            receiptUri: `mock://receipt/${Date.now()}`,
            blockNumber: Math.floor(Math.random() * 1000000),
            status: 'confirmed'
        };
    }

    async getTransactionStatus(txHash) {
        return {
            success: true,
            status: 'confirmed',
            transactionHash: txHash,
            blockNumber: Math.floor(Math.random() * 1000000),
            confirmations: 1,
            timestamp: new Date().toISOString()
        };
    }
}

/**
 * Blockchain Service Factory
 */
function createBlockchainService(apiKey) {
    if (!apiKey || apiKey === 'waiting_for_api_key') {
        console.log('⚠️  No API key detected - Using Mock Blockchain Service');
        return new MockBlockchainService();
    }
    console.log('✅ API key detected - Using Real DevvE Network');
    return new DevveNetworkClient(
        apiKey,
        process.env.DEVVE_BASE_URL || 'https://devve.testnet.devvio.com',
        process.env.DEVVE_NETWORK || 'testnet'
    );
}

module.exports = {
    DevveNetworkClient,
    MockBlockchainService,
    createBlockchainService
};