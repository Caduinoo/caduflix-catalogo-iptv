# Gerador de Jogos do Dia - CaduFlix

Este gerador usa o Pixsuper apenas como fonte auxiliar para descobrir jogos do dia. O app Android nao recebe Pixsuper, nao salva Pixsuper e nunca abre player do Pixsuper.

## Variaveis

```env
GAMES_SOURCE=pixsuper
PIXSUPER_BASE_URL=
PIXSUPER_USERNAME=
PIXSUPER_PASSWORD=
GAMES_OUTPUT_DIR=../..
GAMES_TIMEZONE=America/Sao_Paulo
GAMES_USE_MOCK_WHEN_NO_KEY=true
```

Sem Pixsuper configurado, se `GAMES_USE_MOCK_WHEN_NO_KEY=true`, o gerador cria jogos mock para validar o app.

## Rodar localmente

```powershell
cd C:\caduflix\github\caduflix-catalogo-iptv\tools\gerador-jogos-do-dia
npm install
npm run generate
```

## GitHub Actions

Configure os secrets:

- `PIXSUPER_BASE_URL`
- `PIXSUPER_USERNAME`
- `PIXSUPER_PASSWORD`

O workflow nao usa ONCINE nem qualquer secret do app principal.
