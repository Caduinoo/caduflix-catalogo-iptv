# Gerador de Catalogo CaduFlix v2

Gerador isolado para criar o novo catalogo IPTV do CaduFlix em C:\caduflix\caduflix-catalogo-iptv. Ele consome Xtream e TMDB, grava JSONs compactos para o app e nunca grava URLs completas de player nem credenciais do Xtream.

## Configuracao

Copie .env.example para .env e preencha:

~~~env
XTREAM_BASE_URL=http://cordelrellsers.xyz
XTREAM_USERNAME=06152926
XTREAM_PASSWORD=01914851
TMDB_API_KEY=dc51db853968fc53bf6503d45c2ed67f
CATALOG_OUTPUT_DIR=../caduflix-catalogo-iptv
CATALOG_PUBLIC_BASE_URL=https://caduinoo.github.io/caduflix-catalogo-iptv
TMDB_LANGUAGE=pt-BR
TMDB_REGION=BR
~~~

CATALOG_LIMIT_MOVIES e CATALOG_LIMIT_SERIES sao opcionais e ajudam a testar com poucos itens.

Sem credenciais Xtream, o gerador entra em modo estrutura inicial: cria todos os arquivos esperados com listas vazias. Para geracao real, informe Xtream e TMDB no .env ou em secrets do GitHub Actions.

## Rodar localmente

~~~powershell
cd C:\caduflix\gerador-catalogo-v2
npm install
npm run generate
~~~

## Saida

Por padrao, os JSONs sao escritos em C:\caduflix\caduflix-catalogo-iptv.

O gerador limpa apenas as pastas controladas por ele dentro desse diretorio: canais, filmes, series e busca. Ele tambem escreve version.json, manifest.json e home.json. A pasta antiga C:\caduflix\caduflix-catalogo nao e usada.

## Seguranca Xtream

Os JSONs gravam somente identificadores:

- Filmes: streamId e containerExtension.
- Series: seriesId.
- Episodios: episodeId e containerExtension.

O gerador usa a URL Xtream completa apenas em memoria para consultar a API. Logs mascaram usuario e senha, e o .gitignore impede commit acidental do .env.

## Generos internos

Filmes: acao, aventura, animacao, anime, comedia, crime, documentario, drama, familia, fantasia, ficcao, guerra, historia, infantil, misterio, musica, nacionais, romance, suspense, terror, thriller, faroeste.

Series: acao, aventura, animacao, anime, comedia, crime, documentario, drama, familia, fantasia, ficcao, guerra, historia, infantil, misterio, musica, nacional, reality, romance, suspense, terror, thriller, faroeste.

Um mesmo item pode sair em varios arquivos de genero. O mapeamento combina generos TMDB, nomes de categorias Xtream e sinais no titulo normalizado.

## Produtoras de series

As categorias Xtream sao mapeadas para: netflix, prime_video, hbo_max, disney_plus, star_plus, paramount, globoplay, crunchyroll, discovery_plus, apple_tv_plus, amc_plus, lionsgate e universal. Tudo que nao casar cai em outras_produtoras, sem descartar a serie.

## GitHub Actions

O workflow em .github/workflows/generate-catalog.yml esta preparado para rodar todo dia. Configure os secrets XTREAM_BASE_URL, XTREAM_USERNAME, XTREAM_PASSWORD, TMDB_API_KEY e, se necessario, CATALOG_REPO_TOKEN.


## Cache e retry TMDB

O cache local fica em .cache/tmdb dentro do gerador e armazena buscas, detalhes e resultados nao encontrados. Para desativar:

~~~env
TMDB_CACHE_ENABLED=false
~~~

Tentativas automaticas:

~~~env
TMDB_RETRY_ATTEMPTS=3
TMDB_RETRY_DELAY_MS=1000
~~~


## Modo incremental

O modo incremental reaproveita itens ja enriquecidos quando a fingerprint do item Xtream nao mudou.

Estado local:

~~~text
C:\caduflix\gerador-catalogo-v2.cache\catalog-state.json
~~~

Para desativar:

~~~env
CATALOG_INCREMENTAL_ENABLED=false
~~~


## Retry Xtream

O cliente Xtream tenta novamente erros temporarios de rede e HTTP 500, 502, 503, 504, 520, 522 e 524.

~~~env
XTREAM_RETRY_ATTEMPTS=3
XTREAM_RETRY_DELAY_MS=1500
XTREAM_REQUEST_TIMEOUT_MS=30000
~~~


## Uso dentro do repositorio do catalogo

Dentro de tools/gerador-catalogo-v2, use CATALOG_OUTPUT_DIR=../.. para gerar o catalogo na raiz do repositorio, preservando tools, .github, .git e .cache.
