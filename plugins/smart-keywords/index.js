const PluginBase = require('../../src/plugins/PluginBase');
const fs = require('fs').promises;
const path = require('path');
const chalk = require('chalk');
const natural = require('natural');  // Para processamento de linguagem natural
const LanguageDetect = require('languagedetect'); // Para detecção de idioma

class SmartKeywordsPlugin extends PluginBase {
    constructor(manager) {
        super(manager);
        this.name = 'Smart Keywords';
        this.description = 'Detecção inteligente de padrões de giveaway';
        this.version = '1.0.0';
        
        // Inicializa estruturas de dados
        this.patterns = new Map();           // Padrões detectados
        this.messageHistory = new Map();     // Histórico de mensagens
        this.languageDetector = new LanguageDetect();
        this.tokenizer = new natural.WordTokenizer();
        this.classifier = new natural.BayesClassifier();
        this.potentialCommands = new Map(); // Para rastrear comandos potenciais

        // Caminhos dos arquivos
        this.dataDir = path.join(__dirname, 'data');
        this.patternsFile = path.join(this.dataDir, 'patterns.json');
        this.statsFile = path.join(this.dataDir, 'stats.json');
        this.commandsFile = path.join(this.dataDir, 'commands.json');
        this.commandLogFile = path.join(this.dataDir, 'learned_commands.log');

        // Novas estruturas de dados
        this.messageContext = new Map();     // Contexto por canal
        this.participationStats = new Map(); // Estatísticas de participação
        this.channelCooldowns = new Map();   // Cooldowns por canal
    }

    async onLoad() {
        if (!this.silent) {
            console.log(chalk.cyan(`Inicializando ${this.name}...`));
        }
        
        await fs.mkdir(this.dataDir, { recursive: true });
        await this.loadPatterns();
        await this.trainClassifier();
        await this.loadCommands();

        // Registra hooks disponíveis
        this.registerHook('detectLanguage', this.detectLanguage.bind(this));
        this.registerHook('calculateEntropy', this.calculateEntropy.bind(this));
        this.registerHook('analyzePattern', this.analyzePattern.bind(this));
        this.registerHook('getKnownPatterns', this.getKnownPatterns.bind(this));
        this.registerHook('getStats', this.getStats.bind(this));

        if (!this.silent) {
            console.log(chalk.cyan(`Padrões conhecidos: ${this.patterns.size}`));
            console.log(chalk.green(`✓ ${this.name} inicializado com sucesso`));
        }

        // Configura limpeza periódica
        setInterval(() => this.cleanupPotentialCommands(), this.config.features.patternLearning.timeWindow);
        setInterval(() => this.cleanupMessageContext(), this.config.features.patternLearning.contextAnalysis.timeWindow);
        setInterval(() => this.cleanupParticipationStats(), this.config.rateLimiting.global.timeWindow);
    }

    async loadPatterns() {
        try {
            const data = await fs.readFile(this.patternsFile, 'utf8');
            this.patterns = new Map(JSON.parse(data));
        } catch (error) {
            // Arquivo não existe, começa com padrões vazios
            this.patterns = new Map();
        }
    }

    async savePatterns() {
        const data = JSON.stringify([...this.patterns]);
        await fs.writeFile(this.patternsFile, data);
    }

    async trainClassifier() {
        // Treina com padrões conhecidos
        for (const [pattern, info] of this.patterns) {
            if (info.isGiveaway) {
                this.classifier.addDocument(pattern, 'giveaway');
            } else {
                this.classifier.addDocument(pattern, 'not_giveaway');
            }
        }
        this.classifier.train();
    }

    detectLanguage(message) {
        const langs = this.languageDetector.detect(message);
        if (langs.length > 0 && langs[0][1] >= this.config.features.languageDetection.minimumConfidence) {
            return langs[0][0];
        }
        return null;
    }

    calculateEntropy(message) {
        const freq = {};
        for (let char of message) {
            freq[char] = (freq[char] || 0) + 1;
        }
        
        let entropy = 0;
        const len = message.length;
        for (let char in freq) {
            const p = freq[char] / len;
            entropy -= p * Math.log2(p);
        }
        return entropy;
    }

