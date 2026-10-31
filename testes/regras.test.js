import { test } from 'node:test';
import assert from 'node:assert/strict';
import { criarBaralho } from '../motor/cartas.js';
import { novaPartida, aplicar, validarJogada, jogadasPossiveis, podeFazerCombo, visaoDe } from '../motor/regras.js';
import { escolherAcao } from '../motor/bot.js';

let seq = 0;
const C = (tipo, cor = null, valor = null) => ({ id: `t${seq++}`, tipo, cor, valor });
const N = (cor, v) => C('num', cor, v);

// Mesa montada à mão: mãos e topo definidos no teste
function mesa({ maos, topo, opcoes = {}, vez = 0 }) {
  const e = novaPartida({ jogadores: maos.map((_, i) => ({ id: `j${i + 1}` })), opcoes, semente: 1 });
  e.jogadores.forEach((j, i) => { j.mao = maos[i]; });
  e.descarte = [topo];
  e.topo = { tipo: topo.tipo, cor: topo.cor, valor: topo.valor };
  e.corAtual = topo.cor;
  e.vez = vez; e.sentido = 1; e.compraPendente = null; e.comprou = null;
  return e;
}
const ids = (...cs) => cs.map((c) => c.id);
const extras = () => [N('azul', 1), N('azul', 2), N('verde', 3)]; // para não vencer sem querer

test('baralho tem 137 cartas', () => {
  const b = criarBaralho();
  assert.equal(b.length, 137);
  assert.equal(b.filter((c) => c.cor === 'roxo').length, 25);
  assert.equal(b.filter((c) => c.tipo === '+5').length, 5);
  assert.equal(b.filter((c) => c.tipo === 'ctrl').length, 2);
});

test('combo: só a primeira carta precisa combinar com o topo', () => {
  const a8 = N('azul', 8), v8 = N('verde', 8), r8 = N('roxo', 8), a3 = N('azul', 3), vm3 = N('vermelho', 3), v3 = N('verde', 3);
  const e = mesa({ maos: [[v8, r8, a3, vm3, v3, ...extras()], extras()], topo: N('azul', 8) });
  assert.ok(validarJogada(e, 'j1', ids(v8, r8)).ok, '8 sobre 8');
  assert.ok(validarJogada(e, 'j1', ids(a3, vm3)).ok, 'azul 3 sobre azul 8');
  assert.equal(validarJogada(e, 'j1', ids(v3, a3)).erro, 'nao_combina', 'verde 3 primeiro não vale');
  assert.equal(validarJogada(e, 'j1', ids(v8, a3)).erro, 'combo_diferente');
  assert.ok(podeFazerCombo(e, 'j1'));
});

test('Ctrl+C no fim do combo vira a carta anterior (exemplo do Amarelo 5)', () => {
  const am6 = N('amarelo', 6), vd6 = N('verde', 6), ctrl = C('ctrl');
  let e = mesa({ maos: [[am6, vd6, ctrl, ...extras()], extras()], topo: N('amarelo', 5) });
  let v = validarJogada(e, 'j1', ids(am6, vd6, ctrl));
  assert.ok(v.ok);
  assert.deepEqual([v.efetivas[2].cor, v.efetivas[2].valor], ['verde', 6]);

  v = validarJogada(e, 'j1', ids(am6, ctrl, vd6));
  assert.ok(v.ok);
  assert.deepEqual([v.efetivas[1].cor, v.efetivas[1].valor], ['amarelo', 6]);
  aplicar(e, { tipo: 'jogar', jogador: 'j1', cartas: ids(am6, ctrl, vd6) });
  assert.equal(e.corAtual, 'verde');
});

test('Ctrl+C pode abrir o combo copiando o topo', () => {
  const ctrl = C('ctrl'), vd5 = N('verde', 5), az5 = N('azul', 5);
  const e = mesa({ maos: [[ctrl, vd5, az5, ...extras()], extras()], topo: N('amarelo', 5) });
  const v = validarJogada(e, 'j1', ids(ctrl, vd5, az5));
  assert.ok(v.ok);
  assert.deepEqual([v.efetivas[0].cor, v.efetivas[0].valor], ['amarelo', 5]);
});

