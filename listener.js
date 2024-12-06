const tmi = require("tmi.js");
const fs = require("fs").promises;
const ini = require("ini");
const chalk = require("chalk");
const { exec } = require('child_process');
const PluginManager = require('./src/plugins/PluginManager');
const path = require('path');
const { logger } = require('./src/logger');
const DisplayManager = require('./src/services/DisplayManager');
const BotManager = require('./src/services/BotManager');
const ChatAnalyzer = require('./src/services/ChatAnalyzer');

// Estrutura para armazenar mensagens por canal
const messagePatterns = new Map(); // Canal -> Map<mensagem, { count, timestamps, users }>

// Estrutura para controlar participações por canal
const participationHistory = new Map(); // Canal -> Map<conta, Set<comando>>

// Estrutura única para tracking de comandos
const channelCommands = new Map(); // Canal -> Map<comando, Set<username>>

// Lê configurações do arquivo config.ini
async function getConfig() {
  const configFile = await fs.readFile("./config.ini", "utf-8");
  const config = ini.parse(configFile);
  return {
    clientId: config.CLIENT.ID,
    clientSecret: config.CLIENT.SECRET,
    nomeDoJogo: config.GAME.NAME,
    palavrasChave: config.KEYWORDS.PARTICIPATION.split(','),
    winnerPatterns: config.KEYWORDS.WINNER.split(','),
    whisperPatterns: config.KEYWORDS.WHISPER.split(','),
    participationPatterns: Object.entries(config.PARTICIPATION_TRIGGERS).map(([trigger, command]) => ({
      trigger,
      command
    })),
    patternDetection: {
      threshold: parseInt(config.PATTERN_DETECTION.THRESHOLD) || 5,
      timeWindow: parseInt(config.PATTERN_DETECTION.TIME_WINDOW) || 30000,
      cleanupInterval: parseInt(config.PATTERN_DETECTION.CLEANUP_INTERVAL) || 60000,
      minMessageLength: parseInt(config.PATTERN_DETECTION.MIN_MESSAGE_LENGTH) || 3
    }
  };
}

// Como getConfig agora é async, precisamos inicializar as configurações em uma função async
let config, patternConfig, WINNER_PATTERNS, WHISPER_PATTERNS, PARTICIPATION_PATTERNS;
let cleanupInterval; // Adiciona variável para armazenar o interval

async function initializeConfig() {
    config = await getConfig();
    patternConfig = config.patternDetection;
    WINNER_PATTERNS = config.winnerPatterns;
    WHISPER_PATTERNS = config.whisperPatterns;
    PARTICIPATION_PATTERNS = config.participationPatterns;

    // Configura limpeza periódica após ter as configurações
    if (cleanupInterval) {
        clearInterval(cleanupInterval); // Limpa interval anterior se existir
    }
    cleanupInterval = setInterval(cleanupPatterns, patternConfig.cleanupInterval);
}

function formatMessage(channel, username, message, matchedKeyword) {
  const timestamp = new Date().toLocaleTimeString();
  const channelName = channel.replace('#', '');
  const channelLink = `\u001b]8;;https://twitch.tv/${channelName}\u0007${chalk.cyan(channelName)}\u001b]8;;\u0007`;
  const user = chalk.yellow(username);
  const msg = message.replace(
    matchedKeyword, 
    chalk.red.bold(matchedKeyword)
  );

  // Só exibe mensagens que contenham palavras-chave ou padrões relevantes
  if (!matchedKeyword) return null;

  return `👉 👉 👉 👉 [${timestamp}] ${channelLink} | ${user}: ${msg}`;
}

