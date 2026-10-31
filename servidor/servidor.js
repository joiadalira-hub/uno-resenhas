// Uno Resenhas — servidor online
// Um programa só: entrega o site (pasta dist) e cuida das salas em tempo real (WebSocket em /ws).
// O servidor é o árbitro: guarda as mãos, valida cada jogada no motor de regras e manda a cada
// jogador apenas o que ele pode ver. Bots, tempo de jogada e reconexão também rodam aqui.

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomBytes, randomInt } from 'node:crypto';
import { aceitarUpgrade } from './ws.js';
import { novaPartida, aplicar, visaoDe, resolverSequencia, removerJogadores, adicionarJogador } from '../motor/regras.js';
import { escolherAcao } from '../motor/bot.js';

const PORTA = Number(process.env.PORT) || 3000;
const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../dist');
const NOMES_BOTS = ['Ana', 'Rui', 'Bia', 'Léo', 'Duda', 'Caio', 'Mel', 'Nina', 'Tito'];
const ESPERA_RECONEXAO = 5000;  // caiu a conexão: em 5 s um bot joga por ele até a mão acabar (se voltar, retoma)
const ESPERA_VOTOS = 90000;
const ESPERA_SALA = 3 * 60 * 1000;      // na sala de espera, quem caiu (ex.: foi mandar o link no WhatsApp) guarda o lugar por 3 min      // quem não votar até lá continua na mesa
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);

// ---------------- site ----------------
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.webp': 'image/webp', '.png': 'image/png', '.mp3': 'audio/mpeg', '.json': 'application/json', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.webmanifest': 'application/manifest+json' };
const CABECALHO = '<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">'
  + '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover"><base href="/">'
  + '<meta name="theme-color" content="#10162B"><link rel="manifest" href="/manifest.webmanifest">'
  + '<link rel="icon" href="/icone-192.png"><link rel="apple-touch-icon" href="/icone-192.png">'
  + '<meta name="apple-mobile-web-app-capable" content="yes"><meta name="mobile-web-app-capable" content="yes">'
  + '<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent"><meta name="apple-mobile-web-app-title" content="Uno Resenhas">'
  + '<style>:root{padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}body{margin:0}img{max-width:100%}[hidden]{display:none!important}</style>';
const servidor = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://x');
  let caminho = decodeURIComponent(url.pathname);
  if (caminho === '/saude') { res.writeHead(200, { 'content-type': 'text/plain' }); return res.end('ok'); }
  if (caminho === '/salas') { res.writeHead(200, { 'content-type': 'application/json', 'cache-control': 'no-store' }); return res.end(JSON.stringify(salasParaEntrar())); }
  if (caminho === '/' || caminho.startsWith('/s/')) caminho = '/index.html';
  const arquivo = path.join(RAIZ, path.normalize(caminho));
  if (!arquivo.startsWith(RAIZ)) { res.writeHead(403); return res.end(); }
  fs.readFile(arquivo, (erro, dados) => {
    if (erro) { res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' }); return res.end('Não encontrado'); }
    const ext = path.extname(arquivo).toLowerCase();
    // a página do jogo ganha o cabeçalho de site: tela de celular, ícone de app e base "/"
    // (a base faz as cartas carregarem também nos links de sala, /s/CODIGO)
    if (arquivo.endsWith('index.html')) dados = Buffer.concat([Buffer.from(CABECALHO), dados]);
    res.writeHead(200, { 'content-type': MIME[ext] || 'application/octet-stream', 'cache-control': ext === '.html' ? 'no-cache' : 'public, max-age=86400' });
    res.end(dados);
  });
});

