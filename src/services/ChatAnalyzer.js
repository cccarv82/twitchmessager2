const { logger } = require('../logger');

class ChatAnalyzer {
    constructor() {
        this.chatPatterns = new Map(); // canal -> padrões
        this.userMessages = new Map(); // canal -> Map(usuário -> mensagens)
        this.learnedPatterns = new Map(); // canal -> padrões aprendidos
        this.messageScores = new Map(); // canal -> Map(mensagem -> score)
        this.lastDetections = new Map(); // Para evitar detecções repetidas
        
        // Configurações mais sensíveis para detecção
        this.config = {
            minDifferentUsers: 5,        // Aumentado para 5 usuários diferentes
            timeWindow: 10000,           // Mantido 10 segundos
            minPatternConfidence: 0.4,   // Mantido
            maxMessageAge: 20000,        // Mantido
            cleanupInterval: 300000,     // Mantido
            detectionCooldown: 5 * 60 * 1000,     // Cooldown de 5 minutos entre detecções do mesmo comando
            commonCommands: [            // Lista de comandos comuns
                '!enter',
                '!join',
                '!ticket',
                '!sorteo',
                '!raffle',
                '!giveaway',
                '!sorteio',
                '!participar'
            ],
            // Caracteres invisíveis comuns para normalizar
            invisibleChars: [
                '\u200B', '\u200C', '\u200D', '\u2060', '\uFEFF', '\u0020', '\u00A0', '\u3000',
                '\u180E', '\u2000', '\u2001', '\u2002', '\u2003', '\u2004', '\u2005', '\u2006',
                '\u2007', '\u2008', '\u2009', '\u200A', '\u202F', '\u205F', '\u0008', '\u0009',
                '\u000A', '\u000B', '\u000C', '\u000D', '\u0085', '\u2028', '\u2029'
            ].join('')
        };

        // Inicia limpeza periódica
        setInterval(() => this.cleanup(), this.config.cleanupInterval);
    }

    normalizeMessage(message) {
        // Remove caracteres invisíveis e normaliza espaços
        return message
            .replace(new RegExp(`[${this.config.invisibleChars}]+`, 'g'), '')
            .trim()
            .toLowerCase();
    }

    shouldProcessMessage(channel, message, timestamp) {
        const normalizedMsg = this.normalizeMessage(message);

        // Se for um comando conhecido, SEMPRE processa
        if (this.config.commonCommands.includes(normalizedMsg)) {
            logger.debug(`Comando conhecido detectado: ${normalizedMsg}`);
            return true;
        }

        // Para outros comandos, verifica cooldown e padrões
        const lastDetection = this.lastDetections.get(`${channel}:${normalizedMsg}`);
        if (lastDetection && (timestamp - lastDetection) < this.config.detectionCooldown) {
            return false;
        }

        // Se começa com !, verifica se é uma única palavra
        if (message.startsWith('!')) {
            if (normalizedMsg.split(' ').length > 1) {
                return false;
            }

            const recentMessages = this.getRecentMessages(channel, timestamp);
            const messageCount = this.countMessageOccurrences(recentMessages, normalizedMsg);
            const uniqueUsers = this.countUniqueUsers(recentMessages, normalizedMsg);
            
            return messageCount >= 3 || uniqueUsers >= 2;
        }

        return false;
    }

    analyzeMessage(channel, username, message, timestamp = Date.now()) {
        const normalizedMsg = this.normalizeMessage(message);

        // Se for comando conhecido, retorna score máximo imediatamente
        if (this.config.commonCommands.includes(normalizedMsg)) {
            logger.info(`Comando conhecido detectado em ${channel}: ${normalizedMsg}`);
            return {
                score: 1.0,
                isPattern: true,
                uniqueUsers: 1,
                messageCount: 1,
                details: {
                    channel,
                    message: normalizedMsg,
                    timestamp,
                    isCommonCommand: true
                }
            };
        }

        // Para outros comandos, continua com a análise normal
        if (!this.shouldProcessMessage(channel, normalizedMsg, timestamp)) {
            return { score: 0, isPattern: false };
        }

        // Inicializa estruturas para o canal
        if (!this.userMessages.has(channel)) {
            this.userMessages.set(channel, new Map());
            this.messageScores.set(channel, new Map());
        }

        const channelMessages = this.userMessages.get(channel);
        const messageScores = this.messageScores.get(channel);

        // Registra mensagem do usuário
        if (!channelMessages.has(username)) {
            channelMessages.set(username, []);
        }
        channelMessages.get(username).push({ message: normalizedMsg, timestamp });

        // Analisa padrões de repetição
        const recentMessages = this.getRecentMessages(channel, timestamp);
        const messageCount = this.countMessageOccurrences(recentMessages, message);
        const uniqueUsers = this.countUniqueUsers(recentMessages, message);

        // Calcula score
        const score = this.calculateMessageScore({
            messageCount,
            uniqueUsers,
            message: normalizedMsg,
            channel
        });

        messageScores.set(normalizedMsg, score);

        // Log detalhado para debug
        logger.debug(`Análise em ${channel}:
            Mensagem: ${normalizedMsg}
            Usuários únicos: ${uniqueUsers}
            Repetições: ${messageCount}
            Score: ${score}
            É comando comum: ${this.config.commonCommands.includes(normalizedMsg)}
            Começa com !: ${normalizedMsg.startsWith('!')}
        `);

        // Se for comando comum, reduz threshold
        const threshold = this.config.commonCommands.includes(normalizedMsg) ? 
            0.3 : // Threshold menor para comandos conhecidos
            this.config.minPatternConfidence;

        // Atualiza último tempo de detecção
        if (score > threshold) {
            this.lastDetections.set(`${channel}:${normalizedMsg}`, timestamp);
        }

        return {
            score,
            isPattern: score > threshold,
            uniqueUsers,
            messageCount,
            details: {
                channel,
                message: normalizedMsg,
                timestamp,
                isCommonCommand: this.config.commonCommands.includes(normalizedMsg)
            }
        };
    }

