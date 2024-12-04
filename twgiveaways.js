const inquirer = require('inquirer');
const chalk = require('chalk');
const fs = require('fs');
const { spawn } = require('child_process');
const { exec } = require('child_process');
const tmi = require('tmi.js');
const ini = require('ini');
const PluginManager = require('./src/plugins/PluginManager');

let serverProcess = null;
let isShuttingDown = false;

// Adicione esta função no início do arquivo, após as importações
function waitForEnter() {
    return new Promise((resolve) => {
        // Configura o terminal para modo raw
        process.stdin.setRawMode(true);
        process.stdin.resume();
        process.stdin.setEncoding('utf8');

        const onData = (key) => {
            // Ctrl+C
            if (key === '\u0003') {
                shutdown();
                return;
            }
            
            // Enter ou qualquer outra tecla
            process.stdin.setRawMode(false);
            process.stdin.pause();
            process.stdin.removeListener('data', onData);
            resolve();
        };

        process.stdin.on('data', onData);
    });
}

// Função para limpar o terminal
function clearScreen() {
    process.stdout.write('\x1Bc');
}

// Função para mostrar o cabeçalho
function showHeader() {
    console.log(chalk.cyan.bold('\n=== Twitch Giveaway Monitor ===\n'));
}

// Função para iniciar o servidor
function startServer() {
    return new Promise((resolve) => {
        console.log(chalk.cyan('Iniciando servidor...'));
        serverProcess = spawn('node', ['server.js']);
        
        serverProcess.stdout.on('data', (data) => {
            if (data.toString().includes('App listening')) {
                console.log(chalk.green('Servidor iniciado com sucesso!'));
                resolve();
            }
        });

        serverProcess.stderr.on('data', (data) => {
            console.error(chalk.red(data.toString()));
        });

        // Aguarda um tempo para o servidor iniciar
        setTimeout(resolve, 2000);
    });
}

// Função principal do menu
async function mainMenu() {
    clearScreen();
    console.log(chalk.cyan.bold('\n=== Twitch Giveaway Monitor ===\n'));
    
    const answer = await inquirer.prompt([
        {
            type: 'list',
            name: 'option',
            message: 'Escolha uma opção:',
            choices: menuOptions
        }
    ]);

    switch (answer.option) {
        case 'Adicionar Conta':
            await addAccount();
            break;
        case 'Gerar Tokens':
            await generateTokens();
            break;
        case 'Renovar Tokens':
            await renewTokens();
            break;
        case 'Plugins':
            await listPlugins();
            break;
        case 'Setar Canais':
            await setChannels();
            break;
        case 'Monitorar':
            await monitorChannels();
            break;
        case 'Sair':
            shutdown();
            break;
    }
}

// Função para adicionar conta
async function addAccount() {
    clearScreen();
    showHeader();

    const answers = await inquirer.prompt([
        {
            type: 'input',
            name: 'username',
            message: 'Digite o nome de usuário da Twitch:',
            validate: input => input.length > 0 || 'O nome de usuário é obrigatório'
        },
        {
            type: 'confirm',
            name: 'isListener',
            message: 'Deseja que esta conta seja a conta Listener (responsável por mostrar mensagens)?',
            default: false
        }
    ]);

    // Verifica se contas.json existe, se não, cria
    if (!fs.existsSync('contas.json')) {
        fs.writeFileSync('contas.json', '[]');
    }

    // Lê o arquivo atual
    const contas = JSON.parse(fs.readFileSync('contas.json', 'utf8'));

    // Se esta conta será Listener, remove a flag de outras contas
    if (answers.isListener) {
        contas.forEach(conta => conta.isListener = false);
    }

    // Adiciona nova conta
    contas.push({
        nome: answers.username,
        token: "",
        access_token: "",
        refresh_token: "",
        expiry: null,
        isListener: answers.isListener || (contas.length === 0) // Se for a primeira conta, será Listener por padrão
    });

    // Salva o arquivo
    fs.writeFileSync('contas.json', JSON.stringify(contas, null, 2));

    // Gera URL de autorização
    console.log(chalk.green('\nConta adicionada! Gerando URL de autorização...'));
    
    try {
        const { stdout, stderr } = await new Promise((resolve, reject) => {
            exec('node oauth.js', (error, stdout, stderr) => {
                if (error) reject(error);
                else resolve({ stdout, stderr });
            });
        });

        console.log(chalk.cyan('\nURL de autorização gerada:'));
        console.log(stdout);
        
        console.log(chalk.yellow('\nPressione Enter para voltar ao menu principal...'));
        await waitForEnter();
        mainMenu();
    } catch (error) {
        console.error(chalk.red('Erro ao gerar URL:', error));
        console.log(chalk.yellow('\nPressione Enter para voltar ao menu principal...'));
        await waitForEnter();
        mainMenu();
    }
}

