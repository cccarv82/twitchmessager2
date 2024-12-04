const tmi = require("tmi.js");
const fs = require("fs");
const ini = require("ini");
const chalk = require("chalk");
const { exec } = require('child_process');

// Estrutura para armazenar mensagens por canal
const messagePatterns = new Map(); // Canal -> Map<mensagem, contagem>

// Estrutura para controlar participações por canal
const participationHistory = new Map(); // Canal -> Map<conta, Set<comando>>

// Lê configurações do arquivo config.ini
function getConfig() {
  const config = ini.parse(fs.readFileSync("./config.ini", "utf-8"));
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

// Obtém configuração inicial
const config = getConfig();
const patternConfig = config.patternDetection;
const WINNER_PATTERNS = config.winnerPatterns;
const WHISPER_PATTERNS = config.whisperPatterns;
const PARTICIPATION_PATTERNS = config.participationPatterns;

function formatMessage(channel, username, message, matchedKeyword) {
  const timestamp = new Date().toLocaleTimeString();
  const channelName = channel.replace('#', '');
  const channelLink = `\u001b]8;;https://twitch.tv/${channelName}\u0007${chalk.cyan(channelName)}\u001b]8;;\u0007`;
  const user = chalk.yellow(username);
  const msg = message.replace(
    matchedKeyword, 
    chalk.red.bold(matchedKeyword)
  );

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

// Configura limpeza periódica
setInterval(cleanupPatterns, patternConfig.cleanupInterval);

// Adicione após as outras funções de log
function logWin(channel, username, message) {
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
    
    // Lê o arquivo existente ou cria um novo
    try {
        wins = JSON.parse(fs.readFileSync(logFile, 'utf8'));
    } catch (error) {
        // Arquivo não existe, começará com array vazio
    }

    wins.push(logEntry);
    fs.writeFileSync(logFile, JSON.stringify(wins, null, 2));
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
                        `\n🎉 🎉 🎉 🎉 🎉 [${timestamp}] ${channelLink} | PARABÉNS! ${chalk.yellow(username)} GANHOU!\n` +
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
  const messageLower = message.toLowerCase();
  
  for (const pattern of PARTICIPATION_PATTERNS) {
    if (messageLower.includes(pattern.trigger.toLowerCase())) {
      return pattern.command;
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
        const contas = JSON.parse(fs.readFileSync('contas.json', 'utf8'));
        
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

// Adicione após as outras funções
function logWhisper(conta, from, message) {
    const timestamp = new Date().toISOString();
    const logEntry = {
        timestamp,
        to: conta.nome,
        from,
        message
    };

    const logFile = 'whispers.json';
    let whispers = [];
    
    // Lê o arquivo existente ou cria um novo
    try {
        whispers = JSON.parse(fs.readFileSync(logFile, 'utf8'));
    } catch (error) {
        // Arquivo não existe, começará com array vazio
    }

    whispers.push(logEntry);
    fs.writeFileSync(logFile, JSON.stringify(whispers, null, 2));
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
    // Remove todos os console.log exceto erros críticos
    let token = conta.token;
    if (!token.startsWith('oauth:')) {
        token = `oauth:${token}`;
    }
    
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
        channels: conta.isListener ? canais : [],
        logger: {
            info: () => {},
            warn: () => {},
            error: (message) => {
                if (conta.isListener && !message.includes('No response from Twitch')) {
                    console.error(chalk.red(message));
                }
            }
        }
    });

    try {
        await bot.connect();
        if (conta.isListener) {
            console.log(chalk.green(`✓ Bot ${chalk.yellow(conta.nome)} conectado a ${canais.length} canais`));
        } else {
            console.log(chalk.green(`✓ Bot ${chalk.yellow(conta.nome)} pronto para participações`));
        }
        
        const config = getConfig();
        const palavrasChave = config.palavrasChave.map(p => p.toLowerCase());
        
        // Lê todas as contas para verificar menções
        const contas = JSON.parse(fs.readFileSync('contas.json', 'utf8'));
        const usernames = contas.map(c => c.nome);
        
        // Configurar eventos do bot
        bot.on("message", async (channel, tags, message, self) => {
            if (self) return;
            
            const messageLower = message.toLowerCase();
            
            // Detecta padrões de mensagens
            const pattern = detectMessagePattern(channel, messageLower);
            if (pattern) {
                // Só mostra mensagem de detecção se for listener
                if (conta.isListener) {
                    console.log(
                        chalk.magenta(
                            `\n🔍 🔍 🔍 🔍 🔍 [${new Date().toLocaleTimeString()}] ${pattern.channel} | ` +
                            `Possível ${pattern.isParticipationCommand ? 'comando de participação' : 'giveaway'} detectado!\n` +
                            `Mensagem "${pattern.message}" repetida ${pattern.count} vezes ` +
                            `nos últimos ${pattern.timeWindow} segundos\n`
                        )
                    );
                }

                // Se parece ser um comando de participação
                if (pattern.isParticipationCommand) {
                    const command = pattern.message.trim();
                    if (conta.isListener) {
                        // Se for o listener, coordena a participação de todos
                        const channelName = channel.replace('#', '');
                        for (const participantBot of global.activeBots) {
                            try {
                                // Se não for o listener, entra no canal, participa e depois sai
                                const participantConta = contas.find(c => c.nome === participantBot.getUsername());
                                if (!participantConta.isListener) {
                                    // Primeiro entra no canal
                                    if (!participantBot.getChannels().includes(channel)) {
                                        await participantBot.join(channel);
                                        // Aguarda um momento para garantir a conexão
                                        await new Promise(resolve => setTimeout(resolve, 1000));
                                    }
                                    // Depois participa
                                    await participateInGiveaway(participantBot, channel, command, participantConta, conta.isListener);
                                    
                                    // Sai do canal após participar
                                    setTimeout(async () => {
                                        try {
                                            await participantBot.part(channel);
                                        } catch (error) {
                                            console.error(`Erro ao sair do canal ${channel}:`, error);
                                        }
                                    }, 5000);
                                } else {
                                    // Se for o listener, apenas participa
                                    await participateInGiveaway(participantBot, channel, command, participantConta, conta.isListener);
                                }
                            } catch (error) {
                                console.error(`Erro ao participar com ${participantBot.getUsername()}:`, error);
                            }
                        }
                    }
                }
            }

            // Verifica se é uma mensagem que indica como participar
            const participationCommand = detectParticipationCommand(message);
            if (participationCommand) {
                // Só mostra mensagem no console se for listener
                if (conta.isListener) {
                    const channelName = channel.replace('#', '');
                    const channelLink = `\u001b]8;;https://twitch.tv/${channelName}\u0007${chalk.cyan(channelName)}\u001b]8;;\u0007`;
                    console.log(chalk.magenta(
                        `🎯 🎯 🎯 🎯 🎯 [${new Date().toLocaleTimeString()}] ${channelLink} | ` +
                        `Comando de participação detectado: ${chalk.green(participationCommand)}\n`
                    ));
                }

                await participateWithAllAccounts(bot, channel, participationCommand, conta.isListener);
            }

            // Verifica se alguém ganhou ou foi mencionado
            const winnerOrMention = checkWinnerOrMention(message, usernames, tags.username, channel, bot);
            if (winnerOrMention) {
                console.log(winnerOrMention.message);
            }
        });

        // Adiciona evento de whisper
        bot.on("whisper", (from, userstate, message, self) => {
            // Adiciona log de debug
            console.log(`Debug whisper - De: ${from}, Para: ${conta.nome}, Self: ${self}, Mensagem: ${message}`);
            
            if (self) {
                console.log(`Debug: Mensagem ignorada por ser self (${conta.nome})`);
                return;
            }

            // Salva todos os whispers no arquivo de log
            logWhisper(conta, from, message);

            // Mostra todos os whispers no console
            console.log(formatWhisperMessage(from, message, conta));
            
            // Alerta especial para whispers
            console.log(chalk.bgYellow.black(
                `\n⚠️ ⚠️ ⚠️ ⚠️ ⚠️ ATENÇÃO! Mensagem privada recebida!\n`
            ));

            // Se contiver palavras-chave importantes, destaca ainda mais
            if (WHISPER_PATTERNS.some(pattern => message.toLowerCase().includes(pattern.toLowerCase()))) {
                console.log(chalk.bgRed.white(
                    `\n🎉 🎉 🎉 POSSÍVEL VITÓRIA DETECTADA! 🎉 🎉 🎉\n` +
                    `Verifique a mensagem acima!\n`
                ));
            }
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

        return bot;
    } catch (error) {
        throw new Error(`Falha ao conectar ${conta.nome}`);
    }
}

// No início do arquivo, após as importações
function clearScreen() {
    process.stdout.write('\x1Bc');
}

// Modifique a função main
async function main() {
    try {
        clearScreen();
        console.log(chalk.cyan.bold('\n=== Twitch Giveaway Monitor ===\n'));
        
        // Primeiro passo: Renovar tokens
        console.log(chalk.cyan('Renovando tokens...'));
        try {
            const { stdout, stderr } = await new Promise((resolve, reject) => {
                exec('node oauth2.js', (error, stdout, stderr) => {
                    if (error) reject({ error, stderr });
                    else resolve({ stdout, stderr });
                });
            });

            // Verifica se houve erro no stderr
            if (stderr && stderr.includes('error')) {
                throw new Error(`Erro na renovação: ${stderr}`);
            }

            console.log(chalk.green('✓ Tokens renovados com sucesso!'));

            // Verifica se os tokens foram realmente renovados
            const contas = JSON.parse(fs.readFileSync('contas.json', 'utf8'));
            for (const conta of contas) {
                try {
                    const response = await fetch('https://id.twitch.tv/oauth2/validate', {
                        headers: {
                            'Authorization': `OAuth ${conta.access_token}`
                        }
                    });
                    
                    if (!response.ok) {
                        throw new Error(`Token inválido para conta ${conta.nome}`);
                    }

                    const data = await response.json();
                    console.log(chalk.green(`✓ Token validado para ${chalk.yellow(conta.nome)}`));
                } catch (error) {
                    throw new Error(`Falha na validação do token para ${conta.nome}: ${error.message}`);
                }
            }

            console.log(chalk.green('\n✓ Todos os tokens verificados com sucesso!\n'));

        } catch (error) {
            console.error(chalk.red('\n✖ Erro crítico na renovação/validação dos tokens:'));
            console.error(chalk.red(error.message));
            console.error(chalk.yellow('\nSugestões:'));
            console.log(chalk.yellow('1. Verifique sua conexão com a internet'));
            console.log(chalk.yellow('2. Verifique se as credenciais no config.ini estão corretas'));
            console.log(chalk.yellow('3. Tente gerar novos tokens usando "Gerar Tokens"'));
            console.log(chalk.yellow('4. Verifique se todas as contas têm refresh_token válido'));
            process.exit(1);
        }

        const canais = JSON.parse(fs.readFileSync("canais.json", "utf8"));
        const contas = JSON.parse(fs.readFileSync("contas.json", "utf8"));
        
        const listenerConta = contas.find(c => c.isListener);
        if (!listenerConta) {
            console.error(chalk.red('Erro: Nenhuma conta configurada como listener!'));
            console.log(chalk.yellow('Configure uma conta como listener no arquivo contas.json'));
            process.exit(1);
        }

        console.log(chalk.green(`➜ Conta listener: ${chalk.yellow(listenerConta.nome)}`));
        console.log(chalk.green(`➜ Monitorando ${chalk.yellow(canais.length)} canais`));
        console.log(chalk.green(`➜ Usando ${chalk.yellow(contas.length)} contas para participação\n`));

        console.log(chalk.cyan('Iniciando bots...\n'));

        const bots = [];
        for (const conta of contas) {
            try {
                const bot = await connectBot(conta, canais);
                bots.push(bot);
            } catch (error) {
                console.error(chalk.red(`✖ Falha ao configurar bot para conta ${conta.nome}`));
            }
        }

        global.activeBots = bots;

        clearScreen(); // Limpa o console novamente após todas as conexões
        console.log(chalk.cyan.bold('\n=== Twitch Giveaway Monitor ===\n'));
        console.log(chalk.green('✓ Monitoramento iniciado com sucesso!'));

        // Adiciona horário de início
        const startTime = new Date();
        console.log(chalk.cyan(`Iniciado em: ${startTime.toLocaleTimeString()}`));

        // Calcula e mostra próxima atualização
        const nextUpdate = new Date(startTime.getTime() + 30 * 60000);
        console.log(chalk.cyan(`Próxima atualização de canais: ${nextUpdate.toLocaleTimeString()}`));

        console.log(chalk.yellow('\nPressione Ctrl+C para encerrar\n'));

        // Mantém o processo rodando e desconecta adequadamente
        process.on('SIGINT', async () => {
            console.log(chalk.yellow('\nFinalizando monitoramento...'));
            for (const bot of bots) {
                try {
                    await bot.disconnect();
                } catch (error) {
                    // Silenciosamente ignora erros de desconexão
                }
            }
            process.exit();
        });

    } catch (error) {
        console.error(chalk.red("\n✖ Erro ao inicializar:", error));
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

main();
