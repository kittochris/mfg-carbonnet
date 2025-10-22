// Enhanced Carbon Credit API Server with DevvE Blockchain Integration
const express = require('express');
const cors = require('cors');
require('dotenv').config();
const { createBlockchainService } = require('./services/blockchainService');

const app = express();
const PORT = process.env.PORT || 10000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// In-memory storage
let users = [];
let chargingStations = [];
let retailerPartners = [];
let creditRecords = [];
let blockchainWallets = [];
let blockchainTransactions = [];
let companyProfitBalance = 0;

// Revenue split constants
const COMPANY_PROFIT_RATE = parseFloat(process.env.COMPANY_PROFIT_RATE) || 0.25;
const USER_REWARD_RATE = parseFloat(process.env.USER_REWARD_RATE) || 0.25;
const RETAILER_SHARE_RATE = parseFloat(process.env.RETAILER_SHARE_RATE) || 0.50;
const CARBON_PRICE_PER_TONNE = parseFloat(process.env.CARBON_PRICE_PER_TONNE) || 25;
const BLOCKCHAIN_PREMIUM_MULTIPLIER = parseFloat(process.env.BLOCKCHAIN_PREMIUM_MULTIPLIER) || 1.68;

// Initialize Blockchain Service
const blockchainService = createBlockchainService(process.env.DEVVE_API_KEY);

// Initialize sample data
function initializeData() {
    retailerPartners = [
        {
            id: 'RP001',
            companyName: 'Tesco PLC',
            contactEmail: 'partnerships@tesco.com',
            revenueShareBalance: 0,
            hostedStores: ['STORE001'],
            createdAt: new Date().toISOString()
        }
    ];

    chargingStations = [
        {
            id: 'CS001',
            location: "London King's Cross",
            operatorName: 'BP Chargemaster',
            renewableEnergyPercentage: 0.85,
            isActive: true
        },
        {
            id: 'CS002',
            location: 'Manchester Piccadilly',
            operatorName: 'Pod Point',
            renewableEnergyPercentage: 0.75,
            isActive: true
        },
        {
            id: 'CS003',
            location: 'Birmingham New Street',
            operatorName: 'Ionity',
            renewableEnergyPercentage: 0.90,
            isActive: true
        },
        {
            id: 'CS004',
            location: 'Edinburgh Waverley',
            operatorName: 'ChargePlace Scotland',
            renewableEnergyPercentage: 0.95,
            isActive: true
        }
    ];
}

// Helper functions
function calculateCarbonCredits(kwhCharged, renewablePercentage) {
    const gridCarbonIntensity = 0.233;
    const carbonSaved = kwhCharged * gridCarbonIntensity * renewablePercentage;
    return carbonSaved / 1000;
}

function findUserById(id) {
    return users.find(user => user.id === id);
}

function findStationById(id) {
    return chargingStations.find(station => station.id === id);
}

// API Routes
app.get('/api/health', (req, res) => {
    res.json({ 
        status: 'OK', 
        message: 'Carbon Credit API with DevvE Blockchain is running',
        blockchain: {
            network: process.env.DEVVE_NETWORK || 'testnet',
            enabled: process.env.DEVVE_API_KEY !== 'waiting_for_api_key',
            apiKey: process.env.DEVVE_API_KEY ? 'Configured' : 'Missing'
        }
    });
});

// Users endpoints
app.post('/api/users/register', async (req, res) => {
    const { name, email } = req.body;
    
    if (!name || !email) {
        return res.status(400).json({ error: 'Name and email are required' });
    }

    const userId = `U${Date.now()}`;
    const newUser = {
        id: userId,
        name,
        email,
        carbonCreditBalance: 0,
        rewardBalanceGbp: 0,
        chargingHistory: [],
        createdAt: new Date().toISOString()
    };

    users.push(newUser);

    // Create blockchain wallet
    try {
        const walletResult = await blockchainService.createWallet(userId, email);
        if (walletResult.success) {
            newUser.blockchainWallet = walletResult.wallet.address;
            blockchainWallets.push({
                id: walletResult.wallet.id || `WALLET${Date.now()}`,
                userId: userId,
                address: walletResult.wallet.address,
                createdAt: new Date().toISOString()
            });
        }
    } catch (error) {
        console.error('Wallet creation error:', error);
    }

    res.status(201).json({ 
        message: 'User registered successfully', 
        user: newUser 
    });
});