// Função para gerar tokens
async function generateTokens() {
    clearScreen();
    showHeader();

    const answer = await inquirer.prompt([
        {
            type: 'input',
            name: 'url',
            message: 'Cole a URL de redirecionamento:',
            validate: input => input.includes('code=') || 'URL inválida'
        }
    ]);

    try {
        const { stdout, stderr } = await new Promise((resolve, reject) => {
            exec(`node generate_tokens.js "${answer.url}"`, (error, stdout, stderr) => {
                if (error) reject(error);
                else resolve({ stdout, stderr });
            });
        });

        console.log(chalk.green('\nTokens gerados com sucesso!'));
        console.log(stdout);
        
        console.log(chalk.yellow('\nPressione Enter para voltar ao menu principal...'));
        await waitForEnter();
        mainMenu();
    } catch (error) {
        console.error(chalk.red('Erro ao gerar tokens:', error));
        console.log(chalk.yellow('\nPressione Enter para voltar ao menu principal...'));
        await waitForEnter();
        mainMenu();
    }
}

// Função para renovar tokens
async function renewTokens() {
    clearScreen();
    showHeader();
    
    console.log(chalk.cyan('Renovando tokens...'));
    
    try {
        const { stdout, stderr } = await new Promise((resolve, reject) => {
            exec('node oauth2.js', (error, stdout, stderr) => {
                if (error) reject(error);
                else resolve({ stdout, stderr });
            });
        });

        console.log(chalk.green('\nTokens renovados com sucesso!'));
        console.log(stdout);
        
        console.log(chalk.yellow('\nPressione Enter para voltar ao menu principal...'));
        await waitForEnter();
        mainMenu();
    } catch (error) {
        console.error(chalk.red('Erro ao renovar tokens:', error));
        console.log(chalk.yellow('\nPressione Enter para voltar ao menu principal...'));
        await waitForEnter();
        mainMenu();
    }
}

// Função para setar canais
async function setChannels() {
    clearScreen();
    showHeader();

    const answer = await inquirer.prompt([
        {
            type: 'input',
            name: 'game',
            message: 'Digite o nome do jogo:',
            validate: input => input.length > 0 || 'O nome do jogo é obrigatório'
        }
    ]);

    console.log(chalk.cyan('\nBuscando canais...'));
    
    const url = `http://localhost:3000/start-grabber/${encodeURIComponent(answer.game)}`;
    
    try {
        const { stdout, stderr } = await new Promise((resolve, reject) => {
            exec(`curl "${url}"`, (error, stdout, stderr) => {
                if (error) reject(error);
                else resolve({ stdout, stderr });
            });
        });

        try {
            const response = JSON.parse(stdout);
            console.log(chalk.green('\nCanais encontrados com sucesso!'));
            console.log(chalk.cyan(`Total de canais: ${response.totalCanais}`));
            console.log(chalk.cyan(`Canais selecionados: ${response.canaisSelecionados}`));
        } catch (e) {
            console.log(chalk.yellow('\nResposta do servidor:'));
            console.log(stdout);
        }

        console.log(chalk.yellow('\nPressione Enter para voltar ao menu principal...'));
        await waitForEnter();
        mainMenu();
    } catch (error) {
        console.error(chalk.red('Erro ao buscar canais:', error));
        console.log(chalk.yellow('\nPressione Enter para voltar ao menu principal...'));
        await waitForEnter();
        mainMenu();
    }
}

// Adicione esta função no arquivo twgiveaways.js
async function testConnection(conta) {
    return new Promise((resolve, reject) => {
        const testBot = new tmi.Client({
            options: { debug: false },
            connection: {
                secure: true,
                reconnect: true,
            },
            identity: {
                username: conta.nome,
                password: conta.token,
            },
            channels: ['immapiratewanabe'] // Canal de teste
        });

        testBot.connect()
            .then(() => {
                testBot.disconnect();
                resolve(true);
            })
            .catch((error) => {
                reject(error);
            });
    });
}

