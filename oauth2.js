const fs = require('fs');
const axios = require('axios');
const ini = require('ini');

const config = ini.parse(fs.readFileSync('./config.ini', 'utf-8'));
const clientId = config.CLIENT.ID;
const clientSecret = config.CLIENT.SECRET;

const scopes = [
    'chat:read',
    'chat:edit',
    'whispers:read',
    'whispers:edit',
    'user:manage:whispers',
    'user:read:email'
];

async function refreshTokens() {
    try {
        const contas = JSON.parse(fs.readFileSync('contas.json', 'utf8'));
        let updated = false;

        for (const conta of contas) {
            try {
                // Verifica se o token atual ainda é válido
                try {
                    await axios.get('https://id.twitch.tv/oauth2/validate', {
                        headers: {
                            'Authorization': `OAuth ${conta.access_token}`
                        }
                    });
                    console.log(`Token ainda válido para ${conta.nome}`);
                    continue;
                } catch (error) {
                    if (error.response?.status !== 401) throw error;
                }

                // Token expirado, tenta renovar
                const response = await axios.post('https://id.twitch.tv/oauth2/token', null, {
                    params: {
                        grant_type: 'refresh_token',
                        refresh_token: conta.refresh_token,
                        client_id: clientId,
                        client_secret: clientSecret,
                        scope: scopes.join(' ')
                    }
                });

                const expiryDate = new Date();
                expiryDate.setSeconds(expiryDate.getSeconds() + response.data.expires_in);

                conta.token = `oauth:${response.data.access_token}`;
                conta.access_token = response.data.access_token;
                conta.refresh_token = response.data.refresh_token;
                conta.expiry = expiryDate.toISOString();

                updated = true;
                console.log(`Tokens renovados com sucesso para ${conta.nome}`);

            } catch (error) {
                console.error(`Erro ao renovar tokens para ${conta.nome}:`, error.message);
                console.log('Será necessário reautorizar esta conta.');
            }
        }

        if (updated) {
            fs.writeFileSync('contas.json', JSON.stringify(contas, null, 2));
            console.log('Arquivo contas.json atualizado');
        }

    } catch (error) {
        console.error('Erro ao processar renovação:', error);
        throw error;
    }
}

refreshTokens().catch(console.error);
