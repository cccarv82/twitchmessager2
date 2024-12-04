# Smart Keywords Plugin

Plugin que implementa detecção inteligente de padrões de giveaway usando processamento de linguagem natural e aprendizado de máquina.

## Funcionalidades

- 🧠 Aprendizado automático de padrões
- 🌍 Suporte a múltiplos idiomas
- 🎯 Redução de falsos positivos
- 📊 Análise estatística de padrões
- 🔄 Atualização automática de keywords

## Instalação

1. Instale as dependências:

```bash
npm install natural languagedetect
```

2. Configure o plugin em `config.json`:

```json
{
    "enabled": true,
    "features": {
        "patternLearning": {
            "enabled": true,
            "minOccurrences": 3
        }
    }
}
```

## Como Funciona

1. **Detecção de Padrões**
   - Analisa mensagens do chat
   - Identifica padrões recorrentes
   - Calcula confiança do padrão

2. **Processamento de Linguagem**
   - Detecta idioma automaticamente
   - Tokeniza mensagens
   - Gera n-grams para análise

3. **Redução de Falsos Positivos**
   - Calcula entropia das mensagens
   - Filtra padrões blacklistados
   - Verifica confiança mínima

4. **Aprendizado Contínuo**
   - Atualiza padrões periodicamente
   - Mantém estatísticas de uso
   - Adapta-se a novos formatos

## Configuração Avançada

```json
{
    "features": {
        "patternLearning": {
            "minOccurrences": 3,        // Mínimo de ocorrências
            "confidenceThreshold": 0.7,  // Confiança mínima
            "maxPatternLength": 50,      // Tamanho máximo
            "updateInterval": 3600000    // Intervalo de atualização
        },
        "languageDetection": {
            "enabled": true,
            "supportedLanguages": ["en", "pt", "es"],
            "minimumConfidence": 0.8
        }
    }
}
```

## Logs e Estatísticas

- Padrões detectados são salvos em `data/patterns.json`
- Estatísticas em `data/stats.json`
- Logs detalhados quando `reporting.logLevel = "debug"`

## Contribuindo

- Reporte falsos positivos
- Sugira novos padrões
- Contribua com traduções 