function detectMessagePattern(channel, message) {
  // Ignora mensagens muito curtas
  if (message.length < patternConfig.minMessageLength) return;

  // Inicializa o Map para o canal se não existir
  if (!messagePatterns.has(channel)) {
    messagePatterns.set(channel, new Map());
  }

  const channelPatterns = messagePatterns.get(channel);
  const now = Date.now();

  // Estrutura para armazenar contagem e timestamps das mensagens
  const pattern = channelPatterns.get(message) || {
    count: 0,
    timestamps: [],
    lastNotified: 0,
    isParticipationCommand: false // Nova flag
  };

  // Adiciona novo timestamp e remove timestamps antigos
  pattern.timestamps = [
    ...pattern.timestamps.filter(t => now - t < patternConfig.timeWindow),
    now
  ];
  pattern.count = pattern.timestamps.length;

  // Verifica se parece ser um comando de participação
  if (!pattern.isParticipationCommand && 
      pattern.count >= patternConfig.threshold && 
      (message.startsWith('!') || message.match(/^[a-zA-Z0-9]+$/))) {
    pattern.isParticipationCommand = true;
  }

  // Atualiza o padrão no Map
  channelPatterns.set(message, pattern);

  // Verifica se atingiu o threshold e não notificou recentemente
  if (pattern.count >= patternConfig.threshold && 
      now - pattern.lastNotified > patternConfig.timeWindow) {
    pattern.lastNotified = now;
    const channelName = channel.replace('#', '');
    const channelLink = `\u001b]8;;https://twitch.tv/${channelName}\u0007${chalk.cyan(channelName)}\u001b]8;;\u0007`;
    return {
      channel: channelLink,
      message,
      count: pattern.count,
      timeWindow: patternConfig.timeWindow / 1000,
      isParticipationCommand: pattern.isParticipationCommand
    };
  }

  return null;
}

function cleanupPatterns() {
  const now = Date.now();
  for (const [channel, patterns] of messagePatterns) {
    for (const [message, pattern] of patterns) {
      pattern.timestamps = pattern.timestamps.filter(t => now - t < patternConfig.timeWindow);
      pattern.count = pattern.timestamps.length;
      if (pattern.count === 0) {
        patterns.delete(message);
      }
    }
    if (patterns.size === 0) {
      messagePatterns.delete(channel);
    }
  }
}

// Adicione após as outras funções de log
async function logWin(channel, username, message) {
    const timestamp = new Date().toISOString();
    const logEntry = {
        timestamp,
        channel: channel.replace('#', ''),
        winner: username,
        message,
        url: `https://twitch.tv/${channel.replace('#', '')}`
    };

    const logFile = 'wins.json';
    let wins = [];
    
    try {
        const content = await fs.readFile(logFile, 'utf8');
        wins = JSON.parse(content);
    } catch (error) {
        // Arquivo não existe, começará com array vazio
    }

    wins.push(logEntry);
    await fs.writeFile(logFile, JSON.stringify(wins, null, 2));
}

// Adicione esta função para celebrar a vitória
async function celebrateWin(bot, channel, username) {
    try {
        // Aguarda 15 segundos
        await new Promise(resolve => setTimeout(resolve, 15000));
        
        // Envia mensagem de celebração
        await bot.say(channel, 'uhuuulll');
        
        // Aguarda 5 minutos antes de sair (se não for o listener)
        const participantConta = contas.find(c => c.nome === username);
        if (!participantConta.isListener) {
            await new Promise(resolve => setTimeout(resolve, 300000)); // 5 minutos
            try {
                await bot.part(channel);
            } catch (error) {
                console.error(`Erro ao sair do canal ${channel}:`, error);
            }
        }
    } catch (error) {
        console.error(`Erro ao celebrar vitória para ${username}:`, error);
    }
}

