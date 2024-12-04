# Smart Keywords Plugin

Plugin para detecção inteligente de padrões e idiomas.

## Hooks Fornecidos

### detectLanguage
Detecta o idioma de um texto.

**Parâmetros:**
- `text` (string) - Texto para análise

**Retorno:**
- `Array<{result: string, confidence: number}>` - Idiomas detectados e confiança

**Exemplo:**
```javascript
const [{ result, confidence }] = await plugin.useHook('detectLanguage', 'Hello world');
// result: 'en', confidence: 0.95
```

## Features
- Detecção de idioma
- Aprendizado de padrões
- Redução de falsos positivos
- Atualização automática de padrões

## Configuração
```json
{
    "enabled": true,
    "features": {
        "patternLearning": { "enabled": true },
        "languageDetection": { "enabled": true },
        "falsePositiveReduction": { "enabled": true },
        "autoUpdate": { "enabled": true }
    }
}
```