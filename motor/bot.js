// Uno Resenhas — bot simples: joga combos grandes de números, guarda coringas,
// responde a compras quando pode e usa o Zero contra quem tem menos cartas.

import { CORES } from './cartas.js';
import { jogadasPossiveis } from './regras.js';

const ehCartaCoringa = (c) => c.tipo === 'coringa' || c.tipo === '+5' || c.tipo === 'ctrl';

function corPreferida(mao) {
  const cont = Object.fromEntries(CORES.map((c) => [c, 0]));
  for (const c of mao) if (c.cor) cont[c.cor] += 1;
  return CORES.reduce((a, b) => (cont[b] > cont[a] ? b : a), CORES[0]);
}

function nota(e, j, p) {
  const cartas = p.ids.map((id) => j.mao.find((c) => c.id === id));
  let n = cartas.length * 10;
  if (p.vence) n += 1000;
  if (cartas.some(ehCartaCoringa)) n -= 25 * cartas.filter(ehCartaCoringa).length; // guarda coringas
  if (e.compraPendente) n += 500; // responder a compra é melhor que comprar
  const ult = p.efetivas[p.efetivas.length - 1];
  if (ult.tipo === '+2' || ult.tipo === '+5' || ult.tipo === 'pular') n += 5;
  return n;
}

export function escolherAcao(e, idBot) {
  const j = e.jogadores.find((x) => x.id === idBot);
  if (e.regra9) return e.regra9.apertaram.includes(idBot) ? { tipo: 'tempo9' } : { tipo: 'apertar9', jogador: idBot };
  const possiveis = jogadasPossiveis(e, idBot);
  if (possiveis.length === 0) {
    return e.comprou ? { tipo: 'passar', jogador: idBot } : { tipo: 'comprar', jogador: idBot };
  }
  const melhor = possiveis.reduce((a, b) => (nota(e, j, b) > nota(e, j, a) ? b : a));
  const resto = j.mao.filter((c) => !melhor.ids.includes(c.id));
  const acao = { tipo: 'jogar', jogador: idBot, cartas: melhor.ids, cor: corPreferida(resto), ultima: resto.length === 1 };
  const ult = melhor.efetivas[melhor.efetivas.length - 1];
  if (ult.tipo === 'num' && ult.valor === 0) {
    const outros = e.jogadores.filter((x) => x.id !== idBot);
    const menor = outros.reduce((a, b) => (b.mao.length < a.mao.length ? b : a));
    acao.zero = menor.mao.length < resto.length
      ? { efeito: 'trocar', alvo: menor.id }
      : { efeito: 'espiar', alvo: menor.id };
  }
  return acao;
}