// Modifique a função checkWinnerOrMention
function checkWinnerOrMention(message, usernames, messageUser, channel, currentBot) {
    const messageLower = message.toLowerCase();
    const timestamp = new Date().toLocaleTimeString();
    const channelName = channel.replace('#', '');
    const channelLink = `\u001b]8;;https://twitch.tv/${channelName}\u0007${chalk.cyan(channelName)}\u001b]8;;\u0007`;

    // Verifica se alguma conta foi mencionada
    for (const username of usernames) {
        const usernameLower = username.toLowerCase();
        
        // Verifica padrões de vitória
        if (WINNER_PATTERNS.some(pattern => messageLower.includes(pattern))) {
            if (messageLower.includes(usernameLower)) {
                // Adiciona o log da vitória
                logWin(channel, username, message);

                // Se o bot atual é o vencedor, programa a celebração
                if (currentBot.getUsername().toLowerCase() === usernameLower) {
                    celebrateWin(currentBot, channel, username);
                }

                return {
                    type: 'winner',
                    message: chalk.green.bold(
                        `\n🎉 🎉   🎉 [${timestamp}] ${channelLink} | PARABÉNS! ${chalk.yellow(username)} GANHOU!\n` +
                        `Mensagem original: ${messageUser}: ${message}\n` +
                        `Vitória registrada em wins.json\n` +
                        `Celebração programada em 15 segundos...\n`
                    )
                };
            }
        }

        // Verifica menções (quando o username aparece na mensagem)
        if (messageLower.includes(usernameLower) && messageUser.toLowerCase() !== usernameLower) {
            return {
                type: 'mention',
                message: chalk.green(
                    `\n👉 👉 👉 👉 👉 [${timestamp}] ${channelLink} | ${chalk.yellow(username)} foi mencionado!\n` +
                    `${messageUser}: ${message}\n`
                )
            };
        }
    }

    return null;
}

// Nova função para detectar comandos de participação
function detectParticipationCommand(message) {
    // Normaliza a mensagem
    const normalizedMsg = message.toLowerCase().trim();
    
    // Lista de comandos conhecidos
    const knownCommands = [
        '!enter',
        '!join',
        '!ticket',
        '!sorteo',
        '!raffle',
        '!giveaway',
        '!sorteio',
        '!participar'
    ];

    // Se é um comando conhecido, retorna imediatamente
    if (knownCommands.includes(normalizedMsg)) {
        logger.debug(`Comando conhecido detectado: ${normalizedMsg}`);
        return normalizedMsg;
    }

    // Se começa com !, analisa o padrão de uso
    if (normalizedMsg.startsWith('!')) {
        // Verifica se é um comando sendo usado por múltiplos usuários
        const channel = message.channel;
        const recentMessages = global.messagePatterns.get(channel) || new Map();
        const commandCount = recentMessages.get(normalizedMsg) || 0;

        if (commandCount >= 3) { // Se 3 ou mais pessoas usaram o mesmo comando
            logger.debug(`Comando popular detectado: ${normalizedMsg} (usado ${commandCount} vezes)`);
            return normalizedMsg;
        }
    }

    return null;
}

// Nova função para verificar se já participou
function hasParticipated(channel, command, conta) {
    if (!participationHistory.has(channel)) {
        participationHistory.set(channel, new Map());
    }
    
    const channelHistory = participationHistory.get(channel);
    if (!channelHistory.has(conta.nome)) {
        channelHistory.set(conta.nome, new Set());
        return false;
    }
    
    return channelHistory.get(conta.nome).has(command);
}

// Nova função para registrar participação
function registerParticipation(channel, command, conta) {
    if (!participationHistory.has(channel)) {
        participationHistory.set(channel, new Map());
    }
    
    const channelHistory = participationHistory.get(channel);
    if (!channelHistory.has(conta.nome)) {
        channelHistory.set(conta.nome, new Set());
    }
    
    channelHistory.get(conta.nome).add(command);
}

