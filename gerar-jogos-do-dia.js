const fs = require("fs");
const path = require("path");

// ==============================
// CONFIGURAÇÕES
// ==============================
const config = {
   xtreamUrl: process.env.XTREAM_URL,
   username: process.env.XTREAM_USERNAME,
   password: process.env.XTREAM_PASSWORD,
   playApiUrl: process.env.PLAY_API_URL,

  // Nome da categoria que vamos procurar
  nomesCategoria: [
    "jogos do dia",
    "jogos de hoje",
    "eventos do dia",
    "futebol",
  ],

  outputDir: path.join(__dirname, "canais"),
  outputFile: "jogos-do-dia.json",
};

// ==============================
// FUNÇÕES AUXILIARES
// ==============================
function normalizarTexto(texto) {
  return String(texto || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

async function xtream(action, params = {}) {
  const url = new URL(`${config.xtreamUrl}/player_api.php`);

  url.searchParams.set("username", config.username);
  url.searchParams.set("password", config.password);
  url.searchParams.set("action", action);

  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }

  const res = await fetch(url.toString());

  if (!res.ok) {
    throw new Error(`Erro na Xtream API: ${res.status} ${res.statusText}`);
  }

  return await res.json();
}

function criarLinkPlayer(streamId) {
  const url = new URL(config.playApiUrl);
  url.searchParams.set("tipo", "live");
  url.searchParams.set("id", streamId);
  return url.toString();
}

// ==============================
// GERADOR
// ==============================
async function gerarJogosDoDia() {
  console.log("Buscando categorias de canais...");

  const categorias = await xtream("get_live_categories");

  if (!Array.isArray(categorias)) {
    throw new Error("A Xtream não retornou uma lista de categorias válida.");
  }

  console.log(`Categorias encontradas: ${categorias.length}`);

  const categoriasJogos = categorias.filter((cat) => {
    const nome = normalizarTexto(cat.category_name);

    return config.nomesCategoria.some((busca) =>
      nome.includes(normalizarTexto(busca))
    );
  });

  if (categoriasJogos.length === 0) {
    console.log("Nenhuma categoria parecida com Jogos do Dia foi encontrada.");
    console.log("Categorias disponíveis:");

    categorias.forEach((cat) => {
      console.log(`- ${cat.category_name} | ID: ${cat.category_id}`);
    });

    return;
  }

  console.log("Categorias usadas:");
  categoriasJogos.forEach((cat) => {
    console.log(`- ${cat.category_name} | ID: ${cat.category_id}`);
  });

  let todosCanais = [];

  for (const categoria of categoriasJogos) {
    console.log(`Buscando canais da categoria: ${categoria.category_name}`);

    const canais = await xtream("get_live_streams", {
      category_id: categoria.category_id,
    });

    if (!Array.isArray(canais)) continue;

    const canaisFormatados = canais.map((canal) => ({
      id: String(canal.stream_id),
      nome: canal.name || "Sem nome",
      logo: canal.stream_icon || "",
      categoria: categoria.category_name,
      categoriaId: String(categoria.category_id),
      tipo: "live",
      player: criarLinkPlayer(canal.stream_id),
    }));

    todosCanais.push(...canaisFormatados);
  }

  // Remove duplicados pelo ID
  const mapa = new Map();

  for (const canal of todosCanais) {
    if (!mapa.has(canal.id)) {
      mapa.set(canal.id, canal);
    }
  }

  todosCanais = Array.from(mapa.values());

  const resultado = {
    atualizadoEm: new Date().toISOString(),
    total: todosCanais.length,
    categoria: "Jogos do Dia",
    canais: todosCanais,
  };

  fs.mkdirSync(config.outputDir, { recursive: true });

  const destino = path.join(config.outputDir, config.outputFile);

  fs.writeFileSync(destino, JSON.stringify(resultado, null, 2), "utf8");

  console.log("");
  console.log("Arquivo gerado com sucesso!");
  console.log(`Local: ${destino}`);
  console.log(`Total de canais: ${todosCanais.length}`);
}

gerarJogosDoDia().catch((err) => {
  console.error("Erro ao gerar Jogos do Dia:");
  console.error(err);
  process.exit(1);
});
