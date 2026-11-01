// Uno Resenhas — definição das cartas e do baralho (137 cartas)

export const CORES = ['vermelho', 'azul', 'verde', 'amarelo', 'roxo'];
export const TODAS_CORES = [...CORES, 'rosa'];
// Modos: 4 cores = Tradicional (+4), 5 = Resenhas (+5), 6 = Resenhas estendido (rosa, +6)
export const MODOS_CORES = [4, 5, 6];
export function coresDoModo(n) { return n === 4 ? CORES.slice(0, 4) : n === 6 ? TODAS_CORES : CORES; }

// Tipos de carta
//   num      — número 0 a 9 (tem cor e valor)
//   pular    — bloqueia o próximo jogador
//   reverso  — inverte o sentido
//   +2       — próximo compra 2
//   coringa  — Escolher cor
//   +5       — Coringa +N (valor = 4, 5 ou 6, conforme o número de cores)
//   ctrl     — Coringa Ctrl+C Ctrl+V (vira a carta anterior)
export const ACOES = ['pular', 'reverso', '+2'];
export const CORINGAS = ['coringa', '+5', 'ctrl'];

export const PONTOS_CARTA = { pular: 20, reverso: 20, '+2': 20, coringa: 50, '+5': 60, ctrl: 100 };

// Pontos por colocação na rodada (1º ao 10º)
export const PONTOS_COLOCACAO = [12, 9, 8, 7, 6, 5, 4, 3, 2, 1];

export function pontosDaCarta(carta) {
  return carta.tipo === 'num' ? carta.valor : PONTOS_CARTA[carta.tipo];
}

export function criarBaralho(nCores = 5) {
  const cartas = [];
  let n = 0;
  const add = (tipo, cor = null, valor = null) => cartas.push({ id: `c${n++}`, tipo, cor, valor });
  for (const cor of coresDoModo(nCores)) {
    add('num', cor, 0);
    for (let v = 1; v <= 9; v++) { add('num', cor, v); add('num', cor, v); }
    for (const a of ACOES) { add(a, cor); add(a, cor); }
  }
  for (let i = 0; i < nCores; i++) add('coringa');
  for (let i = 0; i < nCores; i++) add('+5', null, nCores); // +4, +5 ou +6
  for (let i = 0; i < (nCores === 6 ? 3 : 2); i++) add('ctrl');
  return cartas;
}

// Nome do arquivo de arte de cada carta (pasta CARTAS DO JOGO)
const PASTA_COR = { vermelho: 'VERMELHO', azul: 'AZUL', verde: 'VERDE', amarelo: 'AMARELO', roxo: 'ROXO' };
const NOME_COR = { vermelho: 'Vermelho', azul: 'Azul', verde: 'Verde', amarelo: 'Amarelo', roxo: 'Roxo' };
export function arquivoDaCarta(carta) {
  if (carta.tipo === 'coringa') return 'CORINGA/ESCOLHER COR.png';
  if (carta.tipo === '+5') return 'CORINGA/+5.png';
  if (carta.tipo === 'ctrl') return 'CORINGA/CTRL-C + CTRL-V.png';
  const p = PASTA_COR[carta.cor], c = NOME_COR[carta.cor];
  if (carta.tipo === 'num') return `${p}/${c} (${carta.valor}).png`;
  if (carta.tipo === '+2') return `${p}/${c} +2.png`;
  // Amarelo usa minúsculas nos nomes dos arquivos de ação
  if (carta.tipo === 'pular') return `${p}/${c} ${carta.cor === 'amarelo' ? 'pular' : 'Pular'}.png`;
  if (carta.tipo === 'reverso') return `${p}/${c} ${carta.cor === 'amarelo' ? 'reverso' : 'Reverso'}.png`;
}