// Modifique a função participateInGiveaway
async function participateInGiveaway(bot, channel, command, conta, isListener) {
    // Verifica se já participou deste comando neste canal
    if (hasParticipated(channel, command, conta)) {
        if (isListener) {
            console.log(chalk.yellow(
                `🎮 🎮 🎮 🎮 🎮 [${new Date().toLocaleTimeString()}] ${channel} | ` +
                `${conta.nome} já participou com o comando: ${command}`
            ));
        }
        return false;
    }

    const delay = Math.floor(Math.random() * 2000);
    
    return new Promise((resolve) => {
        setTimeout(async () => {
            try {
                await bot.say(channel, command);
                registerParticipation(channel, command, conta);
                
                if (isListener) {
                    const channelName = channel.replace('#', '');
                    const channelLink = `\u001b]8;;https://twitch.tv/${channelName}\u0007${chalk.cyan(channelName)}\u001b]8;;\u0007`;
                    console.log(chalk.blue(
                        `🎮 🎮 🎮 🎮 🎮 [${new Date().toLocaleTimeString()}] ${channelLink} | ` +
                        `${chalk.yellow(conta.nome)} participou com o comando: ${chalk.green(command)}`
                    ));
                }
                resolve(true);
            } catch (error) {
                console.error(`Erro ao participar com a conta ${conta.nome}:`, error);
                resolve(false);
            }
        }, delay);
    });
}

// Adicione após as outras funções e antes do connectBot
// Adicione um Map para armazenar os bots temporários
const temporaryBots = new Map();

async function participateWithAllAccounts(currentBot, channel, command, isListener) {
    try {
        const contasData = await fs.readFile('contas.json', 'utf8');
        const contas = JSON.parse(contasData);
        
        // Participa com cada conta
        for (const contaParticipante of contas) {
            try {
                // Usa o bot atual para participar
                await participateInGiveaway(currentBot, channel, command, contaParticipante, isListener);
            } catch (error) {
                console.error(`Erro ao participar com conta ${contaParticipante.nome}:`, error);
            }
        }
    } catch (error) {
        console.error('Erro ao fazer participação múltipla:', error);
    }
}

// Adicione após as outras funões
async function logWhisper(conta, from, message) {
    const timestamp = new Date().toISOString();
    const logEntry = {
        timestamp,
        to: conta.nome,
        from,
        message
    };

    const logFile = 'whispers.json';
    let whispers = [];
    
    try {
        const content = await fs.readFile(logFile, 'utf8');
        whispers = JSON.parse(content);
    } catch (error) {
        // Arquivo não existe, começará com array vazio
    }

    whispers.push(logEntry);
    await fs.writeFile(logFile, JSON.stringify(whispers, null, 2));
}

function formatWhisperMessage(from, message, conta) {
    const timestamp = new Date().toLocaleTimeString();
    const fromUser = chalk.magenta(from);
    const toUser = chalk.yellow(conta.nome);
    
    return chalk.bgMagenta.white(
        `\n💌 💌 💌 💌 💌 [${timestamp}] Sussurro de ${fromUser} para ${toUser}:\n` +
        `${message}\n`
    );
}

// Modifique a função connectBot
async function connectBot(conta, canais) {
    try {
        // Remove todos os console.log exceto erros críticos
        let token = conta.token;
        if (!token.startsWith('oauth:')) {
            token = `oauth:${token}`;
        }
        
        // Valida o token antes de tentar conectar
        try {
            const response = await fetch('https://id.twitch.tv/oauth2/validate', {
                headers: {
                    'Authorization': `OAuth ${token.replace('oauth:', '')}`
                }
            });
            
            if (!response.ok) {
                throw new Error('Token inválido');
            }
            
            await response.json();
        } catch (error) {
            throw new Error(`Token inválido para ${conta.nome}`);
        }
        
        // Filtra canais blacklistados
        const blacklistPlugin = global.pluginManager.plugins.get('Blacklist');
        let canaisPermitidos = canais;
        
        if (blacklistPlugin) {
            canaisPermitidos = canais.filter(channel => !blacklistPlugin.isChannelBlacklisted(channel));
            
            const canaisBloqueados = canais.length - canaisPermitidos.length;
            if (canaisBloqueados > 0 && !this.silent) {
                console.log(chalk.yellow(`ℹ️ ${canaisBloqueados} canais na blacklist foram ignorados`));
            }
        }

        // Configuração do bot com canais filtrados
        const bot = new tmi.Client({
            options: { 
                debug: false,
                skipMembership: true,
                skipUpdatingEmotesets: true
            },
            connection: {
                secure: true,
                reconnect: true,
            },
            identity: {
                username: conta.nome,
                password: token,
            },
            channels: conta.isListener ? canaisPermitidos : [],
            logger: {
                info: () => {},
                warn: () => {},
                error: (message) => {
                    if (!message.includes('No response from Twitch')) {
                        logger.error(message);
                    }
                }
            }
        });

        // Tenta conectar
        await bot.connect();

        // Log mais limpo
        if (conta.isListener) {
            DisplayManager.logBotAction({
                bot: conta.nome,
                action: 'connected',
                channels: canais.length
            });
        }

        return bot;
    } catch (error) {
        logger.error(`Erro ao conectar bot ${conta.nome}:`, error);
        return null;
    }
}

