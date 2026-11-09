// Uno Resenhas — motor de regras
// Roda igual no navegador e no servidor. O servidor é o árbitro: os celulares só
// mandam ações ({tipo:'jogar', cartas:[...]}) e o motor decide se valem.

import { coresDoModo, criarBaralho, pontosDaCarta, PONTOS_COLOCACAO } from './cartas.js';

export const OPCOES_PADRAO = {
  cores: 5,                  // 4 = Tradicional (+4), 5 = Resenhas (+5), 6 = Resenhas estendido (rosa, +6)
  acumularCompras: true,      // +2 sobre +2, +5 sobre +5
  mais2NaoRespondeMais5: true, // +5 só é respondido por +5 (ou Ctrl+C)
  mais5SobreMais2: true,      // um +2 pode ser respondido com +5
  vencerComEspecial: false,   // libera vencer com coringa ou carta de ação
  corte: false,               // jogar carta idêntica fora da vez
  corteEspecial: false,       // com o Corte ligado: também corta com coringa (sobre coringa) e com ação idêntica (sem efeito)
  baterNoCorte: true,         // com o Corte ligado: pode bater (ganhar) cortando com a última carta
  comprarAtePoder: false,     // sem carta válida, compra até achar
  morteSubita: false,         // monte acabou pela 2ª vez: rodada termina
  regraDo5: false,            // jogar um 5 escolhe a próxima cor
  regraDo9: false,            // jogou 9: o último a apertar o (9) compra 1 carta por 9
  cartasIniciais: 7,
  salaAberta: false,          // online: gente entra e sai entre as mãos, sem criar outra sala
  fim: { modo: 'rodadas', valor: 5 }, // 'rodadas' | 'pontos' | 'vitorias' (conta vitórias, sem fim) | 'sem_fim'
};