// ---------------- salas ----------------
const salas = new Map();
// Lista da tela inicial: salas com lugar livre agora (ou sala aberta com a partida rolando)
function salasParaEntrar() {
  const lista = [];
  for (const sala of salas.values()) {
    if (!sala.humanos().some((h) => h.conectado)) continue;
    const ocupados = sala.assentos.filter((a) => a.tipo !== 'aberto' && !a.saiu && !a.sai).length;
    const humanos = sala.humanos().filter((h) => !h.saiu).length;
    let pode = false;
    if (sala.fase === 'espera') pode = sala.assentos.some((a) => a.tipo === 'aberto') || (sala.config.salaAberta && sala.assentos.length < sala.capacidade);
    else if (sala.fase === 'jogando' && sala.config.salaAberta) pode = humanos < sala.capacidade;
    if (!pode) continue;
    lista.push({ codigo: sala.codigo, nome: sala.nome, temSenha: !!sala.senha, aberta: sala.config.salaAberta, jogando: sala.fase === 'jogando', ocupados, lugares: sala.config.salaAberta ? sala.capacidade : sala.assentos.length, modo: sala.config.fimModo });
  }
  return lista.slice(0, 30);
}
const LETRAS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
function novoCodigo() {
  let c;
  do { c = Array.from({ length: 5 }, () => LETRAS[randomInt(LETRAS.length)]).join(''); } while (salas.has(c));
  return c;
}
const novoToken = () => randomBytes(16).toString('hex');
const limpaTexto = (t, max) => String(t || '').replace(/[<>]/g, '').trim().slice(0, max);
const avatarValido = (a) => (typeof a === 'string' && a.startsWith('data:image/') && a.length < 400000 ? a : null);

class Sala {
  constructor(msg, conexao) {
    const cfg = msg.config || {};
    const lugares = Array.isArray(cfg.lugares) ? cfg.lugares.slice(0, 9) : ['bot'];
    this.codigo = novoCodigo();
    this.nome = limpaTexto(msg.nome, 30) || 'Sala de resenha';
    this.senha = limpaTexto(msg.senha, 20);
    const salaAberta = !!cfg.salaAberta;
    let fimModo = ['rodadas', 'pontos', 'vitorias', 'sem_fim'].includes(cfg.fimModo) ? cfg.fimModo : 'rodadas';
    if (salaAberta && fimModo !== 'vitorias') fimModo = 'sem_fim'; // sala aberta não tem fim marcado: classifica por pontos ou por vitórias
    this.config = {
      salaAberta,
      fimModo,
      fimValor: Number(cfg.fimValor) || 5,
      tempo: [0, 15, 20, 30].includes(Number(cfg.tempo)) ? Number(cfg.tempo) : 20,
      opcoes: typeof cfg.opcoes === 'object' && cfg.opcoes ? cfg.opcoes : {},
    };
    this.seq = 1;
    const dono = this.novoHumano(msg, conexao);
    this.dono = dono.id;
    this.assentos = [dono];
    // sala aberta: a mesa vai até 10, não importa quantos lugares foram escolhidos no começo
    this.capacidade = this.config.salaAberta ? 10 : 1 + lugares.length;
    lugares.forEach((t, i) => this.assentos.push(t === 'bot' ? this.novoBot(i) : { tipo: 'aberto', id: `a${this.seq++}` }));
    this.e = null;
    this.fase = 'espera';
    this.timers = [];
    this.prazoAte = 0;
    this.vazioDesde = 0;
    this.votos = null;   // entre as rodadas: { idJogador: true (Sim) | false (Não) }
    this.timerVotos = null;
  }
  novoHumano(msg, conexao) {
    return { tipo: 'humano', id: `h${this.seq++}`, nome: limpaTexto(msg.apelido, 14) || 'Jogador', avatar: avatarValido(msg.avatar), token: novoToken(), conexao, conectado: true };
  }
  novoBot(i) {
    // nome de bot que não repete nem outro bot nem o apelido de alguém da sala
    const usados = new Set((this.assentos || []).filter((a) => a.tipo !== 'aberto').map((a) => a.nome.replace('Bot ', '').toLowerCase()));
    const nome = 'Bot ' + (NOMES_BOTS.find((n) => !usados.has(n.toLowerCase())) || NOMES_BOTS[i % 9]);
    return { tipo: 'bot', id: `b${this.seq++}`, nome };
  }
  humanos() { return this.assentos.filter((a) => a.tipo === 'humano'); }
  resumo() {
    return {
      codigo: this.codigo, nome: this.nome, temSenha: !!this.senha, dono: this.dono, fase: this.fase, config: this.config, votos: this.votos,
      assentos: this.assentos.map((a) => ({ id: a.id, tipo: a.tipo, nome: a.nome, avatar: a.avatar || null, conectado: a.tipo !== 'humano' || a.conectado, pendente: !!a.pendente, sai: !!(a.saiu || a.sai), naCall: !!(a.naCall && a.conectado) })),
    };
  }
  enviarSala() { for (const h of this.humanos()) if (h.conexao) h.conexao.enviar({ tipo: 'sala', sala: this.resumo() }); }
  enviarEstado(evento) {
    for (const h of this.humanos()) {
      if (!h.conexao || !this.e || h.pendente) continue;
      h.conexao.enviar({ tipo: 'estado', meuId: h.id, visao: visaoDe(this.e, h.id), evento: evento ? privado(evento, h.id) : null, prazo: this.prazoAte ? Math.max(0, this.prazoAte - Date.now()) : 0 });
    }
  }
  limparTimers() { this.timers.forEach(clearTimeout); this.timers = []; this.prazoAte = 0; }
  depois(ms, fn) { this.timers.push(setTimeout(() => { try { fn(); } catch (err) { log('erro no timer', this.codigo, err.message); } }, ms)); }