test('três +5 e um Ctrl+C: o próximo compra 20', () => {
  const p = [C('+5'), C('+5'), C('+5')], ctrl = C('ctrl');
  const e = mesa({ maos: [[...p, ctrl, ...extras()], extras(), extras()], topo: N('azul', 4) });
  aplicar(e, { tipo: 'jogar', jogador: 'j1', cartas: ids(...p, ctrl), cor: 'roxo' });
  assert.deepEqual(e.compraPendente, { tipo: '+5', quantidade: 20 });
  assert.equal(e.vez, 1);
  aplicar(e, { tipo: 'comprar', jogador: 'j2' });
  assert.equal(e.jogadores[1].mao.length, 23);
  assert.equal(e.vez, 2, 'quem comprou perde a vez');
});

test('três +2 somam 6; coringas de tipos diferentes não fazem combo', () => {
  const d = [C('+2', 'azul'), C('+2', 'verde'), C('+2', 'roxo')], cor = C('coringa'), mais5 = C('+5');
  const e = mesa({ maos: [[...d, cor, mais5, ...extras()], extras()], topo: N('azul', 4) });
  assert.equal(validarJogada(e, 'j1', ids(cor, mais5)).erro, 'combo_diferente');
  aplicar(e, { tipo: 'jogar', jogador: 'j1', cartas: ids(...d) });
  assert.deepEqual(e.compraPendente, { tipo: '+2', quantidade: 6 });
});

test('defesa com Ctrl+C contra +5 (passa 10 adiante), mesmo sem acumular compras', () => {
  const ctrl = C('ctrl');
  const e = mesa({ maos: [extras(), [ctrl, ...extras()], extras()], topo: N('azul', 4), opcoes: { acumularCompras: false }, vez: 1 });
  e.topo = { tipo: '+5', cor: 'azul', valor: null }; e.corAtual = 'azul';
  e.compraPendente = { tipo: '+5', quantidade: 5 };
  const outroMais5 = C('+5'); e.jogadores[1].mao.push(outroMais5);
  assert.equal(validarJogada(e, 'j2', ids(outroMais5)).erro, 'sem_acumular');
  aplicar(e, { tipo: 'jogar', jogador: 'j2', cartas: ids(ctrl), cor: 'verde' });
  assert.deepEqual(e.compraPendente, { tipo: '+5', quantidade: 10 });
  assert.equal(e.corAtual, 'verde');
});

test('+2 não responde a +5; Ctrl+C também defende +2', () => {
  const d = C('+2', 'azul'), ctrl = C('ctrl');
  const e = mesa({ maos: [extras(), [d, ctrl, ...extras()]], topo: N('azul', 4), vez: 1 });
  e.topo = { tipo: '+5', cor: 'azul', valor: null }; e.compraPendente = { tipo: '+5', quantidade: 5 };
  assert.equal(validarJogada(e, 'j2', ids(d)).erro, 'mais2_mais5');
  e.topo = { tipo: '+2', cor: 'azul', valor: null }; e.compraPendente = { tipo: '+2', quantidade: 2 };
  aplicar(e, { tipo: 'jogar', jogador: 'j2', cartas: ids(ctrl) });
  assert.deepEqual(e.compraPendente, { tipo: '+2', quantidade: 4 });
});

test('três Pular numa mesa de 4: bloqueia os 3 e joga de novo', () => {
  const p = [C('pular', 'azul'), C('pular', 'verde'), C('pular', 'roxo')];
  const e = mesa({ maos: [[...p, ...extras()], extras(), extras(), extras()], topo: N('azul', 4) });
  aplicar(e, { tipo: 'jogar', jogador: 'j1', cartas: ids(...p) });
  assert.equal(e.vez, 0);
});

test('Reverso: ímpar inverte, par mantém', () => {
  for (const [q, sentido] of [[1, -1], [2, 1], [3, -1], [4, 1]]) {
    const r = Array.from({ length: q }, () => C('reverso', 'azul'));
    const e = mesa({ maos: [[...r, ...extras()], extras(), extras()], topo: N('azul', 4) });
    aplicar(e, { tipo: 'jogar', jogador: 'j1', cartas: ids(...r) });
    assert.equal(e.sentido, sentido, `${q} reversos`);
  }
});

