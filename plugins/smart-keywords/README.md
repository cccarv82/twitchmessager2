# Smart Keywords Plugin

Plugin que implementa detecção inteligente de padrões usando processamento de linguagem natural.

## Funcionalidades

- 🧠 Aprendizado automático de padrões
- 🌍 Suporte a múltiplos idiomas
- 🎯 Redução de falsos positivos
- 📊 Análise estatística de padrões

## Hooks Fornecidos

### detectLanguage
Detecta o idioma de um texto:
```javascript
const [{ result }] = await this.useHook('detectLanguage', 'texto para analisar');
// result: 'pt', 'en', 'es', etc
```

### calculateEntropy
Calcula a entropia de um texto:
```javascript
const [{ result }] = await this.useHook('calculateEntropy', 'texto');
// result: 0.75 (0-1)
```

### analyzePattern
Analisa um padrão de mensagem:
```javascript
const [{ result }] = await this.useHook('analyzePattern', 'mensagem', {
    checkEntropy: true,
    checkLanguage: true
});
```

### getKnownPatterns
Retorna padrões conhecidos:
```javascript
const [{ result }] = await this.useHook('getKnownPatterns', {
    minConfidence: 0.8,
    language: 'pt'
});
```

## Configuração

```json
{
    "features": {
        "patternLearning": {
            "enabled": true,
            "minOccurrences": 3
        }
    }
}
```