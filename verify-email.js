const axios = require('axios');

async function verifyEmail() {
    const verificationData = {
        apikey: '8f4f6afa-372f-4488-b62e-2faf3a2b51cf',
        username: 'kitto',
        verifyCode: '069232'
    };

    try {
        console.log('📧 Confirming signup with verification code...');
        const response = await axios.post(
            'https://devve.testnet.devvio.com/auth/confirmSignUp',
            verificationData
        );
        
        console.log('✅ SUCCESS!');
        console.log('Response:', JSON.stringify(response.data, null, 2));
    } catch (error) {
        console.error('❌ Error:', error.message);
        if (error.response) {
            console.error('Response:', JSON.stringify(error.response.data, null, 2));
        }
    }
}

verifyEmail();