    async processMessage(message, channel) {
        // Verifica se pode participar
        if (!await this.canParticipate(channel)) {
            return;
        }

        const analysis = await this.analyzePattern(message, { channel });
        
        if (analysis.isValid) {
            await this.registerParticipation(channel);
            
            // Se for um comando aprendido, atualiza estatísticas
            if (analysis.type === 'learned_command') {
                const command = this.potentialCommands.get(analysis.command);
                if (command) {
                    command.successRate = (command.successRate * command.occurrences + 1) / (command.occurrences + 1);
                    await this.saveCommands();
                }
            }
        }

        return analysis;
    }

    async analyzePatterns(channel) {
        const history = this.messageHistory.get(channel);
        const messages = history.map(h => h.message);

        // Encontra padrões comuns
        const patterns = this.findCommonPatterns(messages);
        
        for (const [pattern, count] of patterns) {
            if (count >= this.config.features.patternLearning.minOccurrences) {
                const confidence = this.classifier.getClassifications(pattern)[0].value;
                
                if (confidence >= this.config.features.patternLearning.confidenceThreshold) {
                    // Adiciona novo padrão
                    if (!this.patterns.has(pattern)) {
                        this.patterns.set(pattern, {
                            isGiveaway: true,
                            confidence,
                            firstSeen: Date.now(),
                            occurrences: count,
                            channels: new Set([channel])
                        });

                        // Notifica sobre novo padrão
                        if (this.config.reporting.notifyNewPatterns) {
                            console.log(chalk.green(
                                `\n🎯 Novo padrão de giveaway detectado!\n` +
                                `Padrão: ${pattern}\n` +
                                `Confiança: ${(confidence * 100).toFixed(2)}%\n` +
                                `Canal: ${channel}\n`
                            ));
                        }

                        // Salva padrões atualizados
                        await this.savePatterns();
                    }
                }
            }
        }
    }

    findCommonPatterns(messages) {
        const patterns = new Map();
        
        for (const msg of messages) {
            const tokens = this.tokenizer.tokenize(msg.toLowerCase());
            
            // Gera n-grams
            for (let n = 2; n <= 5; n++) {
                for (let i = 0; i <= tokens.length - n; i++) {
                    const pattern = tokens.slice(i, i + n).join(' ');
                    patterns.set(pattern, (patterns.get(pattern) || 0) + 1);
                }
            }
        }

        return patterns;
    }

    // Eventos do sistema
    async onGiveawayDetected(channel, message, pattern) {
        await this.processMessage(message, channel);
    }

    async onMessage(channel, message) {
        await this.processMessage(message, channel);
    }

    async updatePatterns() {
        if (this.config.features.autoUpdate.enabled) {
            // Faz backup dos padrões antigos se configurado
            if (this.config.features.autoUpdate.backupOldPatterns) {
                const backupFile = path.join(this.dataDir, `patterns_${Date.now()}.json.bak`);
                await fs.writeFile(backupFile, JSON.stringify([...this.patterns]));
            }

            // Remove padrões antigos com baixa confiança
            for (const [pattern, info] of this.patterns) {
                if (info.confidence < this.config.features.patternLearning.confidenceThreshold) {
                    this.patterns.delete(pattern);
                }
            }

            // Salva padrões atualizados
            await this.savePatterns();
            
            if (this.config.reporting.logLevel === 'debug') {
                console.log(chalk.gray(`Padrões atualizados. Total: ${this.patterns.size}`));
            }
        }
    }

    // Novo método para retornar padrões conhecidos
    async getKnownPatterns(filter = {}) {
        const patterns = [];
        for (const [pattern, info] of this.patterns) {
            if (filter.minConfidence && info.confidence < filter.minConfidence) continue;
            if (filter.language && info.language !== filter.language) continue;
            patterns.push({ pattern, ...info });
        }
        return patterns;
    }