test('Zero: Trocar troca as mãos, Espiar mostra a mão só para quem jogou', () => {
  const z = N('azul', 0), z2 = N('verde', 0);
  let e = mesa({ maos: [[z, ...extras(), N('roxo', 9)], [N('azul', 7)], extras()], topo: N('azul', 4) });
  aplicar(e, { tipo: 'jogar', jogador: 'j1', cartas: ids(z), zero: { efeito: 'trocar', alvo: 'j2' } });
  assert.equal(e.jogadores[0].mao.length, 1);
  assert.equal(e.jogadores[1].mao.length, 4);

  e = mesa({ maos: [[z, z2, ...extras()], [N('azul', 7)], extras()], topo: N('azul', 4) });
  aplicar(e, { tipo: 'jogar', jogador: 'j1', cartas: ids(z, z2), zero: { efeito: 'espiar', alvo: 'j3' } });
  assert.equal(visaoDe(e, 'j1').espiadas.length, 1, 'combo de zeros: um efeito só');
  assert.equal(visaoDe(e, 'j2').espiadas.length, 0);
});

test('só se vence com números', () => {
  const ctrl = C('ctrl'), v6 = N('verde', 6), p = C('pular', 'azul'), a6 = N('azul', 6);
  let e = mesa({ maos: [[a6, v6, ctrl], extras()], topo: N('azul', 4) });
  assert.equal(validarJogada(e, 'j1', ids(a6, v6, ctrl)).erro, 'vitoria_especial');
  assert.ok(validarJogada(e, 'j1', ids(a6, v6)).ok, 'combo de números pode... mas aqui sobra o Ctrl');
  e = mesa({ maos: [[p], extras()], topo: N('azul', 4) });
  assert.equal(validarJogada(e, 'j1', ids(p)).erro, 'vitoria_especial');
  e = mesa({ maos: [[p], extras()], topo: N('azul', 4), opcoes: { vencerComEspecial: true } });
  assert.ok(validarJogada(e, 'j1', ids(p)).ok);
  e = mesa({ maos: [[a6, v6], extras(), [C('ctrl')]], topo: N('azul', 4) });
  const r = aplicar(e, { tipo: 'jogar', jogador: 'j1', cartas: ids(a6, v6) });
  assert.equal(r.fimDeRodada.vencedor, 'j1');
});

test('pontuação por colocação: 12, 9, 8… pela soma das cartas na mão', () => {
  const a6 = N('azul', 6);
  const e = mesa({ maos: [[a6], [C('ctrl')], [N('azul', 9)], [N('verde', 1), N('verde', 2)]], topo: N('azul', 4) });
  e.disseUltima.j1 = true;
  const r = aplicar(e, { tipo: 'jogar', jogador: 'j1', cartas: ids(a6) });
  assert.deepEqual(r.fimDeRodada.colocacao.map((c) => [c.jogador, c.ganhou]), [['j1', 12], ['j4', 9], ['j3', 8], ['j2', 7]]);
});

test('"Última!": quem esquece compra 2 se for pego', () => {
  const a6 = N('azul', 6);
  const e = mesa({ maos: [[a6, N('verde', 6)], extras()], topo: N('azul', 4) });
  aplicar(e, { tipo: 'jogar', jogador: 'j1', cartas: ids(a6) });
  assert.equal(e.vulneravel, 'j1');
  aplicar(e, { tipo: 'pegou', jogador: 'j2', alvo: 'j1' });
  assert.equal(e.jogadores[0].mao.length, 3);
});

test('desafio do +5 jogado tendo a cor atual', () => {
  const m5 = C('+5');
  const e = mesa({ maos: [[m5, N('azul', 1), N('verde', 2)], extras()], topo: N('azul', 4) });
  aplicar(e, { tipo: 'jogar', jogador: 'j1', cartas: ids(m5), cor: 'roxo' });
  const r = aplicar(e, { tipo: 'desafiar', jogador: 'j2' });
  assert.equal(r.resultado, 'ilegal');
  assert.equal(e.jogadores[0].mao.length, 7);
  assert.equal(e.vez, 1, 'o desafiante continua jogando');
});

