const fs = require('fs').promises;
const ini = require('ini');
const express = require('express');
const axios = require('axios');
const chalk = require('chalk');

const app = express();
const port = 3030;

async function openUrl(url) {
    const open = await import('open');
    return open.default(url);
}

async function main() {
    try {
        // Carrega configurações
        const config = ini.parse(await fs.readFile('./config.ini', 'utf-8'));
        const clientId = config.CLIENT.ID;
        const clientSecret = config.CLIENT.SECRET;
        const contas = JSON.parse(await fs.readFile('./contas.json', 'utf8'));

        const scopes = [
            'chat:read',
            'chat:edit',
            'whispers:read',
            'whispers:edit',
            'user:manage:whispers',
            'user:read:email'
        ];

        // Inicia servidor para receber callbacks
        let currentConta = null;
        let contasRestantes = [];
        let isProcessing = false;

        app.get('/', async (req, res) => {
            try {
                const { code } = req.query;
                
                if (!code || !currentConta || isProcessing) {
                    res.send('Erro: Código não encontrado, conta não selecionada ou processamento em andamento');
                    return;
                }

                isProcessing = true;

                // Troca o código por tokens
                const tokenResponse = await axios.post('https://id.twitch.tv/oauth2/token', null, {
                    params: {
                        client_id: clientId,
                        client_secret: clientSecret,
                        code,
                        grant_type: 'authorization_code',
                        redirect_uri: `http://localhost:${port}`
                    }
                });

                // Atualiza os tokens da conta atual
                currentConta.access_token = tokenResponse.data.access_token;
                currentConta.refresh_token = tokenResponse.data.refresh_token;
                currentConta.token = `oauth:${tokenResponse.data.access_token}`;
                currentConta.expiry = new Date(Date.now() + tokenResponse.data.expires_in * 1000).toISOString();

                // Valida os novos tokens
                const validateResponse = await axios.get('https://id.twitch.tv/oauth2/validate', {
                    headers: {
                        'Authorization': `Bearer ${currentConta.access_token}`
                    }
                });

                currentConta.user_id = validateResponse.data.user_id;

                // Salva as alterações
                await fs.writeFile('./contas.json', JSON.stringify(contas, null, 2));

                console.log(chalk.green(`✓ Conta ${currentConta.nome} atualizada com sucesso!`));

                // Remove a conta da lista de pendentes
                contasRestantes = contasRestantes.filter(c => c.nome !== currentConta.nome);

                if (contasRestantes.length > 0) {
                    currentConta = contasRestantes[0];
                    console.log(chalk.yellow(`\nPróxima conta: ${currentConta.nome}`));
                    console.log(chalk.yellow('Por favor, faça logout da conta atual na Twitch e faça login com a próxima conta.'));
                    console.log(chalk.yellow('Pressione Enter quando estiver pronto...'));
                } else {
                    console.log(chalk.green('\n✓ Todas as contas foram atualizadas!'));
                    process.exit(0);
                }

                isProcessing = false;
                res.send(`
                    <h1>Autorização concluída!</h1>
                    <p>Conta ${currentConta.nome} atualizada com sucesso.</p>
                    <p>Você pode fechar esta janela e continuar o processo no terminal.</p>
                `);

            } catch (error) {
                isProcessing = false;
                console.error('Erro ao processar callback:', error);
                res.send('Erro ao processar autorização. Verifique o console.');
            }
        });

        // Inicia o servidor
        app.listen(port, async () => {
            console.log(chalk.cyan('\n=== Atualizador de Scopes ===\n'));
            console.log('Verificando contas que precisam ser atualizadas...\n');

            // Verifica cada conta
            for (const conta of contas) {
                try {
                    const response = await axios.get('https://id.twitch.tv/oauth2/validate', {
                        headers: {
                            'Authorization': `Bearer ${conta.access_token}`
                        }
                    });

                    const hasAllScopes = scopes.every(scope => 
                        response.data.scopes.includes(scope)
                    );

                    if (!hasAllScopes) {
                        console.log(chalk.yellow(`Conta ${conta.nome} precisa ser atualizada`));
                        contasRestantes.push(conta);
                    } else {
                        console.log(chalk.green(`✓ Conta ${conta.nome} já tem todos os scopes necessários`));
                    }
                } catch (error) {
                    console.log(chalk.yellow(`Conta ${conta.nome} precisa ser atualizada`));
                    contasRestantes.push(conta);
                }
            }

            if (contasRestantes.length === 0) {
                console.log(chalk.green('\nTodas as contas já estão atualizadas!'));
                process.exit(0);
            }

            console.log(chalk.cyan('\nIniciando processo de atualização...'));
            console.log(chalk.yellow(`${contasRestantes.length} contas precisam ser atualizadas\n`));

            // Processa primeira conta
            currentConta = contasRestantes[0];
            const authUrl = `https://id.twitch.tv/oauth2/authorize` +
                `?client_id=${clientId}` +
                `&redirect_uri=http://localhost:${port}` +
                `&response_type=code` +
                `&force_verify=true` +
                `&scope=${scopes.join('+')}`;

            console.log(chalk.cyan(`Atualizando conta: ${currentConta.nome}`));
            console.log(chalk.yellow('Por favor:'));
            console.log('1. Certifique-se de estar logado com esta conta na Twitch');
            console.log('2. Copie e cole esta URL no navegador:');
            console.log(chalk.cyan(authUrl));
            console.log('\nAguardando autorização...');

            process.stdin.once('data', async () => {
                await openUrl(authUrl);
            });
        });

    } catch (error) {
        console.error('Erro:', error);
        process.exit(1);
    }
}

main().catch(console.error); 