  comecar() {
    const jogadores = this.assentos.filter((a) => a.tipo !== 'aberto').map((a) => ({ id: a.id, nome: a.nome, bot: a.tipo === 'bot' || !a.conectado }));
    if (jogadores.length < 2) throw new Error('A mesa precisa de pelo menos 2 jogadores');
    this.assentos = this.assentos.filter((a) => a.tipo !== 'aberto');
    this.e = novaPartida({ jogadores, opcoes: { ...this.config.opcoes, salaAberta: this.config.salaAberta, fim: { modo: this.config.fimModo, valor: this.config.fimValor } } });
    this.fase = 'jogando';
    this.enviarSala();
    const evento = { tipo: 'inicio' };
    this.agendar(evento);
    this.enviarEstado(evento);
    log('partida começou', this.codigo, jogadores.length, 'jogadores');
  }

  // Aplica uma ação no motor e avisa todo mundo
  agir(acao, origem) {
    const e = this.e;
    if (!e) throw new Error('A partida ainda não começou');
    let jogada = null;
    if (acao.tipo === 'jogar' || acao.tipo === 'corte') {
      const j = e.jogadores.find((x) => x.id === acao.jogador);
      const fisicas = (acao.cartas || []).map((id) => j && j.mao.find((c) => c.id === id));
      if (j && fisicas.length && fisicas.every(Boolean)) jogada = { fisicas, efetivas: resolverSequencia(e, fisicas), indice: e.jogadores.indexOf(j) };
    }
    const sentidoAntes = e.sentido;
    const r = aplicar(e, acao);
    const evento = { tipo: 'acao', acao, r, jogada, reverso: e.sentido !== sentidoAntes, origem };
    this.agendar(evento);
    this.enviarEstado(evento);
    if (e.fase !== 'jogando') this.abrirVotacao();
  }

