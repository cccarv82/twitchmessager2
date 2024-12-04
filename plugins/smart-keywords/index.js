const PluginBase = require('../../src/plugins/PluginBase');
const fs = require('fs').promises;
const path = require('path');
const chalk = require('chalk');
const natural = require('natural');  // Para processamento de linguagem natural
const LanguageDetect = require('languagedetect'); // Para detecção de idioma

class SmartKeywordsPlugin extends PluginBase {
    constructor() {
        super();
        this.name = 'Smart Keywords';
        this.description = 'Detecção inteligente de padrões de giveaway';
        this.version = '1.0.0';
        
        // Inicializa estruturas de dados
        this.patterns = new Map();           // Padrões detectados
        this.messageHistory = new Map();     // Histórico de mensagens
        this.languageDetector = new LanguageDetect();
        this.tokenizer = new natural.WordTokenizer();
        this.classifier = new natural.BayesClassifier();

        // Caminhos dos arquivos
        this.dataDir = path.join(__dirname, 'data');
        this.patternsFile = path.join(this.dataDir, 'patterns.json');
        this.statsFile = path.join(this.dataDir, 'stats.json');
    }

    async onLoad() {
        if (!this.silent) {
            console.log(chalk.cyan(`Inicializando ${this.name}...`));
        }
        
        await fs.mkdir(this.dataDir, { recursive: true });
        await this.loadPatterns();
        
        if (!this.silent) {
            console.log(chalk.cyan(`Padrões conhecidos: ${this.patterns.size}`));
            if (this.patterns.size > 0) {
                for (const [pattern, info] of this.patterns) {
                    console.log(chalk.gray(`- ${pattern} (${(info.confidence * 100).toFixed(2)}%)`));
                }
            }
            
            console.log(chalk.green(`✓ ${this.name} inicializado com sucesso`));
        }
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
        if (!this.config.features.patternLearning.enabled) return;

        // Verifica entropia para reduzir falsos positivos
        if (this.config.features.falsePositiveReduction.enabled) {
            const entropy = this.calculateEntropy(message);
            if (entropy < this.config.features.falsePositiveReduction.minimumEntropy) {
                return;
            }
        }

        // Detecta idioma
        if (this.config.features.languageDetection.enabled) {
            const lang = this.detectLanguage(message);
            if (!lang || !this.config.features.languageDetection.supportedLanguages.includes(lang)) {
                return;
            }
        }

        // Tokeniza e processa a mensagem
        const tokens = this.tokenizer.tokenize(message.toLowerCase());
        if (tokens.length > this.config.features.patternLearning.maxPatternLength) {
            return;
        }

        // Atualiza histórico
        if (!this.messageHistory.has(channel)) {
            this.messageHistory.set(channel, []);
        }
        const history = this.messageHistory.get(channel);
        history.push({ message, timestamp: Date.now() });

        // Remove mensagens antigas
        const oneHourAgo = Date.now() - 3600000;
        this.messageHistory.set(
            channel, 
            history.filter(m => m.timestamp > oneHourAgo)
        );

        // Analisa padrões
        await this.analyzePatterns(channel);
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
}

module.exports = SmartKeywordsPlugin; 