// Nova função para configurar eventos do bot
async function setupBotEvents(bot, conta, canais) {
    // Lê configurações necessárias
    const configData = await fs.readFile("./config.ini", "utf-8");
    const config = ini.parse(configData);
    const palavrasChave = config.KEYWORDS.PARTICIPATION.split(',');
    
    // Lê contas para verificar menções
    const contasData = await fs.readFile('contas.json', 'utf8');
    const contas = JSON.parse(contasData);
    const usernames = contas.map(c => c.nome);

    // Configura eventos
    bot.on("message", async (channel, tags, message, self) => {
        if (self) return;
        
        const channelName = channel.replace('#', '');
        const messageLower = message.toLowerCase().trim();
        const normalizedMessage = normalizeCommand(messageLower);

        try {
            // 1. Comandos conhecidos - verificação atualizada
            const isKnownCommand = BotManager.isKnownCommand(normalizedMessage);
            
            // 2. Inicializa tracking do canal
            if (!channelCommands.has(channelName)) {
                channelCommands.set(channelName, new Map());
            }

            const commands = channelCommands.get(channelName);
            
            // 3. Processa a mensagem usando a mensagem normalizada
            if (!commands.has(normalizedMessage)) {
                commands.set(normalizedMessage, {
                    users: new Set(),
                    messages: [],
                    firstSeen: Date.now()
                });
            }

            const cmdData = commands.get(normalizedMessage);
            cmdData.users.add(tags.username);
            cmdData.messages.push({
                user: tags.username,
                timestamp: Date.now()
            });

            // Limpa mensagens antigas
            const now = Date.now();
            const config = isKnownCommand ? 
                BotManager.getCommandConfig(true) : 
                BotManager.getCommandConfig(false);

            cmdData.messages = cmdData.messages.filter(msg => 
                now - msg.timestamp <= config.timeWindow
            );

            // 4. Verifica padrões de detecção
            const hasEnoughUsers = isKnownCommand ? 
                cmdData.users.size >= config.minUsers :  // Para comandos conhecidos, só verifica usuários
                (cmdData.users.size >= config.minUsers && 
                 cmdData.messages.length >= config.minMessages);  // Para desconhecidos, verifica ambos

            if (hasEnoughUsers) {
                const timeSinceFirst = now - cmdData.firstSeen;
                if (timeSinceFirst <= config.timeWindow) {
                    logger.info(`Possível sorteio detectado em ${channelName}:
                        Mensagem: ${normalizedMessage}
                        Usuários únicos: ${cmdData.users.size}/${config.minUsers}
                        Total mensagens: ${cmdData.messages.length}/${isKnownCommand ? config.minUsers : config.minMessages}
                        Tipo: ${isKnownCommand ? 'Comando conhecido' : 'Padrão detectado'}
                        Config usada: ${JSON.stringify(config)}
                        Tempo: ${timeSinceFirst}ms
                    `);

                    // Notifica sobre o padrão detectado
                    DisplayManager.logPatternDetection({
                        channel: channelName,
                        message: normalizedMessage,
                        count: cmdData.messages.length,
                        uniqueUsers: cmdData.users.size,
                        timeWindow: Math.floor(timeSinceFirst / 1000),
                        type: 'participation',
                        isKnownCommand
                    });

                    await BotManager.participateInGiveaway(channel, normalizedMessage, conta.nome);
                    commands.delete(normalizedMessage);
                }
            }

        } catch (error) {
            logger.error(`Erro ao processar mensagem em ${channelName}:`, error);
        }
    });

    // Adiciona evento de whisper
    bot.on("whisper", async (from, userstate, message, self) => {
        // Ignora apenas mensagens realmente enviadas pelo próprio bot
        if (self && from.toLowerCase() === conta.nome.toLowerCase()) {
            return;
        }

        // Salva todos os whispers no arquivo de log
        await logWhisper(conta, from, message);

        // Mostra todos os whispers no console de forma mais limpa
        console.log(chalk.magenta(
            `💌 [${new Date().toLocaleTimeString()}] Whisper de ${chalk.cyan(from)} para ${chalk.yellow(conta.nome)}: ${message}`
        ));

        // Se contiver palavras-chave importantes, destaca
        if (WHISPER_PATTERNS.some(pattern => message.toLowerCase().includes(pattern.toLowerCase()))) {
            console.log(chalk.bgRed.white(
                `🎉 POSSÍVEL VITÓRIA DETECTADA!`
            ));
        }

        // Emite evento para plugins
        await global.pluginManager.emit('onWhisperReceived', from, message, conta.nome);
    });

    // Também podemos adicionar um evento específico para erros de whisper
    bot.on("whisper_error", (error) => {
        console.error(`Erro de whisper para ${conta.nome}:`, error);
    });

    // Só mostra mensagens de conexão/desconexão se for a conta Listener
    if (conta.isListener) {
        bot.on("connected", (addr, port) => {
            console.log(chalk.green(`Bot ${conta.nome} reconectado a ${addr}:${port}`));
        });

        bot.on("disconnected", (reason) => {
            console.log(chalk.red(`Bot ${conta.nome} desconectado: ${reason}`));
        });
    }
}