app.get('/api/users', (req, res) => {
    res.json(users);
});

app.get('/api/users/:id', (req, res) => {
    const user = findUserById(req.params.id);
    if (!user) {
        return res.status(404).json({ error: 'User not found' });
    }
    res.json(user);
});

app.get('/api/stations', (req, res) => {
    res.json(chargingStations);
});

// Charging session with blockchain
app.post('/api/charging-session', async (req, res) => {
    const { userId, stationId, kwhCharged } = req.body;

    if (!userId || !stationId || !kwhCharged) {
        return res.status(400).json({ 
            error: 'userId, stationId, and kwhCharged are required' 
        });
    }

    const user = findUserById(userId);
    const station = findStationById(stationId);

    if (!user || !station) {
        return res.status(404).json({ error: 'User or station not found' });
    }

    const creditAmount = calculateCarbonCredits(kwhCharged, station.renewableEnergyPercentage);
    const useBlockchain = process.env.DEVVE_API_KEY !== 'waiting_for_api_key';
    const pricePerTonne = useBlockchain ? 
        CARBON_PRICE_PER_TONNE * BLOCKCHAIN_PREMIUM_MULTIPLIER : 
        CARBON_PRICE_PER_TONNE;
    
    const creditValue = creditAmount * pricePerTonne;
    const companyProfit = creditValue * COMPANY_PROFIT_RATE;
    const userReward = creditValue * USER_REWARD_RATE;
    const retailerShare = creditValue * RETAILER_SHARE_RATE;

    const sessionId = `SESSION${Date.now()}`;
    const creditId = `CC${Date.now()}`;
    
    const creditRecord = {
        id: creditId,
        sessionId: sessionId,
        userId,
        stationId,
        amount: creditAmount,
        monetaryValue: creditValue,
        blockchainVerified: false,
        blockchainPending: useBlockchain,
        timestamp: new Date().toISOString()
    };

    user.carbonCreditBalance += creditAmount;
    user.rewardBalanceGbp += userReward;
    user.chargingHistory.push(creditId);
    companyProfitBalance += companyProfit;

    const retailer = retailerPartners[0];
    if (retailer) {
        retailer.revenueShareBalance += retailerShare;
    }

    creditRecords.push(creditRecord);

    let blockchainResult = null;
    if (useBlockchain) {
        try {
            const carbonCreditData = {
                creditId,
                sessionId,
                userId,
                stationId,
                amount: creditAmount,
                kwhCharged,
                renewablePercentage: station.renewableEnergyPercentage,
                timestamp: new Date().toISOString(),
                location: {
                    stationName: station.location,
                    operator: station.operatorName
                },
                monetaryValue: creditValue
            };

            const txResult = await blockchainService.recordCarbonCredit(carbonCreditData);
            
            if (txResult.success) {
                const txHash = txResult.transactionHash;
                
                blockchainTransactions.push({
                    id: `BCTX${Date.now()}`,
                    creditId: creditId,
                    sessionId: sessionId,
                    transactionHash: txHash,
                    status: txResult.status || 'confirmed',
                    createdAt: new Date().toISOString()
                });

                creditRecord.blockchainTxHash = txHash;
                creditRecord.blockchainVerified = true;
                creditRecord.blockchainPending = false;

                blockchainResult = {
                    transactionHash: txHash,
                    status: txResult.status || 'confirmed',
                    message: 'Recorded on DevvE blockchain!',
                    receiptUri: txResult.receiptUri
                };
            }
        } catch (error) {
            console.error('Blockchain error:', error);
            blockchainResult = {
                error: error.message,
                message: 'Blockchain submission failed'
            };
        }
    }

    res.status(201).json({
        message: 'Charging session completed successfully',
        session: {
            sessionId: sessionId,
            creditRecord: creditRecord,
            energyCharged: kwhCharged,
            carbonCreditsEarned: creditAmount,
            creditValue: creditValue,
            pricePerTonne: pricePerTonne,
            blockchainPremium: useBlockchain ? `+${((BLOCKCHAIN_PREMIUM_MULTIPLIER - 1) * 100).toFixed(0)}%` : 'N/A',
            userReward: userReward,
            companyProfit: companyProfit,
            retailerShare: retailerShare,
            retailerPartner: retailer ? retailer.companyName : null,
            blockchain: blockchainResult
        }
    });
});

