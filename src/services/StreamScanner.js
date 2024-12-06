const { EventEmitter } = require('events');
const axios = require('axios');
const chalk = require('chalk');
const { logger } = require('../../src/logger');
const path = require('path');
const fs = require('fs');

class StreamScanner extends EventEmitter {
    constructor(config = {}) {
        super();
        
        const logDir = path.join(process.cwd(), 'log');
        if (!fs.existsSync(logDir)){
            fs.mkdirSync(logDir, { recursive: true });
        }
        
        this.config = {
            batchSize: 100,
            maxConcurrent: 20,
            rateLimitDelay: 500,
            ...config
        };
        
        this.queue = [];
        this.activeRequests = 0;
        this.tokenPool = new Map();
        this.progress = {
            total: 0,
            processed: 0,
            found: 0,
            channels: []
        };
    }

    async scanGame(gameId, options = {}) {
        try {
            logger.info(`Iniciando scan do jogo ${gameId}`);
            this.emit('scanStart', { gameId });

            let cursor = null;
            let totalStreams = 0;
            let filteredChannels = [];

            do {
                const response = await this.fetchBatch(gameId, cursor);
                const streams = response.data.data;
                totalStreams += streams.length;

                // Filtra canais com palavras-chave no título
                const validChannels = streams.filter(stream => 
                    this.config.palavrasChave.some(keyword => 
                        stream.title.toLowerCase().includes(keyword.toLowerCase())
                    )
                ).map(stream => stream.user_login);

                filteredChannels = [...filteredChannels, ...validChannels];

                this.progress.processed += streams.length;
                this.progress.found += validChannels.length;
                this.emit('batchProgress', {
                    processed: this.progress.processed,
                    found: this.progress.found,
                    total: totalStreams
                });

                cursor = response.data.pagination?.cursor;
            } while (cursor);

            const result = {
                total: totalStreams,
                processed: this.progress.processed,
                found: filteredChannels.length,
                channels: filteredChannels
            };

            this.emit('scanComplete', result);
            return result;

        } catch (error) {
            logger.error('Erro durante scan:', error);
            this.emit('scanError', error);
            throw error;
        }
    }

    async fetchBatch(gameId, cursor = null) {
        const token = await this.getToken();
        await this.rateLimitDelay();

        const params = {
            game_id: gameId,
            first: this.config.batchSize
        };

        if (cursor) {
            params.after = cursor;
        }

        return axios.get('https://api.twitch.tv/helix/streams', {
            params,
            headers: {
                'Client-ID': this.config.clientId,
                'Authorization': `Bearer ${token}`
            }
        });
    }

    async getToken() {
        const validTokens = Array.from(this.tokenPool.entries())
            .filter(([_, data]) => data.expiresAt > Date.now());

        if (validTokens.length) {
            const [token] = validTokens[0];
            return token;
        }

        return this.refreshToken();
    }

    async rateLimitDelay() {
        await new Promise(resolve => 
            setTimeout(resolve, this.config.rateLimitDelay)
        );
    }

    processQueue() {
        if (this.queue.length === 0 || this.activeRequests >= this.config.maxConcurrent) {
            return;
        }

        const next = this.queue.shift();
        next.batchFn()
            .then(next.resolve)
            .catch(next.reject)
            .finally(() => {
                this.activeRequests--;
                this.processQueue();
            });
    }
}

module.exports = StreamScanner; 