// No início do arquivo, após as importações
function clearScreen() {
    process.stdout.write('\x1Bc');
}

// Inicializa o gerenciador de plugins globalmente
global.pluginManager = new PluginManager();

// Modifique a função main para inicializar as configurações
async function main() {
    try {
        logger.info('Iniciando sistema do listener...');
        
        // Inicializa configurações primeiro
        await initializeConfig();
        const currentConfig = await getConfig();

        // Carrega plugins primeiro
        logger.info('Carregando plugins...');
        await global.pluginManager.loadPlugins();
        
        // Carrega canais e contas
        logger.info('Carregando configurações...');
        const canaisData = await fs.readFile("canais.json", "utf8");
        const canais = JSON.parse(canaisData);
        const contasData = await fs.readFile("contas.json", "utf8");
        const contas = JSON.parse(contasData);

        // Verifica tokens primeiro
        logger.info('Verificando tokens...');
        try {
            const { stdout, stderr } = await new Promise((resolve, reject) => {
                exec('node oauth2.js', (error, stdout, stderr) => {
                    if (error) reject({ error, stderr });
                    else resolve({ stdout, stderr });
                });
            });

            if (stderr && stderr.includes('error')) {
                throw new Error(`Erro na renovação: ${stderr}`);
            }

            // Valida tokens
            for (const conta of contas) {
                try {
                    const response = await fetch('https://id.twitch.tv/oauth2/validate', {
                        headers: {
                            'Authorization': `OAuth ${conta.access_token}`
                        }
                    });
                    
                    if (!response.ok) {
                        throw new Error(`Token invlido para conta ${conta.nome}`);
                    }
                } catch (error) {
                    throw new Error(`Falha na validação do token para ${conta.nome}: ${error.message}`);
                }
            }

        } catch (error) {
            logger.error('Erro na verificação de tokens:', error);
            throw error;
        }

        // Configura e conecta bots
        logger.info('Conectando bots...');
        const bots = [];
        for (const conta of contas) {
            const bot = await connectBot(conta, canais);
            if (bot) {
                await setupBotEvents(bot, conta, canais);
                bots.push(bot);
            }
        }

        if (bots.length === 0) {
            throw new Error('Nenhum bot pôde ser iniciado');
        }

        global.activeBots = bots;

        // Limpa a tela e mostra o novo display
        DisplayManager.clearScreen();
        
        // Pequeno delay para garantir que tudo foi limpo
        await new Promise(resolve => setTimeout(resolve, 100));
        
        DisplayManager.showHeader();
        DisplayManager.showStatus({
            startTime: new Date(),
            pluginsCount: global.pluginManager.plugins.size,
            channelsCount: canais.length,
            nextUpdate: new Date(Date.now() + 30 * 60000),
            gameName: currentConfig.nomeDoJogo || 'Not Set'
        });

        // Configura o console para filtrar mensagens indesejadas
        DisplayManager.setupConsole();

        logger.info('Sistema iniciado com sucesso');
        
        // Configura encerramento gracioso
        process.on('SIGINT', async () => {
            logger.info('\nFinalizando sistema...');
            for (const bot of bots) {
                try {
                    await bot.disconnect();
                    logger.info(`Bot ${bot.getUsername()} desconectado`);
                } catch (error) {
                    logger.error(`Erro ao desconectar bot:`, error);
                }
            }
            process.exit(0);
        });

        // Notifica que está pronto
        process.send?.({ type: 'ready' });
        
    } catch (error) {
        logger.error("Erro fatal ao inicializar listener:", error);
        process.exit(1);
    }
}