  // Entre as rodadas cada um vota: Sim (continua) ou Não (sai da mesa). Bots votam Sim.
  abrirVotacao() {
    this.votos = {};
    for (const j of this.e.jogadores) {
      const a = this.assento(j.id);
      if (a && (a.saiu || a.sai)) this.votos[j.id] = false; // saiu no meio da mão, ou bot que cede o lugar
      else if (a && a.tipo === 'bot') this.votos[j.id] = true; // humano com bot no lugar ainda vota (ou sai, se não voltar)
    }
    clearTimeout(this.timerVotos);
    this.timerVotos = setTimeout(() => {
      if (!this.votos) return;
      for (const j of this.e.jogadores) if (!(j.id in this.votos)) {
        const a = this.assento(j.id);
        this.votos[j.id] = !(a && a.tipo === 'humano' && !a.conectado); // quem caiu e não voltou até o fim da votação sai da mesa
      }
      this.conferirVotos();
    }, ESPERA_VOTOS);
    this.enviarSala();
    this.conferirVotos();
  }
  assento(id) { return this.assentos.find((a) => a.id === id); }
  passarDono() {
    const dono = this.assento(this.dono);
    if (dono && !dono.saiu && dono.tipo === 'humano') return;
    const outro = this.assentos.find((a) => a.tipo === 'humano' && !a.saiu && a.conectado) || this.assentos.find((a) => a.tipo === 'humano' && !a.saiu);
    if (outro) this.dono = outro.id;
  }
  // Sala aberta: alguém chega no meio da mão e espera a próxima
  chegou(msg, conexao) {
    if (this.assentos.filter((a) => !a.saiu && !a.sai).length >= Math.max(this.capacidade, 2)) {
      const bot = this.assentos.find((a) => a.tipo === 'bot' && !a.sai);
      if (!bot) return null;
      bot.sai = true; // o bot cede o lugar na próxima mão
    }
    const novo = { ...this.novoHumano(msg, conexao), pendente: true };
    this.assentos.push(novo);
    log('chegou para a próxima mão', this.codigo, novo.nome);
    return novo;
  }
  votar(id, sim) {
    if (!this.votos || !this.e.jogadores.some((j) => j.id === id)) return;
    this.votos[id] = !!sim;
    this.enviarSala();
    this.conferirVotos();
  }
  conferirVotos() {
    const e = this.e;
    if (!this.votos || !e.jogadores.every((j) => j.id in this.votos)) return;
    clearTimeout(this.timerVotos);
    const saem = e.jogadores.filter((j) => this.votos[j.id] === false).map((j) => j.id);
    this.votos = null;
    const ficam = this.assentos.filter((a) => !saem.includes(a.id));
    const chegam = ficam.filter((a) => a.pendente);
    // sem 2 jogadores, ou sem nenhuma pessoa de verdade, a partida acaba aqui
    if (ficam.length < 2 || !ficam.some((a) => a.tipo === 'humano' && !a.saiu)) {
      this.assentos = ficam.length ? ficam : this.assentos;
      return this.finalizar();
    }
    const tirar = () => { if (saem.length) removerJogadores(e, saem); };
    const sentar = () => { for (const a of chegam) { adicionarJogador(e, { id: a.id, nome: a.nome }); a.pendente = false; } };
    // a mesa nunca fica com menos de 2 no meio da troca
    if (e.jogadores.length - saem.length >= 2) { tirar(); sentar(); } else { sentar(); tirar(); }
    if (saem.length) {
      for (const a of this.assentos) if (saem.includes(a.id) && a.conexao) a.conexao.enviar({ tipo: 'removido' });
      log('saíram da mesa', this.codigo, saem.join(','));
    }
    if (chegam.length) log('sentaram na mesa', this.codigo, chegam.map((a) => a.nome).join(','));
    this.assentos = ficam;
    this.passarDono();
    this.enviarSala();
    this.proximaRodada();
  }
  // Quem criou a sala encerra: todo mundo vê o placar final com a arte
  finalizar() {
    clearTimeout(this.timerVotos);
    this.limparTimers();
    this.votos = null;
    this.fase = 'final';
    this.enviarSala();
    log('partida finalizada', this.codigo);
  }

  // Quanto tempo as animações deste evento levam nos celulares (para os bots e o relógio esperarem)
  esperaAnimacao(evento) {
    if (evento.tipo === 'inicio' || evento.tipo === 'rodada') return Math.min(this.e.jogadores.length, 8) * 1000 + 500;
    let t = 0;
    const { jogada, r } = evento;
    const n = jogada ? jogada.fisicas.length : 0;
    // combo / Pular / Reverso: um palco só (cai → efeito → recolhe na pilha), igual ao celular
    const ultEf = jogada ? jogada.efetivas[n - 1] : null;
    const efeito = evento.reverso ? 'reverso' : jogada && this.e.fase === 'jogando' && ultEf.tipo === 'pular' ? 'pulo' : null;
    if (jogada && (n > 1 || efeito)) {
      const tEspalha = 450 + n * 225 + 150;
      const tB = efeito ? tEspalha + 350 : tEspalha;
      const durB = !efeito ? 700 : efeito === 'reverso' ? 1500 : (n + 1) * 520 + 350;
      t = tB + durB + (n - 1) * 110 + 260 + 350;
    }
    if (jogada && this.e.fase === 'jogando') {
      const fis = jogada.fisicas[jogada.fisicas.length - 1];
      if (jogada.fisicas.length === 1 && (fis.tipo === 'coringa' || fis.tipo === '+5' || fis.tipo === 'ctrl')) t = Math.max(t, 1100);
      const troca = (r.eventos || []).some((ev) => ev.tipo === 'troca');
      if (troca) t = Math.max(350, t) + 1900; // TROCOU!
      const ator = this.e.jogadores.find((j) => j.id === evento.acao.jogador);
      if (ator && ator.mao.length === 1 && !troca) t = Math.max(350, t) + 1500; // ÚLTIMA! ou ESQUECEU!
    }
    const compradas = r && r.compradas ? r.compradas.length : 0;
    if (compradas) {
      const intervalo = compradas <= 2 ? 260 : Math.max(55, Math.min(220, 1600 / compradas));
      const voo = (compradas - 1) * intervalo + (compradas > 6 ? 330 : 460);
      const forcada = evento.acao && (evento.acao.tipo === 'pegou' || (evento.acao.tipo === 'comprar' && r.perdeuVez));
      t = Math.max(t, forcada ? Math.max(1500, voo + 400) : voo); // +N na tela de todos
    }
    if (evento.acao && evento.acao.tipo === 'desafiar') t = Math.max(t, 2000);
    return t;
  }

