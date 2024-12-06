const axios = require("axios");
const fs = require("fs");
const ini = require("ini");
const StreamScanner = require('./src/services/StreamScanner');
const { logger } = require('./src/logger');
const path = require('path');
const ConfigManager = require('./src/services/ConfigManager');

// Singleton para gerenciar plugins
let pluginManager = null;

function getPluginManager() {
    if (!pluginManager) {
        const PluginManager = require('./src/plugins/PluginManager');
        pluginManager = new PluginManager();
        // Carrega plugins se ainda não foram carregados
        if (!pluginManager.plugins || pluginManager.plugins.size === 0) {
            logger.info('Carregando plugins para o scanner...');
            pluginManager.loadPlugins();
        }
    }
    return pluginManager;
}

async function getConfig(gameName) {
    const config = await ConfigManager.load();
    return {
        clientId: config.CLIENT.ID,
        clientSecret: config.CLIENT.SECRET,
        nomeDoJogo: gameName || config.GAME.NAME,
        palavrasChave: config.KEYWORDS.PARTICIPATION.split(','),
    };
}

function filterChannels(stream, palavrasChave) {
    const titulo = stream.title.toLowerCase();
    return palavrasChave.some((palavraChave) =>
        titulo.includes(palavraChave.toLowerCase())
    );
}

async function getAccessToken(gameName) {
    const config = await getConfig(gameName);
    const response = await axios({
        method: "POST",
        url: `https://id.twitch.tv/oauth2/token?client_id=${config.clientId}&client_secret=${config.clientSecret}&grant_type=client_credentials`,
    });

    return response.data.access_token;
}

async function getGameId(accessToken, gameName) {
    const config = await getConfig(gameName);
    const gameResponse = await axios({
        method: "GET",
        url: `https://api.twitch.tv/helix/games?name=${config.nomeDoJogo}`,
        headers: {
            "Client-ID": config.clientId,
            Authorization: `Bearer ${accessToken}`,
        },
    });

    return gameResponse.data.data[0].id;
}

async function getStreams(gameId, accessToken, gameName) {
    const config = await getConfig(gameName);
    let url = `https://api.twitch.tv/helix/streams?game_id=${gameId}&first=100`;
    let totalCanais = 0;
    let allCanais = [];
    let hasNextPage = true;
    let cursor = null;

    logger.info(`Iniciando busca de streams para ${gameName}`);

    while (hasNextPage) {
        try {
            const currentUrl = cursor ? `${url}&after=${cursor}` : url;
            const response = await axios({
                method: "GET",
                url: currentUrl,
                headers: {
                    "Client-ID": config.clientId,
                    Authorization: `Bearer ${accessToken}`,
                },
            });

            totalCanais += response.data.data.length;
            
            // Filtra canais com palavras-chave
            const canaisFiltrados = response.data.data.filter(stream => 
                filterChannels(stream, config.palavrasChave)
            ).map(stream => stream.user_login);

            allCanais = [...allCanais, ...canaisFiltrados];

            // Verifica se tem próxima página
            cursor = response.data.pagination?.cursor;
            hasNextPage = !!cursor;

            // Notifica progresso
            const pluginManager = getPluginManager();
            await pluginManager.emit('onScanProgress', {
                processed: totalCanais,
                found: allCanais.length,
                total: totalCanais
            });

            // Rate limiting
            await new Promise(resolve => setTimeout(resolve, 500));

        } catch (error) {
            logger.error('Erro ao buscar lote de streams:', error);
            throw error;
        }
    }

    // Filtra canais usando plugins de blacklist se disponível
    const blacklistPlugin = pluginManager.plugins.get('Blacklist');
    if (blacklistPlugin) {
        allCanais = allCanais.filter(channel => 
            !blacklistPlugin.isChannelBlacklisted(channel)
        );
    }

    logger.info(`Busca concluída: ${allCanais.length} canais encontrados de ${totalCanais} streams`);

    return {
        totalCanais,
        canais: allCanais,
        canaisSelecionados: allCanais.length
    };
}

function writeChannelsToFile(canais) {
    try {
        fs.writeFileSync("canais.json", JSON.stringify(canais, null, 2));
        logger.info(`${canais.length} canais salvos em canais.json`);
    } catch (error) {
        logger.error('Erro ao salvar canais:', error);
        throw error;
    }
}

async function main(gameName) {
    try {
        // Se recebeu um novo nome de jogo, atualiza no config
        if (gameName) {
            await ConfigManager.setGame(gameName);
        } else {
            // Se não recebeu, usa o do config
            gameName = await ConfigManager.getGame();
            if (!gameName) {
                throw new Error('Nenhum jogo configurado');
            }
        }

        logger.info(`Iniciando scan para ${gameName}`);
        
        const accessToken = await getAccessToken(gameName);
        const gameId = await getGameId(accessToken, gameName);
        const { canais, totalCanais, canaisSelecionados } = await getStreams(
            gameId,
            accessToken,
            gameName
        );

        // Salva os canais filtrados
        writeChannelsToFile(canais);

        return {
            nomeDoJogo: await getConfig(gameName).nomeDoJogo,
            totalCanais,
            canais,
            canaisSelecionados
        };
    } catch (error) {
        logger.error("Erro ao obter canais:", error);
        throw error;
    }
}

module.exports = { getAccessToken, getGameId, getStreams, main };
