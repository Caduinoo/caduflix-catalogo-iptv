# Gerador de Jogos do Dia - CaduFlix

Ferramenta separada do gerador principal. Ela nao acessa Xtream e escreve apenas:

- `canais/jogos-do-dia.json`
- `canais/jogos-canais-map.json`

## Variaveis

```env
FOOTBALL_API_PROVIDER=api-football
FOOTBALL_API_KEY=
FOOTBALL_API_BASE_URL=https://v3.football.api-sports.io
GAMES_OUTPUT_DIR=../..
GAMES_TIMEZONE=America/Sao_Paulo
GAMES_COUNTRY=BR
GAMES_LANGUAGE=pt-BR
GAMES_USE_MOCK_WHEN_NO_KEY=true
```

Sem `FOOTBALL_API_KEY`, se `GAMES_USE_MOCK_WHEN_NO_KEY=true`, o gerador cria jogos de teste para validar o app.

## Rodar localmente

```powershell
cd C:\caduflix\github\caduflix-catalogo-iptv\tools\gerador-jogos-do-dia
npm install
npm run generate
```

## GitHub Actions

Crie o secret `FOOTBALL_API_KEY`. O workflow `Atualizar Jogos do Dia` usa apenas essa chave e nao usa nenhum secret Xtream.

Se a API falhar quando a chave estiver configurada, o processo falha antes de escrever os JSONs. Assim o arquivo antigo do GitHub Pages fica preservado.