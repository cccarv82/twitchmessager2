const fs = require('fs').promises;
const path = require('path');
const chalk = require('chalk');

class PluginManager {
    constructor() {
        this.plugins = new Map();
        this.pluginsDir = path.join(__dirname, '../../plugins');
        this.hooks = new Map();
        this.debugMode = false;
    }

    setDebugMode(enabled) {
        this.debugMode = enabled;
    }

    async loadPlugins(silent = false) {
        try {
            if (!silent) {
                console.log(chalk.cyan('Carregando plugins...'));
            }

            try {
                await fs.access(this.pluginsDir);
            } catch {
                await fs.mkdir(this.pluginsDir);
                if (!silent) {
                    console.log(chalk.yellow('Diretório de plugins criado'));
                }
                return;
            }

            const pluginDirs = await fs.readdir(this.pluginsDir);
            
            for (const pluginDir of pluginDirs) {
                const pluginPath = path.join(this.pluginsDir, pluginDir);
                const stat = await fs.stat(pluginPath);
                
                if (stat.isDirectory()) {
                    try {
                        await this.loadPlugin(pluginDir, silent);
                    } catch (error) {
                        if (!silent) {
                            console.error(chalk.red(`Erro ao carregar plugin ${pluginDir}:`, error));
                        }
                    }
                }
            }
            
            if (!silent) {
                console.log(chalk.green(`✓ ${this.plugins.size} plugins carregados`));
            }
        } catch (error) {
            if (!silent) {
                console.error(chalk.red('Erro ao carregar plugins:', error));
            }
        }
    }

    async loadPlugin(pluginDir, silent = false) {
        const pluginPath = path.join(this.pluginsDir, pluginDir);
        const configPath = path.join(pluginPath, 'config.json');
        
        const Plugin = require(path.join(pluginPath, 'index.js'));
        const plugin = new Plugin();
        
        try {
            const config = await fs.readFile(configPath, 'utf8');
            plugin.config = JSON.parse(config);
        } catch {
            plugin.config = {};
        }

        plugin.silent = silent;
        await plugin.onLoad();
        if (plugin.config.enabled !== false) {
            await plugin.onEnable();
        }
        plugin.silent = false;

        this.plugins.set(plugin.name, plugin);
        if (!silent) {
            console.log(chalk.green(`✓ Plugin carregado: ${plugin.name} v${plugin.version}`));
        }
    }

    // Método para emitir eventos para todos os plugins ativos
    async emit(event, ...args) {
        if (this.debugMode) {
            console.log(chalk.gray(`Emitindo evento ${event} para ${this.plugins.size} plugins`));
        }

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