const fs = require('fs').promises;
const path = require('path');
const { execSync } = require('child_process');

async function setupPlugins() {
    const pluginsDir = path.join(__dirname, '../plugins');
    
    try {
        // Instala dependências dos plugins
        console.log('Instalando dependências...');
        execSync('npm install natural languagedetect', { stdio: 'inherit' });

        // Cria diretórios necessários
        await fs.mkdir(path.join(pluginsDir, 'smart-keywords/data'), { recursive: true });
        await fs.mkdir(path.join(pluginsDir, 'blacklist/data'), { recursive: true });
        
        console.log('✓ Plugins configurados com sucesso!');
    } catch (error) {
        console.error('Erro ao configurar plugins:', error);
    }
}

setupPlugins(); 