const fs = require('fs');
const ini = require('ini');

// Lê as configurações
const config = ini.parse(fs.readFileSync('./config.ini', 'utf-8'));
const clientId = config.CLIENT.ID;

// Scopes necessários para chat e outras funcionalidades
const scopes = [
    'chat:read',
    'chat:edit',
    'whispers:read',
    'whispers:edit'
].join(' ');

// Gera URL de autorização para cada conta
function generateAuthUrl(accountName) {
    const state = Buffer.from(JSON.stringify({
        accountName,
        timestamp: Date.now()
    })).toString('base64');

    const params = new URLSearchParams({
        client_id: clientId,
        redirect_uri: 'http://localhost',
        response_type: 'code',
        scope: scopes,
        state: state,
        force_verify: true
    });

    return `https://id.twitch.tv/oauth2/authorize?${params.toString()}`;
}

// Lê as contas e gera URLs
const contas = JSON.parse(fs.readFileSync('contas.json', 'utf8'));
contas.forEach(conta => {
    console.log(`\nURL de autorização para ${conta.nome}:`);
    console.log(generateAuthUrl(conta.nome));
});