  // Agenda o próximo passo: bot jogar, tempo de quem é humano, Regra do 9, "Pegou!"
  agendar(evento) {
    this.limparTimers();
    const e = this.e;
    if (e.fase !== 'jogando') { this.ultimaAtividade = Date.now(); return; }
    const espera = this.esperaAnimacao(evento);
    if (e.regra9) {
      for (const j of e.jogadores) if (j.bot && !e.regra9.apertaram.includes(j.id)) {
        this.depois(espera + 450 + randomInt(2200), () => { if (this.e.regra9 && !this.e.regra9.apertaram.includes(j.id)) this.agir({ tipo: 'apertar9', jogador: j.id }, j.id); });
      }
      this.depois(espera + 6000, () => { if (this.e.regra9) this.agir({ tipo: 'tempo9' }, 'servidor'); });
      return;
    }
    // bot pega quem esqueceu de dizer "Última!"
    const vul = e.vulneravel && e.jogadores.find((j) => j.id === e.vulneravel);
    const algumBot = e.jogadores.find((j) => j.bot);
    if (vul && !vul.bot && algumBot) this.depois(espera + 2600, () => {
      if (this.e.vulneravel === vul.id && Math.random() < 0.75) this.agir({ tipo: 'pegou', jogador: algumBot.id, alvo: vul.id }, algumBot.id);
    });
    const atual = e.jogadores[e.vez];
    if (atual.bot) {
      this.depois(Math.max(1900, espera + 700), () => { const a = escolherAcao(this.e, atual.id); this.agir(a, atual.id); });
    } else if (this.config.tempo) {
      const ms = espera + this.config.tempo * 1000;
      this.prazoAte = Date.now() + ms;
      this.depois(ms, () => {
        const j = this.e.jogadores[this.e.vez];
        if (j.id !== atual.id) return;
        this.agir(this.e.comprou ? { tipo: 'passar', jogador: j.id } : { tipo: 'comprar', jogador: j.id }, 'tempo');
      });
    }
  }

  proximaRodada() {
    if (this.e.fase === 'fim_rodada') {
      aplicar(this.e, { tipo: 'proxima_rodada' });
    } else if (this.e.fase === 'fim_partida') {
      const jogadores = this.e.jogadores.map((j) => ({ id: j.id, nome: j.nome, bot: j.bot }));
      this.e = novaPartida({ jogadores, opcoes: this.e.opcoes });
    } else return;
    const evento = { tipo: 'rodada' };
    this.agendar(evento);
    this.enviarEstado(evento);
  }

  // Quem caiu: espera um pouco e depois um bot assume a mão
  caiu(assento) {
    assento.conectado = false;
    assento.conexao = null;
    assento.naCall = false;
    if (this.fase === 'espera') {
      // celular que troca de app derruba a conexão: o lugar (e o posto de dono) fica guardado
      this.enviarSala();
      clearTimeout(assento.timerSaida);
      assento.timerSaida = setTimeout(() => this.liberarLugar(assento), ESPERA_SALA);
      return;
    }
    this.enviarSala();
    setTimeout(() => {
      if (assento.conectado || !this.e) return;
      const j = this.e.jogadores.find((x) => x.id === assento.id);
      if (j && !j.bot) { j.bot = true; log('bot assumiu', this.codigo, assento.nome); this.agendar({ tipo: 'nada' }); this.enviarEstado(null); }
    }, ESPERA_RECONEXAO);
  }
  liberarLugar(assento) {
    const i = this.assentos.indexOf(assento);
    if (i < 0 || assento.conectado || this.fase !== 'espera') return;
    this.assentos[i] = { tipo: 'aberto', id: `a${this.seq++}` };
    if (assento.id === this.dono) {
      const outro = this.humanos().find((h) => h.conectado);
      if (outro) this.dono = outro.id;
    }
    this.enviarSala();
  }
  voltou(assento, conexao) {
    clearTimeout(assento.timerSaida);
    assento.conexao = conexao;
    assento.conectado = true;
    if (this.e) { const j = this.e.jogadores.find((x) => x.id === assento.id); if (j) j.bot = false; }
  }
}

