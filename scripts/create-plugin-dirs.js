const fs = require('fs').promises;
const path = require('path');

async function createPluginDirs() {
    const pluginsDir = path.join(__dirname, '../plugins');
    const plugins = ['smart-keywords', 'blacklist', 'discord-notifier', 'auto-responder'];
    
    for (const plugin of plugins) {
        const dirs = [
            path.join(pluginsDir, plugin, 'data'),
            path.join(pluginsDir, plugin, 'data', 'backups')
        ];

        for (const dir of dirs) {
            try {
                await fs.mkdir(dir, { recursive: true });
                await fs.writeFile(path.join(dir, '.gitkeep'), '');
                console.log(`✓ Criado diretório: ${dir}`);
            } catch (error) {
                console.error(`Erro ao criar diretório ${dir}:`, error);
            }
        }
    }
}

createPluginDirs(); 