    getRecentMessages(channel, currentTime) {
        const channelMessages = this.userMessages.get(channel);
        const recentMessages = [];

        for (const [username, messages] of channelMessages) {
            messages
                .filter(msg => currentTime - msg.timestamp <= this.config.timeWindow)
                .forEach(msg => recentMessages.push({ ...msg, username }));
        }

        return recentMessages;
    }

    countMessageOccurrences(messages, targetMessage) {
        return messages.filter(msg => 
            msg.message.toLowerCase() === targetMessage.toLowerCase()
        ).length;
    }

    countUniqueUsers(messages, targetMessage) {
        return new Set(
            messages
                .filter(msg => msg.message.toLowerCase() === targetMessage.toLowerCase())
                .map(msg => msg.username)
        ).size;
    }

    calculateMessageScore({ messageCount, uniqueUsers, message, channel }) {
        const normalizedMsg = this.normalizeMessage(message);

        // Comando conhecido = confiança máxima
        if (this.config.commonCommands.includes(normalizedMsg)) {
            logger.debug(`Comando conhecido ${normalizedMsg} - Score: 1.0`);
            return 1.0; // Confiança máxima para comandos conhecidos
        }

        let score = 0;

        // Começa com ! = base score maior
        if (normalizedMsg.startsWith('!')) {
            score += 0.4;
        }

        // Peso para usuários únicos
        score += (uniqueUsers / this.config.minDifferentUsers) * 0.4;

        // Peso para repetições
        score += (messageCount / (this.config.minDifferentUsers * 2)) * 0.2;

        // Bônus para padrões conhecidos
        if (this.matchesLearnedPattern(channel, normalizedMsg)) {
            score += 0.2;
        }

        logger.debug(`Score calculado para ${normalizedMsg}: ${score}`);
        return Math.min(1, score);
    }

    learnPattern(channel, message, score) {
        if (!this.learnedPatterns.has(channel)) {
            this.learnedPatterns.set(channel, new Map());
        }

        const patterns = this.learnedPatterns.get(channel);
        
        if (patterns.has(message)) {
            // Atualiza confiança do padrão existente
            const currentScore = patterns.get(message);
            patterns.set(message, (currentScore + score) / 2);
        } else {
            // Adiciona novo padrão
            patterns.set(message, score);
        }

        // Integra com Smart Keywords plugin
        const smartKeywords = global.pluginManager?.plugins.get('Smart Keywords');
        if (smartKeywords) {
            smartKeywords.learnPattern({
                channel,
                pattern: message,
                confidence: score,
                type: 'giveaway_command'
            });
        }
    }

    matchesLearnedPattern(channel, message) {
        const patterns = this.learnedPatterns.get(channel);
        if (!patterns) return false;

        // Verifica padrões aprendidos
        for (const [pattern, score] of patterns) {
            if (message.toLowerCase().includes(pattern.toLowerCase()) && 
                score >= this.config.minPatternConfidence) {
                return true;
            }
        }

        // Verifica padrões do Smart Keywords plugin
        const smartKeywords = global.pluginManager?.plugins.get('Smart Keywords');
        if (smartKeywords) {
            return smartKeywords.matchPattern(message, 'giveaway_command');
        }

        return false;
    }

    cleanup() {
        const now = Date.now();

        for (const [channel, messages] of this.userMessages) {
            // Limpa mensagens antigas
            for (const [username, userMessages] of messages) {
                const recentMessages = userMessages.filter(
                    msg => now - msg.timestamp <= this.config.maxMessageAge
                );
                
                if (recentMessages.length === 0) {
                    messages.delete(username);
                } else {
                    messages.set(username, recentMessages);
                }
            }

            // Remove canal se vazio
            if (messages.size === 0) {
                this.userMessages.delete(channel);
                this.messageScores.delete(channel);
            }
        }
    }
}

module.exports = new ChatAnalyzer(); 