// O que cada jogador pode saber de um evento: as cartas compradas pelos outros não vão para ele
function privado(evento, id) {
  if (!evento.r || !evento.r.compradas || !evento.acao) return evento;
  const dono = evento.acao.tipo === 'comprar' ? evento.acao.jogador : evento.acao.tipo === 'pegou' ? evento.acao.alvo : evento.r.comprou || evento.r.ultimo9;
  if (dono === id) return evento;
  return { ...evento, r: { ...evento.r, compradas: evento.r.compradas.map(() => null), podeJogar: undefined } };
}

// ---------------- mensagens ----------------
function erro(conexao, mensagem) { conexao.enviar({ tipo: 'erro', mensagem }); }

function tratar(conexao, msg, ctx) {
  const { tipo } = msg;
  if (tipo === 'ping') return conexao.enviar({ tipo: 'pong' });

  if (tipo === 'criar') {
    const sala = new Sala(msg, conexao);
    salas.set(sala.codigo, sala);
    ctx.sala = sala; ctx.assento = sala.assentos[0];
    conexao.enviar({ tipo: 'entrou', codigo: sala.codigo, token: ctx.assento.token, meuId: ctx.assento.id });
    sala.enviarSala();
    log('sala criada', sala.codigo, `(${sala.assentos.length} lugares)`);
    return;
  }

  if (tipo === 'entrar') {
    const sala = salas.get(String(msg.codigo || '').toUpperCase());
    if (!sala) return erro(conexao, 'Sala não encontrada. Confira o link.');
    const antigo = msg.token && sala.humanos().find((h) => h.token === msg.token);
    if (antigo) {
      if (antigo.conexao && antigo.conexao !== conexao) antigo.conexao.fechar();
      sala.voltou(antigo, conexao);
      ctx.sala = sala; ctx.assento = antigo;
    } else {
      if (sala.senha && msg.senha !== sala.senha) return erro(conexao, 'Senha errada.');
      if (sala.fase === 'jogando' && sala.config.salaAberta) {
        const novo = sala.chegou(msg, conexao);
        if (!novo) return erro(conexao, 'A sala está cheia.');
        ctx.sala = sala; ctx.assento = novo;
      } else {
        if (sala.fase !== 'espera') return erro(conexao, sala.fase === 'final' ? 'Essa partida já terminou.' : 'A partida já começou nesta sala.');
        let i = sala.assentos.findIndex((a) => a.tipo === 'aberto');
        if (i < 0 && sala.config.salaAberta && sala.assentos.length < sala.capacidade) { sala.assentos.push({ tipo: 'aberto' }); i = sala.assentos.length - 1; }
        if (i < 0) return erro(conexao, 'A sala está cheia.');
        sala.assentos[i] = sala.novoHumano(msg, conexao);
        ctx.sala = sala; ctx.assento = sala.assentos[i];
      }
    }
    conexao.enviar({ tipo: 'entrou', codigo: sala.codigo, token: ctx.assento.token, meuId: ctx.assento.id });
    sala.enviarSala();
    if (sala.e && !ctx.assento.pendente) conexao.enviar({ tipo: 'estado', meuId: ctx.assento.id, visao: visaoDe(sala.e, ctx.assento.id), evento: null, prazo: sala.prazoAte ? Math.max(0, sala.prazoAte - Date.now()) : 0 });
    return;
  }

  const { sala, assento } = ctx;
  if (!sala || !assento) return erro(conexao, 'Entre em uma sala primeiro.');

  if (tipo === 'lugar') { // o dono alterna um lugar vago entre Aberto e Bot
    if (assento.id !== sala.dono || sala.fase !== 'espera') return;
    const a = sala.assentos[msg.indice];
    if (!a || a.tipo === 'humano') return;
    sala.assentos[msg.indice] = a.tipo === 'bot' ? { tipo: 'aberto', id: `a${sala.seq++}` } : sala.novoBot(msg.indice);
    return sala.enviarSala();
  }
  if (tipo === 'comecar') {
    if (assento.id !== sala.dono) return erro(conexao, 'Só quem criou a sala pode começar.');
    if (sala.fase !== 'espera') return;
    try { sala.comecar(); } catch (err) { erro(conexao, err.message); }
    return;
  }
  if (tipo === 'acao') {
    const acao = { ...(msg.acao || {}), jogador: assento.id };
    if (['tempo9', 'proxima_rodada'].includes(acao.tipo)) return;
    try { sala.agir(acao, assento.id); } catch (err) { erro(conexao, err.message); }
    return;
  }
  // Call de voz: o servidor só apresenta os celulares (WebRTC); o áudio vai direto de um para o outro
  if (tipo === 'call') { assento.naCall = !!msg.ativo; sala.enviarSala(); return; }
  if (tipo === 'rtc') {
    const outro = sala.humanos().find((h) => h.id === msg.para && h.conexao);
    if (outro && msg.dados && typeof msg.dados === 'object') outro.conexao.enviar({ tipo: 'rtc', de: assento.id, dados: msg.dados });
    return;
  }
  if (tipo === 'voto') { if (sala.e) sala.votar(assento.id, msg.sim); return; }
  if (tipo === 'finalizar') {
    if (assento.id !== sala.dono) return erro(conexao, 'Só quem criou a sala pode finalizar.');
    if (sala.e && sala.e.fase !== 'jogando' && sala.fase === 'jogando') sala.finalizar();
    return;
  }
  if (tipo === 'sair') {
    const i = sala.assentos.indexOf(assento);
    if (sala.fase === 'espera') { assento.conectado = false; assento.conexao = null; assento.token = null; sala.liberarLugar(assento); }
    else if (i >= 0 && assento.pendente) { // ia entrar na próxima mão e desistiu
      sala.assentos.splice(i, 1);
      const bot = sala.assentos.find((a) => a.tipo === 'bot' && a.sai);
      if (bot) bot.sai = false;
      sala.enviarSala();
    } else if (i >= 0 && sala.e) {
      // saiu da partida: um bot termina a mão por ele e ele sai da mesa quando ela acabar
      assento.token = null; assento.saiu = true; assento.conectado = false; assento.conexao = null;
      const j = sala.e.jogadores.find((x) => x.id === assento.id);
      if (j) j.bot = true;
      // abriu um lugar: o bot que ia ceder o lugar para quem chegou (sala aberta) pode ficar
      const botSaindo = sala.assentos.find((a) => a.tipo === 'bot' && a.sai);
      if (botSaindo && sala.assentos.filter((a) => !a.saiu && !a.sai).length < sala.capacidade) botSaindo.sai = false;
      sala.passarDono();
      log('saiu da partida (bot até o fim da mão)', sala.codigo, assento.nome);
      if (sala.votos) sala.votar(assento.id, false); // saiu entre as mãos = Não
      else if (sala.e.fase === 'jogando') { sala.agendar({ tipo: 'nada' }); sala.enviarEstado(null); }
      sala.enviarSala();
    }
    ctx.sala = null; ctx.assento = null;
  }
}

servidor.on('upgrade', (req, socket) => {
  if (!req.url.startsWith('/ws')) return socket.destroy();
  const conexao = aceitarUpgrade(req, socket);
  if (!conexao) return;
  const ctx = { sala: null, assento: null };
  conexao.on('mensagem', (msg) => { try { tratar(conexao, msg, ctx); } catch (err) { log('erro', err.message); erro(conexao, 'Algo deu errado no servidor.'); } });
  conexao.on('close', () => { if (ctx.sala && ctx.assento && ctx.assento.conexao === conexao) ctx.sala.caiu(ctx.assento); });
});

// Salas sem ninguém conectado por 30 minutos são apagadas
setInterval(() => {
  const agora = Date.now();
  for (const [codigo, sala] of salas) {
    const alguem = sala.humanos().some((h) => h.conectado);
    if (alguem) { sala.vazioDesde = 0; continue; }
    if (!sala.vazioDesde) sala.vazioDesde = agora;
    else if (agora - sala.vazioDesde > 30 * 60 * 1000) { sala.limparTimers(); salas.delete(codigo); log('sala apagada', codigo); }
  }
}, 60 * 1000).unref();

servidor.listen(PORTA, () => log(`Uno Resenhas no ar na porta ${PORTA}`));