// Função para atualizar canais
async function updateChannels(isListener) {
    try {
        const config = ini.parse(fs.readFileSync('./config.ini', 'utf-8'));
        const gameName = config.GAME.NAME;

        if (!gameName) {
            if (isListener) {
                console.log(chalk.red('\nErro: Não foi possível atualizar canais - jogo não configurado'));
            }
            return;
        }

        if (isListener) {
            console.log(chalk.cyan('\n🔄 Atualizando lista de canais...'));
        }
        
        const url = `http://localhost:3000/start-grabber/${encodeURIComponent(gameName)}`;
        
        const { stdout } = await new Promise((resolve, reject) => {
            exec(`curl "${url}"`, (error, stdout, stderr) => {
                if (error) reject(error);
                else resolve({ stdout, stderr });
            });
        });

        const response = JSON.parse(stdout);
        
        if (isListener) {
            console.log(chalk.green('✓ Canais atualizados com sucesso!'));
            console.log(chalk.cyan(`➜ Total de canais: ${chalk.yellow(response.totalCanais)}`));
            console.log(chalk.cyan(`➜ Canais selecionados: ${chalk.yellow(response.canaisSelecionados)}`));
            console.log(chalk.cyan('Continuando monitoramento com a lista atualizada...\n'));
        }

        return response.canais;
    } catch (error) {
        if (isListener) {
            console.error(chalk.red('\nErro ao atualizar canais:', error));
        }
        return null;
    }
}