// Adiciona uma limpeza periódica do histórico de participações
setInterval(() => {
    participationHistory.clear();
}, 1800000); // Limpa a cada 30 minutos

// Função para atualizar canais
async function updateChannels(isListener) {
    try {
        const configData = await fs.readFile('./config.ini', 'utf-8');
        const config = ini.parse(configData);
        const gameName = config.GAME.NAME;

        if (!gameName) {
            if (isListener) {
                console.log(chalk.red('\nErro: Não foi possível atualizar canais - jogo no configurado'));
            }
            return;
        }

        if (isListener) {
            console.log(chalk.cyan('\n Atualizando lista de canais...'));
        }
        
        const url = `http://localhost:3000/start-grabber/${encodeURIComponent(gameName)}`;
        
        const { stdout } = await new Promise((resolve, reject) => {
            exec(`curl "${url}"`, (error, stdout, stderr) => {
                if (error) reject(error);
                else resolve({ stdout, stderr });
            });
        });

        const response = JSON.parse(stdout);
        
        // Filtra canais blacklistados antes de salvar/usar
        const blacklistPlugin = global.pluginManager.plugins.get('Blacklist');
        if (blacklistPlugin) {
            response.canais = response.canais.filter(channel => 
                !blacklistPlugin.isChannelBlacklisted(channel)
            );
            
            if (isListener) {
                console.log(chalk.yellow(`ℹ️ Canais na blacklist foram removidos da lista`));
            }
        }

        if (isListener) {
            console.log(chalk.green('✓ Canais atualizados com sucesso!'));
            console.log(chalk.cyan(`➜ Total de canais: ${chalk.yellow(response.totalCanais)}`));
            console.log(chalk.cyan(`➜ Canais selecionados: ${chalk.yellow(response.canaisSelecionados)}`));

            // Atualiza os canais do bot listener
            const listenerBot = global.activeBots.find(b => b.getUsername() === listenerConta.nome);
            if (listenerBot) {
                const currentChannels = listenerBot.getChannels();
                const newChannels = response.canais;

                // Canais para sair (estão nos atuais mas não nos novos)
                const channelsToLeave = currentChannels.filter(c => !newChannels.includes(c));
                // Canais para entrar (estão nos novos mas não nos atuais)
                const channelsToJoin = newChannels.filter(c => !currentChannels.includes(c));

                // Sai dos canais que não estão mais na lista
                for (const channel of channelsToLeave) {
                    try {
                        await listenerBot.part(channel);
                        console.log(chalk.yellow(`➜ Listener saiu do canal: ${channel}`));
                    } catch (error) {
                        console.error(`Erro ao sair do canal ${channel}:`, error);
                    }
                }

                // Entra nos novos canais
                for (const channel of channelsToJoin) {
                    try {
                        await listenerBot.join(channel);
                        console.log(chalk.green(`➜ Listener entrou no canal: ${channel}`));
                    } catch (error) {
                        console.error(`Erro ao entrar no canal ${channel}:`, error);
                    }
                }
            }

            // Calcula e mostra próxima atualização
            const nextUpdate = new Date(Date.now() + 30 * 60000);
            console.log(chalk.cyan(`\nPróxima atualização: ${nextUpdate.toLocaleTimeString()}`));
            
            console.log(chalk.cyan('\nContinuando monitoramento com a lista atualizada...\n'));
        }

        return response.canais;
    } catch (error) {
        if (isListener) {
            console.error(chalk.red('\nErro ao atualizar canais:', error));
        }
        return null;
    }
}

