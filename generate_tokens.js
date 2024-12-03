const axios = require('axios');
const fs = require('fs');
const ini = require('ini');

const config = ini.parse(fs.readFileSync('./config.ini', 'utf-8'));
const clientId = config.CLIENT.ID;
const clientSecret = config.CLIENT.SECRET;

async function generateTokens(redirectUrl) {
    try {
        const cleanUrl = redirectUrl.replace(/\\/g, '');
        const url = new URL(cleanUrl);
        const code = url.searchParams.get('code');
        const state = url.searchParams.get('state');
        
        if (!code) {
            throw new Error('Código não encontrado na URL');
        }

        // Decodifica o state para obter o nome da conta
        const stateData = JSON.parse(Buffer.from(state, 'base64').toString());
        const accountName = stateData.accountName;

        console.log('Código extraído:', code);
        console.log('Nome da conta:', accountName);

        // Troca o código por tokens usando o endpoint correto
        const tokenResponse = await axios.post('https://id.twitch.tv/oauth2/token', null, {
            params: {
                client_id: clientId,
                client_secret: clientSecret,
                code: code,
                grant_type: 'authorization_code',
                redirect_uri: 'http://localhost'
            }
        });

        // Valida o token obtido
        const validateResponse = await axios.get('https://id.twitch.tv/oauth2/validate', {
            headers: {
                'Authorization': `OAuth ${tokenResponse.data.access_token}`
            }
        });

        console.log('Token validado para usuário:', validateResponse.data.login);

        // Atualiza o arquivo contas.json
        const contas = JSON.parse(fs.readFileSync('contas.json', 'utf-8'));
        const contaIndex = contas.findIndex(conta => 
            conta.nome.toLowerCase() === accountName.toLowerCase()
        );

        if (contaIndex === -1) {
            throw new Error(`Conta ${accountName} não encontrada`);
        }

        // Calcula a data de expiração baseada no expires_in
        const expiryDate = new Date();
        expiryDate.setSeconds(expiryDate.getSeconds() + tokenResponse.data.expires_in);

        // Atualiza os tokens e adiciona o user_id
        contas[contaIndex] = {
            ...contas[contaIndex],
            token: `oauth:${tokenResponse.data.access_token}`,
            access_token: tokenResponse.data.access_token,
            refresh_token: tokenResponse.data.refresh_token,
            expiry: expiryDate.toISOString(),
            user_id: validateResponse.data.user_id
        };

        fs.writeFileSync('contas.json', JSON.stringify(contas, null, 2));

        console.log('\nTokens gerados e salvos com sucesso!');
        console.log(`Tempo de expiração: ${tokenResponse.data.expires_in} segundos`);
        console.log(`Data de expiração: ${expiryDate.toLocaleString()}`);

    } catch (error) {
        console.error('Erro ao gerar tokens:', error.response?.data || error.message);
        throw error;
    }
}

// Execução principal
const redirectUrl = process.argv[2];
if (!redirectUrl) {
    console.error('Por favor, forneça a URL de redirecionamento como argumento.');
    process.exit(1);
}

generateTokens(redirectUrl).catch(error => {
    console.error('Falha ao gerar tokens:', error);
    process.exit(1);
}); 