// Modifique a função monitorChannels
async function monitorChannels() {
    clearScreen();
    showHeader();
    
    // Verifica se existem contas configuradas
    if (!fs.existsSync('contas.json')) {
        console.log(chalk.red('Erro: Arquivo contas.json não encontrado'));
        console.log(chalk.yellow('Adicione uma conta primeiro usando a opção "Adicionar conta"'));
        console.log(chalk.yellow('\nPressione Enter para voltar ao menu principal...'));
        await waitForEnter();
        return mainMenu();
    }

    const contas = JSON.parse(fs.readFileSync('contas.json', 'utf8'));
    
    // Verifica se há contas configuradas
    if (!contas.length) {
        console.log(chalk.red('Erro: Nenhuma conta configurada'));
        console.log(chalk.yellow('Adicione uma conta primeiro usando a opção "Adicionar conta"'));
        console.log(chalk.yellow('\nPressione Enter para voltar ao menu principal...'));
        await waitForEnter();
        return mainMenu();
    }

    // Verifica se as contas têm tokens
    const contasInvalidas = contas.filter(conta => 
        !conta.token || 
        !conta.access_token || 
        !conta.refresh_token ||
        conta.token === 'oauth:' ||
        conta.token === 'oauth:undefined'
    );

    if (contasInvalidas.length > 0) {
        console.log(chalk.red('Erro: Existem contas com tokens inválidos:'));
        contasInvalidas.forEach(conta => {
            console.log(chalk.yellow(`- ${conta.nome}`));
        });
        console.log(chalk.cyan('\nPor favor, siga os passos:'));
        console.log(chalk.cyan('1. Use a opção "Adicionar conta" para cada conta'));
        console.log(chalk.cyan('2. Acesse a URL gerada e autorize o aplicativo'));
        console.log(chalk.cyan('3. Use a opção "Gerar Tokens" com a URL de redirecionamento'));
        console.log(chalk.yellow('\nPressione Enter para voltar ao menu principal...'));
        await waitForEnter();
        return mainMenu();
    }

    // Verifica se há canais para monitorar
    if (!fs.existsSync('canais.json')) {
        console.log(chalk.red('Erro: Arquivo canais.json não encontrado'));
        console.log(chalk.yellow('Use a opção "Setar Canais" primeiro para buscar canais'));
        console.log(chalk.yellow('\nPressione Enter para voltar ao menu principal...'));
        await waitForEnter();
        return mainMenu();
    }

    const canais = JSON.parse(fs.readFileSync('canais.json', 'utf8'));
    if (!canais.length) {
        console.log(chalk.red('Erro: Nenhum canal configurado para monitoramento'));
        console.log(chalk.yellow('Use a opção "Setar Canais" primeiro para buscar canais'));
        console.log(chalk.yellow('\nPressione Enter para voltar ao menu principal...'));
        await waitForEnter();
        return mainMenu();
    }

    // Tenta renovar os tokens antes de iniciar
    console.log(chalk.cyan('Verificando tokens...'));
    try {
        await new Promise((resolve, reject) => {
            exec('node oauth2.js', (error, stdout, stderr) => {
                if (error) reject(error);
                else resolve(stdout);
            });
        });
        console.log(chalk.green('Tokens verificados/renovados com sucesso!'));
    } catch (error) {
        console.log(chalk.red('Erro ao verificar/renovar tokens. Tentando iniciar mesmo assim...'));
    }
    
    // Testa a conexão antes de iniciar
    console.log(chalk.cyan('Testando conexão...'));
    try {
        for (const conta of contas) {
            await testConnection(conta);
            console.log(chalk.green(`Conexão testada com sucesso para ${conta.nome}`));
        }
    } catch (error) {
        console.log(chalk.red('Erro ao testar conexão:'), error);
        console.log(chalk.yellow('\nSugestões:'));
        console.log(chalk.yellow('1. Gere um novo token em https://twitchapps.com/tmi/'));
        console.log(chalk.yellow('2. Atualize o arquivo contas.json com o novo token'));
        console.log(chalk.yellow('3. Tente novamente'));
        
        console.log(chalk.yellow('\nPressione Enter para voltar ao menu principal...'));
        await waitForEnter();
        return mainMenu();
    }
    
    console.log(chalk.cyan('\nIniciando monitoramento dos canais...'));
    console.log(chalk.yellow('Pressione Ctrl+C para parar o monitoramento\n'));

    return new Promise((resolve) => {
        const monitor = spawn('node', ['client.js']);
        const listener = spawn('curl', ['http://localhost:3000/start-listener']);

        let hasError = false;
        let updateInterval;

        // Configura a atualização periódica
        updateInterval = setInterval(async () => {
            await updateChannels(true);
        }, 30 * 60 * 1000); // 30 minutos

        monitor.stdout.on('data', (data) => {
            console.log(data.toString());
        });

        monitor.stderr.on('data', (data) => {
            hasError = true;
            console.error(chalk.red(data.toString()));
        });

        listener.stderr.on('data', (data) => {
            hasError = true;
            console.error(chalk.red(`Erro no listener: ${data.toString()}`));
        });

        monitor.on('close', (code) => {
            // Limpa o intervalo de atualização
            if (updateInterval) {
                clearInterval(updateInterval);
            }

            if (hasError) {
                console.log(chalk.red('\nErro durante o monitoramento.'));
                console.log(chalk.yellow('Sugestões:'));
                console.log(chalk.yellow('1. Verifique se os tokens estão válidos (use a opção "Renovar Tokens")'));
                console.log(chalk.yellow('2. Verifique se há canais configurados (use a opção "Setar Canais")'));
                console.log(chalk.yellow('3. Verifique se as contas têm permissão para acessar os canais'));
            } else {
                console.log(chalk.yellow('\nMonitoramento finalizado.'));
            }
            
            console.log(chalk.yellow('\nPressione Enter para voltar ao menu principal...'));
            process.stdin.once('data', () => {
                if (listener.killed === false) {
                    listener.kill();
                }
                resolve();
                mainMenu();
            });
        });

        // Também limpa o intervalo quando o programa é encerrado
        process.on('SIGINT', () => {
            if (updateInterval) {
                clearInterval(updateInterval);
            }
        });
    });
}

// Função para encerrar o servidor e o programa
function shutdown(exitCode = 0) {
    if (isShuttingDown) return;
    isShuttingDown = true;

    console.log(chalk.yellow('\nFinalizando programa...'));
    
    if (serverProcess) {
        console.log(chalk.cyan('Encerrando servidor...'));
        serverProcess.kill();
        serverProcess = null;
    }

    console.log(chalk.yellow('Programa finalizado.\n'));
    process.exit(exitCode);
}

// Inicia o programa
async function init() {
    clearScreen();
    await startServer();
    mainMenu();
}