    // Método melhorado para análise de padrões
    async analyzePattern(message, options = {}) {
        if (!this.config.features.patternLearning.enabled) return null;

        // Verifica se é um comando conhecido
        if (this.config.features.falsePositiveReduction.commandExceptions.enabled) {
            const { prefixes, commonCommands } = this.config.features.falsePositiveReduction.commandExceptions;
            
            if (prefixes.some(prefix => message.startsWith(prefix))) {
                const command = message.slice(1).toLowerCase();
                
                // Verifica se não é um comando blacklistado
                if (this.config.features.patternLearning.commandLearning.blacklistedCommands.includes(command)) {
                    return { isValid: false, reason: 'blacklisted_command' };
                }

                // Verifica comandos conhecidos
                if (commonCommands.includes(command)) {
                    return { isValid: true, type: 'command', command, confidence: 1.0 };
                }
            }
        }

        // Verifica comandos potenciais
        const potentialCommand = await this.checkPotentialCommand(message);
        if (potentialCommand) return potentialCommand;

        // Verifica contexto se disponível
        if (options.channel && this.config.features.patternLearning.contextAnalysis.enabled) {
            const context = await this.analyzeContext(options.channel, message);
            if (context.isGiveaway) {
                return { isValid: true, type: 'context_validated', confidence: 0.9, context };
            }
        }

        // Verifica entropia apenas se não for comando
        if (options.checkEntropy !== false && this.config.features.falsePositiveReduction.enabled) {
            const entropy = this.calculateEntropy(message);
            if (entropy < this.config.features.falsePositiveReduction.minimumEntropy) {
                return { isValid: false, reason: 'low_entropy' };
            }
        }

        // Detecta idioma
        if (options.checkLanguage !== false && this.config.features.languageDetection.enabled) {
            const lang = this.detectLanguage(message);
            if (!lang || !this.config.features.languageDetection.supportedLanguages.includes(lang)) {
                return { isValid: false, reason: 'unsupported_language' };
            }
        }

        // Analisa o padrão
        const tokens = this.tokenizer.tokenize(message.toLowerCase());
        if (tokens.length > this.config.features.patternLearning.maxPatternLength) {
            return { isValid: false, reason: 'too_long' };
        }

        // Retorna análise
        return {
            isValid: true,
            tokens,
            entropy: this.calculateEntropy(message),
            language: this.detectLanguage(message),
            confidence: this.classifier.getClassifications(message)[0].value
        };
    }

    // Limpa comandos antigos periodicamente
    async cleanupPotentialCommands() {
        const now = Date.now();
        const timeWindow = this.config.features.patternLearning.timeWindow;
        
        for (const [command, stats] of this.potentialCommands) {
            if (now - stats.firstSeen > timeWindow) {
                this.potentialCommands.delete(command);
            }
        }
    }

    async loadCommands() {
        try {
            const data = await fs.readFile(this.commandsFile, 'utf8');
            const commands = JSON.parse(data);
            commands.forEach(cmd => {
                this.potentialCommands.set(cmd.command, {
                    occurrences: cmd.occurrences,
                    firstSeen: cmd.firstSeen,
                    lastSeen: cmd.lastSeen,
                    successRate: cmd.successRate || 1.0
                });
            });
        } catch (error) {
            // Arquivo não existe ainda
        }
    }

    async saveCommands() {
        const commands = Array.from(this.potentialCommands.entries())
            .map(([command, stats]) => ({
                command,
                ...stats,
                lastSeen: Date.now()
            }))
            .filter(cmd => cmd.occurrences >= this.config.features.patternLearning.commandLearning.minOccurrences);

        await fs.writeFile(this.commandsFile, JSON.stringify(commands, null, 2));
    }

    async analyzeContext(channel, message) {
        const context = this.messageContext.get(channel) || [];
        const now = Date.now();
        const timeWindow = this.config.features.patternLearning.contextAnalysis.timeWindow;
        const keywords = this.config.features.patternLearning.contextAnalysis.keywords;

        // Limpa mensagens antigas
        while (context.length > 0 && now - context[0].timestamp > timeWindow) {
            context.shift();
        }

        // Adiciona nova mensagem
        context.push({ message, timestamp: now });
        this.messageContext.set(channel, context);

        // Analisa contexto
        const recentMessages = context.map(m => m.message.toLowerCase());
        const hasGiveawayKeywords = keywords.some(keyword => 
            recentMessages.some(msg => msg.includes(keyword))
        );

        return {
            isGiveaway: hasGiveawayKeywords,
            recentMessages: recentMessages.slice(-5), // Últimas 5 mensagens
            keywordsFound: keywords.filter(k => recentMessages.some(msg => msg.includes(k)))
        };
    }

