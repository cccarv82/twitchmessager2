const fs = require('fs').promises;
const path = require('path');
const chalk = require('chalk');

class PluginManager {
    constructor() {
        this.plugins = new Map();
        this.pluginsDir = path.join(__dirname, '../../plugins');
        this.hooks = new Map();
    }

    async loadPlugins() {
        try {
            // Verifica se o diretório plugins existe
            try {
                await fs.access(this.pluginsDir);
            } catch {
                await fs.mkdir(this.pluginsDir);
                console.log(chalk.yellow('Diretório de plugins criado'));
                return;
            }

            // Lista todos os diretórios de plugins
            const pluginDirs = await fs.readdir(this.pluginsDir);
            
            for (const pluginDir of pluginDirs) {
                const pluginPath = path.join(this.pluginsDir, pluginDir);
                const stat = await fs.stat(pluginPath);
                
                if (stat.isDirectory()) {
                    try {
                        await this.loadPlugin(pluginDir);
                    } catch (error) {
                        console.error(chalk.red(`Erro ao carregar plugin ${pluginDir}:`, error));
                    }
                }
            }
        } catch (error) {
            console.error(chalk.red('Erro ao carregar plugins:', error));
        }
    }

    async loadPlugin(pluginDir) {
        const pluginPath = path.join(this.pluginsDir, pluginDir);
        const configPath = path.join(pluginPath, 'config.json');
        
        // Carrega o plugin
        const Plugin = require(path.join(pluginPath, 'index.js'));
        const plugin = new Plugin();
        
        // Carrega configuração se existir
        try {
            const config = await fs.readFile(configPath, 'utf8');
            plugin.config = JSON.parse(config);
        } catch {
            plugin.config = {};
        }

        // Inicializa o plugin
        await plugin.onLoad();
        if (plugin.config.enabled !== false) {
            await plugin.onEnable();
        }

        this.plugins.set(plugin.name, plugin);
        console.log(chalk.green(`✓ Plugin carregado: ${plugin.name} v${plugin.version}`));
    }

    // Método para emitir eventos para todos os plugins ativos
    async emit(event, ...args) {
        for (const [name, plugin] of this.plugins) {
            if (plugin.enabled && typeof plugin[event] === 'function') {
                try {
                    await plugin[event](...args);
                } catch (error) {
                    console.error(chalk.red(`Erro no plugin ${name} durante ${event}:`, error));
                }
            }
        }
    }
}

module.exports = PluginManager; 