// Tratamento de saída do programa
process.on('SIGINT', () => shutdown());  // Ctrl+C
process.on('SIGTERM', () => shutdown()); // kill
process.on('SIGHUP', () => shutdown());  // Terminal fechado
process.on('uncaughtException', (error) => {
    console.error(chalk.red('Erro não tratado:'), error);
    shutdown(1);
});
process.on('unhandledRejection', (reason, promise) => {
    console.error(chalk.red('Promise não tratada:'), reason);
    shutdown(1);
});
process.on('exit', (code) => {
    if (serverProcess) {
        serverProcess.kill();
    }
});

// Nova função para scanear canais
async function scanChannels() {
    clearScreen();
    showHeader();

    // Lê o jogo configurado do config.ini
    try {
        const config = ini.parse(fs.readFileSync('./config.ini', 'utf-8'));
        const gameName = config.GAME.NAME;

        if (!gameName) {
            console.log(chalk.red('Erro: Nenhum jogo configurado no config.ini'));
            console.log(chalk.yellow('Configure o jogo primeiro usando a opção "Setar Canais"'));
            console.log(chalk.yellow('\nPressione Enter para voltar ao menu principal...'));
            await waitForEnter();
            return mainMenu();
        }

        console.log(chalk.cyan(`\nScaneando canais para o jogo: ${chalk.yellow(gameName)}\n`));
        
        const url = `http://localhost:3000/start-grabber/${encodeURIComponent(gameName)}`;
        
        try {
            const { stdout, stderr } = await new Promise((resolve, reject) => {
                exec(`curl "${url}"`, (error, stdout, stderr) => {
                    if (error) reject(error);
                    else resolve({ stdout, stderr });
                });
            });

            try {
                const response = JSON.parse(stdout);
                console.log(chalk.green('\nCanais encontrados com sucesso!'));
                console.log(chalk.cyan(`Total de canais: ${chalk.yellow(response.totalCanais)}`));
                console.log(chalk.cyan(`Canais selecionados: ${chalk.yellow(response.canaisSelecionados)}`));
                
                if (response.canaisSelecionados > 0) {
                    console.log(chalk.green('\nCanais atualizados no arquivo canais.json'));
                } else {
                    console.log(chalk.yellow('\nNenhum canal relevante encontrado neste momento'));
                }
            } catch (e) {
                console.log(chalk.yellow('\nResposta do servidor:'));
                console.log(stdout);
            }

            console.log(chalk.yellow('\nPressione Enter para voltar ao menu principal...'));
            await waitForEnter();
            mainMenu();
        } catch (error) {
            console.error(chalk.red('Erro ao buscar canais:', error));
            console.log(chalk.yellow('\nPressione Enter para voltar ao menu principal...'));
            await waitForEnter();
            mainMenu();
        }
    } catch (error) {
        console.error(chalk.red('Erro ao ler config.ini:', error));
        console.log(chalk.yellow('\nPressione Enter para voltar ao menu principal...'));
        await waitForEnter();
        mainMenu();
    }
}

async function listPlugins() {
    clearScreen();
    console.log(chalk.cyan.bold('\n=== Plugins Instalados ===\n'));

    const pluginManager = new PluginManager();
    await pluginManager.loadPlugins(true);

    if (pluginManager.plugins.size === 0) {
        console.log(chalk.yellow('Nenhum plugin instalado.'));
        console.log(chalk.gray('\nPara instalar plugins, coloque-os na pasta plugins/'));
    } else {
        // Lista todos os plugins
        for (const [name, plugin] of pluginManager.plugins) {
            const status = plugin.config?.enabled ? 
                chalk.green('✓') : 
                chalk.red('✗');
            
            console.log(`${status} ${chalk.cyan(name)} v${plugin.version}`);
            console.log(chalk.gray(`   ${plugin.description}`));
            
            // Mostra status das features se o plugin tiver
            if (plugin.config?.features) {
                console.log(chalk.gray('   Features:'));
                for (const [feature, config] of Object.entries(plugin.config.features)) {
                    const featureStatus = config.enabled ? 
                        chalk.green('✓') : 
                        chalk.red('✗');
                    console.log(`   ${featureStatus} ${feature}`);
                }
            }
            console.log(); // Linha em branco entre plugins
        }
    }

    console.log(chalk.yellow('\nPressione Enter para voltar ao menu principal...'));
    await waitForEnter();
    return mainMenu();
}

const menuOptions = [
    'Adicionar Conta',
    'Gerar Tokens',
    'Renovar Tokens',
    'Plugins',
    'Setar Canais',
    'Monitorar',
    'Sair'
];

init(); 