// ---------- utilidades ----------
export function criarRng(semente = Date.now()) {
  let a = semente >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function embaralhar(lista, rng) {
  for (let i = lista.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [lista[i], lista[j]] = [lista[j], lista[i]];
  }
  return lista;
}
const ehCoringa = (t) => t === 'coringa' || t === '+5';
const ehCompra = (t) => t === '+2' || t === '+5';
const maisN = (e) => '+' + (e.opcoes.cores || 5); // nome do coringa de compra: +4, +5 ou +6
// "Face" de uma carta efetiva: o que precisa ser igual num combo
const face = (e) => (e.tipo === 'num' ? `n${e.valor}` : e.tipo);

class ErroJogada extends Error {
  constructor(codigo, msg) { super(msg || codigo); this.codigo = codigo; }
}

// ---------- criação ----------
export function novaPartida({ jogadores, opcoes = {}, semente } = {}) {
  if (!jogadores || jogadores.length < 2 || jogadores.length > 10) throw new ErroJogada('jogadores', 'A mesa precisa de 2 a 10 jogadores');
  const e = {
    opcoes: { ...OPCOES_PADRAO, ...opcoes, fim: { ...OPCOES_PADRAO.fim, ...(opcoes.fim || {}) } },
    semente: semente ?? Date.now(),
    jogadores: jogadores.map((j, i) => ({ id: j.id ?? `j${i + 1}`, nome: j.nome ?? `Jogador ${i + 1}`, bot: !!j.bot, mao: [], pontos: 0, vitorias: 0, maos: 0 })),
    rodada: 0,
    quemComecouUltima: -1,
    fase: 'aguardando', // 'jogando' | 'fim_rodada' | 'fim_partida'
    historico: [],
  };
  e.rng = criarRng(e.semente);
  return iniciarRodada(e);
}

export function iniciarRodada(e) {
  e.rodada += 1;
  e.monte = embaralhar(criarBaralho(e.opcoes.cores || 5), e.rng);
  e.descarte = [];
  e.sentido = 1;
  e.compraPendente = null;  // { tipo:'+2'|'+5', quantidade }
  e.ultimoMais5 = null;     // para o desafio do +5
  e.comprou = null;         // id da carta comprada nesta vez (marca que já comprou; dá para jogar qualquer carta ou passar)
  e.vulneravel = null;      // jogador com 1 carta que não apertou "Última!"
  e.disseUltima = {};
  e.reembaralhadas = 0;
  e.resultadoRodada = null;
  e.espiadas = [];          // eventos privados de "Espiar"
  e.regra9 = null;          // { quantidade, por, apertaram:[] } enquanto o (9) está aberto
  for (const j of e.jogadores) j.mao = [];
  for (let k = 0; k < e.opcoes.cartasIniciais; k++) for (const j of e.jogadores) j.mao.push(e.monte.pop());

  // Primeira carta: coringa volta para o monte
  let primeira = e.monte.pop();
  while (primeira.tipo === 'coringa' || primeira.tipo === '+5' || primeira.tipo === 'ctrl') {
    e.monte.unshift(primeira);
    primeira = e.monte.pop();
  }
  e.descarte.push(primeira);
  e.topo = { tipo: primeira.tipo, cor: primeira.cor, valor: primeira.valor };
  e.corAtual = primeira.cor;

  e.quemComecouUltima = Math.floor(e.rng() * e.jogadores.length); // quem começa é sempre sorteado
  e.vez = e.quemComecouUltima;
  e.fase = 'jogando';

  // Ação da primeira carta vale para o primeiro jogador
  if (primeira.tipo === 'pular') e.vez = passo(e, e.vez, 1);
  else if (primeira.tipo === 'reverso') e.sentido = -1;
  else if (primeira.tipo === '+2') e.compraPendente = { tipo: '+2', quantidade: 2 };
  return e;
}

// ---------- consulta ----------
const idx = (e, id) => {
  const i = e.jogadores.findIndex((j) => j.id === id);
  if (i < 0) throw new ErroJogada('jogador', 'Jogador não está na mesa');
  return i;
};
function passo(e, de, n) {
  const t = e.jogadores.length;
  return (((de + e.sentido * n) % t) + t) % t;
}
export const jogadorDaVez = (e) => e.jogadores[e.vez];

// Transforma as cartas (na ordem escolhida) em cartas efetivas.
// O Ctrl+C Ctrl+V vira a carta anterior do combo; se for o primeiro, vira o topo.
export function resolverSequencia(e, cartas) {
  const efetivas = [];
  let anterior = e.topo;
  for (const c of cartas) {
    const ef = c.tipo === 'ctrl'
      ? { tipo: anterior.tipo, cor: anterior.cor, valor: anterior.valor, copia: true }
      : { tipo: c.tipo, cor: c.cor, valor: c.valor };
    efetivas.push(ef);
    anterior = ef;
  }
  return efetivas;
}

function combinaComTopo(e, ef) {
  if (ehCoringa(ef.tipo)) return true;
  if (ef.cor && ef.cor === e.corAtual) return true;
  if (ef.tipo === 'num' && e.topo.tipo === 'num') return ef.valor === e.topo.valor;
  if (ef.tipo !== 'num' && ef.tipo === e.topo.tipo) return true;
  return false;
}

// Valida uma jogada (uma carta ou um combo). Devolve { ok, erro, efetivas, cartas }.
export function validarJogada(e, idJogador, idsCartas, { foraDaVez = false } = {}) {
  try {
    const r = checarJogada(e, idJogador, idsCartas, { foraDaVez });
    return { ok: true, ...r };
  } catch (err) {
    if (err instanceof ErroJogada) return { ok: false, erro: err.codigo, mensagem: err.message };
    throw err;
  }
}

function checarJogada(e, idJogador, idsCartas, { foraDaVez }) {
  if (e.fase !== 'jogando') throw new ErroJogada('fase', 'A rodada não está em andamento');
  const ij = idx(e, idJogador);
  const j = e.jogadores[ij];
  if (e.regra9) throw new ErroJogada('regra9', 'Aperte o (9) primeiro!');
  if (!foraDaVez && ij !== e.vez) throw new ErroJogada('vez', 'Não é a sua vez');
  if (!idsCartas || idsCartas.length === 0) throw new ErroJogada('vazio', 'Escolha ao menos uma carta');
  if (new Set(idsCartas).size !== idsCartas.length) throw new ErroJogada('repetida', 'Carta repetida');
  const cartas = idsCartas.map((id) => {
    const c = j.mao.find((x) => x.id === id);
    if (!c) throw new ErroJogada('nao_tem', 'Essa carta não está na sua mão');
    return c;
  });

  const efetivas = resolverSequencia(e, cartas);
  const f0 = face(efetivas[0]);
  if (efetivas.some((x) => face(x) !== f0)) throw new ErroJogada('combo_diferente', 'No combo, todas as cartas precisam ter o mesmo número ou símbolo');

  const primeira = efetivas[0];
  if (e.compraPendente) {
    const p = e.compraPendente;
    const defesaCtrl = cartas[0].tipo === 'ctrl';
    if (!ehCompra(primeira.tipo)) throw new ErroJogada('compra_pendente', `Você precisa responder com ${p.tipo} ou comprar ${p.quantidade}`);
    if (!e.opcoes.acumularCompras && !defesaCtrl) throw new ErroJogada('sem_acumular', `Compre ${p.quantidade} cartas`);
    if (p.tipo === '+5' && primeira.tipo === '+2' && e.opcoes.mais2NaoRespondeMais5) throw new ErroJogada('mais2_mais5', `Um ${maisN(e)} só pode ser respondido com ${maisN(e)}`);
    if (p.tipo === '+2' && primeira.tipo === '+5' && !e.opcoes.mais5SobreMais2) throw new ErroJogada('mais5_mais2', 'Um +2 só pode ser respondido com +2');
  } else if (!combinaComTopo(e, primeira)) {
    throw new ErroJogada('nao_combina', 'A primeira carta precisa combinar com a cor, o número ou o símbolo do topo');
  }

  if (foraDaVez) {
    if (!e.opcoes.corte) throw new ErroJogada('corte', 'Corte desligado nesta sala');
    // idêntica à carta de verdade do topo: mesmo número E mesma cor (a cor escolhida pela Regra do 5 ou pelo Ctrl+C não vale)
    const t = e.topo, fis = e.descarte[e.descarte.length - 1];
    const c = cartas[0];
    const igual = (x) => x && x.tipo === 'num' && x.valor === c.valor && x.cor === c.cor;
    const acaoIgual = (x) => x && x.tipo === c.tipo && x.cor === c.cor;
    const especial = e.opcoes.corteEspecial && cartas.length === 1 && !e.compraPendente && (
      (c.tipo === 'coringa' && fis && fis.tipo === 'coringa') || // coringa preto sobre coringa preto
      (['pular', 'reverso', '+2'].includes(c.tipo) && acaoIgual(fis) && acaoIgual(t))); // mesma ação, mesma cor
    if (!especial && (cartas.length !== 1 || c.tipo !== 'num' || !igual(t) || !igual(fis) || e.compraPendente)) {
      throw new ErroJogada('corte', e.opcoes.corteEspecial ? 'Corte só com carta idêntica ao topo (mesmo número/ação e cor, ou coringa sobre coringa)' : 'Corte só com carta idêntica ao topo: mesmo número e mesma cor');
    }
  }

  // Só se vence com números
  let vence = cartas.length === j.mao.length;
  let defesaFinal = false;
  if (vence && foraDaVez && e.opcoes.baterNoCorte === false) throw new ErroJogada('bater_corte', 'Nesta sala não dá para bater no corte');
  if (vence && !e.opcoes.vencerComEspecial && cartas.some((c) => c.tipo !== 'num')) {
    // defesa com a última carta (+2 / +N / Ctrl+C contra uma compra): pode se defender, mas não bate — compra 1 na hora
    if (e.compraPendente && !foraDaVez && cartas.every((c) => ehCompra(c.tipo) || c.tipo === 'ctrl')) { vence = false; defesaFinal = true; }
    else throw new ErroJogada('vitoria_especial', 'Só dá para vencer com cartas de número');
  }
  return { cartas, efetivas, vence, indice: ij, defesaFinal };
}

// Todas as jogadas possíveis (usado para acender o botão Combo e pelos bots)
export function jogadasPossiveis(e, idJogador) {
  const j = e.jogadores[idx(e, idJogador)];
  const resultado = [];
  const vistos = new Set();
  const tentar = (ids) => {
    const k = ids.join(',');
    if (vistos.has(k)) return;
    vistos.add(k);
    const v = validarJogada(e, idJogador, ids);
    if (v.ok) resultado.push({ ids, efetivas: v.efetivas, vence: v.vence });
  };
  const ctrls = j.mao.filter((c) => c.tipo === 'ctrl');
  for (const c of j.mao) {
    if (!validarJogada(e, idJogador, [c.id]).ok) continue;
    tentar([c.id]);
    const ef0 = resolverSequencia(e, [c])[0];
    const iguais = j.mao.filter((x) => x.id !== c.id && x.tipo !== 'ctrl' && face(x) === face(ef0));
    let seq = [c.id];
    for (const x of iguais) { seq = [...seq, x.id]; tentar(seq); }
    for (const x of ctrls) if (!seq.includes(x.id)) { seq = [...seq, x.id]; tentar(seq); }
  }
  return resultado;
}

export const podeFazerCombo = (e, idJogador) => jogadasPossiveis(e, idJogador).some((p) => p.ids.length > 1);

// ---------- ações ----------
// acao: { tipo:'jogar', jogador, cartas:[ids], cor?, zero?:{efeito:'trocar'|'espiar', alvo}, ultima?:bool }
//       { tipo:'comprar', jogador } | { tipo:'passar', jogador } | { tipo:'ultima', jogador }
//       { tipo:'pegou', jogador, alvo } | { tipo:'desafiar', jogador } | { tipo:'corte', jogador, cartas:[id] }
//       { tipo:'proxima_rodada' }
export function aplicar(e, acao) {
  const fn = {
    jogar: () => jogar(e, acao, false),
    corte: () => jogar(e, acao, true),
    comprar: () => comprar(e, acao),
    passar: () => passar(e, acao),
    ultima: () => ultima(e, acao),
    pegou: () => pegou(e, acao),
    desafiar: () => desafiar(e, acao),
    apertar9: () => apertar9(e, acao),
    tempo9: () => tempo9(e),
    proxima_rodada: () => proximaRodada(e),
  }[acao.tipo];
  if (!fn) throw new ErroJogada('acao', 'Ação desconhecida');
  const r = fn();
  e.historico.push({ ...acao, rodada: e.rodada });
  return r || {};
}

function jogar(e, acao, foraDaVez) {
  const { cartas, efetivas, vence, indice, defesaFinal } = checarJogada(e, acao.jogador, acao.cartas, { foraDaVez });
  const j = e.jogadores[indice];
  const ultimaEf = efetivas[efetivas.length - 1];
  const n = cartas.length;

  // escolhas obrigatórias
  let cor = ultimaEf.cor;
  if (ehCoringa(ultimaEf.tipo)) {
    if (!vence) {
      if (!coresDoModo(e.opcoes.cores || 5).includes(acao.cor)) throw new ErroJogada('cor', 'Escolha uma cor');
      cor = acao.cor;
    }
  } else if (e.opcoes.regraDo5 && ultimaEf.tipo === 'num' && ultimaEf.valor === 5 && coresDoModo(e.opcoes.cores || 5).includes(acao.cor)) {
    cor = acao.cor;
  }
  const zero = ultimaEf.tipo === 'num' && ultimaEf.valor === 0 && !vence;
  if (zero) {
    const z = acao.zero;
    if (!z || !['trocar', 'espiar'].includes(z.efeito)) throw new ErroJogada('zero', 'Escolha Trocar ou Espiar');
    const ia = idx(e, z.alvo);
    if (ia === indice) throw new ErroJogada('zero_alvo', 'Escolha outro jogador');
  }

  // desafio do +5: guarda se o +5 foi jogado tendo carta da cor atual
  const mais5Sozinho = !e.compraPendente && n === 1 && cartas[0].tipo === '+5';
  const tinhaCor = j.mao.some((c) => c.cor === e.corAtual && !cartas.includes(c));

  // tira da mão e põe no descarte
  j.mao = j.mao.filter((c) => !cartas.includes(c));
  e.descarte.push(...cartas);
  e.topo = { tipo: ultimaEf.tipo, cor, valor: ultimaEf.valor };
  e.corAtual = cor;
  e.comprou = null;
  e.ultimoMais5 = mais5Sozinho ? { por: j.id, ilegal: tinhaCor } : null;
  if (e.vulneravel && e.vulneravel !== j.id) e.vulneravel = null;
  if (foraDaVez) e.vez = indice;

  // "Última!"
  if (j.mao.length === 1) {
    if (acao.ultima || e.disseUltima[j.id]) e.disseUltima[j.id] = true;
    else e.vulneravel = j.id;
  } else e.disseUltima[j.id] = false;

  if (vence) return encerrarRodada(e, j.id);
  // defendeu com a última carta especial: não pode bater, então compra 1 na hora (e fica avisado da Última)
  let compraDefesa = null;
  if (defesaFinal) {
    compraDefesa = darCartas(e, j, 1);
    e.disseUltima[j.id] = true;
    if (e.vulneravel === j.id) e.vulneravel = null;
  }

  // efeitos somados (carta de ação usada no corte não tem efeito: só corta a vez)
  let pular = 0;
  const eventos = [];
  switch (foraDaVez && ultimaEf.tipo !== 'num' ? 'nenhum' : ultimaEf.tipo) {
    case 'num':
      if (zero) {
        const alvo = e.jogadores[idx(e, acao.zero.alvo)];
        if (acao.zero.efeito === 'trocar') {
          [j.mao, alvo.mao] = [alvo.mao, j.mao];
          e.disseUltima[j.id] = false; e.disseUltima[alvo.id] = false;
          if (e.vulneravel === j.id) e.vulneravel = null;
          eventos.push({ tipo: 'troca', de: j.id, com: alvo.id });
        } else {
          const espiada = { por: j.id, alvo: alvo.id, mao: alvo.mao.map((c) => ({ ...c })) };
          e.espiadas.push(espiada);
          eventos.push({ tipo: 'espiou', de: j.id, alvo: alvo.id });
        }
      }
      break;
    case 'pular':
      pular = n;
      break;
    case 'reverso':
      if (n % 2 === 1) {
        if (e.jogadores.length === 2) pular = 1;
        else e.sentido *= -1;
      }
      break;
    case '+2':
    case '+5': {
      const por = ultimaEf.tipo === '+2' ? 2 : ultimaEf.valor || 5;
      const antes = e.compraPendente ? e.compraPendente.quantidade : 0;
      e.compraPendente = { tipo: ultimaEf.tipo, quantidade: antes + por * n };
      break;
    }
    default:
      break; // coringa: só troca a cor
  }
  e.vez = passo(e, indice, 1 + pular);
  // Regra do 9: abre o botão (9) para a mesa toda
  if (e.opcoes.regraDo9) {
    const noves = efetivas.filter((x) => x.tipo === 'num' && x.valor === 9).length;
    if (noves) { e.regra9 = { quantidade: noves, por: j.id, apertaram: [] }; eventos.push({ tipo: 'regra9', quantidade: noves }); }
  }
  if (compraDefesa) eventos.push({ tipo: 'defesaFinal', jogador: j.id, quantidade: compraDefesa.length });
  return { eventos, compraDefesa: compraDefesa ? compraDefesa.length : 0 };
}

function tirarDoMonte(e) {
  if (e.monte.length === 0) {
    if (e.descarte.length <= 1) return null;
    const topo = e.descarte.pop();
    e.monte = embaralhar(e.descarte, e.rng);
    e.descarte = [topo];
    e.reembaralhadas += 1;
  }
  return e.monte.pop() ?? null;
}

function darCartas(e, j, q) {
  const novas = [];
  for (let k = 0; k < q; k++) {
    const c = tirarDoMonte(e);
    if (!c) break;
    j.mao.push(c); novas.push(c);
  }
  if (j.mao.length > 1) e.disseUltima[j.id] = false;
  if (e.vulneravel === j.id && j.mao.length > 1) e.vulneravel = null;
  return novas;
}

function checarMorteSubita(e) {
  if (e.opcoes.morteSubita && e.reembaralhadas >= 2) { encerrarRodada(e, null); return true; }
  return false;
}

function comprar(e, acao) {
  if (e.fase !== 'jogando') throw new ErroJogada('fase');
  if (e.regra9) throw new ErroJogada('regra9', 'Aperte o (9) primeiro!');
  const ij = idx(e, acao.jogador);
  if (ij !== e.vez) throw new ErroJogada('vez', 'Não é a sua vez');
  const j = e.jogadores[ij];
  if (e.vulneravel && e.vulneravel !== j.id) e.vulneravel = null;

  if (e.compraPendente) {
    const novas = darCartas(e, j, e.compraPendente.quantidade);
    e.compraPendente = null; e.ultimoMais5 = null;
    if (checarMorteSubita(e)) return { compradas: novas };
    e.vez = passo(e, ij, 1);
    return { compradas: novas, perdeuVez: true };
  }
  if (e.comprou) throw new ErroJogada('ja_comprou', 'Você já comprou nesta vez');

  let novas = darCartas(e, j, 1);
  if (e.opcoes.comprarAtePoder) {
    while (novas.length && !validarJogada(e, j.id, [novas[novas.length - 1].id]).ok) {
      const mais = darCartas(e, j, 1);
      if (!mais.length) break;
      novas = [...novas, ...mais];
    }
  }
  if (checarMorteSubita(e)) return { compradas: novas };
  // depois de comprar, pode jogar QUALQUER carta da mão que sirva (ou passar);
  // se nenhuma servir, a vez passa sozinha
  const ultimaComprada = novas[novas.length - 1];
  if (ultimaComprada && j.mao.some((c) => validarJogada(e, j.id, [c.id]).ok)) {
    e.comprou = ultimaComprada.id; // marca que já comprou nesta vez
    return { compradas: novas, podeJogar: true, serve: validarJogada(e, j.id, [ultimaComprada.id]).ok };
  }
  e.comprou = null;
  e.vez = passo(e, ij, 1);
  return { compradas: novas, passou: true };
}

function passar(e, acao) {
  const ij = idx(e, acao.jogador);
  if (ij !== e.vez || !e.comprou) throw new ErroJogada('passar', 'Só dá para passar depois de comprar');
  e.comprou = null;
  e.vez = passo(e, ij, 1);
}

function ultima(e, acao) {
  if (e.fase !== 'jogando') throw new ErroJogada('fase', 'A mão já acabou');
  const j = e.jogadores[idx(e, acao.jogador)];
  if (j.mao.length > 2) throw new ErroJogada('ultima', 'Você tem mais de 2 cartas');
  e.disseUltima[j.id] = true;
  if (e.vulneravel === j.id) e.vulneravel = null;
}

function pegou(e, acao) {
  if (e.fase !== 'jogando') throw new ErroJogada('fase', 'A mão já acabou');
  idx(e, acao.jogador);
  const alvo = e.jogadores[idx(e, acao.alvo)];
  if (e.vulneravel !== alvo.id || alvo.mao.length !== 1) throw new ErroJogada('pegou', 'Esse jogador já está seguro');
  e.vulneravel = null;
  return { compradas: darCartas(e, alvo, 2) };
}

function desafiar(e, acao) {
  const ij = idx(e, acao.jogador);
  if (ij !== e.vez || !e.ultimoMais5 || !e.compraPendente) throw new ErroJogada('desafio', `Não há ${maisN(e)} para desafiar`);
  const j = e.jogadores[ij];
  const autor = e.jogadores[idx(e, e.ultimoMais5.por)];
  const q = e.compraPendente.quantidade;
  e.compraPendente = null;
  const ilegal = e.ultimoMais5.ilegal;
  e.ultimoMais5 = null;
  if (ilegal) {
    darCartas(e, autor, q); // quem jogou errado compra; o desafiante segue jogando
    return { resultado: 'ilegal', comprou: autor.id };
  }
  darCartas(e, j, q + 2);
  e.vez = passo(e, ij, 1);
  return { resultado: 'legal', comprou: j.id };
}

// ---------- Regra do 9 ----------
function apertar9(e, acao) {
  if (!e.regra9) throw new ErroJogada('regra9', 'Não há (9) para apertar');
  const j = e.jogadores[idx(e, acao.jogador)];
  if (e.regra9.apertaram.includes(j.id)) throw new ErroJogada('regra9', 'Você já apertou');
  e.regra9.apertaram.push(j.id);
  const faltam = e.jogadores.filter((x) => !e.regra9.apertaram.includes(x.id));
  if (faltam.length === 1) return resolver9(e, faltam[0].id);
  return { apertou: j.id };
}
// Tempo esgotado: entre quem não apertou, um é sorteado como o último
function tempo9(e) {
  if (!e.regra9) throw new ErroJogada('regra9', 'Não há (9) aberto');
  const faltam = e.jogadores.filter((x) => !e.regra9.apertaram.includes(x.id));
  return resolver9(e, faltam[Math.floor(e.rng() * faltam.length)].id);
}
function resolver9(e, id) {
  const q = e.regra9.quantidade;
  e.regra9 = null;
  const j = e.jogadores[idx(e, id)];
  const novas = darCartas(e, j, q);
  const perdeuVez = e.jogadores[e.vez].id === id;
  if (perdeuVez) { e.vez = passo(e, e.vez, 1); e.comprou = null; }
  checarMorteSubita(e);
  return { ultimo9: id, compradas: novas, perdeuVez };
}

// ---------- fim de rodada e de partida ----------
export const pontosDaMao = (mao) => mao.reduce((s, c) => s + pontosDaCarta(c), 0);

function encerrarRodada(e, idVencedor) {
  const ordem = [...e.jogadores].sort((a, b) => {
    if (a.id === idVencedor) return -1;
    if (b.id === idVencedor) return 1;
    return pontosDaMao(a.mao) - pontosDaMao(b.mao) || a.mao.length - b.mao.length;
  });
  const colocacao = ordem.map((j, i) => {
    const ganhos = PONTOS_COLOCACAO[i] ?? 0;
    j.pontos += ganhos;
    return { jogador: j.id, posicao: i + 1, pontosNaMao: pontosDaMao(j.mao), cartas: j.mao.length, ganhou: ganhos };
  });
  for (const j of e.jogadores) j.maos = (j.maos || 0) + 1; // mãos jogadas (importa na sala aberta)
  const venc = idVencedor && e.jogadores.find((j) => j.id === idVencedor);
  if (venc) venc.vitorias = (venc.vitorias || 0) + 1;
  e.resultadoRodada = { rodada: e.rodada, vencedor: idVencedor, colocacao };
  e.fase = partidaAcabou(e) ? 'fim_partida' : 'fim_rodada';
  return { fimDeRodada: e.resultadoRodada, fimDePartida: e.fase === 'fim_partida' };
}

function partidaAcabou(e) {
  const { modo, valor } = e.opcoes.fim;
  if (modo === 'rodadas') return e.rodada >= valor;
  if (modo === 'pontos') return e.jogadores.some((j) => j.pontos >= valor);
  return false; // vitorias e sem_fim: só acaba quando quem criou a sala finaliza
}

export function placar(e) {
  const porVitorias = e.opcoes.fim.modo === 'vitorias';
  return [...e.jogadores]
    .sort((a, b) => (porVitorias ? (b.vitorias || 0) - (a.vitorias || 0) || b.pontos - a.pontos : b.pontos - a.pontos || (b.vitorias || 0) - (a.vitorias || 0)))
    .map((j) => ({ jogador: j.id, nome: j.nome, pontos: j.pontos, vitorias: j.vitorias || 0, maos: j.maos || 0 }));
}

// Sala aberta: quem chega senta entre as mãos, com o placar zerado
export function adicionarJogador(e, j) {
  if (e.fase === 'jogando') throw new ErroJogada('fase', 'Só dá para entrar entre as mãos');
  if (e.jogadores.length >= 10) throw new ErroJogada('jogadores', 'A mesa está cheia');
  if (e.jogadores.some((x) => x.id === j.id)) return e;
  e.jogadores.push({ id: j.id, nome: j.nome, bot: !!j.bot, mao: [], pontos: 0, vitorias: 0, maos: 0 });
  return e;
}

// Entre as rodadas: quem votou "Não" sai da mesa (a pontuação dos outros continua)
export function removerJogadores(e, ids) {
  if (e.fase === 'jogando') throw new ErroJogada('fase', 'Só dá para sair entre as rodadas');
  const ficam = e.jogadores.filter((j) => !ids.includes(j.id));
  if (ficam.length < 2) throw new ErroJogada('jogadores', 'A mesa precisa de pelo menos 2 jogadores');
  e.jogadores = ficam;
  e.quemComecouUltima = e.quemComecouUltima % ficam.length;
  e.vez = Math.min(e.vez, ficam.length - 1);
  return e;
}

// O dono encerrou a mão no meio: ela não conta (nem pontos nem número da rodada)
export function cancelarRodada(e) {
  if (e.fase !== 'jogando') return e;
  e.rodada -= 1;
  for (const j of e.jogadores) j.mao = [];
  e.fase = 'fim_rodada';
  e.resultadoRodada = null; e.regra9 = null; e.compraPendente = null; e.vulneravel = null; e.comprou = null;
  return e;
}
// Entre as mãos: a mesa fica com estes jogadores, nesta ordem (quem já estava mantém pontos e vitórias)
export function arrumarJogadores(e, lista) {
  if (e.fase === 'jogando') throw new ErroJogada('fase', 'Só dá para mexer na mesa entre as mãos');
  if (lista.length < 2 || lista.length > 10) throw new ErroJogada('jogadores', 'A mesa precisa de 2 a 10 jogadores');
  const antes = new Map(e.jogadores.map((j) => [j.id, j]));
  e.jogadores = lista.map((n) => {
    const j = antes.get(n.id);
    if (j) { j.bot = !!n.bot; j.nome = n.nome || j.nome; return j; }
    return { id: n.id, nome: n.nome, bot: !!n.bot, mao: [], pontos: 0, vitorias: 0, maos: 0 };
  });
  e.vez = 0;
  return e;
}

function proximaRodada(e) {
  if (e.fase !== 'fim_rodada') throw new ErroJogada('fase', 'A rodada ainda não acabou');
  iniciarRodada(e);
}

// ---------- visão de cada jogador (o que o servidor manda para cada celular) ----------
export function visaoDe(e, idJogador) {
  return {
    rodada: e.rodada,
    fase: e.fase,
    vez: e.jogadores[e.vez].id,
    sentido: e.sentido,
    topo: e.topo,
    cartaDoTopo: e.descarte[e.descarte.length - 1],
    corAtual: e.corAtual,
    compraPendente: e.compraPendente,
    regra9: e.regra9,
    podeDesafiar: !!(e.ultimoMais5 && e.compraPendente && e.jogadores[e.vez].id === idJogador),
    cartaComprada: e.jogadores[e.vez].id === idJogador ? e.comprou : null,
    vulneravel: e.vulneravel,
    disseiUltima: !!e.disseUltima[idJogador],
    monte: e.monte.length,
    minhaMao: e.jogadores.find((j) => j.id === idJogador)?.mao ?? [],
    jogadores: e.jogadores.map((j) => ({ id: j.id, nome: j.nome, bot: j.bot, cartas: j.mao.length, pontos: j.pontos, vitorias: j.vitorias || 0, maos: j.maos || 0 })),
    espiadas: e.espiadas.filter((x) => x.por === idJogador),
    resultadoRodada: e.resultadoRodada,
    opcoes: e.opcoes,
  };
}

export { ErroJogada };