test('fim de partida: por rodadas, por pontos ou sem fim', () => {
  const um = (fim) => {
    const e = mesa({ maos: [[N('azul', 6)], extras()], topo: N('azul', 4), opcoes: { fim } });
    e.disseUltima.j1 = true;
    return aplicar(e, { tipo: 'jogar', jogador: 'j1', cartas: [e.jogadores[0].mao[0].id] });
  };
  assert.equal(um({ modo: 'rodadas', valor: 1 }).fimDePartida, true);
  assert.equal(um({ modo: 'pontos', valor: 12 }).fimDePartida, true);
  assert.equal(um({ modo: 'pontos', valor: 50 }).fimDePartida, false);
  assert.equal(um({ modo: 'sem_fim' }).fimDePartida, false);
});

test('Regra do 9: o último a apertar compra 1 por 9 e, se for a vez dele, perde a vez', () => {
  const n9a = N('azul', 9), n9b = N('verde', 9);
  const e = mesa({ maos: [[n9a, n9b, ...extras()], extras(), extras()], topo: N('azul', 4), opcoes: { regraDo9: true } });
  aplicar(e, { tipo: 'jogar', jogador: 'j1', cartas: ids(n9a, n9b) });
  assert.deepEqual(e.regra9.quantidade, 2);
  assert.equal(validarJogada(e, 'j2', [e.jogadores[1].mao[0].id]).erro, 'regra9');
  aplicar(e, { tipo: 'apertar9', jogador: 'j1' });
  const r = aplicar(e, { tipo: 'apertar9', jogador: 'j3' });
  assert.equal(r.ultimo9, 'j2');
  assert.equal(e.jogadores[1].mao.length, 5);
  assert.equal(r.perdeuVez, true);
  assert.equal(e.vez, 2);
  assert.equal(e.regra9, null);
});

test('Regra do 9: quem jogou o 9 também pode ser o último', () => {
  const n9 = N('azul', 9);
  const e = mesa({ maos: [[n9, ...extras()], extras(), extras()], topo: N('azul', 4), opcoes: { regraDo9: true } });
  aplicar(e, { tipo: 'jogar', jogador: 'j1', cartas: ids(n9) });
  aplicar(e, { tipo: 'apertar9', jogador: 'j2' });
  const r = aplicar(e, { tipo: 'apertar9', jogador: 'j3' });
  assert.equal(r.ultimo9, 'j1');
  assert.equal(r.perdeuVez, false);
  assert.equal(e.vez, 1, 'a vez continua com o próximo');
});

test('+5 sobre +2: liga e desliga na sala', () => {
  const m5 = C('+5');
  const e = mesa({ maos: [extras(), [m5, ...extras()]], topo: N('azul', 4), vez: 1 });
  e.topo = { tipo: '+2', cor: 'azul', valor: null }; e.compraPendente = { tipo: '+2', quantidade: 2 };
  assert.ok(validarJogada(e, 'j2', ids(m5)).ok, 'padrão: pode');
  e.opcoes.mais5SobreMais2 = false;
  assert.equal(validarJogada(e, 'j2', ids(m5)).erro, 'mais5_mais2');
});

test('modo vitórias: conta as vitórias e não acaba sozinho; quem sai deixa a mesa', async () => {
  const { removerJogadores } = await import('../motor/regras.js');
  const e = mesa({ maos: [[N('azul', 6)], extras(), extras()], topo: N('azul', 4), opcoes: { fim: { modo: 'vitorias' } } });
  e.disseUltima.j1 = true;
  const r = aplicar(e, { tipo: 'jogar', jogador: 'j1', cartas: [e.jogadores[0].mao[0].id] });
  assert.equal(r.fimDePartida, false);
  assert.equal(e.jogadores[0].vitorias, 1);
  removerJogadores(e, ['j3']);
  assert.equal(e.jogadores.length, 2);
  aplicar(e, { tipo: 'proxima_rodada' });
  assert.equal(e.jogadores.every((j) => j.mao.length === 7), true);
  assert.equal(e.jogadores[0].vitorias, 1, 'as vitórias continuam');
});