// Blockchain endpoints
app.get('/api/blockchain/transactions/:userId', (req, res) => {
    const userCredits = creditRecords.filter(c => c.userId === req.params.userId);
    const userCreditIds = userCredits.map(c => c.id);
    
    const transactions = blockchainTransactions.filter(tx => 
        userCreditIds.includes(tx.creditId)
    );
    
    res.json({
        transactions,
        total: transactions.length,
        confirmed: transactions.filter(t => t.status === 'confirmed').length,
        pending: transactions.filter(t => t.status === 'pending').length
    });
});

app.get('/api/blockchain/verified-credits/:userId', (req, res) => {
    const verifiedCredits = creditRecords.filter(c => 
        c.userId === req.params.userId && c.blockchainVerified === true
    );
    
    res.json({
        credits: verifiedCredits,
        summary: {
            count: verifiedCredits.length,
            totalCarbonAmount: verifiedCredits.reduce((sum, c) => sum + c.amount, 0),
            totalValue: verifiedCredits.reduce((sum, c) => sum + c.monetaryValue, 0)
        }
    });
});

// Analytics
app.get('/api/analytics/dashboard', (req, res) => {
    const blockchainVerifiedCount = creditRecords.filter(c => c.blockchainVerified).length;
    const blockchainPendingCount = creditRecords.filter(c => c.blockchainPending).length;

    res.json({
        totalUsers: users.length,
        totalStations: chargingStations.length,
        totalRetailers: retailerPartners.length,
        totalCreditsIssued: creditRecords.length,
        totalCarbonCredits: creditRecords.reduce((sum, r) => sum + r.amount, 0).toFixed(3),
        totalRevenueGenerated: creditRecords.reduce((sum, r) => sum + r.monetaryValue, 0).toFixed(2),
        companyProfitBalance: companyProfitBalance.toFixed(2),
        blockchain: {
            enabled: process.env.DEVVE_API_KEY !== 'waiting_for_api_key',
            network: process.env.DEVVE_NETWORK || 'testnet',
            verifiedCredits: blockchainVerifiedCount,
            pendingCredits: blockchainPendingCount,
            verificationRate: creditRecords.length > 0 ? 
                `${((blockchainVerifiedCount / creditRecords.length) * 100).toFixed(1)}%` : '0%'
        },
        recentSessions: creditRecords.slice(-10).reverse()
    });
});

// Initialize and start
initializeData();

app.listen(PORT, () => {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`🔋 Carbon Credit API with DevvE Blockchain`);
    console.log(`${'='.repeat(60)}`);
    console.log(`Server running on http://localhost:${PORT}`);
    console.log(`\nBlockchain Status:`);
    console.log(`  Network: ${process.env.DEVVE_NETWORK || 'testnet'}`);
    console.log(`  API Key: ${process.env.DEVVE_API_KEY !== 'waiting_for_api_key' ? '✅ Configured' : '❌ Not Set'}`);
    console.log(`  Premium: ${BLOCKCHAIN_PREMIUM_MULTIPLIER}x pricing`);
    console.log(`\nAPI Endpoints:`);
    console.log(`  Health: http://localhost:${PORT}/api/health`);
    console.log(`  Dashboard: http://localhost:${PORT}/test-dashboard.html`);
    console.log(`${'='.repeat(60)}\n`);
});