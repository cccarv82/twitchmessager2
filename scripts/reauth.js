const fs = require('fs').promises;
const ini = require('ini');
const open = require('open');

async function main() {
    const config = ini.parse(await fs.readFile('./config.ini', 'utf-8'));
    const clientId = config.CLIENT.ID;

    const scopes = [
        'chat:read',
        'chat:edit',
        'whispers:read',
        'whispers:edit',
        'user:manage:whispers',
        'user:read:email'
    ];

    const authUrl = `https://id.twitch.tv/oauth2/authorize?client_id=${clientId}&redirect_uri=http://localhost&response_type=code&scope=${scopes.join('+')}`;

    console.log('Por favor, autorize cada conta usando este link:');
    console.log(authUrl);
    
    await open(authUrl);
}

main().catch(console.error); 