// No início do arquivo
process.on('uncaughtException', (error) => {
    logger.error('Erro não capturado no listener:', error);
    process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
    logger.error('Promise não tratada rejeitada no listener:', reason);
});

// Executa
logger.info('Iniciando processo do listener...');
main().catch(error => {
    logger.error('Erro fatal:', error);
    process.exit(1);
});

// Adiciona limpeza periódica de padrões
setInterval(() => {
    messagePatterns.clear();
}, 15000); // Reduzido para 15 segundos para detectar novos padrões mais rapidamente

// Verifica conexão dos listeners periodicamente
setInterval(async () => {
    const canaisData = await fs.readFile("canais.json", "utf8");
    const canais = JSON.parse(canaisData);

    for (const [name, { bot, conta }] of BotManager.listeners) {
        const connectedChannels = bot.getChannels();
        const missingChannels = canais.filter(c => !connectedChannels.includes(c));

        if (missingChannels.length > 0) {
            logger.warn(`Bot ${name} não está em ${missingChannels.length} canais. Reconectando...`);
            for (const channel of missingChannels) {
                try {
                    await bot.join(channel);
                    logger.info(`Bot ${name} reconectado ao canal: ${channel}`);
                    await new Promise(resolve => setTimeout(resolve, 100));
                } catch (error) {
                    logger.error(`Erro ao reconectar ${name} ao canal ${channel}:`, error);
                }
            }
        }
    }
}, 60000); // Verifica a cada minuto

// Única limpeza periódica - a cada 5 segundos
setInterval(() => {
    const now = Date.now();
    for (const [channel, commands] of channelCommands) {
        for (const [cmd, data] of commands) {
            if (now - data.firstSeen > 30000) {
                commands.delete(cmd);
            }
        }
        if (commands.size === 0) {
            channelCommands.delete(channel);
        }
    }
}, 5000);

// Limpeza a cada 30 segundos
setInterval(() => {
    channelCommands.clear();
}, 30000);

// Adiciona função de normalização
function normalizeCommand(command) {
    return command
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[\u200B-\u200D\uFEFF\u0000-\u001F\u007F-\u009F\u2000-\u200F\u2028-\u202F\u205F-\u206F]/g, '')
        .replace(/[^\x20-\x7E]/g, '')
        .replace(/\s+/g, ' ')
        .trim()
        .toLowerCase();
}
