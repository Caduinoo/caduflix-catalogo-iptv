// Mantido apenas por compatibilidade com versoes antigas da ferramenta.
// A fonte ativa de Jogos do Dia agora e o Pixsuper, configurada em src/index.js.
export async function fetchGames() {
  throw new Error("Football API desativada nesta etapa. Use GAMES_SOURCE=pixsuper.");
}