test('quem sai entre as rodadas não deixa a vez apontando para fora da mesa', async () => {
  const { removerJogadores, visaoDe } = await import('../motor/regras.js');
  const e = mesa({ maos: [[N('azul', 6)], extras(), extras()], topo: N('azul', 4) });
  e.disseUltima.j1 = true;
  aplicar(e, { tipo: 'jogar', jogador: 'j1', cartas: [e.jogadores[0].mao[0].id] });
  e.vez = 2;
  removerJogadores(e, ['j3']);
  assert.ok(e.vez < e.jogadores.length);
  assert.doesNotThrow(() => visaoDe(e, 'j1'));
  assert.throws(() => removerJogadores(e, ['j2']), /pelo menos 2/);
});

test('simulação: 3000 partidas de bots terminam sem erro e sem perder cartas', () => {
  let rodadas = 0;
  for (let s = 1; s <= 3000; s++) {
    const nj = 2 + (s % 9);
    const opcoes = { corte: s % 2 === 0, comprarAtePoder: s % 3 === 0, morteSubita: s % 5 === 0, acumularCompras: s % 7 !== 0, regraDo5: s % 4 === 0, regraDo9: s % 3 === 1, fim: { modo: 'rodadas', valor: 2 } };
    const e = novaPartida({ jogadores: Array.from({ length: nj }, (_, i) => ({ bot: true, id: `b${i}` })), opcoes, semente: s });
    let passos = 0;
    while (e.fase !== 'fim_partida') {
      if (e.fase === 'fim_rodada') { aplicar(e, { tipo: 'proxima_rodada' }); continue; }
      const total = e.monte.length + e.descarte.length + e.jogadores.reduce((t, j) => t + j.mao.length, 0);
      assert.equal(total, 137, `semente ${s}: cartas sumiram`);
      aplicar(e, escolherAcao(e, e.jogadores[e.vez].id));
      if (++passos > 5000) assert.fail(`semente ${s}: rodada não termina`);
    }
    rodadas += e.rodada;
  }
  assert.ok(rodadas >= 6000);
});

test('sala aberta: quem chega entra na próxima mão e as mãos jogadas são contadas', async () => {
  const { adicionarJogador, placar } = await import('../motor/regras.js');
  const e = mesa({ maos: [[N('azul', 6)], extras(), extras()], topo: N('azul', 4), opcoes: { salaAberta: true, fim: { modo: 'sem_fim' } } });
  e.disseUltima.j1 = true;
  assert.throws(() => adicionarJogador(e, { id: 'novo', nome: 'Novo' }), /entre as mãos/);
  aplicar(e, { tipo: 'jogar', jogador: 'j1', cartas: [e.jogadores[0].mao[0].id] });
  assert.equal(e.jogadores.every((j) => j.maos === 1), true);
  adicionarJogador(e, { id: 'novo', nome: 'Novo' });
  aplicar(e, { tipo: 'proxima_rodada' });
  assert.equal(e.jogadores.length, 4);
  assert.equal(e.jogadores[3].mao.length, 7);
  const p = placar(e).find((x) => x.jogador === 'novo');
  assert.deepEqual([p.pontos, p.maos], [0, 0]);
});

test('bater no corte: opcional', () => {
  for (const pode of [true, false]) {
    const e = mesa({ maos: [extras(), [N('azul', 4)], extras()], topo: N('azul', 4), opcoes: { corte: true, baterNoCorte: pode } });
    e.disseUltima.j2 = true;
    const id = e.jogadores[1].mao[0].id;
    if (pode) { const r = aplicar(e, { tipo: 'corte', jogador: 'j2', cartas: [id] }); assert.ok(r.fimDeRodada); }
    else assert.throws(() => aplicar(e, { tipo: 'corte', jogador: 'j2', cartas: [id] }), /bater no corte/);
  }
});