    async checkPotentialCommand(message) {
        const prefixes = this.config.features.falsePositiveReduction.commandExceptions.prefixes;
        if (!prefixes.some(prefix => message.startsWith(prefix))) return null;

        const command = message.slice(1).toLowerCase();
        const stats = this.potentialCommands.get(command);

        if (stats) {
            stats.occurrences++;
            if (stats.occurrences >= this.config.features.patternLearning.commandLearning.minOccurrences) {
                await this.saveCommands();
                await this.logLearnedCommand(command, stats);
                return {
                    isValid: true,
                    type: 'learned_command',
                    command,
                    confidence: 0.8,
                    occurrences: stats.occurrences
                };
            }
        } else {
            this.potentialCommands.set(command, {
                occurrences: 1,
                firstSeen: Date.now(),
                successRate: 0
            });
        }

        return null;
    }

    async canParticipate(channel) {
        if (!this.config.rateLimiting.enabled) return true;

        const now = Date.now();
        const channelStats = this.participationStats.get(channel) || { count: 0, lastParticipation: 0 };
        const globalStats = this.participationStats.get('global') || { count: 0, lastParticipation: 0 };

        // Verifica cooldown do canal
        if (now - channelStats.lastParticipation < this.config.rateLimiting.perChannel.cooldown) {
            return false;
        }

        // Verifica limite por canal
        if (channelStats.count >= this.config.rateLimiting.perChannel.maxParticipations) {
            return false;
        }

        // Verifica limite global
        if (globalStats.count >= this.config.rateLimiting.global.maxParticipations) {
            return false;
        }

        return true;
    }

    async registerParticipation(channel) {
        const now = Date.now();
        
        // Atualiza estatísticas do canal
        let channelStats = this.participationStats.get(channel) || { count: 0, lastParticipation: 0 };
        channelStats.count++;
        channelStats.lastParticipation = now;
        this.participationStats.set(channel, channelStats);

        // Atualiza estatísticas globais
        let globalStats = this.participationStats.get('global') || { count: 0, lastParticipation: 0 };
        globalStats.count++;
        globalStats.lastParticipation = now;
        this.participationStats.set('global', globalStats);
    }

    async cleanupMessageContext() {
        const now = Date.now();
        const timeWindow = this.config.features.patternLearning.contextAnalysis.timeWindow;

        for (const [channel, messages] of this.messageContext) {
            const validMessages = messages.filter(m => now - m.timestamp <= timeWindow);
            if (validMessages.length === 0) {
                this.messageContext.delete(channel);
            } else {
                this.messageContext.set(channel, validMessages);
            }
        }
    }

    async cleanupParticipationStats() {
        const now = Date.now();
        
        // Limpa estatísticas por canal
        for (const [channel, stats] of this.participationStats) {
            if (now - stats.lastParticipation > this.config.rateLimiting.perChannel.timeWindow) {
                stats.count = 0;
            }
        }

        // Limpa estatísticas globais
        const globalStats = this.participationStats.get('global');
        if (globalStats && now - globalStats.lastParticipation > this.config.rateLimiting.global.timeWindow) {
            globalStats.count = 0;
        }
    }

    async logLearnedCommand(command, stats) {
        const timestamp = new Date().toISOString();
        const logEntry = {
            timestamp,
            command,
            occurrences: stats.occurrences,
            successRate: stats.successRate,
            firstSeen: new Date(stats.firstSeen).toISOString(),
            lastSeen: new Date(stats.lastSeen).toISOString()
        };

        await fs.appendFile(
            this.commandLogFile,
            JSON.stringify(logEntry) + '\n'
        );
    }

    async getStats() {
        return {
            patterns: {
                total: this.patterns.size,
                byLanguage: Array.from(this.patterns.values()).reduce((acc, p) => {
                    acc[p.language] = (acc[p.language] || 0) + 1;
                    return acc;
                }, {})
            },
            commands: {
                learned: this.potentialCommands.size,
                mostUsed: Array.from(this.potentialCommands.entries())
                    .sort((a, b) => b[1].occurrences - a[1].occurrences)
                    .slice(0, 10)
                    .map(([cmd, stats]) => ({
                        command: cmd,
                        occurrences: stats.occurrences,
                        successRate: stats.successRate
                    }))
            },
            participation: {
                global: this.participationStats.get('global'),
                channels: Array.from(this.participationStats.entries())
                    .filter(([channel]) => channel !== 'global')
                    .map(([channel, stats]) => ({
                        channel,
                        participations: stats.count,
                        lastParticipation: new Date(stats.lastParticipation).toISOString()
                    }))
            }
        };
    }
}

module.exports = SmartKeywordsPlugin; 