// Uno Resenhas — interface (treino contra bots no navegador)
// Usa o motor (cartas.js, regras.js, bot.js), que é colado antes deste arquivo no build.

let EU = 'eu'; // no online vira o id que o servidor deu para você
const NOMES_BOTS = ['Ana', 'Rui', 'Bia', 'Léo', 'Duda', 'Caio', 'Mel', 'Nina', 'Tito'];
const NOME_DA_COR = { vermelho: 'Vermelho', azul: 'Azul', verde: 'Verde', amarelo: 'Amarelo', roxo: 'Roxo' };
const VAR_COR = { vermelho: 'var(--c-vermelho)', azul: 'var(--c-azul)', verde: 'var(--c-verde)', amarelo: 'var(--c-amarelo)', roxo: 'var(--c-roxo)' };
const REGRAS_OPCIONAIS = [
  ['acumularCompras', 'Acumular compras', '+2 sobre +2, +5 sobre +5'],
  ['mais5SobreMais2', '+5 em cima de +2', 'Um +2 pode ser respondido com +5'],
  ['mais2NaoRespondeMais5', '+2 não responde a +5', 'Só +5 ou Ctrl+C defendem um +5'],
  ['vencerComEspecial', 'Vencer com carta especial', 'Libera vencer com coringa ou ação'],
  ['corte', 'Corte', 'Carta idêntica ao topo joga fora da vez'],
  ['baterNoCorte', 'Bater no corte', 'Com o Corte ligado: dá para ganhar cortando com a última carta'],
  ['comprarAtePoder', 'Comprar até poder jogar', 'Compra até achar uma carta válida'],
  ['morteSubita', 'Morte súbita', 'O monte acaba 2 vezes: fim da rodada'],
  ['regraDo5', 'Regra do 5', 'Jogar um 5 escolhe a próxima cor'],
  ['regraDo9', 'Regra do 9', 'Saiu 9: o último a apertar o (9) compra 1 por 9'],
];

const ler = (k, padrao) => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : padrao; } catch { return padrao; } };
const gravar = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* sem armazenamento */ } };
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const app = document.getElementById('app');

// ---------- sons ----------
// sons/ : jogar, carta, combo e reverso vieram prontos; os outros foram criados para o jogo
const NOMES_SONS = ['corte', 'jogar', 'carta', 'combo', 'reverso', 'pular', 'ataque', 'coringa', 'ctrl', 'trocar', 'espiar', 'nove', 'apertou', 'ultima', 'pegou', 'sua-vez', 'tique', 'erro', 'vitoria', 'vitoria-partida', 'derrota'];
const VOLUME = { carta: 0.6, tique: 0.8, 'sua-vez': 0.9, apertou: 0.9 };
const bancoSom = {};
let somCartaEm = 0;
// Web Audio: os sons ficam decodificados na memória e tocam na hora, sem o atraso do <audio>
let ctxAudio = null;
const buffers = {};
function iniciarAudio() {
  try {
    if (!ctxAudio) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      ctxAudio = new AC();
      for (const n of NOMES_SONS) {
        fetch(`sons/${n}.mp3`).then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error('sem som'))))
          .then((b) => ctxAudio.decodeAudioData(b)).then((buf) => { buffers[n] = buf; }).catch(() => {});
      }
    }
    if (ctxAudio.state === 'suspended') ctxAudio.resume();
  } catch { /* fica no <audio> */ }
}
document.addEventListener('pointerdown', iniciarAudio, { capture: true });
document.addEventListener('keydown', iniciarAudio, { capture: true });
function tocar(nome, vol = 1) {
  if (!S.som) return;
  if (nome === 'carta') { const agora = performance.now(); if (agora - somCartaEm < 45) return; somCartaEm = agora; }
  const volume = Math.min(1, (VOLUME[nome] ?? 0.85) * vol * S.volJogo);
  if (ctxAudio && ctxAudio.state === 'running' && buffers[nome]) {
    try {
      const fonte = ctxAudio.createBufferSource(), ganho = ctxAudio.createGain();
      fonte.buffer = buffers[nome]; ganho.gain.value = volume;
      fonte.connect(ganho).connect(ctxAudio.destination); fonte.start();
      return;
    } catch { /* cai para o <audio> */ }
  }
  try {
    const base = bancoSom[nome] || (bancoSom[nome] = new Audio(`sons/${nome}.mp3`));
    const a = base.cloneNode();
    a.volume = volume;
    const p = a.play(); if (p) p.catch(() => {});
  } catch { /* sem áudio */ }
}
const tocarDepois = (nome, ms, vol) => setTimeout(() => tocar(nome, vol), ms);
(function preCarregarSons() {
  for (const n of NOMES_SONS) {
    try { const a = new Audio(`sons/${n}.mp3`); a.preload = 'auto'; bancoSom[n] = a; } catch { /* sem áudio */ }
  }
})();
const iconeSom = () => S.som
  ? '<path d="M4 9v6h4l5 4V5L8 9H4z"/><path d="M16 9a4 4 0 0 1 0 6M18.5 6.5a8 8 0 0 1 0 11"/>'
  : '<path d="M4 9v6h4l5 4V5L8 9H4z"/><path d="M17 9l5 6M22 9l-5 6"/>';
const botaoSom = () => `<button class="btn btn-icone botao-som ${CALL.ativa ? 'em-call' : ''}" id="som" aria-label="Sons e call" aria-haspopup="dialog"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${iconeSom()}</svg></button>`;
// ---------- zoom: (−) e (+) aumentam ou diminuem a tela inteira, de 10 em 10% ----------
const ZOOM = { valor: ler('ur-zoom', 1), mao: ler('ur-tam-mao', 1), mesa: ler('ur-tam-mesa', 1) };
function aplicarZoom() {
  const z = ZOOM.valor;
  app.style.zoom = z === 1 ? '' : String(z);
  // altura em px (que o zoom multiplica): a tela inteira continua cabendo, em qualquer navegador
  app.style.height = z === 1 ? '' : `${window.innerHeight / z}px`;
}
// um botão só (lupa) abre o painel: zoom da tela, tamanho das cartas da mão e das cartas da mesa
const botoesZoom = () => `<button class="btn btn-icone" id="visual" aria-label="Deck, zoom e tamanho das cartas" aria-haspopup="dialog"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5"/><path d="M15.5 15.5L21 21M10.5 7.5v6M7.5 10.5h6"/></svg></button>`;
const AJUSTES = [
  ['valor', 'ur-zoom', 'Zoom da tela', 'Aumenta ou diminui tudo'],
  ['mao', 'ur-tam-mao', 'Cartas da mão', 'Só as suas cartas'],
  ['mesa', 'ur-tam-mesa', 'Cartas da mesa', 'Monte e pilha do meio'],
];
function abrirPainelVisual(botao) {
  const velho = document.querySelector('.painel-visual');
  document.querySelectorAll('.painel-som').forEach((x) => x.remove());
  if (velho) return;
  const r = botao.getBoundingClientRect();
  const pn = document.createElement('div');
  pn.className = 'painel-som painel-visual';
  pn.setAttribute('role', 'dialog');
  pn.setAttribute('aria-label', 'Zoom e tamanho das cartas');
  pn.style.top = (r.bottom + 8) + 'px';
  document.body.appendChild(pn);
  desenharPainelVisual();
  const w = pn.offsetWidth;
  pn.style.left = Math.max(8, Math.min(r.right - w, window.innerWidth - w - 8)) + 'px';
  const fechar = (ev) => { if (!pn.contains(ev.target) && !ev.target.closest('#visual')) { pn.remove(); document.removeEventListener('pointerdown', fechar, true); } };
  setTimeout(() => document.addEventListener('pointerdown', fechar, true), 0);
}
function desenharPainelVisual() {
  const pn = document.querySelector('.painel-visual');
  if (!pn) return;
  // o deck vem primeiro: é a escolha que mais se procura aqui dentro da mesa
  pn.innerHTML = `<span class="ps-titulo">Deck das cartas</span>${htmlEscolhaDeck()}<div class="ps-sep"></div>` + AJUSTES.map(([k, , nome, ajuda]) => `<div class="ps-linha"><span style="display:flex;flex-direction:column"><span class="ps-titulo">${nome}</span><span class="ajuda">${ajuda}</span></span>
    <div class="passo"><button class="btn btn-icone ps-passo" data-aj="${k}" data-d="-1" aria-label="Diminuir ${nome}" ${ZOOM[k] <= 0.6 ? 'disabled' : ''}>−</button><span style="min-width:52px;font-size:17px">${Math.round(ZOOM[k] * 100)}%</span><button class="btn btn-icone ps-passo" data-aj="${k}" data-d="1" aria-label="Aumentar ${nome}" ${ZOOM[k] >= 1.6 ? 'disabled' : ''}>+</button></div></div>`).join('')
    + '<button type="button" class="link" id="aj-padrao" style="align-self:center">Voltar ao padrão</button>';
  ligarEscolhaDeck(pn);
  pn.querySelectorAll('[data-deck]').forEach((b) => b.addEventListener('click', () => setTimeout(desenharPainelVisual, 0)));
  pn.querySelectorAll('[data-aj]').forEach((b) => (b.onclick = () => mudarAjuste(b.dataset.aj, Number(b.dataset.d) * 0.1)));
  pn.querySelector('#aj-padrao').onclick = () => { for (const [k, chave] of AJUSTES) { ZOOM[k] = 1; gravar(chave, 1); } aplicarZoom(); render(); desenharPainelVisual(); };
}
function mudarAjuste(k, d) {
  const chave = AJUSTES.find((a) => a[0] === k)[1];
  ZOOM[k] = Math.round(Math.min(1.6, Math.max(0.6, ZOOM[k] + d)) * 10) / 10;
  gravar(chave, ZOOM[k]);
  if (k === 'valor') aplicarZoom();
  render();
  desenharPainelVisual();
  // o painel acompanha o botão (o zoom muda a posição dele)
  const b = document.getElementById('visual'), pn = document.querySelector('.painel-visual');
  if (b && pn) { const r = b.getBoundingClientRect(), w = pn.offsetWidth; pn.style.top = (r.bottom + 8) + 'px'; pn.style.left = Math.max(8, Math.min(r.right - w, window.innerWidth - w - 8)) + 'px'; }
}
// ---------- tela cheia: disponível em todas as telas (fica valendo ao trocar de tela) ----------
const iconeTelaCheia = () => (document.fullscreenElement ? '<path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5"/>' : '<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>');
const botaoTelaCheia = () => (document.fullscreenEnabled ? `<button class="btn btn-icone" id="tela-cheia" aria-label="${document.fullscreenElement ? 'Sair da tela cheia' : 'Tela cheia'}"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${iconeTelaCheia()}</svg></button>` : '');
function ligarTelaCheia() {
  const b = document.getElementById('tela-cheia');
  if (!b) return;
  b.onclick = () => {
    const p = document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen();
    Promise.resolve(p).catch(() => mostrarToast('Este navegador não deixou abrir em tela cheia', 3500));
  };
}
function ligarZoom() {
  ligarTelaCheia();
  const v = document.getElementById('visual');
  if (v) v.onclick = (ev) => { ev.stopPropagation(); abrirPainelVisual(v); };
}
// ---------- painel de som: sons do jogo, call de voz e microfone ----------
function abrirPainelSom(botao) {
  document.querySelectorAll('.painel-visual').forEach((x) => x.remove());
  const velho = document.querySelector('.painel-som');
  if (velho) { velho.remove(); return; }
  const r = botao.getBoundingClientRect();
  const pn = document.createElement('div');
  pn.className = 'painel-som';
  pn.setAttribute('role', 'dialog');
  pn.setAttribute('aria-label', 'Sons e call');
  pn.style.top = (r.bottom + 8) + 'px';
  document.body.appendChild(pn);
  desenharPainelSom();
  const w = pn.offsetWidth; // alinhado ao botão, mas sempre inteiro na tela
  pn.style.left = Math.max(8, Math.min(r.right - w, window.innerWidth - w - 8)) + 'px';
  const fechar = (ev) => { if (!pn.contains(ev.target) && ev.target.id !== 'som' && !ev.target.closest('#som')) { pn.remove(); document.removeEventListener('pointerdown', fechar, true); } };
  setTimeout(() => document.addEventListener('pointerdown', fechar, true), 0);
}
function desenharPainelSom() {
  const pn = document.querySelector('.painel-som');
  if (!pn) return;
  const online = !!(S.online && S.online.codigo);
  const naCall = (S.online && S.online.sala ? S.online.sala.assentos.filter((a) => a.naCall) : []).map((a) => a.id === EU ? 'Você' : a.nome).join(', ');
  pn.innerHTML = `
    <div class="ps-linha"><span class="ps-titulo">Sons do jogo</span>
      <label class="chave mini"><input type="checkbox" id="ps-som" ${S.som ? 'checked' : ''}><span class="trilho" aria-hidden="true"></span></label></div>
    <input type="range" class="ps-vol" id="ps-vol-jogo" min="0" max="100" value="${Math.round(S.volJogo * 100)}" aria-label="Volume dos sons do jogo" ${S.som ? '' : 'disabled'}>
    <div class="ps-sep"></div>
    <div class="ps-linha"><span class="ps-titulo">Call de voz</span>
      <label class="chave mini"><input type="checkbox" id="ps-call" ${CALL.ativa ? 'checked' : ''} ${online ? '' : 'disabled'}><span class="trilho" aria-hidden="true"></span></label></div>
    <input type="range" class="ps-vol" id="ps-vol-call" min="0" max="100" value="${Math.round(S.volCall * 100)}" aria-label="Volume da call">
    <div class="ps-linha"><span>Microfone</span>
      <button type="button" class="btn ps-mic ${CALL.mic ? '' : 'mudo'}" id="ps-mic" ${CALL.ativa && CALL.stream ? '' : 'disabled'}>${CALL.mic ? 'Ligado' : 'Mudo'}</button></div>
    <p class="ajuda ps-ajuda">${!online ? 'A call funciona nas salas online.' : CALL.erro ? esc(CALL.erro) : naCall ? 'Na call: ' + esc(naCall) : 'Ninguém na call ainda.'}</p>`;
  const $ = (id) => document.getElementById(id);
  $('ps-som').onchange = (ev) => { S.som = ev.target.checked; gravar('ur-som', S.som); if (S.som) tocar('ultima', 0.6); desenharPainelSom(); };
  $('ps-vol-jogo').oninput = (ev) => { S.volJogo = ev.target.value / 100; gravar('ur-vol-jogo', S.volJogo); };
  $('ps-vol-jogo').onchange = () => tocar('carta');
  $('ps-vol-call').oninput = (ev) => { S.volCall = ev.target.value / 100; gravar('ur-vol-call', S.volCall); for (const a of CALL.audios.values()) a.volume = S.volCall; };
  $('ps-call').onchange = (ev) => { if (ev.target.checked) entrarNaCall(); else sairDaCall(); };
  $('ps-mic').onclick = () => { CALL.mic = !CALL.mic; aplicarMic(); desenharPainelSom(); };
}

// ---------- call de voz (WebRTC: o áudio vai direto entre os celulares; o servidor só apresenta) ----------
const CALL = { ativa: false, mic: true, stream: null, pcs: new Map(), audios: new Map(), filas: new Map(), medidores: new Map(), erro: '' };
const ICE = [{ urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] }];
async function entrarNaCall() {
  if (!S.online || !S.online.codigo) return;
  iniciarAudio();
  CALL.erro = '';
  try {
    CALL.stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
  } catch {
    CALL.stream = null;
    CALL.erro = 'O microfone foi bloqueado: você só ouve. Libere o microfone para este site e entre de novo.';
  }
  CALL.ativa = true; CALL.mic = true;
  aplicarMic();
  if (CALL.stream) medirVoz(EU, CALL.stream);
  enviar({ tipo: 'call', ativo: true });
  atualizarCall();
  desenharPainelSom(); atualizarIconeSom();
}
function sairDaCall(avisar = true) {
  if (!CALL.ativa && !CALL.stream) return;
  CALL.ativa = false;
  for (const id of [...CALL.pcs.keys()]) fecharPar(id);
  if (CALL.stream) CALL.stream.getTracks().forEach((t) => t.stop());
  CALL.stream = null;
  pararMedidor(EU);
  if (avisar) enviar({ tipo: 'call', ativo: false });
  desenharPainelSom(); atualizarIconeSom();
}
function aplicarMic() { if (CALL.stream) CALL.stream.getAudioTracks().forEach((t) => { t.enabled = CALL.mic; }); }
function atualizarIconeSom() { const b = document.getElementById('som'); if (b) b.classList.toggle('em-call', CALL.ativa); }
// Quem chama quem: só o de id "menor" liga, para os dois não ligarem ao mesmo tempo
function atualizarCall() {
  const sala = S.online && S.online.sala;
  if (!CALL.ativa || !sala) return;
  const naCall = new Set(sala.assentos.filter((a) => a.naCall && a.id !== EU).map((a) => a.id));
  for (const id of [...CALL.pcs.keys()]) if (!naCall.has(id)) fecharPar(id);
  for (const id of naCall) if (!CALL.pcs.has(id) && EU < id) chamar(id);
  desenharPainelSom();
}
function novoPar(id) {
  fecharPar(id);
  const pc = new RTCPeerConnection({ iceServers: ICE });
  if (CALL.stream) CALL.stream.getTracks().forEach((t) => pc.addTrack(t, CALL.stream));
  else pc.addTransceiver('audio', { direction: 'recvonly' });
  pc.onicecandidate = (ev) => { if (ev.candidate) enviar({ tipo: 'rtc', para: id, dados: { candidate: ev.candidate.toJSON() } }); };
  pc.ontrack = (ev) => ouvir(id, ev.streams[0] || new MediaStream([ev.track]));
  pc.onconnectionstatechange = () => {
    if (pc.connectionState === 'failed') { fecharPar(id); setTimeout(atualizarCall, 1500); }
  };
  CALL.pcs.set(id, pc);
  return pc;
}
async function chamar(id) {
  try {
    const pc = novoPar(id);
    await pc.setLocalDescription(await pc.createOffer());
    enviar({ tipo: 'rtc', para: id, dados: { sdp: pc.localDescription.toJSON() } });
  } catch { fecharPar(id); }
}
async function receberRtc(m) {
  if (!CALL.ativa) return;
  const { de, dados } = m;
  try {
    if (dados.sdp && dados.sdp.type === 'offer') {
      const pc = novoPar(de);
      await pc.setRemoteDescription(dados.sdp);
      await pc.setLocalDescription(await pc.createAnswer());
      enviar({ tipo: 'rtc', para: de, dados: { sdp: pc.localDescription.toJSON() } });
      await soltarCandidatos(de);
    } else if (dados.sdp && dados.sdp.type === 'answer') {
      const pc = CALL.pcs.get(de);
      if (pc && pc.signalingState === 'have-local-offer') { await pc.setRemoteDescription(dados.sdp); await soltarCandidatos(de); }
    } else if (dados.candidate) {
      const pc = CALL.pcs.get(de);
      if (pc && pc.remoteDescription) await pc.addIceCandidate(dados.candidate);
      else { if (!CALL.filas.has(de)) CALL.filas.set(de, []); CALL.filas.get(de).push(dados.candidate); }
    }
  } catch { /* uma negociação perdida: a próxima atualização da sala refaz */ }
}
async function soltarCandidatos(id) {
  const pc = CALL.pcs.get(id), fila = CALL.filas.get(id) || [];
  CALL.filas.delete(id);
  for (const c of fila) { try { await pc.addIceCandidate(c); } catch { /* candidato velho */ } }
}
function ouvir(id, stream) {
  let a = CALL.audios.get(id);
  if (!a) { a = document.createElement('audio'); a.autoplay = true; a.setAttribute('playsinline', ''); a.className = 'audio-call'; document.body.appendChild(a); CALL.audios.set(id, a); }
  a.srcObject = stream; a.volume = S.volCall;
  const p = a.play(); if (p) p.catch(() => {});
  medirVoz(id, stream);
}
function fecharPar(id) {
  const pc = CALL.pcs.get(id);
  if (pc) { pc.onconnectionstatechange = null; try { pc.close(); } catch { /* já fechado */ } }
  CALL.pcs.delete(id); CALL.filas.delete(id);
  const a = CALL.audios.get(id);
  if (a) { a.srcObject = null; a.remove(); }
  CALL.audios.delete(id);
  pararMedidor(id);
}
// Quem está falando: a foto ganha um brilho enquanto a voz passa de um certo volume
function medirVoz(id, stream) {
  pararMedidor(id);
  if (!ctxAudio) return;
  try {
    const fonte = ctxAudio.createMediaStreamSource(stream);
    const an = ctxAudio.createAnalyser(); an.fftSize = 512;
    fonte.connect(an);
    const dados = new Uint8Array(an.fftSize);
    const timer = setInterval(() => {
      an.getByteTimeDomainData(dados);
      let soma = 0; for (const v of dados) soma += (v - 128) * (v - 128);
      const falando = Math.sqrt(soma / dados.length) > 6 && (id !== EU || CALL.mic);
      const el = id === EU ? document.querySelector('.eu-canto') : document.querySelector(`.assento[data-id="${id}"]`);
      if (el) el.classList.toggle('falando', falando);
    }, 150);
    CALL.medidores.set(id, { timer, fonte });
  } catch { /* sem medidor */ }
}
function pararMedidor(id) {
  const m = CALL.medidores.get(id);
  if (m) { clearInterval(m.timer); try { m.fonte.disconnect(); } catch { /* ok */ } }
  CALL.medidores.delete(id);
}

function ligarBotaoSom() {
  ligarZoom();
  const b = document.getElementById('som');
  if (b) b.onclick = (ev) => { ev.stopPropagation(); abrirPainelSom(b); };
}
const S = {
  tela: 'inicio',
  apelido: ler('ur-apelido', ''),
  avatar: ler('ur-avatar', null),
  som: ler('ur-som', true),
  deck: ler('ur-deck', 'classico'),
  volJogo: ler('ur-vol-jogo', 1),
  volCall: ler('ur-vol-call', 1),
  config: ler('ur-config', { lugares: 6, fimModo: 'rodadas', fimValor: 5, tempo: 20, opcoes: { ...OPCOES_PADRAO } }),
  e: null,
  ui: null,
  online: null,      // { ws, codigo, token, meuId, sala, ... } quando jogando pela internet
  modoCriar: 'treino',
};

function novaUI() {
  return { combo: false, seq: [], aviso: '', erro: false, modal: null, prazo: 0, ultimaCarta: null, espiadasVistas: 0, treme: null };
}

// ---------- utilidades de carta ----------
// ---------- decks: cada jogador escolhe o seu (só muda o desenho no próprio aparelho) ----------
const DECKS = [['classico', 'Clássico', 'cartas'], ['minimalista', 'Minimalista', 'cartas-min']];
let PASTA = (DECKS.find((d) => d[0] === S.deck) || DECKS[0])[2];
function trocarDeck(id) {
  const d = DECKS.find((x) => x[0] === id) || DECKS[0];
  const ap = document.getElementById('apelido'); if (ap) S.apelido = ap.value; // não perde o que foi digitado
  S.deck = d[0]; gravar('ur-deck', S.deck);
  PASTA = d[2];
  preCarregarDeck();
  carregarVerso();
  render();
}
const htmlEscolhaDeck = () => `<div class="decks" role="group" aria-label="Deck das cartas">${DECKS.map(([id, nome, pasta]) => `<button type="button" class="deck-op" data-deck="${id}" aria-pressed="${S.deck === id}">
    <span class="deck-mini"><img src="${pasta}/azul-7.webp" alt=""><img src="${pasta}/coringa.webp" alt=""><img src="${pasta}/vermelho-reverso.webp" alt=""></span><b>${nome}</b></button>`).join('')}</div>`;
function ligarEscolhaDeck(raiz = document) {
  raiz.querySelectorAll('[data-deck]').forEach((b) => (b.onclick = () => { if (S.deck !== b.dataset.deck) trocarDeck(b.dataset.deck); }));
}
function imgCarta(c) {
  if (c.tipo === 'coringa') return `${PASTA}/coringa.webp`;
  if (c.tipo === '+5') return `${PASTA}/mais5.webp`;
  if (c.tipo === 'ctrl') return `${PASTA}/ctrl.webp`;
  if (c.tipo === 'num') return `${PASTA}/${c.cor}-${c.valor}.webp`;
  return `${PASTA}/${c.cor}-${{ pular: 'pular', reverso: 'reverso', '+2': 'mais2' }[c.tipo]}.webp`;
}
// Carta do topo com animação: o preto do coringa se pinta com a cor escolhida;
// o Ctrl+C se pinta e depois vira a carta que ele copiou.
const ehPreta = (t) => t === 'coringa' || t === '+5' || t === 'ctrl';
const baseCoringa = (t) => (t === '+5' ? 'mais5' : 'coringa');
function htmlTopo(v, nova) {
  const fisica = v.cartaDoTopo, ef = v.topo, cor = v.corAtual;
  const alt = `Topo: ${esc(nomeCarta(fisica))}${fisica.tipo === 'ctrl' ? ' virou ' + esc(nomeCarta(ef)) : ''}`;
  if (!ehPreta(fisica.tipo)) return `<div class="topo-pilha ${nova ? 'entrou' : ''}" role="img" aria-label="${alt}"><img src="${imgCarta(fisica)}" alt=""></div>`;
  const final = ehPreta(ef.tipo) ? `${PASTA}/${baseCoringa(ef.tipo)}-${cor}.webp` : imgCarta({ tipo: ef.tipo, cor: ef.cor, valor: ef.valor });
  const selo = fisica.tipo === 'ctrl' ? '<span class="selo-ctrl">Ctrl+C</span>' : '';
  if (!nova) return `<div class="topo-pilha" role="img" aria-label="${alt}"><img src="${final}" alt="">${selo}</div>`;
  if (fisica.tipo !== 'ctrl') {
    return `<div class="topo-pilha entrou" role="img" aria-label="${alt}"><img src="${imgCarta(fisica)}" alt=""><img class="pinta" src="${final}" alt=""></div>`;
  }
  return `<div class="topo-pilha entrou" role="img" aria-label="${alt}"><img class="some-depois" src="${PASTA}/ctrl.webp" alt=""><img class="pinta some-depois" src="${PASTA}/ctrl-${cor}.webp" alt=""><img class="final-vira" src="${final}" alt="">${selo.replace('selo-ctrl', 'selo-ctrl atrasado')}</div>`;
}
// Todas as cartas baixadas e prontas antes de precisar delas: a carta que outro jogador joga
// aparece na hora na pilha e nas animações (antes ela só era baixada na primeira vez que aparecia)
const CARTAS_PRONTAS = [];
function todasAsCartas() {
  const l = ['coringa', 'mais5', 'ctrl', 'verso'];
  for (const c of CORES) {
    for (let v = 0; v <= 9; v++) l.push(`${c}-${v}`);
    for (const t of ['pular', 'reverso', 'mais2']) l.push(`${c}-${t}`);
    for (const b of ['coringa', 'mais5', 'ctrl']) l.push(`${b}-${c}`);
  }
  return l.map((n) => `${PASTA}/${n}.webp`);
}
function preCarregarDeck() {
  CARTAS_PRONTAS.length = 0;
  for (const src of todasAsCartas()) {
    const i = new Image();
    i.decoding = 'async';
    i.src = src;
    if (i.decode) i.decode().catch(() => {});
    CARTAS_PRONTAS.push(i); // guardadas na memória: o navegador não joga fora
  }
}
preCarregarDeck();
// Cartas e sons ficam guardados no celular (abre mais rápido e gasta menos internet)
if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol) && location.hostname !== 'claude.ai' && !location.hostname.endsWith('.claudeusercontent.com')) {
  window.addEventListener('load', () => { navigator.serviceWorker.register('/sw.js').catch(() => {}); });
}

function nomeCarta(c) {
  if (c.tipo === 'coringa') return 'Escolher cor';
  if (c.tipo === '+5') return '+5';
  if (c.tipo === 'ctrl') return 'Ctrl+C';
  const cor = c.cor ? NOME_DA_COR[c.cor] : '';
  if (c.tipo === 'num') return `${cor} ${c.valor}`;
  return `${cor} ${{ pular: 'Pular', reverso: 'Reverso', '+2': '+2' }[c.tipo]}`;
}
const nomeJog = (id) => (id === EU ? 'Você' : S.e.jogadores.find((j) => j.id === id)?.nome ?? '?');
const minhaMao = () => S.e.jogadores.find((j) => j.id === EU).mao;
const minhaVez = () => S.e.fase === 'jogando' && S.e.jogadores[S.e.vez].id === EU;

// ---------- salas para entrar (tela inicial) ----------
S.salas = null;
let timerSalas = null;
function htmlSalasAbertas() {
  const l = S.salas;
  if (!l) return '<p class="ajuda" style="margin:0;text-align:center">Procurando salas…</p>';
  if (!l.length) return '<p class="ajuda" style="margin:0;text-align:center">Nenhuma sala aberta agora. Crie a sua!</p>';
  const modo = (m) => ({ vitorias: 'vitórias', sem_fim: 'sem fim', rodadas: 'rodadas', pontos: 'pontos' }[m] || m);
  return `<span class="rotulo">Salas para entrar</span>` + l.map((x) => `<button type="button" class="sala-item" data-sala="${esc(x.codigo)}">
      <span class="sala-nome">${x.temSenha ? '🔒 ' : ''}${esc(x.nome)}</span>
      <span class="sala-info">${x.aberta ? 'Sala aberta' : 'Esperando começar'}${x.jogando ? ' · jogando agora' : ''} · ${modo(x.modo)}</span>
      <b>${x.ocupados}/${x.lugares}</b></button>`).join('');
}
function ligarSalasAbertas() {
  app.querySelectorAll('[data-sala]').forEach((b) => (b.onclick = () => {
    const ap = document.getElementById('apelido');
    if (ap) { S.apelido = ap.value.trim() || S.apelido; gravar('ur-apelido', S.apelido); }
    S.codigoEntrar = b.dataset.sala; S.tela = 'entrar'; render();
  }));
}
function buscarSalas() {
  clearTimeout(timerSalas);
  if (!S.temServidor || S.tela !== 'inicio') return;
  fetch('/salas', { cache: 'no-store' }).then((r) => r.json()).then((l) => {
    S.salas = Array.isArray(l) ? l : [];
    const el = document.getElementById('salas-abertas');
    if (el && S.tela === 'inicio') { el.innerHTML = htmlSalasAbertas(); ligarSalasAbertas(); }
  }).catch(() => {}).finally(() => { clearTimeout(timerSalas); if (S.tela === 'inicio') timerSalas = setTimeout(buscarSalas, 5000); });
}

// ---------- telas ----------
// Redesenhar a mesma tela (voto, regra, bot, lugar…) mantém o ponto onde a pessoa estava:
// a tela nunca "sobe" sozinha, e as entradas animadas só acontecem na primeira vez.
let telaDesenhada = null;
function comRolagem(nome, fn) {
  return function (...args) {
    const t = app.querySelector('.tela');
    const repetida = telaDesenhada === nome && !!t;
    const y = repetida ? t.scrollTop : 0;
    S.repetindoTela = repetida;
    telaDesenhada = nome;
    const r = fn.apply(this, args);
    S.repetindoTela = false;
    const t2 = app.querySelector('.tela');
    if (t2 && y) t2.scrollTop = y;
    return r;
  };
}
function render() {
  // a página em si nunca rola (só as telas por dentro): se algo a empurrou, volta ao lugar
  if (window.scrollY || document.documentElement.scrollTop) window.scrollTo(0, 0);
  if (S.tela === 'entrar') return telaEntrar();
  if (S.tela === 'espera') return telaEspera();
  if (S.tela === 'inicio') return telaInicio();
  if (S.tela === 'criar') return telaCriar();
  if (S.tela === 'mesa') return telaMesa();
  if (S.tela === 'fim') return telaFim();
  if (S.tela === 'arte') return telaArte();
}

function telaInicio() {
  app.innerHTML = `
  <main class="tela" style="justify-content:space-between;position:relative">
    <div style="position:absolute;top:12px;right:0;z-index:2;display:flex;gap:6px">${botoesZoom()}${botaoSom()}${botaoTelaCheia()}</div>
    <div style="position:relative;height:220px;flex:none" aria-hidden="true">
      <img src="${PASTA}/roxo-0.webp" alt="" style="position:absolute;left:calc(50% - 128px);top:22px;width:100px;transform:rotate(-16deg);border-radius:10px;box-shadow:0 10px 24px rgba(0,0,0,.45)">
      <img src="${PASTA}/ctrl.webp" alt="" style="position:absolute;left:calc(50% - 50px);top:0;width:100px;border-radius:10px;box-shadow:0 10px 24px rgba(0,0,0,.45)">
      <img src="${PASTA}/mais5.webp" alt="" style="position:absolute;left:calc(50% + 28px);top:22px;width:100px;transform:rotate(16deg);border-radius:10px;box-shadow:0 10px 24px rgba(0,0,0,.45)">
    </div>
    <div style="text-align:center;display:flex;flex-direction:column;gap:4px">
      <h1 style="font-size:46px;line-height:1;color:var(--destaque)">Uno Resenhas</h1>
      <p style="margin:0;color:var(--apagado)">5 cores, +5, Ctrl+C e muita resenha</p>
    </div>
    <form id="f-inicio" style="display:flex;flex-direction:column;gap:12px">
      <div class="escolher-foto">
        <button type="button" id="foto" class="avatar-grande" aria-label="${S.avatar ? 'Trocar sua foto' : 'Adicionar sua foto'}">${S.avatar ? `<img src="${S.avatar}" alt="">` : `<span>${esc((S.apelido || '?')[0].toUpperCase())}</span>`}</button>
        <div style="display:flex;flex-direction:column;gap:6px;min-width:0">
          <span style="font-weight:800">Sua foto na mesa</span>
          <span class="ajuda" id="foto-status">${S.avatar ? 'Toque na foto para trocar' : 'O fundo sai sozinho e a foto ganha contorno'}</span>
          ${S.avatar ? '<button type="button" class="link" id="tirar-foto">Remover foto</button>' : ''}
        </div>
        <input type="file" id="arquivo-foto" accept="image/*" hidden>
      </div>
      <label for="apelido" style="font-weight:700;color:var(--suave)">Seu apelido</label>
      <input id="apelido" class="campo" maxlength="14" autocomplete="nickname" value="${esc(S.apelido)}" placeholder="Como te chamam na mesa">
      <span style="font-weight:700;color:var(--suave)">Deck das cartas</span>
      ${htmlEscolhaDeck()}
      <button class="btn btn-principal" style="min-height:56px;margin-top:8px" type="button" id="criar-online" ${S.temServidor === false ? 'disabled' : ''}>Criar sala online</button>
      ${S.temServidor ? `<div class="salas-abertas" id="salas-abertas">${htmlSalasAbertas()}</div>` : ''}
      <div style="display:grid;grid-template-columns:minmax(0,1fr) auto;gap:8px">
        <input id="codigo" class="campo" maxlength="40" autocomplete="off" placeholder="Código ou link da sala" aria-label="Código ou link da sala" style="text-transform:uppercase" ${S.temServidor === false ? 'disabled' : ''}>
        <button class="btn" type="button" id="entrar-codigo" ${S.temServidor === false ? 'disabled' : ''}>Entrar</button>
      </div>
      ${S.temServidor === false ? '<p class="ajuda" style="margin:0;text-align:center">O jogo online funciona no site do jogo (depois de publicado). Aqui dá para treinar contra os bots.</p>' : ''}
      <button class="btn" type="submit">Treinar contra bots</button>
      ${S.erroInicio ? `<p class="aviso" role="status" style="height:auto;white-space:normal">${esc(S.erroInicio)}</p>` : ''}
    </form>
  </main>`;
  S.erroInicio = null;
  ligarBotaoSom();
  ligarSalasAbertas();
  ligarEscolhaDeck(app);
  buscarSalas();
  const entrada = document.getElementById('arquivo-foto');
  document.getElementById('foto').onclick = () => entrada.click();
  const tirar = document.getElementById('tirar-foto');
  if (tirar) tirar.onclick = () => { S.avatar = null; gravar('ur-avatar', null); S.apelido = document.getElementById('apelido').value; telaInicio(); };
  entrada.onchange = async () => {
    const f = entrada.files && entrada.files[0];
    if (!f) return;
    S.apelido = document.getElementById('apelido').value;
    document.getElementById('foto-status').textContent = 'Tirando o fundo da foto…';
    document.getElementById('foto').classList.add('processando');
    try {
      const r = await processarFoto(f);
      S.avatar = r.url; gravar('ur-avatar', S.avatar);
      telaInicio();
      document.getElementById('foto-status').textContent = r.semFundo ? 'Pronto! Fundo removido' : 'Não deu para tirar o fundo aqui; usei um corte redondo';
    } catch {
      telaInicio();
      document.getElementById('foto-status').textContent = 'Não consegui abrir essa imagem. Tente outra.';
    }
  };
  const guardarApelido = () => { S.apelido = document.getElementById('apelido').value.trim() || 'Você'; gravar('ur-apelido', S.apelido); };
  document.getElementById('f-inicio').onsubmit = (ev) => {
    ev.preventDefault();
    guardarApelido();
    S.modoCriar = 'treino';
    S.tela = 'criar';
    render();
  };
  document.getElementById('criar-online').onclick = () => { guardarApelido(); S.modoCriar = 'online'; S.tela = 'criar'; render(); };
  document.getElementById('entrar-codigo').onclick = () => {
    guardarApelido();
    const txt = document.getElementById('codigo').value.trim().toUpperCase();
    const m = txt.match(/([A-Z0-9]{5})\s*$/);
    if (!m) { document.getElementById('codigo').focus(); return; }
    S.codigoEntrar = m[1]; S.tela = 'entrar'; render();
  };
}

function telaCriar() {
  const c = S.config;
  const online = S.modoCriar === 'online';
  const seg = (grupo, valor, rotulo) => `<button type="button" data-${grupo}="${valor}" aria-pressed="${String(grupoValor(grupo) === valor)}">${rotulo}</button>`;
  function grupoValor(g) { return g === 'fim' ? c.fimModo : g === 'tempo' ? String(c.tempo) : g === 'fimval' ? String(c.fimValor) : null; }
  const aberta = online && !!c.salaAberta;
  if (aberta && c.fimModo !== 'vitorias') c.fimModo = 'sem_fim';
  const valoresFim = aberta ? [] : c.fimModo === 'rodadas' ? [[3, '3'], [5, '5'], [10, '10']] : c.fimModo === 'pontos' ? [[30, '30'], [50, '50'], [100, '100']] : [];
  app.innerHTML = `
  <main class="tela">
    <div class="linha" style="justify-content:flex-start">
      <button class="btn btn-icone" id="voltar" aria-label="Voltar"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 18l-6-6 6-6"/></svg></button>
      <h1 style="font-size:28px">${online ? 'Criar sala online' : 'Criar sala de treino'}</h1>
      <span style="margin-left:auto">${botaoTelaCheia()}</span>
    </div>
    ${online ? `<section class="bloco">
      <h2 class="rotulo">Sala</h2>
      <label for="nome-sala" style="font-weight:700">Nome da sala</label>
      <input id="nome-sala" class="campo" maxlength="30" value="${esc(c.nomeSala || 'Resenha dos amigos')}">
      <label for="senha-sala" style="font-weight:700">Senha</label>
      <input id="senha-sala" class="campo" maxlength="20" value="${esc(c.senha || '')}" placeholder="Opcional" autocomplete="off">
      <label class="chave" for="sala-aberta"><span style="display:flex;flex-direction:column"><span style="font-weight:700">Sala aberta</span><span class="ajuda">Gente entra e sai a cada mão, sem criar outra sala, até 10 na mesa. O placar mostra as mãos jogadas.</span></span>
        <input type="checkbox" id="sala-aberta" ${c.salaAberta ? 'checked' : ''}><span class="trilho" aria-hidden="true"></span></label>
    </section>` : ''}
    <section class="bloco">
      <h2 class="rotulo">Mesa</h2>
      <div class="linha"><span style="font-weight:700">Lugares na mesa</span>
        <div class="passo"><button class="btn btn-icone" style="border:2px solid var(--borda);background:var(--chao)" id="menos" aria-label="Menos lugares">−</button><span>${c.lugares}</span><button class="btn btn-icone" style="border:2px solid var(--borda);background:var(--chao)" id="mais" aria-label="Mais lugares">+</button></div>
      </div>
      ${online ? `<div class="lista-lugares">${Array.from({ length: c.lugares - 1 }, (_, i) => {
        const t = (c.assentos || [])[i] || 'aberto';
        return `<button type="button" class="lugar ${t}" data-lugar="${i}"><span>Lugar ${i + 2}</span><b>${t === 'bot' ? 'Bot' : 'Aberto'}</b></button>`;
      }).join('')}</div><p class="ajuda" style="margin:0">Você senta no lugar 1. Toque num lugar para deixar Aberto (para um amigo) ou com um Bot.</p>`
      : `<p class="ajuda" style="margin:0">Você senta no lugar 1; os outros ${c.lugares - 1} são bots.</p>`}
    </section>
    <section class="bloco">
      <h2 class="rotulo">Partida</h2>
      <span style="font-weight:700">Quando a partida acaba</span>
      ${aberta ? `<span class="ajuda" style="margin-top:-6px">Sala aberta não tem fim marcado: escolha como o placar classifica.</span>
      <div class="segmentos">${seg('fim', 'sem_fim', 'Por pontos')}${seg('fim', 'vitorias', 'Por vitórias')}</div>`
      : `<div class="segmentos">${seg('fim', 'rodadas', 'Rodadas')}${seg('fim', 'pontos', 'Pontos')}${seg('fim', 'vitorias', 'Vitórias')}${seg('fim', 'sem_fim', 'Sem fim')}</div>`}
      ${valoresFim.length ? `<div class="linha"><span class="ajuda" style="font-size:14px">${c.fimModo === 'rodadas' ? 'Número de rodadas' : 'Pontos para vencer'}</span></div><div class="segmentos">${valoresFim.map(([v, r]) => seg('fimval', String(v), r)).join('')}</div>`
        : aberta ? '' : `<p class="ajuda" style="margin:0">${c.fimModo === 'vitorias' ? 'Rodadas sem limite: conta quantas vezes cada um bateu. Quem criou a sala finaliza quando quiser e todos ganham a arte do placar.' : 'O placar só acumula; quem criou a sala finaliza quando quiser.'}</p>`}
      <span style="font-weight:700">Tempo por jogada</span>
      <div class="segmentos">${seg('tempo', '15', '15 s')}${seg('tempo', '20', '20 s')}${seg('tempo', '30', '30 s')}${seg('tempo', '0', 'Livre')}</div>
    </section>
    <section class="bloco" style="gap:4px">
      <h2 class="rotulo" style="margin-bottom:8px">Regras opcionais</h2>
      ${REGRAS_OPCIONAIS.map(([k, nome, ajuda]) => `
      <label class="chave" for="op-${k}"><span style="display:flex;flex-direction:column"><span style="font-weight:700">${nome}</span><span class="ajuda">${ajuda}</span></span>
        <input type="checkbox" id="op-${k}" data-op="${k}" ${(c.opcoes[k] ?? OPCOES_PADRAO[k]) ? 'checked' : ''}><span class="trilho" aria-hidden="true"></span></label>`).join('')}
    </section>
    <p class="aviso erro" id="erro-criar" role="alert" style="height:auto;white-space:normal"></p>
    <button class="btn btn-principal" id="comecar" style="min-height:56px;flex:none">${online ? 'Criar sala e gerar link' : 'Começar'}</button>
  </main>`;
  // redesenha sem perder o ponto da tela onde a pessoa estava
  const salvar = () => {
    guardarCampos(); gravar('ur-config', c);
    const y = app.querySelector('.tela') ? app.querySelector('.tela').scrollTop : 0;
    telaCriar();
    const t = app.querySelector('.tela'); if (t) t.scrollTop = y;
  };
  document.getElementById('voltar').onclick = () => { S.tela = 'inicio'; render(); };
  ligarTelaCheia();
  document.getElementById('menos').onclick = () => { c.lugares = Math.max(2, c.lugares - 1); salvar(); };
  document.getElementById('mais').onclick = () => { c.lugares = Math.min(10, c.lugares + 1); salvar(); };
  app.querySelectorAll('[data-fim]').forEach((b) => (b.onclick = () => { c.fimModo = b.dataset.fim; c.fimValor = c.fimModo === 'rodadas' ? 5 : 50; salvar(); }));
  app.querySelectorAll('[data-fimval]').forEach((b) => (b.onclick = () => { c.fimValor = Number(b.dataset.fimval); salvar(); }));
  app.querySelectorAll('[data-tempo]').forEach((b) => (b.onclick = () => { c.tempo = Number(b.dataset.tempo); salvar(); }));
  app.querySelectorAll('[data-op]').forEach((i) => (i.onchange = () => { c.opcoes[i.dataset.op] = i.checked; gravar('ur-config', c); }));
  const ab = document.getElementById('sala-aberta');
  if (ab) ab.onchange = () => { c.salaAberta = ab.checked; if (!ab.checked && c.fimModo === 'sem_fim') c.fimModo = 'rodadas'; if (c.fimModo === 'rodadas') c.fimValor = 5; salvar(); };
  app.querySelectorAll('[data-lugar]').forEach((b) => (b.onclick = () => {
    c.assentos = c.assentos || [];
    const i = Number(b.dataset.lugar);
    c.assentos[i] = (c.assentos[i] || 'aberto') === 'aberto' ? 'bot' : 'aberto';
    salvar();
  }));
  function guardarCampos() {
    if (!online) return;
    c.nomeSala = document.getElementById('nome-sala').value.trim();
    c.senha = document.getElementById('senha-sala').value.trim();
  }
  document.getElementById('comecar').onclick = online ? () => { guardarCampos(); gravar('ur-config', c); criarSalaOnline(); } : comecarPartida;
}

function comecarPartida() {
  const c = S.config;
  const jogadores = [{ id: EU, nome: S.apelido || 'Você' }];
  for (let i = 1; i < c.lugares; i++) jogadores.push({ id: `b${i}`, nome: `Bot ${NOMES_BOTS[i - 1]}`, bot: true });
  S.e = novaPartida({ jogadores, opcoes: { ...c.opcoes, fim: { modo: c.fimModo, valor: c.fimValor } } });
  S.ui = novaUI();
  S.ui.aviso = `Rodada 1. Começa: ${nomeJog(S.e.jogadores[S.e.vez].id)}`;
  S.tela = 'mesa';
  comecarRodadaAnimada();
}

// ---------- mesa ----------
// Assentos espalhados por igual ao longo da borda da mesa oval (pela distância, não pelo ângulo),
// para não amontoar nas pontas quando a mesa está cheia.
function posicoesAssentos(n) {
  if (!n) return [];
  const caixa = document.querySelector('.arena')?.getBoundingClientRect();
  const z = ZOOM.valor, larguraTela = window.innerWidth / z;
  const w = caixa ? caixa.width / z : Math.min(larguraTela, 1100) - 32;
  const h = caixa ? caixa.height / z : (window.innerHeight / z) * 0.45;
  const rx = w * 0.43, ry = h * 0.45, cx = w / 2, cy = h * 0.54;
  const arco = Math.min(250, 150 + 15 * n) * Math.PI / 180;
  const ini = Math.PI / 2 + arco / 2;
  const pts = [], amostras = 240;
  let total = 0;
  for (let i = 0; i <= amostras; i++) {
    const a = ini - arco * i / amostras;
    const p = { x: cx + rx * Math.cos(a), y: cy - ry * Math.sin(a) };
    if (i) total += Math.hypot(p.x - pts[i - 1].x, p.y - pts[i - 1].y);
    p.d = total; pts.push(p);
  }
  const margemY = larguraTela <= 520 ? 50 : 62, margemX = larguraTela <= 520 ? 48 : 60;
  return Array.from({ length: n }, (_, k) => {
    const alvo = total * (k + 0.5) / n;
    const p = pts.find((q) => q.d >= alvo) || pts[pts.length - 1];
    return { x: Math.min(w - margemX, Math.max(margemX, p.x)) / w * 100, y: Math.max(margemY, p.y) / h * 100 };
  });
}
function arrumarLeque(qtd) {
  const n = Math.min(qtd, 25);
  const largura = 104, carta = 28;
  const passo = n <= 1 ? 0 : Math.min(16, (largura - carta) / (n - 1));
  const abertura = Math.min(56, n * 7); // graus de abertura total do leque
  return Array.from({ length: n }, (_, i) => {
    const t = n <= 1 ? 0 : i / (n - 1) - 0.5;
    return { ml: `${i ? (passo - carta).toFixed(1) : 0}px`, tr: `rotate(${(t * abertura).toFixed(1)}deg) translateY(${(Math.abs(t) * 6).toFixed(1)}px)` };
  });
}
function leque(qtd) {
  return arrumarLeque(qtd).map((p) => `<span class="verso mini" style="margin-left:${p.ml};transform:${p.tr}"></span>`).join('');
}
// Ajusta o leque já desenhado: entra (ou sai) carta a carta e as outras se reacomodam deslizando
function ajustarLeque(lq, qtd) {
  const pos = arrumarLeque(qtd);
  const spans = [...lq.children];
  while (spans.length < pos.length) {
    const s = document.createElement('span');
    s.className = 'verso mini nova';
    const ant = spans[spans.length - 1];
    if (ant) { s.style.marginLeft = ant.style.marginLeft; s.style.transform = ant.style.transform; }
    lq.appendChild(s); spans.push(s);
  }
  while (spans.length > pos.length) spans.pop().remove();
  void lq.offsetWidth; // aplica a posição inicial antes de deslizar
  spans.forEach((s, i) => { s.style.marginLeft = pos[i].ml; s.style.transform = pos[i].tr; });
}
// Quantas cartas aparecem na mão de um adversário (durante voos, só as que já chegaram)
const cartasVisiveis = (j) => (S.ui.mostrado && S.ui.mostrado[j.id] !== undefined ? S.ui.mostrado[j.id] : j.cartas ?? j.mao.length);
function chegouCarta(id) {
  const ui = S.ui;
  if (id === EU) {
    const prox = ui.pendentes && ui.pendentes.values().next().value;
    if (prox !== undefined) { ui.pendentes.delete(prox); if (S.tela === 'mesa') render(); }
    return;
  }
  const j = S.e.jogadores.find((x) => x.id === id);
  if (!ui.mostrado || ui.mostrado[id] === undefined) return;
  ui.mostrado[id] += 1;
  const n = ui.mostrado[id];
  if (n >= j.mao.length) delete ui.mostrado[id];
  const el = document.querySelector(`.assento[data-id="${id}"]`);
  if (!el) return;
  const c = el.querySelector('.contagem');
  if (c) { c.textContent = n; c.classList.remove('pula-num'); void c.offsetWidth; c.classList.add('pula-num'); }
  el.classList.toggle('uma', n === 1);
  ajustarLeque(el.querySelector('.leque'), n);
}
const estaNaCall = (id) => !!(S.online && S.online.sala && S.online.sala.assentos.some((a) => a.id === id && a.naCall));
const caiuDaSala = (id) => !!(S.online && S.online.sala && S.online.sala.assentos.some((a) => a.id === id && a.tipo === 'humano' && !a.conectado));
const CORES_JOG = ['#FF7A59', '#5BC0FF', '#B48CFF', '#4FD1A5', '#FFB547', '#FF6FB5', '#7BD389', '#F2C94C', '#6FA8FF'];
function corDoJogador(id) {
  if (id === EU) return 'var(--destaque)';
  const i = S.e.jogadores.findIndex((j) => j.id === id);
  return CORES_JOG[(i - 1 + CORES_JOG.length) % CORES_JOG.length];
}
function htmlAvatar(j) {
  if (j.id === EU && S.avatar) return `<img class="figurinha" src="${S.avatar}" alt="">`;
  const av = j.id !== EU && (j.avatar || (S.e && S.e.jogadores.find((x) => x.id === j.id)?.avatar));
  if (av) return `<img class="figurinha" src="${av}" alt="">`;
  return `<span class="inicial">${esc(j.nome.replace('Bot ', '')[0].toUpperCase())}</span>`;
}
function telaMesa() {
  telaDesenhada = null;
  const e = S.e, ui = S.ui, v = visaoDe(e, EU);
  const vez = minhaVez() && !ui.distribuindo; // enquanto as cartas são distribuídas ninguém joga
  const mao = minhaMao().filter((c) => !(ui.pendentes && ui.pendentes.has(c.id)));
  const fim = e.opcoes.fim;
  const rotRodada = fim.modo === 'rodadas' ? `Rodada ${e.rodada} de ${fim.valor}` : fim.modo === 'pontos' ? `Rodada ${e.rodada} · até ${fim.valor} pts` : e.opcoes.salaAberta ? `Mão ${e.rodada} · sala aberta` : fim.modo === 'vitorias' ? `Rodada ${e.rodada} · vitórias` : `Rodada ${e.rodada}`;
  const rivais = v.jogadores.filter((j) => j.id !== EU);
  const restam = ui.prazo ? Math.max(0, Math.ceil((ui.prazo - Date.now()) / 1000)) : null;

  // jogáveis e combo
  const possiveis = vez ? jogadasPossiveis(e, EU) : [];
  const jogaveisSozinhas = new Set(possiveis.filter((p) => p.ids.length === 1).map((p) => p.ids[0]));
  let candidatosCombo = new Set(), seqValida = null;
  if (ui.combo && vez) {
    for (const c of mao) if (!ui.seq.includes(c.id) && validarJogada(e, EU, [...ui.seq, c.id]).ok) candidatosCombo.add(c.id);
    if (ui.seq.length) seqValida = validarJogada(e, EU, ui.seq);
  }
  const comboDisponivel = vez && possiveis.some((p) => p.ids.length > 1);
  // Tamanho das cartas acompanha a tela (celular ou PC)
  const W = window.innerWidth / ZOOM.valor, H = window.innerHeight / ZOOM.valor;
  const cw = Math.round(Math.max(84, Math.min(W * 0.25, H * 0.16, 150)) * ZOOM.mao);
  const cwTopo = Math.round(Math.max(96, Math.min(W * 0.27, H * 0.16, 160)) * ZOOM.mesa);
  const larguraMao = Math.min(W, 1100) - 40;
  const passoCarta = mao.length <= 1 ? cw : Math.max(cw * 0.3, Math.min(cw * 0.86, (larguraMao - cw) / (mao.length - 1)));
  const sobrepor = Math.round(passoCarta - cw);
  // Assentos em volta da mesa oval: da esquerda, por cima, até a direita (ordem de jogo)
  // Regra: os lugares (fotos) e a mesa só mudam se a tela mudar de tamanho ou alguém entrar/sair.
  // Nenhuma animação, painel ou botão mexe neles.
  const chaveLayout = `${Math.round(W)}x${Math.round(H)}x${ZOOM.valor}x${ZOOM.mao}x${ZOOM.mesa}x${rivais.map((j) => j.id).join(',')}`;
  const fixo = S.layoutMesa && S.layoutMesa.chave === chaveLayout ? S.layoutMesa : null;
  const assentos = (fixo ? fixo.pos : posicoesAssentos(rivais.length)).map((pos, k) => ({ j: rivais[k], ...pos }));
  const vulneravelRival = e.vulneravel && e.vulneravel !== EU ? e.vulneravel : null;

  const fichas = ui.seq.length
    ? resolverSequencia(e, ui.seq.map((id) => mao.find((c) => c.id === id))).map((ef, i) => {
      const fisica = mao.find((c) => c.id === ui.seq[i]);
      const nome = fisica.tipo === 'ctrl' ? `Ctrl+C → ${nomeCarta(ef)}` : nomeCarta(fisica);
      return `<span class="ficha">${i + 1} · ${esc(nome)}</span>`;
    }).join('')
    : '<span class="ajuda" style="align-self:center">Toque nas cartas na ordem em que quer jogar</span>';

  app.innerHTML = `
  <main class="mesa ${ui.distribuindo ? 'distribuindo' : ''}" style="--cw:${cw}px;--cw-topo:${cwTopo}px;--cor-atual:${VAR_COR[v.corAtual]}">
    <div class="topo-mesa">
      <button class="btn btn-icone" id="sair" aria-label="Sair da partida"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><path d="M18 6L6 18M6 6l12 12"/></svg></button>
      <span style="font-size:14px;font-weight:700;color:var(--suave)">${rotRodada}</span>
      <span style="display:flex;gap:6px">
        ${botoesZoom()}
        ${botaoSom()}
        ${botaoTelaCheia()}
        <span class="relogio ${vez && restam !== null ? (restam <= 5 ? 'urgente' : 'ativo') : ''}" id="relogio" aria-live="off">${vez && restam !== null ? restam + ' s' : '—'}</span>
      </span>
    </div>
    <div class="arena" ${fixo ? `style="flex:none;height:${fixo.h}px"` : ''}>
      <div class="feltro" aria-hidden="true"></div>
      ${assentos.map(({ j, x, y }) => `<div class="assento ${j.id === v.vez ? 'vez' : ''} ${caiuDaSala(j.id) ? 'caiu' : ''} ${estaNaCall(j.id) ? 'na-call' : ''} ${cartasVisiveis(j) === 1 ? 'uma' : ''} ${v.regra9 && v.regra9.apertaram.includes(j.id) ? 'apertou9' : ''}" data-id="${j.id}" style="left:${x.toFixed(1)}%;top:${y.toFixed(1)}%;--cor-jog:${corDoJogador(j.id)}">
        ${j.id === v.vez ? '<span class="selo-vez">Jogando</span>' : ''}
        <div class="leque" aria-hidden="true">${leque(cartasVisiveis(j))}</div>
        <span class="avatar">${htmlAvatar(j)}<span class="contagem" aria-label="${cartasVisiveis(j)} cartas">${cartasVisiveis(j)}</span></span>
        <span class="placa">${esc(j.nome.replace('Bot ', ''))}</span>
      </div>`).join('')}
      <div class="centro-mesa">
        <svg class="giro ${v.sentido === 1 ? '' : 'anti'}" style="rotate:${GIRO.angulo.toFixed(1)}deg" viewBox="0 0 100 100" aria-hidden="true"><defs><marker id="ponta" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="4" markerHeight="4" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" fill="currentColor"/></marker></defs>
          <path d="M50 4 A46 46 0 0 1 96 50" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" marker-end="url(#ponta)"/>
          <path d="M50 96 A46 46 0 0 1 4 50" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" marker-end="url(#ponta)"/></svg>
        <div class="pilhas">
          <button class="monte verso" id="monte" aria-label="Comprar do monte, ${v.monte} cartas" ${vez && !e.comprou ? '' : 'disabled'}><b>UR</b></button>
          ${ui.topoSegurado ? htmlTopo(ui.topoSegurado, false) : htmlTopo(v, ui.ultimaCarta !== v.cartaDoTopo.id)}
        </div>
      </div>
      <div class="pilulas">
        <span class="pilula"><span class="ponto" style="background:${VAR_COR[v.corAtual]}"></span>${NOME_DA_COR[v.corAtual]}</span>
        <span class="pilula">${v.monte} no monte</span>
        ${v.cartaDoTopo.tipo === 'ctrl' ? `<span class="pilula">Ctrl+C virou ${esc(nomeCarta(v.topo))}</span>` : ''}
        ${v.compraPendente ? `<span class="pilula compra">Compra acumulada: ${v.compraPendente.quantidade}</span>` : ''}
      </div>
    ${v.regra9 ? (() => {
      const jaApertei = v.regra9.apertaram.includes(EU);
      const q = v.regra9.quantidade;
      return `<div class="nove-box"><button class="btn-nove ${jaApertei ? 'feito' : ''}" id="apertar9" ${jaApertei ? 'disabled' : ''} aria-label="Apertar o 9">(9)</button>
        <span>${jaApertei ? 'Você apertou! Torcendo…' : 'Aperte rápido! (tecla 9)'} · o último compra ${q} ${q === 1 ? 'carta' : 'cartas'}</span></div>`;
    })() : ''}
      ${vulneravelRival ? `<button class="btn btn-perigo pegou-flutua" id="pegou">Pegou! <small>${esc(nomeJog(vulneravelRival).replace('Bot ', ''))} não disse Última</small></button>` : ''}
    </div>
    <div class="mao-zona">
      ${ui.combo ? `<div class="painel-combo">
        <div class="linha"><span style="font:800 16px var(--display);color:var(--destaque)">Montando combo</span>${seqValida && !seqValida.ok ? `<span class="ajuda" style="color:#FF8A82">${esc(seqValida.mensagem)}</span>` : ''}</div>
        <div class="fichas">${fichas}</div></div>` : ''}
      <div class="mao-wrap"><div class="mao" style="--sobrepor:${sobrepor}px">
      ${mao.map((c) => {
        const i = ui.seq.indexOf(c.id);
        const escolhida = ui.combo && i >= 0;
        const jogavel = vez && (ui.combo ? candidatosCombo.has(c.id) : jogaveisSozinhas.has(c.id));
        const apagada = vez && !escolhida && !jogavel;
        return `<button class="carta ${escolhida ? 'escolhida' : ''} ${jogavel ? 'jogavel' : ''} ${apagada ? 'apagada' : ''} ${ui.treme === c.id ? 'treme' : ''}" data-carta="${c.id}" aria-label="${esc(nomeCarta(c))}${escolhida ? ', posição ' + (i + 1) : ''}">
          <img src="${imgCarta(c)}" alt="">${escolhida ? `<span class="ordem">${i + 1}</span>` : ''}</button>`;
      }).join('')}
      </div></div>
    </div>
    <p class="aviso ${ui.erro ? 'erro' : ''}" role="status">${esc(ui.aviso)}</p>
    <div class="base-mesa">
      <div class="eu-canto ${vez ? 'vez' : ''} ${CALL.ativa ? 'na-call' : ''}" style="--cor-jog:${corDoJogador(EU)}">
        ${vez ? '<span class="selo-vez">Sua vez!</span>' : ''}
        <span class="avatar eu-avatar">${htmlAvatar({ id: EU, nome: S.apelido || 'Você' })}</span>
        <span class="placa">${esc(S.apelido || 'Você')}</span>
      </div>
      <div class="acoes">
      ${ui.combo ? `<button class="btn" id="cancelar">Cancelar</button>
        <button class="btn btn-principal duplo" id="jogar-combo" ${seqValida && seqValida.ok ? '' : 'disabled'}>Jogar ${ui.seq.length || ''} ${ui.seq.length === 1 ? 'carta' : 'cartas'}</button>`
      : `${e.comprou && vez ? '<button class="btn" id="passar">Passar</button>' : `<button class="btn" id="comprar" ${vez ? '' : 'disabled'}>${v.compraPendente && vez ? `Comprar ${v.compraPendente.quantidade}` : 'Comprar'}</button>`}
        ${v.podeDesafiar ? '<button class="btn btn-perigo" id="desafiar">Desafiar +5</button>' : `<button class="btn ${comboDisponivel ? 'btn-principal' : ''}" id="combo" ${comboDisponivel ? '' : 'disabled'}>Combo</button>`}
        <button class="btn ${mao.length <= 2 && !e.disseUltima[EU] && vez ? 'btn-alerta' : ''}" id="ultima" ${mao.length <= 2 && !e.disseUltima[EU] ? '' : 'disabled'}>${e.disseUltima[EU] && mao.length <= 2 ? 'Avisado!' : 'Última!'}</button>`}
      </div>
    </div>
  </main>
  ${renderModal()}`;
  // primeira vez neste tamanho de tela: mede a mesa desenhada (antes de pintar) e congela tamanho e lugares
  if (!fixo) {
    const arena = app.querySelector('.arena');
    const pos = posicoesAssentos(rivais.length);
    pos.forEach((p, k) => {
      const el = app.querySelectorAll('.assento')[k];
      if (el) { el.style.left = p.x.toFixed(1) + '%'; el.style.top = p.y.toFixed(1) + '%'; }
    });
    const h = arena.getBoundingClientRect().height / ZOOM.valor;
    S.layoutMesa = { chave: chaveLayout, h, pos };
    arena.style.flex = 'none'; arena.style.height = h + 'px';
  }
  if (!ui.distribuindo) ui.ultimaCarta = v.cartaDoTopo.id;
  ui.treme = null;
  ligarMesa();
}

function ligarMesa() {
  const $ = (id) => document.getElementById(id);
  $('sair').onclick = () => abrirModal({ tipo: 'sair' });
  if ($('monte')) $('monte').onclick = () => agir({ tipo: 'comprar', jogador: EU });
  if ($('comprar')) $('comprar').onclick = () => agir({ tipo: 'comprar', jogador: EU });
  if ($('passar')) $('passar').onclick = () => agir({ tipo: 'passar', jogador: EU });
  if ($('desafiar')) $('desafiar').onclick = () => agir({ tipo: 'desafiar', jogador: EU });
  if ($('combo')) $('combo').onclick = () => { S.ui.combo = true; S.ui.seq = []; S.ui.aviso = 'A primeira carta precisa combinar com o topo'; S.ui.erro = false; render(); };
  if ($('cancelar')) $('cancelar').onclick = () => { S.ui.combo = false; S.ui.seq = []; S.ui.aviso = ''; render(); };
  if ($('jogar-combo')) $('jogar-combo').onclick = () => prepararJogada([...S.ui.seq]);
  if ($('ultima')) $('ultima').onclick = () => agir({ tipo: 'ultima', jogador: EU });
  if ($('pegou')) $('pegou').onclick = () => agir({ tipo: 'pegou', jogador: EU, alvo: S.e.vulneravel });
  if ($('apertar9')) $('apertar9').onclick = () => agir({ tipo: 'apertar9', jogador: EU });
  ligarBotaoSom();
  app.querySelectorAll('[data-carta]').forEach((b) => (b.onclick = () => tocarCarta(b.dataset.carta)));
  ligarModal();
}

function tocarCarta(id) {
  const ui = S.ui;
  if (ui.distribuindo) return;
  if (S.ui.modal) return;
  if (!minhaVez()) {
    // Corte: carta idêntica fora da vez
    if (S.e.opcoes.corte && validarJogada(S.e, EU, [id], { foraDaVez: true }).ok) return prepararJogada([id], true);
    ui.aviso = `Vez de ${nomeJog(S.e.jogadores[S.e.vez].id)}`; ui.erro = false; return render();
  }
  if (ui.combo) {
    const i = ui.seq.indexOf(id);
    if (i >= 0) ui.seq = ui.seq.slice(0, i); // tocar de novo tira essa e as seguintes
    else ui.seq.push(id);
    return render();
  }
  const v = validarJogada(S.e, EU, [id]);
  if (!v.ok) { tocar('erro'); ui.aviso = v.mensagem; ui.erro = true; ui.treme = id; return render(); }
  prepararJogada([id]);
}

// Junta as escolhas (cor, efeito do zero) antes de mandar a jogada ao motor
function prepararJogada(ids, foraDaVez = false) {
  const v = validarJogada(S.e, EU, ids, { foraDaVez });
  if (!v.ok) { S.ui.aviso = v.mensagem; S.ui.erro = true; return render(); }
  const ult = v.efetivas[v.efetivas.length - 1];
  const acao = { tipo: foraDaVez ? 'corte' : 'jogar', jogador: EU, cartas: ids };
  const passos = [];
  if (!v.vence && (ult.tipo === 'coringa' || ult.tipo === '+5')) passos.push('cor');
  if (!v.vence && S.e.opcoes.regraDo5 && ult.tipo === 'num' && ult.valor === 5) passos.push('cor5');
  if (!v.vence && ult.tipo === 'num' && ult.valor === 0) passos.push('zero');
  seguirPassos(acao, passos);
}
function seguirPassos(acao, passos) {
  if (!passos.length) { S.ui.combo = false; S.ui.seq = []; return agir(acao); }
  abrirModal({ tipo: passos[0], acao, resto: passos.slice(1) });
}

// ---------- janelas ----------
function abrirModal(m) { S.ui.modal = m; render(); }
function renderModal() {
  const m = S.ui && S.ui.modal;
  if (!m) return '';
  const cores = (comManter) => `<div class="cores">${CORES.map((c) => `<button data-cor="${c}" aria-label="${NOME_DA_COR[c]}" style="background:${VAR_COR[c]}"></button>`).join('')}</div>${comManter ? '<button class="btn" data-cor="">Manter a cor da carta</button>' : ''}`;
  let corpo = '';
  if (m.tipo === 'cor' || m.tipo === 'cor5') corpo = `<h2 style="font-size:24px">${m.tipo === 'cor5' ? 'Regra do 5: escolher a próxima cor?' : 'Escolha a próxima cor'}</h2>${cores(m.tipo === 'cor5')}`;
  if (m.tipo === 'zero') {
    const outros = S.e.jogadores.filter((j) => j.id !== EU);
    corpo = `<h2 style="font-size:24px">Zero: o que fazer?</h2>
      <div class="segmentos"><button data-efeito="trocar" aria-pressed="${String(m.efeito !== 'espiar')}">Trocar a mão</button><button data-efeito="espiar" aria-pressed="${String(m.efeito === 'espiar')}">Espiar a mão</button></div>
      <span class="rotulo">Com quem</span>
      <div class="lista-jog">${outros.map((j) => `<button data-alvo="${j.id}" aria-pressed="${String(m.alvo === j.id)}"><span class="bola" style="background:var(--bot);width:28px;height:28px;font-size:14px">${esc(j.nome.replace('Bot ', '')[0])}</span>${esc(j.nome.replace('Bot ', ''))} · ${j.mao.length}</button>`).join('')}</div>
      <button class="btn btn-principal" id="ok-zero" ${m.alvo ? '' : 'disabled'}>Confirmar</button>`;
  }
  if (m.tipo === 'espiada') corpo = `<h2 style="font-size:24px">Mão de ${esc(nomeJog(m.alvo).replace('Bot ', ''))}</h2><div class="espiadas">${m.mao.map((c) => `<img src="${imgCarta(c)}" alt="${esc(nomeCarta(c))}">`).join('')}</div><button class="btn btn-principal" id="fechar">Fechar</button>`;
  if (m.tipo === 'sair') corpo = `<h2 style="font-size:24px">Sair da partida?</h2><p style="margin:0;color:var(--suave)">${S.online ? 'Um bot joga no seu lugar até o fim da mão e depois você sai da mesa.' : 'O placar desta partida será perdido.'}</p><div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px"><button class="btn" id="fechar">Continuar jogando</button><button class="btn btn-perigo" id="confirmar-sair">Sair</button></div>`;
  return `<div class="fundo-modal"><div class="modal" role="dialog" aria-modal="true">${corpo}</div></div>`;
}
function ligarModal() {
  const m = S.ui && S.ui.modal;
  if (!m) return;
  const fechar = () => { S.ui.modal = null; render(); };
  app.querySelectorAll('[data-cor]').forEach((b) => (b.onclick = () => {
    if (b.dataset.cor) m.acao.cor = b.dataset.cor;
    S.ui.modal = null; seguirPassos(m.acao, m.resto);
  }));
  app.querySelectorAll('[data-efeito]').forEach((b) => (b.onclick = () => { m.efeito = b.dataset.efeito; render(); }));
  app.querySelectorAll('[data-alvo]').forEach((b) => (b.onclick = () => { m.alvo = b.dataset.alvo; render(); }));
  const okZero = document.getElementById('ok-zero');
  if (okZero) okZero.onclick = () => { m.acao.zero = { efeito: m.efeito === 'espiar' ? 'espiar' : 'trocar', alvo: m.alvo }; S.ui.modal = null; seguirPassos(m.acao, m.resto); };
  const f = document.getElementById('fechar');
  if (f) f.onclick = fechar;
  const cs = document.getElementById('confirmar-sair');
  if (cs) cs.onclick = () => { document.querySelectorAll('.palco').forEach((x) => x.remove()); if (S.online) return sairDaSala(); pararTimers(); S.tela = 'inicio'; S.e = null; render(); };
}

// ---------- ações e bots ----------
function descrever(acao, r) {
  const quem = nomeJog(acao.jogador).replace('Bot ', '');
  const e = S.e;
  if (acao.tipo === 'jogar' || acao.tipo === 'corte') {
    const cartas = e.descarte.slice(-acao.cartas.length).map(nomeCarta).join(' + ');
    let t = `${quem}${acao.tipo === 'corte' ? ' cortou com' : ' jogou'} ${cartas}`;
    if (e.compraPendente) t += ` · ${nomeJog(e.jogadores[e.vez].id).replace('Bot ', '')} compra ${e.compraPendente.quantidade} ou responde`;
    for (const ev of r.eventos || []) {
      if (ev.tipo === 'troca') t += ` · trocou de mão com ${nomeJog(ev.com).replace('Bot ', '')}`;
      if (ev.tipo === 'espiou') t += ` · espiou ${nomeJog(ev.alvo).replace('Bot ', '')}`;
      if (ev.tipo === 'regra9') t += ' · Aperte o (9)!';
    }
    return t;
  }
  if (acao.tipo === 'comprar') return r.perdeuVez ? `${quem} comprou ${r.compradas.length} e perdeu a vez` : `${quem} comprou uma carta`;
  if (acao.tipo === 'passar') return `${quem} passou`;
  if (acao.tipo === 'ultima') return `${quem}: "Última!"`;
  if (acao.tipo === 'pegou') return `${quem} pegou ${nomeJog(acao.alvo).replace('Bot ', '')}: +2 cartas`;
  if ((acao.tipo === 'apertar9' || acao.tipo === 'tempo9') && r.ultimo9) {
    const ult = nomeJog(r.ultimo9).replace('Bot ', '');
    return `${ult === 'Você' ? 'Você foi' : ult + ' foi'} o último no (9): compra ${r.compradas.length}${r.perdeuVez ? ' e perde a vez' : ''}`;
  }
  if (acao.tipo === 'apertar9') return `${quem} apertou o (9)`;
  if (acao.tipo === 'desafiar') return r.resultado === 'ilegal' ? `Desafio certo! ${nomeJog(r.comprou).replace('Bot ', '')} compra` : `Desafio errado: ${quem} compra`;
  return '';
}

function agir(acao) {
  const ui = S.ui;
  if (ui.distribuindo && acao.jogador === EU) return;
  if (acao.jogador === EU && acao.tipo === 'jogar' && minhaMao().length - acao.cartas.length === 1 && S.e.disseUltima[EU]) acao.ultima = true;
  // Online: só pede ao servidor; a jogada volta em receberEstado com as animações
  if (S.online) {
    if (acao.jogador !== EU) return;
    const { jogador, ...pedido } = acao;
    enviar({ tipo: 'acao', acao: pedido });
    return;
  }
  // guarda as cartas do combo antes de jogar, para a animação
  let combo = null, jogada = null;
  if (acao.tipo === 'jogar' || acao.tipo === 'corte') {
    const j = S.e.jogadores.find((x) => x.id === acao.jogador);
    const fisicas = acao.cartas.map((id) => j.mao.find((c) => c.id === id));
    if (fisicas.every(Boolean)) {
      jogada = { fisicas, efetivas: resolverSequencia(S.e, fisicas), indice: S.e.jogadores.indexOf(j) };
      if (fisicas.length > 1) combo = jogada;
    }
  }
  const antes = fotoAntes();
  let r;
  try { r = aplicar(S.e, acao); }
  catch (err) { if (acao.jogador === EU) tocar('erro'); ui.aviso = err.message; ui.erro = true; return render(); }
  posAcao(acao, r, jogada, antes);
}

// Como a mesa estava antes da jogada (para animar as diferenças)
function fotoAntes() {
  const topo = { cartaDoTopo: S.e.descarte[S.e.descarte.length - 1], topo: S.e.topo, corAtual: S.e.corAtual };
  return { topo, vez: S.e.jogadores[S.e.vez] && S.e.jogadores[S.e.vez].id, sentido: S.e.sentido, pendente: !!S.e.compraPendente, maos: Object.fromEntries(S.e.jogadores.map((j) => [j.id, j.mao.length])), minhas: new Set(minhaMao().map((c) => c.id)) };
}

// Efeitos de uma jogada já aplicada (local ou vinda do servidor): aviso, sons, animações, compras
function posAcao(acao, r, jogada, antes) {
  const ui = S.ui;
  const combo = jogada && jogada.fisicas.length > 1 ? jogada : null;
  const sentidoAntes = antes.sentido, maosAntes = antes.maos, minhasAntes = antes.minhas;
  ui.aviso = descrever(acao, r); ui.erro = false;
  somDaAcao(acao, r, jogada, combo, antes);
  // Combo, Pular e Reverso: uma animação só; as cartas só vão para a pilha no fim dela
  let efeito = null;
  if (jogada && S.e.sentido !== sentidoAntes) efeito = { tipo: 'reverso', sentido: S.e.sentido };
  else if (jogada && S.e.fase === 'jogando' && jogada.efetivas[jogada.efetivas.length - 1].tipo === 'pular') {
    const N = S.e.jogadores.length, q = jogada.fisicas.length;
    const pulados = Array.from({ length: q }, (_, k) => S.e.jogadores[(((jogada.indice + S.e.sentido * (k + 1)) % N) + N) % N].id);
    efeito = { tipo: 'pulo', pulados, destino: S.e.jogadores[S.e.vez].id };
  }
  if (acao.tipo === 'corte' && jogada) {
    // CORTOU!: a carta igual cai em cima da do topo, a lâmina passa e a vez é "roubada"
    const N = S.e.jogadores.length, ia = S.e.jogadores.findIndex((j) => j.id === antes.vez), ic = jogada.indice, sent = antes.sentido;
    const perderam = [];
    if (ia >= 0 && ia !== ic) for (let k = ia, n = 0; k !== ic && n < N; k = (((k + sent) % N) + N) % N, n++) perderam.push(S.e.jogadores[k].id);
    const destino = S.e.fase === 'jogando' ? S.e.jogadores[S.e.vez].id : null;
    const marca = (ui.marcaTopo || 0) + 1;
    ui.marcaTopo = marca;
    ui.topoSegurado = antes.topo;
    ui.ultimaCarta = S.e.descarte[S.e.descarte.length - 1].id;
    const soltar = () => { if (S.ui === ui && ui.marcaTopo === marca && ui.topoSegurado) { ui.topoSegurado = null; if (S.tela === 'mesa') render(); } };
    ui.comboAte = Date.now() + mostrarCorte(acao.jogador, itensDaJogada(jogada)[0], perderam, destino, soltar);
  } else if (jogada && (combo || efeito)) {
    const marca = (ui.marcaTopo || 0) + 1;
    ui.marcaTopo = marca;
    ui.topoSegurado = antes.topo; // a pilha continua mostrando a carta de antes
    ui.ultimaCarta = S.e.descarte[S.e.descarte.length - 1].id;
    const soltar = () => { if (S.ui === ui && ui.marcaTopo === marca && ui.topoSegurado) { ui.topoSegurado = null; if (S.tela === 'mesa') render(); } };
    ui.comboAte = Date.now() + mostrarJogada(acao.jogador, itensDaJogada(jogada), efeito, soltar);
  }
  // Zero que troca as mãos: TROCOU! com os dois jogadores e os leques cruzando a mesa
  const troca = (r.eventos || []).find((ev) => ev.tipo === 'troca');
  if (troca) {
    const atraso = Math.max(350, (ui.comboAte || 0) - Date.now());
    const de = acao.jogador, com = troca.com;
    setTimeout(() => { if (S.e) mostrarTroca(de, com); }, atraso);
    ui.comboAte = Date.now() + atraso + DURACAO_TROCA;
  }
  // Ficou com 1 carta avisando (antes de jogar, ou apertando "Última!" logo depois, antes de alguém pegar): ÚLTIMA!
  // Quem esquece não ganha animação nenhuma: o ESQUECEU! só aparece se alguém de fato pegar ("Pegou!").
  const ator1 = S.e.fase === 'jogando' && S.e.jogadores.find((j) => j.id === acao.jogador);
  const avisouAgora = acao.tipo === 'ultima' && ator1 && ator1.mao.length === 1;
  const jogouAvisado = (acao.tipo === 'jogar' || acao.tipo === 'corte') && !troca && ator1 && ator1.mao.length === 1 && S.e.vulneravel !== ator1.id;
  if (avisouAgora || jogouAvisado) {
    const atraso = avisouAgora ? Math.max(0, (ui.comboAte || 0) - Date.now()) : Math.max(350, (ui.comboAte || 0) - Date.now());
    setTimeout(() => { if (S.e) mostrarUltima(ator1.id, true); }, atraso);
    ui.comboAte = Date.now() + atraso + DURACAO_ULTIMA;
  }
  if (acao.jogador === EU && acao.tipo === 'comprar' && r.podeJogar) ui.aviso = 'Você comprou uma carta que serve: jogue-a ou passe';
  // compras: uma carta por vez saindo do monte até quem comprou
  const compras = [];
  if (['comprar', 'pegou', 'desafiar', 'apertar9', 'tempo9'].includes(acao.tipo)) {
    for (const j of S.e.jogadores) {
      const d = j.mao.length - maosAntes[j.id];
      if (d > 0 && duracaoCompra(d) > 0) {
        compras.push([j.id, d]);
        ui.comboAte = Math.max(ui.comboAte || 0, Date.now() + duracaoCompra(d));
        // as cartas só aparecem quando chegam
        if (j.id === EU) { ui.pendentes = ui.pendentes || new Set(); for (const c of j.mao) if (!minhasAntes.has(c.id)) ui.pendentes.add(c.id); }
        else { ui.mostrado = ui.mostrado || {}; ui.mostrado[j.id] = Math.min(maosAntes[j.id], ui.mostrado[j.id] ?? Infinity); }
      }
    }
  }
  // +2, +5, desafio e "Pegou!": +N grande com quem está comprando
  const forcada = (acao.tipo === 'comprar' && antes.pendente) || acao.tipo === 'pegou' || acao.tipo === 'desafiar';
  if (forcada && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    for (const [id, d] of compras) {
      if (acao.tipo === 'pegou') { // ESQUECEU!: só quando alguém pega de verdade, junto com as 2 cartas
        const dur = Math.max(1700, duracaoCompra(d) + 500);
        mostrarUltima(id, false, `${nomeJog(acao.jogador).replace('Bot ', '')} pegou! +${d} cartas`, dur);
        ui.comboAte = Math.max(ui.comboAte || 0, Date.now() + dur);
        continue;
      }
      const sub = acao.tipo === 'pegou' ? 'Não disse Última!' : acao.tipo === 'desafiar' ? (r.resultado === 'ilegal' ? 'Desafio certo: o +5 era ilegal' : 'Desafio errado: +2 de castigo') : `Comprou ${d} ${d === 1 ? 'carta' : 'cartas'}`;
      const dur = Math.max(1500, duracaoCompra(d) + 400);
      mostrarCompraForcada(id, d, sub, dur);
      ui.comboAte = Math.max(ui.comboAte || 0, Date.now() + dur);
    }
  }
  depoisDeMudar();
  for (const [id, d] of compras) animarCompra(id, d);
}

// Som de cada ação (os de combo, Reverso e Pulo tocam junto com as animações)
function somDaAcao(acao, r, jogada, combo, antes) {
  if ((acao.tipo === 'jogar' || acao.tipo === 'corte') && jogada) {
    if (!combo) tocar('jogar');
    const ult = jogada.efetivas[jogada.efetivas.length - 1];
    const fis = jogada.fisicas[jogada.fisicas.length - 1];
    if (!combo && (fis.tipo === 'coringa' || fis.tipo === '+5')) tocarDepois('coringa', 320);
    if (!combo && fis.tipo === 'ctrl') tocarDepois('ctrl', 220);
    for (const ev of r.eventos || []) {
      if (ev.tipo === 'espiou') tocarDepois('espiar', 250);
    }
  }
  // +2/+5: o som de ataque sai quando a compra acontece (quem levou compra as cartas)
  if (acao.tipo === 'comprar' && antes && antes.pendente) tocar('ataque');
  if (acao.tipo === 'desafiar') tocarDepois('ataque', 260);
  if (acao.tipo === 'ultima' && !(S.e && (S.e.jogadores.find((j) => j.id === acao.jogador) || { mao: [] }).mao.length === 1)) tocar('ultima'); // com 1 carta o som vem com a animação
  if (acao.tipo === 'pegou') tocar('pegou');
  if (acao.tipo === 'desafiar') tocar(r.resultado === 'ilegal' ? 'pegou' : 'erro');
  if (acao.tipo === 'apertar9') tocar('apertou'); // cada um que aperta o (9) faz o som, para todos
  if ((acao.tipo === 'apertar9' || acao.tipo === 'tempo9') && r.ultimo9) tocarDepois('pegou', acao.tipo === 'apertar9' ? 160 : 0);
}

// ---------- palco das animações ----------
// Escurece a tela inteira (mais forte no centro da mesa, suave nas bordas: sem corte visível)
// e devolve uma área do tamanho da mesa para o conteúdo.
function criarPalco(classe, rotulo) {
  const arena = document.querySelector('.arena');
  if (!arena) return null;
  const r = arena.getBoundingClientRect();
  const cx = r.left + r.width / 2, cy = r.top + r.height * 0.55;
  const palco = document.createElement('div');
  palco.className = 'palco ' + classe;
  palco.setAttribute('role', 'status');
  palco.setAttribute('aria-label', rotulo);
  const fundo = document.createElement('div');
  fundo.className = 'palco-fundo';
  palco.appendChild(fundo);
  fundo.style.background = `radial-gradient(ellipse ${Math.max(r.width * 0.7, 320)}px ${Math.max(r.height * 0.8, 320)}px at ${cx}px ${cy}px, rgba(5,8,20,.86) 0%, rgba(5,8,20,.7) 55%, rgba(5,8,20,.5) 100%)`;
  const area = document.createElement('div');
  area.className = 'palco-area';
  // a área vai do topo da tela até o fim da mesa: espaço para a foto, o título e as cartas
  const topo = 12;
  Object.assign(area.style, { left: r.left + 'px', top: topo + 'px', width: r.width + 'px', height: (r.bottom - topo) + 'px' });
  palco.appendChild(area);
  document.body.appendChild(palco);
  return { palco, area, r };
}
// Cabeçalho de toda animação: foto/avatar, nome e o título grande
function htmlCabecalho(id, titulo, sub) {
  const jog = id === EU ? { id: EU, nome: S.apelido || 'Você' } : S.e.jogadores.find((j) => j.id === id);
  const nome = id === EU ? (S.apelido || 'Você') : jog.nome.replace('Bot ', '');
  return `<div class="anim-cab" style="--cor-jog:${corDoJogador(id)}">
    <span class="avatar anim-avatar">${htmlAvatar(jog)}</span>
    <span class="anim-nome">${esc(nome)}</span>
    <b class="anim-titulo">${titulo}</b>${sub ? `<span class="anim-sub">${esc(sub)}</span>` : ''}</div>`;
}

// ---------- animação do combo ----------
// COMBO! → as cartas caem na pilha uma a uma → abrem em escada (a primeira embaixo, a última em cima)
let comboAtivo = null;
// Imagens das cartas de uma jogada (coringas já pintados; Ctrl+C com o que ele virou)
function itensDaJogada(jogada) {
  const cor = S.e.corAtual;
  return jogada.fisicas.map((c, i) => {
    const ef = jogada.efetivas[i];
    if (c.tipo === 'coringa' || c.tipo === '+5') return { src: `${PASTA}/${baseCoringa(c.tipo)}-${cor}.webp` };
    if (c.tipo === 'ctrl') return { src: `${PASTA}/ctrl-${ehPreta(ef.tipo) ? cor : ef.cor}.webp`, rotulo: `= ${nomeCarta(ef)}` };
    return { src: imgCarta(c) };
  });
}
// Mesmo tamanho e posição para todas as animações de efeito: cabeçalho logo acima das cartas no centro
function montarEfeito(area, r, idJog, titulo, sub, itens) {
  const n = itens.length;
  const altura = r.bottom - 12;
  const fonteTitulo = Math.max(48, Math.min(window.innerWidth * 0.09, 96));
  const cabecalho = 84 + 34 + fonteTitulo * 0.95 + 24; // mesmo espaço em todas, para as cartas terem sempre o mesmo tamanho
  const cw = Math.round(Math.max(60, Math.min(r.width * 0.22, (altura - cabecalho - 56) / 1.54, 140)));
  const passo = n > 1 ? Math.min(cw * 0.62, (r.width * 0.9 - cw) / (n - 1)) : 0;
  area.style.setProperty('--cw', cw + 'px');
  area.innerHTML = `<div class="efeito-col">${htmlCabecalho(idJog, titulo, sub)}<div class="efeito-cartas">` + itens.map((it, i) => {
    const m = i - (n - 1) / 2;
    return `<div class="combo-carta" style="--i:${i};--x:${(m * passo).toFixed(1)}px;--y:${(-m * 7).toFixed(1)}px;--r:${(m * 4).toFixed(1)}deg;z-index:${i + 2}">
      <img src="${it.src}" alt="">${it.rotulo ? `<span class="combo-rotulo">${esc(it.rotulo)}</span>` : ''}</div>`;
  }).join('') + '</div></div>';
}
// Uma jogada com animação, do começo ao fim, num palco só:
// título (COMBO! ou o efeito) → cartas caem → efeito (PULOU!/REVERSO!) → cartas voltam uma a uma para a pilha.
// A pilha só troca de carta quando a última pousa nela.
function duracoesJogada(n, efeito, q) {
  const tEspalha = 450 + n * 225 + 150;
  const tB = efeito ? tEspalha + 350 : tEspalha;
  const durB = !efeito ? 700 : efeito.tipo === 'reverso' ? 1500 : (q + 1) * SALTO + 350;
  const tC = tB + durB;
  const tFim = tC + (n - 1) * 110 + 260;
  return { tEspalha, tB, tC, tFim, total: tFim + 350 };
}
const SETAS_REVERSO = `<div class="reverso-setas"><svg viewBox="0 0 100 100" aria-hidden="true">
      <defs><marker id="ponta-rev" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="3.2" markerHeight="3.2" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" fill="currentColor"/></marker></defs>
      <path d="M50 8 A42 42 0 0 1 92 50" fill="none" stroke="currentColor" stroke-width="7" stroke-linecap="round" marker-end="url(#ponta-rev)"/>
      <path d="M50 92 A42 42 0 0 1 8 50" fill="none" stroke="currentColor" stroke-width="7" stroke-linecap="round" marker-end="url(#ponta-rev)"/></svg></div>`;
function mostrarJogada(idJog, itens, efeito, aoPousar) {
  if (comboAtivo) comboAtivo.remove();
  const n = itens.length, combo = n > 1;
  const nomeEf = efeito ? (efeito.tipo === 'reverso' ? 'REVERSO!' : 'PULOU!') : '';
  const subEf = !efeito ? '' : efeito.tipo === 'reverso' ? `Agora ${efeito.sentido === 1 ? 'horário ↻' : 'anti-horário ↺'}` : efeito.pulados.length > 1 ? `${efeito.pulados.length} jogadores bloqueados` : '';
  const p = criarPalco('combo-show', combo ? `${nomeJog(idJog)} jogou um combo de ${n} cartas` : `${nomeJog(idJog)}: ${nomeEf}`);
  if (!p) { aoPousar(); return 0; }
  const { palco, area, r } = p;
  montarEfeito(area, r, idJog, combo ? 'COMBO!' : nomeEf, combo ? '' : subEf, itens);
  comboAtivo = palco;
  const reduzido = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (combo) tocar('combo');
  if (reduzido) {
    if (efeito) efeitoNaJogada(palco, area, idJog, efeito, combo, nomeEf, subEf);
    setTimeout(() => { aoPousar(); palco.classList.add('sai'); }, 1800);
    setTimeout(() => { palco.remove(); if (comboAtivo === palco) comboAtivo = null; }, 2150);
    return 2150;
  }
  if (combo) itens.forEach((_, i) => tocarDepois('carta', 450 + i * 225)); // cada carta que cai faz o som
  const q = efeito && efeito.tipo === 'pulo' ? efeito.pulados.length : 0;
  const d = duracoesJogada(n, efeito, q);
  setTimeout(() => palco.classList.add('espalha'), d.tEspalha);
  if (efeito) setTimeout(() => { if (palco.isConnected) efeitoNaJogada(palco, area, idJog, efeito, combo, nomeEf, subEf); }, d.tB);
  setTimeout(() => { if (palco.isConnected) recolherNaPilha(palco, 110, 260); }, d.tC);
  setTimeout(() => { aoPousar(); palco.classList.add('sai'); }, d.tFim);
  setTimeout(() => { palco.remove(); if (comboAtivo === palco) comboAtivo = null; }, d.total);
  return d.total;
}
// O efeito da jogada, no mesmo palco: as setas do Reverso ou a bolinha da vez saltando no Pular
function efeitoNaJogada(palco, area, idJog, efeito, combo, nomeEf, subEf) {
  if (combo) { // o título troca de COMBO! para o efeito
    const t = area.querySelector('.anim-titulo');
    if (t) { const novo = t.cloneNode(); novo.textContent = nomeEf; t.replaceWith(novo); }
    if (subEf) area.querySelector('.anim-cab').insertAdjacentHTML('beforeend', `<span class="anim-sub">${esc(subEf)}</span>`);
  }
  if (efeito.tipo === 'reverso') {
    palco.classList.add('reverso-show', efeito.sentido === 1 ? 'horario' : 'anti');
    area.style.setProperty('--cor', VAR_COR[S.e.corAtual]);
    area.querySelector('.efeito-cartas').insertAdjacentHTML('beforeend', SETAS_REVERSO);
    tocar('reverso');
    GIRO.turboAte = performance.now() + 1400; // a seta da mesa dá um giro rápido no sentido novo
    return;
  }
  tocar('pular');
  const { pulados, destino } = efeito;
  const pontos = [idJog, ...pulados, destino].map(centroDoJogador);
  if (pontos.some((x) => !x)) return;
  // carimbos de bloqueio sobre quem foi pulado
  pulados.forEach((id, k) => {
    const c = pontos[k + 1];
    const selo = document.createElement('div');
    selo.className = 'pulo-bloqueio';
    selo.style.left = c.x + 'px'; selo.style.top = c.y + 'px';
    selo.style.animationDelay = ((k + 1) * SALTO - 120) + 'ms';
    palco.appendChild(selo);
  });
  // a bolinha da vez saltando em arco de um jogador ao outro
  const bola = document.createElement('div');
  bola.className = 'pulo-bola';
  bola.textContent = 'VEZ';
  palco.appendChild(bola);
  const quadros = [];
  pontos.forEach((pt, k) => {
    if (k === 0) { quadros.push({ transform: `translate(${pt.x}px, ${pt.y}px) scale(.4)`, opacity: 0 }); return; }
    const a = pontos[k - 1];
    const alto = Math.max(70, Math.hypot(pt.x - a.x, pt.y - a.y) * 0.45);
    quadros.push({ transform: `translate(${(a.x + pt.x) / 2}px, ${(a.y + pt.y) / 2 - alto}px) scale(1.15)`, opacity: 1 });
    quadros.push({ transform: `translate(${pt.x}px, ${pt.y}px) scale(${k === pontos.length - 1 ? 1.35 : 0.9})`, opacity: 1 });
  });
  quadros.splice(1, 0, { transform: `translate(${pontos[0].x}px, ${pontos[0].y}px) scale(1)`, opacity: 1 });
  quadros.forEach((f, i) => { f.offset = i / (quadros.length - 1); });
  bola.animate(quadros, { duration: (pulados.length + 1) * SALTO + 250, easing: 'ease-in-out', fill: 'forwards' });
}

// ---------- CORTOU!: carta idêntica fora da vez ----------
const SALTO_CORTE = 420;
function duracaoCorte(temVez) { const fimBola = temVez ? 900 + 2 * SALTO_CORTE + 200 : 1300; return fimBola + 260 + 350; }
function mostrarCorte(idJog, item, perderam, destino, aoPousar) {
  if (comboAtivo) comboAtivo.remove();
  const p = criarPalco('combo-show corte-show', `${nomeJog(idJog)} cortou a jogada`);
  if (!p) { aoPousar(); return 0; }
  const { palco, area, r } = p;
  // duas cartas iguais: a do topo (já na mesa) e a que corta, caindo em cima
  montarEfeito(area, r, idJog, 'CORTOU!', perderam.length ? (perderam.length === 1 ? `${nomeJog(perderam[0]).replace('Bot ', '')} perdeu a vez` : `${perderam.length} perderam a vez`) : '', [item, item]);
  const cartas = area.querySelectorAll('.combo-carta');
  cartas[0].style.animation = 'none';
  cartas[0].style.setProperty('--x', '-6px'); cartas[0].style.setProperty('--y', '4px'); cartas[0].style.setProperty('--r', '-4deg');
  cartas[1].style.animationDelay = '350ms';
  cartas[1].style.setProperty('--x', '14px'); cartas[1].style.setProperty('--y', '-8px'); cartas[1].style.setProperty('--r', '7deg');
  area.querySelector('.efeito-cartas').insertAdjacentHTML('beforeend', '<div class="corte-lamina" aria-hidden="true"><span class="corte-tesoura">✂</span></div>');
  comboAtivo = palco;
  tocar('jogar');
  const reduzido = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const temVez = !!destino && !reduzido;
  const total = duracaoCorte(temVez);
  setTimeout(() => { if (!palco.isConnected) return; palco.classList.add('cortando'); tocar('corte'); }, 650);
  setTimeout(() => palco.classList.add('espalha'), 600);
  if (temVez) setTimeout(() => { if (palco.isConnected) bolaDaVez(palco, [perderam[0] || idJog, idJog, destino], perderam); }, 900);
  const tRecolhe = total - 350 - 260;
  setTimeout(() => { if (palco.isConnected) recolherNaPilha(palco, 0, 260); }, tRecolhe);
  setTimeout(() => { aoPousar(); palco.classList.add('sai'); }, tRecolhe + 260);
  setTimeout(() => { palco.remove(); if (comboAtivo === palco) comboAtivo = null; }, total);
  return total;
}
// a bolinha "VEZ" saindo de quem ia jogar, passando por quem cortou e indo ao próximo
function bolaDaVez(palco, ids, perderam) {
  const pontos = ids.map(centroDoJogador);
  if (pontos.some((x) => !x)) return;
  perderam.forEach((id, k) => {
    const c = centroDoJogador(id); if (!c) return;
    const selo = document.createElement('div');
    selo.className = 'pulo-bloqueio';
    selo.style.left = c.x + 'px'; selo.style.top = c.y + 'px';
    selo.style.animationDelay = (SALTO_CORTE * 0.5 + k * 80) + 'ms';
    palco.appendChild(selo);
  });
  const bola = document.createElement('div');
  bola.className = 'pulo-bola';
  bola.textContent = 'VEZ';
  palco.appendChild(bola);
  const q = [{ transform: `translate(${pontos[0].x}px, ${pontos[0].y}px) scale(.4)`, opacity: 0 }, { transform: `translate(${pontos[0].x}px, ${pontos[0].y}px) scale(1)`, opacity: 1 }];
  for (let k = 1; k < pontos.length; k++) {
    const a = pontos[k - 1], b = pontos[k];
    const alto = Math.max(70, Math.hypot(b.x - a.x, b.y - a.y) * 0.45);
    q.push({ transform: `translate(${(a.x + b.x) / 2}px, ${(a.y + b.y) / 2 - alto}px) scale(1.15)`, opacity: 1 });
    q.push({ transform: `translate(${b.x}px, ${b.y}px) scale(${k === pontos.length - 1 ? 1.35 : 0.9})`, opacity: 1 });
  }
  q.forEach((f, i) => { f.offset = i / (q.length - 1); });
  bola.animate(q, { duration: 2 * SALTO_CORTE + 200, easing: 'ease-in-out', fill: 'forwards' });
}

// ---------- compra por efeito (+2, +5, desafio, "Pegou!"): +N com a foto de quem compra ----------
function mostrarCompraForcada(id, n, sub, dur) {
  const p = criarPalco('compra-show', `${nomeJog(id)} comprou ${n} ${n === 1 ? 'carta' : 'cartas'}`);
  if (!p) return;
  const { palco, area } = p;
  area.innerHTML = `<div class="efeito-col">${htmlCabecalho(id, `+${n}`, sub)}</div>`;
  setTimeout(() => palco.classList.add('sai'), dur - 350);
  setTimeout(() => palco.remove(), dur);
}
function recolherNaPilha(palco, passo, voo) {
  const pilha = document.querySelector('.topo-pilha');
  if (!pilha || !palco.isConnected) return;
  palco.classList.add('recolhe');
  palco.querySelectorAll('.pulo-bola, .pulo-bloqueio').forEach((x) => x.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 250, fill: 'forwards' }));
  const alvo = pilha.getBoundingClientRect();
  const ax = alvo.left + alvo.width / 2, ay = alvo.top + alvo.height / 2;
  palco.querySelectorAll('.combo-carta').forEach((el, i) => {
    const b = el.getBoundingClientRect();
    const x = parseFloat(el.style.getPropertyValue('--x')) || 0, y = parseFloat(el.style.getPropertyValue('--y')) || 0;
    const r = parseFloat(el.style.getPropertyValue('--r')) || 0;
    const dx = ax - (b.left + b.width / 2), dy = ay - (b.top + b.height / 2);
    const escala = (pilha.offsetWidth * ZOOM.valor) / el.offsetWidth;
    el.animate([
      { transform: `translate(${x}px, ${y}px) rotate(${r}deg)` },
      { transform: `translate(${x + dx}px, ${y + dy}px) rotate(6deg) scale(${escala})` },
    ], { duration: voo, delay: i * passo, easing: 'cubic-bezier(.5,0,.3,1)', fill: 'forwards' });
  });
}

// ---------- animação de compra: cartas voando do monte até a mão ----------
function ritmoCompra(n) {
  const intervalo = n <= 2 ? 260 : Math.max(55, Math.min(220, 1600 / n)); // muitas cartas = mais rápido
  const voo = n > 6 ? 330 : 460;
  return { intervalo, voo };
}
function duracaoCompra(n) {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return 0;
  const { intervalo, voo } = ritmoCompra(n);
  return (n - 1) * intervalo + voo;
}
function animarCompra(id, n) {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const { intervalo, voo } = ritmoCompra(n);
  const ui = S.ui;
  for (let i = 0; i < n; i++) setTimeout(() => { if (S.ui === ui) voarCarta(id, voo, i, () => { if (S.ui === ui) chegouCarta(id); }); }, i * intervalo);
}
function voarCarta(id, duracao, i, aoChegar) {
  const monte = document.getElementById('monte');
  const alvoEl = id === EU ? document.querySelector('.mao-wrap') : document.querySelector(`.assento[data-id="${id}"] .avatar`);
  if (!monte || !alvoEl) { if (aoChegar) aoChegar(); return; }
  const a = monte.getBoundingClientRect(), b = alvoEl.getBoundingClientRect();
  tocar('carta', S.ui && S.ui.distribuindo ? 0.6 : 1); // o som sai quando a carta começa a voar
  const el = document.createElement('div');
  el.className = 'voo verso';
  el.innerHTML = '<b>UR</b>';
  Object.assign(el.style, { left: a.left + 'px', top: a.top + 'px', width: a.width + 'px', height: a.height + 'px' });
  document.body.appendChild(el);
  const dx = b.left + b.width / 2 - (a.left + a.width / 2);
  const dy = (id === EU ? b.top + b.height * 0.55 : b.top + b.height / 2) - (a.top + a.height / 2);
  const fim = id === EU ? Math.min(1.1, ((parseFloat(getComputedStyle(document.querySelector('.mesa')).getPropertyValue('--cw')) || 90) * ZOOM.valor) / a.width) : 0.32;
  const giro = (i % 2 ? 1 : -1) * (12 + (i * 7) % 20);
  el.animate([
    { transform: 'translate(0, 0) rotate(-4deg) scale(1)', opacity: 1 },
    { transform: `translate(${dx * 0.5}px, ${dy * 0.5 - 50}px) rotate(${giro / 2}deg) scale(${(1 + fim) / 2})`, opacity: 1, offset: 0.5 },
    { transform: `translate(${dx}px, ${dy}px) rotate(${giro}deg) scale(${fim})`, opacity: 0.15 },
  ], { duration: duracao, easing: 'cubic-bezier(.3,.6,.4,1)' }).onfinish = () => { el.remove(); if (aoChegar) aoChegar(); };
}

// ---------- distribuição: uma carta por vez, rodando a mesa (1 s por jogador, no máximo 8 s) ----------
function comecarRodadaAnimada() {
  const n = S.e.jogadores.length;
  const reduzido = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const total = reduzido ? 0 : Math.min(n, 8) * 1000;
  S.ui.distribuindo = total > 0;
  S.ui.ultimaCarta = null;
  if (total) {
    S.ui.mostrado = Object.fromEntries(S.e.jogadores.filter((j) => j.id !== EU).map((j) => [j.id, 0]));
    S.ui.pendentes = new Set(minhaMao().map((c) => c.id));
  }
  S.ui.comboAte = Date.now() + total + 500;
  depoisDeMudar();
  if (!total) return;
  const e = S.e, k = e.opcoes.cartasIniciais, passos = n * k;
  const intervalo = (total - 450) / passos;
  const voo = Math.round(Math.min(420, Math.max(220, intervalo * 4)));
  const ui = S.ui;
  for (let p = 0; p < passos; p++) {
    const j = e.jogadores[(e.vez + p) % n]; // começa por quem joga primeiro
    setTimeout(() => {
      if (S.ui !== ui || !ui.distribuindo) return;
      voarCarta(j.id, voo, p, () => { if (S.ui === ui) chegouCarta(j.id); });
    }, p * intervalo);
  }
  setTimeout(() => { if (S.ui === ui) { ui.distribuindo = false; ui.mostrado = {}; ui.pendentes = new Set(); if (S.tela === 'mesa') render(); } }, total + 150);
}

// ---------- vitória: confete e o vencedor no centro, depois a tela de resultado ----------
function mostrarVitoria(depois) {
  const e = S.e, r = e.resultadoRodada, acabou = e.fase === 'fim_partida';
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return depois();
  const venc = acabou ? placar(e)[0].jogador : r.vencedor;
  const nome = venc ? nomeJog(venc).replace('Bot ', '') : null;
  const eu = venc === EU;
  const titulo = !venc ? 'Morte súbita!' : acabou ? `${eu ? 'Você venceu' : nome + ' venceu'} a partida!` : `${eu ? 'Você bateu' : nome + ' bateu'}!`;
  const sub = !venc ? 'O monte acabou duas vezes' : acabou ? `${placar(e)[0].pontos} pontos no total` : `Rodada ${e.rodada} · +12 pontos`;
  const jog = venc ? (eu ? { id: EU, nome: S.apelido || 'Você' } : e.jogadores.find((j) => j.id === venc)) : null;
  const cores = ['#FFD43B', '#EE1C24', '#3A58E4', '#4FCB1A', '#8A3FD9', '#FFFFFF'];
  const confetes = Array.from({ length: 90 }, (_, i) => `<i style="left:${(Math.random() * 100).toFixed(1)}%;background:${cores[i % cores.length]};animation-delay:${(Math.random() * 0.9).toFixed(2)}s;animation-duration:${(1.6 + Math.random() * 1.4).toFixed(2)}s;--giro:${Math.round(360 + Math.random() * 720)}deg;--lado:${Math.round(Math.random() * 160 - 80)}px;width:${6 + Math.round(Math.random() * 6)}px"></i>`).join('');
  const div = document.createElement('div');
  div.className = 'vitoria-show' + (acabou ? ' partida' : '');
  div.setAttribute('role', 'status');
  div.innerHTML = `<div class="confetes" aria-hidden="true">${confetes}</div>
    <div class="vit-centro" style="--cor-jog:${venc ? corDoJogador(venc) : '#fff'}">
      ${jog ? `<span class="avatar vit-avatar">${htmlAvatar(jog)}</span>` : ''}
      <b>${esc(titulo)}</b><span>${esc(sub)}</span>
    </div>`;
  document.body.appendChild(div);
  tocar(acabou ? (eu ? 'vitoria-partida' : 'derrota') : (eu ? 'vitoria' : 'derrota'));
  setTimeout(() => { div.classList.add('sai'); depois(); }, acabou ? 3200 : 2600);
  setTimeout(() => div.remove(), acabou ? 3700 : 3100);
}

// ---------- animação do zero que troca as mãos ----------
const DURACAO_TROCA = 1900;
function pessoaAnim(id) {
  const jog = id === EU ? { id: EU, nome: S.apelido || 'Você' } : S.e.jogadores.find((j) => j.id === id);
  const nome = id === EU ? (S.apelido || 'Você') : jog.nome.replace('Bot ', '');
  return `<div class="anim-cab troca-pessoa" style="--cor-jog:${corDoJogador(id)}"><span class="avatar anim-avatar">${htmlAvatar(jog)}</span><span class="anim-nome">${esc(nome)}</span></div>`;
}
function mostrarTroca(a, b) {
  const p = criarPalco('troca-show', `${nomeJog(a)} trocou de mão com ${nomeJog(b)}`);
  if (!p) return;
  const { palco, area } = p;
  const qtd = (id) => (S.e.jogadores.find((j) => j.id === id) || { mao: [] }).mao.length;
  tocar('trocar');
  // o leque que sai de A são as cartas que agora estão com B, e vice-versa
  area.innerHTML = `<div class="efeito-col">
    <div class="troca-linha">${pessoaAnim(a)}<span class="troca-seta" aria-hidden="true">⇄</span>${pessoaAnim(b)}</div>
    <b class="anim-titulo">TROCOU!</b>
    <div class="troca-leques"><div class="troca-leque" data-lado="a">${leque(qtd(b))}</div><div class="troca-leque" data-lado="b">${leque(qtd(a))}</div></div></div>`;
  const reduzido = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const linha = area.querySelector('.troca-leques');
  const d = linha.getBoundingClientRect().width * 0.5;
  if (!reduzido) area.querySelectorAll('.troca-leque').forEach((el) => {
    const s = el.dataset.lado === 'a' ? 1 : -1;
    el.animate([
      { transform: 'translate(0, 0) scale(1.9)' },
      { transform: `translate(${(s * d) / 2}px, ${s * -70}px) scale(2.3) rotate(${s * 12}deg)`, offset: 0.5 },
      { transform: `translate(${s * d}px, 0) scale(1.9)` },
    ], { duration: 900, delay: 500, easing: 'cubic-bezier(.45,0,.3,1)', fill: 'forwards' });
  });
  setTimeout(() => palco.classList.add('sai'), DURACAO_TROCA - 350);
  setTimeout(() => palco.remove(), DURACAO_TROCA);
}

// ---------- ÚLTIMA! / ESQUECEU! quando alguém fica com uma carta ----------
const DURACAO_ULTIMA = 1500;
function mostrarUltima(id, disse, subPegou, dur = DURACAO_ULTIMA) {
  const p = criarPalco('ultima-show ' + (disse ? 'disse' : 'esqueceu'), disse ? `${nomeJog(id)}: Última!` : `${nomeJog(id)} esqueceu de dizer Última`);
  if (!p) return;
  const { palco, area } = p;
  const eu = id === EU;
  const sub = disse ? 'Só falta 1 carta' : subPegou || (eu ? 'Você não disse Última!' : 'Não disse Última!');
  area.innerHTML = `<div class="efeito-col">${htmlCabecalho(id, disse ? 'ÚLTIMA!' : 'ESQUECEU!', sub)}
    <div class="ultima-carta"><span class="verso"></span></div></div>`;
  tocar(disse ? 'ultima' : 'erro');
  setTimeout(() => palco.classList.add('sai'), dur - 350);
  setTimeout(() => palco.remove(), dur);
}

// ---------- animação do Pular: a vez salta por cima dos bloqueados ----------
const SALTO = 520;
function centroDoJogador(id) {
  const el = id === EU ? document.querySelector('.eu-canto .avatar') : document.querySelector(`.assento[data-id="${id}"] .avatar`);
  if (!el) return null;
  const b = el.getBoundingClientRect();
  return { x: b.left + b.width / 2, y: b.top + b.height / 2 };
}

let timerBot = null, timerRelogio = null, timerPegou = null;
function pararTimers() { clearTimeout(timerBot); clearInterval(timerRelogio); clearTimeout(timerPegou); timerBot = timerRelogio = timerPegou = null; }

function depoisDeMudar() {
  const e = S.e, ui = S.ui;
  pararTimers();
  // espiada nova para mim
  const minhas = e.espiadas.filter((x) => x.por === EU);
  if (minhas.length > ui.espiadasVistas) { ui.espiadasVistas = minhas.length; const x = minhas[minhas.length - 1]; ui.modal = { tipo: 'espiada', alvo: x.alvo, mao: x.mao }; }
  const esperaCombo = Math.max(0, (ui.comboAte || 0) - Date.now());
  if (e.fase !== 'jogando') {
    if (ui.vitoria) return;
    ui.vitoria = true;
    const ir = () => mostrarVitoria(() => { S.tela = 'fim'; S.ui.modal = null; render(); });
    render();
    if (esperaCombo) timerBot = setTimeout(ir, esperaCombo + 300); else ir();
    return;
  }

  if (S.online) return depoisDeMudarOnline(esperaCombo);
  // bot pega quem esqueceu de dizer "Última!"
  if (e.vulneravel === EU) timerPegou = setTimeout(() => {
    if (S.e && S.e.vulneravel === EU && Math.random() < 0.75) {
      const bot = S.e.jogadores.find((j) => j.bot);
      agir({ tipo: 'pegou', jogador: bot.id, alvo: EU });
    }
  }, 2600 + esperaCombo);

  // Regra do 9: enquanto o (9) está aberto, ninguém joga; os bots apertam com reflexos diferentes
  if (e.regra9) {
    ui.prazo = 0;
    if (!ui.timers9) {
      ui.timers9 = [];
      for (const j of e.jogadores) if (j.bot) {
        const reflexo = 450 + Math.random() * 2200;
        ui.timers9.push(setTimeout(() => { if (S.e && S.e.regra9 && !S.e.regra9.apertaram.includes(j.id)) agir({ tipo: 'apertar9', jogador: j.id }); }, reflexo));
      }
      ui.timers9.push(setTimeout(() => { if (S.e && S.e.regra9) agir({ tipo: 'tempo9' }); }, 6000));
    }
    return render();
  }
  if (ui.timers9) { ui.timers9.forEach(clearTimeout); ui.timers9 = null; }
  const atual = e.jogadores[e.vez];
  const vezAntes = ui.vezAnterior;
  const topo = e.descarte[e.descarte.length - 1];
  const animando = ui.ultimaCarta !== topo.id && ehPreta(topo.tipo); // espera a animação acabar
  if (atual.bot) {
    ui.prazo = 0;
    timerBot = setTimeout(() => agir(escolherAcao(S.e, atual.id)), Math.max(animando ? (topo.tipo === 'ctrl' ? 3000 : 2600) : 1900, esperaCombo + 700));
  } else if (e.compraPendente && !e.ultimoMais5 && jogadasPossiveis(e, EU).length === 0) {
    // levou +2/+5 sem ter como responder nem desafiar: compra sozinho (não há o que decidir)
    ui.prazo = 0;
    ui.aviso = `Sem resposta para o ${e.compraPendente.tipo}: comprando ${e.compraPendente.quantidade}…`; ui.erro = false;
    timerBot = setTimeout(() => { if (S.e === e && minhaVez() && S.e.compraPendente) agir({ tipo: 'comprar', jogador: EU }); }, Math.max(1100, esperaCombo + 900));
  } else {
    if (ui.vezAnterior !== EU) tocarDepois('sua-vez', Math.max(0, esperaCombo - 200));
    const tempo = S.config.tempo;
    ui.prazo = tempo ? Date.now() + esperaCombo + tempo * 1000 : 0;
    if (tempo) timerRelogio = setInterval(() => {
      const el = document.getElementById('relogio');
      const restam = Math.max(0, Math.ceil((S.ui.prazo - Date.now()) / 1000));
      if (el) { el.textContent = restam + ' s'; el.className = 'relogio ' + (restam <= 5 ? 'urgente' : 'ativo'); }
      if (restam <= 5 && restam > 0 && restam !== S.ui.ultimoTique && !S.ui.modal) { S.ui.ultimoTique = restam; tocar('tique'); }
      if (restam <= 0 && !S.ui.modal) {
        S.ui.combo = false; S.ui.seq = [];
        agir(S.e.comprou ? { tipo: 'passar', jogador: EU } : { tipo: 'comprar', jogador: EU });
      }
    }, 250);
  }
  ui.vezAnterior = atual.id;
  if (vezAntes !== atual.id) ui.ultimoTique = null;
  render();
}

// Online: o servidor controla bots e tempo; aqui só o relógio, os sons e a tela
function depoisDeMudarOnline(esperaCombo) {
  const e = S.e, ui = S.ui;
  const atual = e.jogadores[e.vez];
  const vezAntes = ui.vezAnterior;
  ui.prazo = 0;
  if (!e.regra9 && atual.id === EU && e.compraPendente && !e.ultimoMais5 && jogadasPossiveis(e, EU).length === 0) {
    ui.aviso = `Sem resposta para o ${e.compraPendente.tipo}: comprando ${e.compraPendente.quantidade}…`; ui.erro = false; // o servidor compra sozinho
  } else if (!e.regra9 && atual.id === EU) {
    if (vezAntes !== EU) tocarDepois('sua-vez', Math.max(0, esperaCombo - 200));
    if (ui.prazoServidor) {
      ui.prazo = Date.now() + ui.prazoServidor;
      timerRelogio = setInterval(() => {
        const el = document.getElementById('relogio');
        const restam = Math.max(0, Math.ceil((S.ui.prazo - Date.now()) / 1000));
        if (el) { el.textContent = restam + ' s'; el.className = 'relogio ' + (restam <= 5 ? 'urgente' : 'ativo'); }
        if (restam <= 5 && restam > 0 && restam !== S.ui.ultimoTique && !S.ui.modal) { S.ui.ultimoTique = restam; tocar('tique'); }
      }, 250);
    }
  }
  ui.vezAnterior = atual.id;
  if (vezAntes !== atual.id) ui.ultimoTique = null;
  render();
}

// ---------- fim de rodada / partida ----------
// Entre as rodadas todos votam: Sim (continua) ou Não (sai da mesa) e confirmam com OK.
// Quem criou a sala pode finalizar a qualquer momento entre as rodadas: todos ganham a arte do placar.
const souDonoDaSala = () => !S.online || (S.online.sala && S.online.sala.dono === EU);
function votosAtuais() {
  if (S.online) return (S.online.sala && S.online.sala.votos) || {};
  const v = {};
  for (const j of S.e.jogadores) if (j.bot) v[j.id] = true;
  if (S.ui.votoEnviado !== undefined) v[EU] = S.ui.votoEnviado;
  return v;
}
function htmlVotos() {
  const votos = votosAtuais();
  const chegando = S.online && S.online.sala ? S.online.sala.assentos.filter((a) => a.pendente) : [];
  return S.e.jogadores.map((j) => {
    const v = votos[j.id];
    const nome = j.id === EU ? 'Você' : j.nome.replace('Bot ', '');
    return `<span class="voto-lin ${v === true ? 'sim' : v === false ? 'nao' : ''}" style="--cor-jog:${corDoJogador(j.id)}">
      <span class="avatar mini-av">${htmlAvatar(j.id === EU ? { id: EU, nome: S.apelido || 'Você' } : j)}</span>
      <b>${esc(nome)}</b><span class="voto-est">${v === true ? 'Sim ✓' : v === false ? 'Não · sai' : 'pensando…'}</span></span>`;
  }).join('') + chegando.map((a) => `<span class="voto-lin sim" style="--cor-jog:var(--humano)">
      <span class="avatar mini-av">${a.avatar ? `<img class="figurinha" src="${a.avatar}" alt="">` : `<span class="inicial">${esc(a.nome.replace('Bot ', '')[0].toUpperCase())}</span>`}</span>
      <b>${esc(a.nome.replace('Bot ', ''))}</b><span class="voto-est">chegando ✓</span></span>`).join('');
}
function atualizarVotos() {
  const el = document.getElementById('votos');
  if (el) el.innerHTML = htmlVotos();
}
function telaFim() {
  const e = S.e, r = e.resultadoRodada, acabou = e.fase === 'fim_partida';
  const ui = S.ui;
  const venc = r.vencedor ? nomeJog(r.vencedor).replace('Bot ', '') : null;
  const placarGeral = placar(e);
  const fim = e.opcoes.fim;
  const porVit = fim.modo === 'vitorias';
  const aberta = !!e.opcoes.salaAberta;
  const dono = souDonoDaSala();
  const linhas = r.colocacao.map((c, i) => `<div class="lin ${S.repetindoTela ? '' : 'entra'} ${c.jogador === EU ? 'eu' : ''}" style="--i:${i}"><span class="pos" style="color:${c.posicao === 1 ? 'var(--destaque)' : 'inherit'}">${c.posicao}º</span><span style="font-weight:700;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(nomeJog(c.jogador).replace('Bot ', ''))}</span><span class="dir" style="color:var(--suave)">${c.pontosNaMao} pts</span><span class="ganho">+${c.ganhou}</span></div>`).join('');
  const geral = placarGeral.map((p, i) => `<div class="lin ${S.repetindoTela ? '' : 'entra'} ${aberta ? 'cinco' : ''} ${p.jogador === EU ? 'eu' : ''}" style="--i:${i + r.colocacao.length}"><span class="pos">${i + 1}º</span><span style="font-weight:700;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(p.jogador === EU ? (S.apelido || 'Você') : p.nome.replace('Bot ', ''))}</span><span class="dir" style="font-weight:800;color:${porVit ? 'var(--destaque)' : 'var(--suave)'}">${aberta ? p.vitorias : `${p.vitorias} ${p.vitorias === 1 ? 'vit.' : 'vits.'}`}</span>${aberta ? `<span class="dir" style="font-weight:800;color:var(--suave)">${p.maos}</span>` : ''}<span class="ganho" style="color:var(--texto)">${p.pontos}</span></div>`).join('');
  const rotulo = acabou ? 'Fim da partida' : aberta ? `Mão ${e.rodada} · sala aberta` : fim.modo === 'rodadas' ? `Rodada ${e.rodada} de ${fim.valor}` : `Rodada ${e.rodada}`;
  if (ui.votoEnviado === undefined && S.online && votosAtuais()[EU] !== undefined) ui.votoEnviado = votosAtuais()[EU];
  const votou = ui.votoEnviado !== undefined;
  app.innerHTML = `
  <main class="tela">
    <div class="bloco" style="align-items:center;text-align:center;gap:6px">
      <span class="rotulo">${rotulo}</span>
      <h1 style="font-size:30px;color:var(--destaque)">${acabou ? `${esc(placarGeral[0].jogador === EU ? 'Você venceu' : placarGeral[0].nome.replace('Bot ', '') + ' venceu')} a partida!` : venc ? `${esc(venc === 'Você' ? 'Você venceu' : venc + ' venceu')}!` : 'Morte súbita!'}</h1>
      <span style="color:var(--suave)">${acabou ? `${placarGeral[0].pontos} pontos no total` : venc ? 'Esvaziou a mão com números' : 'O monte acabou duas vezes'}</span>
    </div>
    <div class="tabela"><div class="lin cab"><span>Pos.</span><span>Jogador</span><span class="dir">Na mão</span><span class="dir">Ganhou</span></div>${linhas}</div>
    <div class="tabela"><div class="lin cab ${aberta ? 'cinco' : ''}"><span></span><span>Placar geral</span><span class="dir">Vitórias</span>${aberta ? '<span class="dir">Mãos</span>' : ''}<span class="dir">Pontos</span></div>${geral}</div>
    ${aberta && S.online && S.online.sala ? htmlConvite(S.online.sala) : ''}
    <section class="bloco votacao">
      <span class="rotulo">${acabou ? 'Jogar outra partida?' : aberta ? 'Jogar a próxima mão?' : 'Jogar a próxima rodada?'}</span>
      ${votou
        ? `<p class="voto-feito">Você votou <b>${ui.votoEnviado ? 'Sim' : 'Não'}</b>. Esperando os outros…</p>`
        : `<div class="segmentos voto-seg">
            <button type="button" id="voto-sim" aria-pressed="${ui.voto === true}">Sim</button>
            <button type="button" id="voto-nao" aria-pressed="${ui.voto === false}">Não</button>
          </div>
          <p class="ajuda" style="margin:0">${ui.voto === false ? 'Votando Não, você sai da mesa.' : 'Quem votar Não sai da mesa; o jogo segue com quem ficou.'}</p>
          <button class="btn btn-principal" id="ok-voto" ${ui.voto === undefined ? 'disabled' : ''}>OK</button>`}
      <div class="votos" id="votos">${htmlVotos()}</div>
    </section>
    <div class="fim-botoes">
      ${dono ? `<button class="btn" id="config-sala">⚙ Regras da sala</button><button class="btn" id="finalizar">Finalizar partida</button>` : ''}
      ${acabou && !dono ? `<button class="btn" id="ver-arte">Arte do placar</button>` : ''}
    </div>
  </main>`;
  const $ = (id) => document.getElementById(id);
  ligarConvite();
  if ($('config-sala')) $('config-sala').onclick = abrirConfigSala;
  if ($('voto-sim')) $('voto-sim').onclick = () => { ui.voto = true; telaFim(); };
  if ($('voto-nao')) $('voto-nao').onclick = () => { ui.voto = false; telaFim(); };
  if ($('ok-voto')) $('ok-voto').onclick = () => confirmarVoto(ui.voto);
  if ($('ver-arte')) $('ver-arte').onclick = () => { S.arteDe = 'fim'; S.tela = 'arte'; render(); };
  if ($('finalizar')) $('finalizar').onclick = () => {
    if (S.online) { $('finalizar').disabled = true; enviar({ tipo: 'finalizar' }); return; }
    S.arteDe = 'final'; S.tela = 'arte'; render();
  };
}
// Sala aberta: entre as mãos, o link fica à mão para chamar mais gente antes da próxima
function htmlConvite(sala) {
  const link = `${location.origin}/s/${sala.codigo}`;
  const convite = `Bora jogar Uno Resenhas! Entra na mesa "${sala.nome}" que a próxima mão já vai começar:\n${link}${sala.temSenha ? '\n(peça a senha no grupo)' : ''}`;
  const lugares = sala.assentos.filter((a) => !a.sai).length;
  return `<section class="bloco convite-fim" data-link="${esc(link)}" data-texto="${esc(convite)}">
    <div class="linha"><span class="rotulo">Chamar mais gente</span><span class="ajuda">${lugares}/10 na mesa</span></div>
    <span class="ajuda" style="margin-top:-6px">Quem entrar agora já senta na próxima mão.</span>
    <div class="linha" style="background:var(--chao);border:2px solid var(--borda);border-radius:12px;padding:6px 6px 6px 14px">
      <span style="font-weight:700;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;min-width:0;user-select:all" id="link-fim">${esc(link)}</span>
      <button class="btn" id="copiar-fim" style="min-height:40px;flex:none">Copiar</button>
    </div>
    <div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px">
      <a class="btn" href="https://wa.me/?text=${encodeURIComponent(convite)}" target="_blank" rel="noopener" style="display:grid;place-items:center;text-decoration:none;background:#25D366;border-color:#25D366;color:#06210F;font-weight:800">WhatsApp</a>
      <button class="btn" id="compartilhar-fim">Compartilhar</button>
    </div></section>`;
}
function ligarConvite() {
  const caixa = document.querySelector('.convite-fim');
  if (!caixa) return;
  const link = caixa.dataset.link, texto = caixa.dataset.texto;
  document.getElementById('copiar-fim').onclick = async (ev) => {
    const b = ev.currentTarget;
    try { await navigator.clipboard.writeText(link); b.textContent = 'Copiado!'; }
    catch { const r = document.createRange(); r.selectNodeContents(document.getElementById('link-fim')); const sel = getSelection(); sel.removeAllRanges(); sel.addRange(r); b.textContent = 'Selecionado'; }
  };
  const comp = document.getElementById('compartilhar-fim');
  comp.onclick = async () => {
    if (navigator.share) { try { await navigator.share({ title: 'Uno Resenhas', text: texto }); return; } catch (err) { if (err && err.name === 'AbortError') return; } }
    try { await navigator.clipboard.writeText(texto); comp.textContent = 'Convite copiado!'; } catch { comp.textContent = 'Use o Copiar'; }
  };
}
// ---------- bots na mesa: o dono põe ou tira (sentam / saem na próxima mão) ----------
function contagemMesa() {
  const sala = S.online && S.online.sala;
  if (sala) {
    const ativos = sala.assentos.filter((a) => a.tipo !== 'aberto' && !a.sai);
    return { bots: ativos.filter((a) => a.tipo === 'bot').length, total: ativos.length };
  }
  const js = S.e ? S.e.jogadores : [];
  return { bots: js.filter((j) => j.bot).length, total: js.length };
}
function htmlBotsConfig() {
  const { bots, total } = contagemMesa();
  return `<div class="linha"><span style="display:flex;flex-direction:column"><span style="font-weight:700">Bots na mesa</span><span class="ajuda">${total} de 10 na mesa · entram ou saem na próxima mão</span></span>
    <div class="passo"><button class="btn btn-icone" style="border:2px solid var(--borda);background:var(--chao)" id="bot-menos" aria-label="Tirar um bot" ${bots && total > 2 ? '' : 'disabled'}>−</button><span>${bots}</span><button class="btn btn-icone" style="border:2px solid var(--borda);background:var(--chao)" id="bot-mais" aria-label="Pôr um bot" ${total < 10 ? '' : 'disabled'}>+</button></div></div>`;
}
function ligarBotsConfig() {
  const menos = document.getElementById('bot-menos'), mais = document.getElementById('bot-mais');
  if (menos) menos.onclick = () => mudarBots(-1);
  if (mais) mais.onclick = () => mudarBots(1);
}
function atualizarBotsConfig() {
  const el = document.getElementById('cfg-bots');
  if (el) { el.innerHTML = htmlBotsConfig(); ligarBotsConfig(); }
}
function mudarBots(delta) {
  if (S.online) return enviar({ tipo: 'bots', delta });
  // treino: o bot senta (ou sai) já para a próxima mão
  const e = S.e;
  if (!e || e.fase === 'jogando') return;
  if (delta > 0 && e.jogadores.length < 10) {
    const usados = new Set(e.jogadores.map((j) => j.nome.replace('Bot ', '')));
    const nome = NOMES_BOTS.find((n) => !usados.has(n)) || `Bot ${e.jogadores.length}`;
    let n = 1; while (e.jogadores.some((j) => j.id === `b${n}`)) n++;
    adicionarJogador(e, { id: `b${n}`, nome: `Bot ${nome}`, bot: true });
  } else if (delta < 0) {
    const bots = e.jogadores.filter((j) => j.bot);
    if (bots.length && e.jogadores.length > 2) removerJogadores(e, [bots[bots.length - 1].id]);
  }
  atualizarBotsConfig();
  if (S.tela === 'fim') { const y = app.querySelector('.tela') ? app.querySelector('.tela').scrollTop : 0; telaFim(); const t = app.querySelector('.tela'); if (t) t.scrollTop = y; }
}

// ---------- regras da sala: o dono muda entre as mãos (valem a partir da próxima) ----------
function abrirConfigSala() {
  document.querySelectorAll('.fundo-config').forEach((x) => x.remove());
  const sala = S.online && S.online.sala;
  const atuais = sala ? { ...OPCOES_PADRAO, ...sala.config.opcoes } : { ...OPCOES_PADRAO, ...(S.e ? S.e.opcoes : S.config.opcoes) };
  const cfg = { opcoes: Object.fromEntries(REGRAS_OPCIONAIS.map(([k]) => [k, !!atuais[k]])), tempo: sala ? sala.config.tempo : S.config.tempo };
  const fundo = document.createElement('div');
  fundo.className = 'fundo-modal fundo-config';
  const desenhar = () => {
    fundo.innerHTML = `<div class="modal" role="dialog" aria-modal="true" aria-label="Regras da sala" style="max-height:85vh;overflow-y:auto">
      <h2 style="font-size:24px">Regras da sala</h2>
      <span class="ajuda" style="margin-top:-8px">${S.e && S.e.fase !== 'jogando' ? 'Valem a partir da próxima mão.' : 'Valem a partir da primeira mão.'}</span>
      <div id="cfg-bots">${htmlBotsConfig()}</div>
      <span style="font-weight:700">Tempo por jogada</span>
      <div class="segmentos">${[[15, '15 s'], [20, '20 s'], [30, '30 s'], [0, 'Livre']].map(([v, r]) => `<button type="button" data-cfg-tempo="${v}" aria-pressed="${cfg.tempo === v}">${r}</button>`).join('')}</div>
      <div style="display:flex;flex-direction:column;gap:4px">
      ${REGRAS_OPCIONAIS.map(([k, nome, ajuda]) => `
        <label class="chave" for="cfg-${k}"><span style="display:flex;flex-direction:column"><span style="font-weight:700">${nome}</span><span class="ajuda">${ajuda}</span></span>
          <input type="checkbox" id="cfg-${k}" data-cfg="${k}" ${cfg.opcoes[k] ? 'checked' : ''}><span class="trilho" aria-hidden="true"></span></label>`).join('')}
      </div>
      <div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;position:sticky;bottom:-18px;background:var(--superficie);padding:8px 0">
        <button class="btn" id="cfg-cancelar">Cancelar</button>
        <button class="btn btn-principal" id="cfg-salvar">Salvar</button>
      </div></div>`;
    fundo.querySelectorAll('[data-cfg-tempo]').forEach((b) => (b.onclick = () => { cfg.tempo = Number(b.dataset.cfgTempo); const y = fundo.querySelector('.modal').scrollTop; desenhar(); fundo.querySelector('.modal').scrollTop = y; }));
    fundo.querySelectorAll('[data-cfg]').forEach((i) => (i.onchange = () => { cfg.opcoes[i.dataset.cfg] = i.checked; }));
    ligarBotsConfig();
    fundo.querySelector('#cfg-cancelar').onclick = () => fundo.remove();
    fundo.querySelector('#cfg-salvar').onclick = () => {
      if (S.online) enviar({ tipo: 'config', opcoes: cfg.opcoes, tempo: cfg.tempo });
      else {
        if (S.e) Object.assign(S.e.opcoes, cfg.opcoes);
        Object.assign(S.config.opcoes, cfg.opcoes); S.config.tempo = cfg.tempo; gravar('ur-config', S.config);
      }
      fundo.remove();
      mostrarToast('Regras salvas: valem na próxima mão', 3500);
    };
  };
  document.body.appendChild(fundo); // antes de desenhar: os botões de bots são achados pelo id
  desenhar();
  fundo.addEventListener('pointerdown', (ev) => { if (ev.target === fundo) fundo.remove(); });
}
function confirmarVoto(sim) {
  if (sim === undefined) return;
  if (S.online) {
    enviar({ tipo: 'voto', sim });
    if (!sim) { S.erroInicio = 'Você saiu da mesa.'; return sairDaSala(); }
    S.ui.votoEnviado = true; telaFim();
    return;
  }
  if (!sim) { S.tela = 'inicio'; S.e = null; return render(); }
  // treino: os bots sempre votam Sim
  if (S.e.fase === 'fim_partida') return comecarPartida();
  aplicar(S.e, { tipo: 'proxima_rodada' });
  S.ui = { ...novaUI(), espiadasVistas: 0 };
  S.ui.aviso = `Rodada ${S.e.rodada}. Começa: ${nomeJog(S.e.jogadores[S.e.vez].id).replace('Bot ', '')}`;
  S.tela = 'mesa';
  comecarRodadaAnimada();
}

// ---------- arte do placar final (imagem para salvar e compartilhar) ----------
function carregarImg(src) {
  return new Promise((ok) => { const i = new Image(); i.onload = () => ok(i); i.onerror = () => ok(null); i.src = src; });
}
function retanguloRedondo(c, x, y, w, h, r) {
  c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath();
}
function textoCabe(c, texto, max) {
  if (c.measureText(texto).width <= max) return texto;
  let t = texto;
  while (t.length > 1 && c.measureText(t + '…').width > max) t = t.slice(0, -1);
  return t + '…';
}
async function desenharArte() {
  const e = S.e;
  const W = 1080, H = 1350;
  const cv = document.createElement('canvas');
  cv.width = W; cv.height = H;
  const c = cv.getContext('2d');
  try { await Promise.all(['800 100px "Baloo 2"', '800 40px "Nunito"', '700 30px "Nunito"'].map((f) => document.fonts.load(f))); } catch { /* usa a fonte reserva */ }
  const DISPLAY = '"Baloo 2", "Trebuchet MS", sans-serif', CORPO = 'Nunito, system-ui, sans-serif';
  const lista = placar(e).map((p) => {
    const j = e.jogadores.find((x) => x.id === p.jogador) || {};
    const foto = p.jogador === EU ? S.avatar : j.avatar;
    return { ...p, nome: p.jogador === EU ? (S.apelido || 'Você') : p.nome.replace('Bot ', ''), foto, cor: corDoJogador(p.jogador).startsWith('var') ? '#FFD43B' : corDoJogador(p.jogador) };
  });
  const [fotos, enfeites] = await Promise.all([
    Promise.all(lista.map((p) => (p.foto ? carregarImg(p.foto) : null))),
    Promise.all([`${PASTA}/vermelho-7.webp`, `${PASTA}/azul-reverso.webp`, `${PASTA}/verde-mais2.webp`, `${PASTA}/roxo-0.webp`, `${PASTA}/amarelo-pular.webp`, `${PASTA}/mais5-roxo.webp`].map(carregarImg)),
  ]);
  // fundo azul-noite com brilho dourado no alto
  const g = c.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#1C2658'); g.addColorStop(0.55, '#121A3A'); g.addColorStop(1, '#0A0E20');
  c.fillStyle = g; c.fillRect(0, 0, W, H);
  const brilho = c.createRadialGradient(W / 2, 560, 40, W / 2, 560, 620);
  brilho.addColorStop(0, 'rgba(255,212,59,.30)'); brilho.addColorStop(1, 'rgba(255,212,59,0)');
  c.fillStyle = brilho; c.fillRect(0, 0, W, H);
  // cartas espalhadas nos cantos
  const posEnfeite = [[40, 110, -24], [1040, 120, 22], [-40, 640, -14], [1120, 600, 16], [20, 1330, 18], [1060, 1330, -20]];
  enfeites.forEach((img, i) => {
    if (!img) return;
    const [x, y, giro] = posEnfeite[i];
    c.save(); c.translate(x, y); c.rotate((giro * Math.PI) / 180); c.globalAlpha = 0.4;
    c.shadowColor = 'rgba(0,0,0,.5)'; c.shadowBlur = 24; c.shadowOffsetY = 10;
    c.drawImage(img, -95, -146, 190, 293); c.restore();
  });
  // faixa com as 5 cores do jogo
  const cores = ['#EE1C24', '#4A74F2', '#4FCB1A', '#FFE600', '#742EC0'];
  cores.forEach((cor, i) => { c.fillStyle = cor; retanguloRedondo(c, W / 2 - 230 + i * 94, 64, 84, 14, 7); c.fill(); });
  // título
  c.textAlign = 'center'; c.textBaseline = 'alphabetic';
  const titulo = (txt, y, tam0) => {
    let tam = tam0;
    c.font = `800 ${tam}px ${DISPLAY}`;
    const larg = c.measureText(txt).width;
    if (larg > 900) { tam = Math.floor((tam * 900) / larg); c.font = `800 ${tam}px ${DISPLAY}`; }
    c.lineJoin = 'round';
    c.fillStyle = '#B8860B'; c.fillText(txt, W / 2, y + tam * 0.07);
    c.lineWidth = tam * 0.08; c.strokeStyle = '#3A2A00'; c.strokeText(txt, W / 2, y);
    c.fillStyle = '#FFD43B'; c.fillText(txt, W / 2, y);
  };
  titulo('UNO RESENHAS', 186, 112);
  const sala = S.online && S.online.sala ? S.online.sala.nome : 'Sala de treino';
  const data = new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
  c.font = `800 40px ${CORPO}`; c.fillStyle = '#FFFFFF'; c.fillText(textoCabe(c, sala, 900), W / 2, 252);
  c.font = `700 28px ${CORPO}`; c.fillStyle = '#A9B3D6'; c.fillText(data, W / 2, 294);
  // foto redonda (ou inicial) de um jogador
  const avatar = (p, foto, x, y, raio, aro) => {
    c.save();
    c.beginPath(); c.arc(x, y, raio, 0, Math.PI * 2);
    const fundo = c.createRadialGradient(x - raio * 0.3, y - raio * 0.35, raio * 0.1, x, y, raio);
    fundo.addColorStop(0, '#FFFFFF'); fundo.addColorStop(0.35, p.cor); fundo.addColorStop(1, p.cor);
    c.fillStyle = foto ? '#1B2340' : fundo; c.fill();
    c.clip();
    if (foto) {
      const esc2 = Math.max((raio * 2.15) / foto.width, (raio * 2.15) / foto.height);
      const w = foto.width * esc2, h = foto.height * esc2;
      c.drawImage(foto, x - w / 2, y - h / 2 + raio * 0.08, w, h);
    } else {
      c.fillStyle = '#10162B'; c.font = `800 ${Math.round(raio * 1.05)}px ${DISPLAY}`; c.textBaseline = 'middle';
      c.fillText(p.nome[0].toUpperCase(), x, y + raio * 0.08); c.textBaseline = 'alphabetic';
    }
    c.restore();
    c.beginPath(); c.arc(x, y, raio, 0, Math.PI * 2); c.lineWidth = aro; c.strokeStyle = '#FFFFFF'; c.stroke();
  };
  // campeão
  const camp = lista[0];
  const cx = W / 2, cy = 535;
  c.save(); c.shadowColor = 'rgba(255,212,59,.9)'; c.shadowBlur = 60;
  c.beginPath(); c.arc(cx, cy, 128, 0, Math.PI * 2); c.fillStyle = '#FFD43B'; c.fill(); c.restore();
  avatar(camp, fotos[0], cx, cy, 116, 10);
  c.beginPath(); c.arc(cx, cy, 128, 0, Math.PI * 2); c.lineWidth = 8; c.strokeStyle = '#FFD43B'; c.stroke();
  // coroa
  c.save(); c.translate(cx, cy - 142);
  c.beginPath(); c.moveTo(-70, 30); c.lineTo(-82, -38); c.lineTo(-38, -4); c.lineTo(0, -58); c.lineTo(38, -4); c.lineTo(82, -38); c.lineTo(70, 30); c.closePath();
  c.fillStyle = '#FFD43B'; c.fill(); c.lineWidth = 6; c.lineJoin = 'round'; c.strokeStyle = '#3A2A00'; c.stroke();
  [[-82, -38], [0, -58], [82, -38]].forEach(([x, y]) => { c.beginPath(); c.arc(x, y, 10, 0, Math.PI * 2); c.fillStyle = '#EE1C24'; c.fill(); c.stroke(); });
  c.restore();
  // selo CAMPEÃO e nome
  c.font = `800 26px ${CORPO}`;
  const selo = 'CAMPEÃO';
  const ws = c.measureText(selo).width + 48;
  c.fillStyle = '#FFD43B'; retanguloRedondo(c, cx - ws / 2, 678, ws, 44, 22); c.fill();
  c.fillStyle = '#1A1400'; c.fillText(selo, cx, 710);
  c.font = `800 74px ${DISPLAY}`; c.fillStyle = '#FFFFFF';
  c.fillText(textoCabe(c, camp.nome, 900), cx, 792);
  c.font = `800 32px ${CORPO}`; c.fillStyle = '#FFD43B';
  c.fillText(`${camp.vitorias} ${camp.vitorias === 1 ? 'vitória' : 'vitórias'}  ·  ${camp.pontos} pontos`, cx, 838);
  // ranking (sobre um painel escuro, para as cartas do fundo não atrapalharem)
  const topo = 868, fim = 1226;
  const n = lista.length;
  const alt = Math.min(84, (fim - topo - 40) / n);
  c.fillStyle = 'rgba(8,12,26,.6)'; retanguloRedondo(c, 64, topo - 8, W - 128, 40 + n * alt + 24, 28); c.fill();
  const gap = Math.min(10, alt * 0.12);
  const xL = 90, xR = W - 90;
  c.font = `800 22px ${CORPO}`; c.fillStyle = '#A9B3D6';
  const aberta = !!e.opcoes.salaAberta;
  const xVit = aberta ? xR - 270 : xR - 150, xMaos = xR - 150;
  c.textAlign = 'right'; c.fillText('VITÓRIAS', xVit, topo + 26); if (aberta) c.fillText('MÃOS', xMaos, topo + 26); c.fillText('PONTOS', xR - 24, topo + 26);
  lista.forEach((p, i) => {
    const y = topo + 40 + i * alt;
    const h = alt - gap;
    c.fillStyle = i === 0 ? 'rgba(255,212,59,.18)' : 'rgba(255,255,255,.07)';
    retanguloRedondo(c, xL, y, xR - xL, h, Math.min(22, h / 2)); c.fill();
    const meio = y + h / 2;
    c.textBaseline = 'middle';
    const tam = Math.max(20, Math.min(34, h * 0.46));
    c.textAlign = 'left'; c.font = `800 ${tam}px ${DISPLAY}`; c.fillStyle = i === 0 ? '#FFD43B' : '#FFFFFF';
    c.fillText(`${i + 1}º`, xL + 22, meio + 2);
    const r2 = Math.max(14, h * 0.38);
    avatar(p, fotos[i], xL + 110, meio, r2, 3);
    c.font = `800 ${tam}px ${CORPO}`; c.fillStyle = '#FFFFFF';
    c.fillText(textoCabe(c, p.nome, aberta ? 300 : 400), xL + 110 + r2 + 18, meio + 1);
    c.textAlign = 'right'; c.font = `800 ${tam}px ${DISPLAY}`;
    c.fillStyle = '#FFD43B'; c.fillText(String(p.vitorias), xVit, meio + 2);
    if (aberta) { c.fillStyle = '#A9B3D6'; c.fillText(String(p.maos), xMaos, meio + 2); }
    c.fillStyle = '#FFFFFF'; c.fillText(String(p.pontos), xR - 24, meio + 2);
    c.textBaseline = 'alphabetic';
  });
  // rodapé: total de rodadas e de pontos
  const totalPontos = lista.reduce((s2, p) => s2 + p.pontos, 0);
  const rodape = `${e.rodada} ${aberta ? (e.rodada === 1 ? 'mão jogada' : 'mãos jogadas') : e.rodada === 1 ? 'rodada jogada' : 'rodadas jogadas'}  ·  ${totalPontos} pontos na mesa`;
  c.textAlign = 'center'; c.font = `800 30px ${CORPO}`;
  const wr = c.measureText(rodape).width + 60;
  c.fillStyle = 'rgba(8,12,26,.85)'; retanguloRedondo(c, W / 2 - wr / 2, 1250, wr, 56, 28); c.fill();
  c.lineWidth = 3; c.strokeStyle = '#33406B'; c.stroke();
  c.fillStyle = '#FFFFFF'; c.fillText(rodape, W / 2, 1289);
  return cv;
}
function nomeArquivoArte() {
  const d = new Date();
  return `uno-resenhas-placar-${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}.png`;
}
function baixarArte(blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = nomeArquivoArte();
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}
function telaArte() {
  const final = S.arteDe === 'final';
  app.innerHTML = `
  <main class="tela arte-tela">
    <div class="linha" style="justify-content:flex-start">
      ${final ? '' : `<button class="btn btn-icone" id="voltar-arte" aria-label="Voltar"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 18l-6-6 6-6"/></svg></button>`}
      <h1 style="font-size:26px">Placar final</h1>
    </div>
    <div class="arte-quadro" id="arte-quadro"><span class="ajuda">Desenhando a arte…</span></div>
    <p class="aviso" id="aviso-arte" role="status"></p>
    <div class="fim-botoes">
      <button class="btn" id="salvar-arte" disabled>Salvar</button>
      <button class="btn btn-principal" id="compartilhar-arte" disabled>Compartilhar</button>
    </div>
    ${final ? `<button class="btn" id="sair-arte">${S.online ? 'Sair da sala' : 'Voltar ao início'}</button>` : ''}
  </main>`;
  const $ = (id) => document.getElementById(id);
  if ($('voltar-arte')) $('voltar-arte').onclick = () => { S.tela = 'fim'; render(); };
  if ($('sair-arte')) $('sair-arte').onclick = () => { if (S.online) sairDaSala(); else { S.tela = 'inicio'; S.e = null; render(); } };
  const aviso = (t) => { const el = $('aviso-arte'); if (el) el.textContent = t; };
  desenharArte().then((cv) => {
    if (S.tela !== 'arte') return;
    const img = new Image();
    img.alt = 'Arte do placar final do Uno Resenhas';
    img.src = cv.toDataURL('image/png');
    $('arte-quadro').replaceChildren(img);
    cv.toBlob((blob) => {
      if (!blob || S.tela !== 'arte') return;
      $('salvar-arte').disabled = false; $('compartilhar-arte').disabled = false;
      $('salvar-arte').onclick = () => { baixarArte(blob); aviso('Imagem salva nos downloads'); };
      $('compartilhar-arte').onclick = async () => {
        const arquivo = new File([blob], nomeArquivoArte(), { type: 'image/png' });
        if (navigator.canShare && navigator.canShare({ files: [arquivo] })) {
          try { await navigator.share({ files: [arquivo], title: 'Uno Resenhas', text: 'Placar final da resenha!' }); return; }
          catch (err) { if (err && err.name === 'AbortError') return; }
        }
        baixarArte(blob);
        aviso('Este aparelho não compartilha direto: a imagem foi salva para você enviar');
      };
    }, 'image/png');
  }).catch(() => aviso('Não consegui desenhar a arte'));
}

// A seta do sentido gira continuamente; cada nova jogada só muda a cor e, no Reverso, o sentido
const GIRO = { angulo: 0, ultimo: 0, turboAte: 0 };
(function girar(t) {
  if (GIRO.ultimo && S.e) {
    const dt = Math.min(100, t - GIRO.ultimo);
    const turbo = 1 + 14 * Math.max(0, (GIRO.turboAte - t) / 1400);
    GIRO.angulo = (GIRO.angulo + (S.e.sentido === 1 ? 1 : -1) * dt * 0.026 * turbo + 360) % 360;
    const el = document.querySelector('.giro');
    if (el) el.style.rotate = GIRO.angulo.toFixed(1) + 'deg';
  }
  GIRO.ultimo = t;
  if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) requestAnimationFrame(girar);
})(0);

// ---------- foto do avatar: tira o fundo e põe contorno ----------
const MP = 'https://cdn.jsdelivr.net/npm/@mediapipe/selfie_segmentation@0.1.1675465747/';
const comTempo = (p, ms) => Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error('tempo')), ms))]);
function carregarScript(src) {
  return new Promise((ok, erro) => { const s = document.createElement('script'); s.src = src; s.crossOrigin = 'anonymous'; s.onload = ok; s.onerror = erro; document.head.appendChild(s); });
}
function carregarImagem(arquivo) {
  return new Promise((ok, erro) => { const i = new Image(); i.onload = () => ok(i); i.onerror = erro; i.src = URL.createObjectURL(arquivo); });
}
let segmentador = null;
async function mascaraDaPessoa(canvas) {
  if (!window.SelfieSegmentation) await comTempo(carregarScript(MP + 'selfie_segmentation.js'), 15000);
  if (!segmentador) {
    segmentador = new window.SelfieSegmentation({ locateFile: (f) => MP + f });
    segmentador.setOptions({ modelSelection: 0 });
  }
  return comTempo(new Promise((ok) => { segmentador.onResults((r) => ok(r.segmentationMask)); segmentador.send({ image: canvas }); }), 25000);
}
async function processarFoto(arquivo) {
  const img = await carregarImagem(arquivo);
  const k = Math.min(1, 512 / Math.max(img.naturalWidth, img.naturalHeight));
  const base = document.createElement('canvas');
  base.width = Math.round(img.naturalWidth * k); base.height = Math.round(img.naturalHeight * k);
  base.getContext('2d').drawImage(img, 0, 0, base.width, base.height);
  let mascara = null;
  try { mascara = await mascaraDaPessoa(base); } catch { mascara = null; }
  const T = 256, borda = 7, saida = document.createElement('canvas');
  saida.width = saida.height = T;
  const cx = saida.getContext('2d');
  if (mascara) {
    // pessoa recortada
    const rec = document.createElement('canvas'); rec.width = base.width; rec.height = base.height;
    const rc = rec.getContext('2d');
    rc.drawImage(mascara, 0, 0, rec.width, rec.height);
    rc.globalCompositeOperation = 'source-in';
    rc.drawImage(base, 0, 0);
    // caixa em volta da pessoa
    const d = rc.getImageData(0, 0, rec.width, rec.height).data;
    let x0 = rec.width, y0 = rec.height, x1 = 0, y1 = 0;
    for (let y = 0; y < rec.height; y++) for (let x = 0; x < rec.width; x++) if (d[(y * rec.width + x) * 4 + 3] > 60) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    if (x1 - x0 > 20 && y1 - y0 > 20) {
      const lado = Math.max(x1 - x0, y1 - y0);
      const esc2 = (T - 2 * borda - 6) / lado;
      const dx = (T - (x1 - x0) * esc2) / 2 - x0 * esc2, dy = (T - (y1 - y0) * esc2) / 2 - y0 * esc2;
      // contorno branco: a silhueta pintada de branco, desenhada em volta
      const branca = document.createElement('canvas'); branca.width = rec.width; branca.height = rec.height;
      const bc = branca.getContext('2d'); bc.drawImage(rec, 0, 0); bc.globalCompositeOperation = 'source-in'; bc.fillStyle = '#fff'; bc.fillRect(0, 0, branca.width, branca.height);
      cx.shadowColor = 'rgba(0,0,0,.35)'; cx.shadowBlur = 8;
      for (let a = 0; a < 16; a++) {
        const ang = a / 16 * Math.PI * 2;
        cx.drawImage(branca, dx + Math.cos(ang) * borda, dy + Math.sin(ang) * borda, rec.width * esc2, rec.height * esc2);
        cx.shadowBlur = 0;
      }
      cx.drawImage(rec, dx, dy, rec.width * esc2, rec.height * esc2);
      return { url: saida.toDataURL('image/png'), semFundo: true };
    }
  }
  // sem recorte: corte redondo com contorno branco
  const lado = Math.min(base.width, base.height);
  cx.save(); cx.beginPath(); cx.arc(T / 2, T / 2, T / 2 - borda, 0, Math.PI * 2); cx.clip();
  cx.drawImage(base, (base.width - lado) / 2, (base.height - lado) / 2, lado, lado, 0, 0, T, T);
  cx.restore();
  cx.lineWidth = borda; cx.strokeStyle = '#fff'; cx.beginPath(); cx.arc(T / 2, T / 2, T / 2 - borda / 2, 0, Math.PI * 2); cx.stroke();
  return { url: saida.toDataURL('image/png'), semFundo: false };
}

// ================= ONLINE =================
// Conversa com o servidor por WebSocket. O servidor guarda o jogo; aqui só mostramos e pedimos jogadas.
function enviar(msg) {
  const o = S.online;
  if (o && o.ws && o.ws.readyState === 1) o.ws.send(JSON.stringify(msg));
  else if (o) o.fila.push(msg);
}
function conectar(aoAbrir) {
  if (!/^https?:$/.test(location.protocol)) { mostrarErroOnline('O modo online funciona no site do jogo. Aqui dá para treinar contra os bots.'); return; }
  const o = S.online || (S.online = { fila: [], tentativas: 0 });
  if (aoAbrir && !o.codigo) o.primeiro = aoAbrir; // criar/entrar: repete até conseguir, mesmo se a 1ª conexão cair
  const ws = new WebSocket(`${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/ws`);
  o.ws = ws;
  ws.onopen = () => {
    o.tentativas = 0; o.caiu = false; o.ultimaMsg = Date.now();
    if (o.codigo) {
      enviar({ tipo: 'entrar', codigo: o.codigo, token: o.token, apelido: S.apelido || 'Jogador', avatar: S.avatar, senha: o.senha });
      if (CALL.ativa) enviar({ tipo: 'call', ativo: true }); // voltou da queda: continua na call
    }
    else if (o.primeiro) o.primeiro();
    const fila = o.fila; o.fila = [];
    fila.forEach((m) => ws.send(JSON.stringify(m)));
    clearInterval(o.ping); o.ping = setInterval(() => enviar({ tipo: 'ping' }), 25000);
    clearInterval(o.vivo); o.vivo = setInterval(() => { if (o.codigo) fetch('/saude', { cache: 'no-store' }).catch(() => {}); }, 5 * 60 * 1000); // o servidor grátis não dorme com a sala aberta
    if (S.tela === 'mesa' || S.tela === 'espera') render();
  };
  ws.onmessage = (ev) => { o.ultimaMsg = Date.now(); let m; try { m = JSON.parse(ev.data); } catch { return; } receberDoServidor(m); };
  ws.onclose = () => {
    clearInterval(o.ping);
    if (S.online !== o || o.saindo) return;
    if (!o.codigo && o.tentativas >= 7) { // nunca chegou a entrar (~1 min tentando): desiste e avisa
      S.online = null;
      mostrarErroOnline('Não consegui falar com o servidor. Tente de novo em alguns segundos (no plano grátis ele pode levar até 1 minuto para acordar).');
      const b = document.getElementById('comecar') || document.getElementById('btn-entrar'); if (b) b.disabled = false;
      if (S.tela === 'espera') { S.tela = S.codigoEntrar ? 'entrar' : 'inicio'; render(); }
      return;
    }
    o.caiu = true;
    if (!o.codigo) { const el = document.getElementById('erro-criar') || document.getElementById('erro-entrar'); if (el) el.textContent = 'Acordando o servidor… (no plano grátis pode levar até 1 minuto)'; }
    if (S.tela === 'mesa' || S.tela === 'espera') render();
    // tenta voltar para a mesma sala com o mesmo lugar
    const atraso = Math.min(8000, 1000 * 2 ** o.tentativas++);
    clearTimeout(o.timerVolta);
    o.timerVolta = setTimeout(() => { if (S.online === o && !o.saindo && o.ws === ws) conectar(); }, atraso);
  };
  ws.onerror = () => {};
}
// Voltou para o jogo (celular desbloqueado, voltou do WhatsApp…): reconecta na hora se a conexão morreu
function conferirConexao() {
  const o = S.online;
  if (!o || o.saindo || document.visibilityState !== 'visible') return;
  const ws = o.ws;
  const morta = !ws || ws.readyState > 1 || (ws.readyState === 1 && Date.now() - (o.ultimaMsg || 0) > 35000);
  if (!morta) return;
  clearTimeout(o.timerVolta); clearInterval(o.ping);
  o.tentativas = 0;
  if (ws && ws.readyState <= 1) { ws.onclose = null; try { ws.close(); } catch { /* já fechada */ } }
  conectar();
}
document.addEventListener('visibilitychange', conferirConexao);
window.addEventListener('pageshow', conferirConexao);
window.addEventListener('online', conferirConexao);
function mostrarErroOnline(msg) {
  const el = document.getElementById('erro-criar') || document.getElementById('erro-entrar');
  if (el) el.textContent = msg; else { S.erroInicio = msg; }
}
function criarSalaOnline() {
  const c = S.config;
  const lugares = Array.from({ length: c.lugares - 1 }, (_, i) => (c.assentos || [])[i] || 'aberto');
  S.online = null;
  document.getElementById('comecar').disabled = true;
  document.getElementById('erro-criar').textContent = 'Criando a sala…';
  const criacao = { tipo: 'criar', nome: c.nomeSala, senha: c.senha, config: { lugares, salaAberta: !!c.salaAberta, fimModo: c.fimModo, fimValor: c.fimValor, tempo: c.tempo, opcoes: c.opcoes } };
  conectar(() => enviar({ ...criacao, apelido: S.apelido, avatar: S.avatar }));
  S.online.criacao = criacao; S.online.senha = c.senha;
}
// Guarda o necessário para voltar à sala (e, se for o dono, recriá-la) mesmo recarregando a página
function guardarSala() {
  const o = S.online;
  if (o && o.codigo) gravar('ur-sala', { codigo: o.codigo, token: o.token, senha: o.senha || '', criacao: o.criacao || null, dono: !!o.souDono });
}
// O servidor reiniciou e a sala sumiu: o dono recria com o mesmo código; os outros esperam e entram de novo
function salaSumiu() {
  const o = S.online;
  if (!o.recriando) o.recriando = { desde: Date.now(), dono: !!(o.souDono && o.criacao) };
  if (Date.now() - o.recriando.desde > 90000) { S.erroInicio = 'A sala fechou e ninguém a recriou. Crie outra ou entre em uma da lista.'; return sairDaSala(); }
  pararTimers();
  document.querySelectorAll('.palco, .vitoria-show').forEach((x) => x.remove());
  S.e = null; o.sala = null; S.tela = 'espera'; render();
  if (o.recriando.dono) enviar({ ...o.criacao, codigo: o.codigo, apelido: S.apelido, avatar: S.avatar });
  else setTimeout(() => { if (S.online === o && o.recriando) enviar({ tipo: 'entrar', codigo: o.codigo, apelido: S.apelido || 'Jogador', avatar: S.avatar, senha: o.senha || '' }); }, 3000);
}
function mostrarToast(texto, ms = 6000) {
  document.querySelectorAll('.toast').forEach((x) => x.remove());
  const t = document.createElement('div');
  t.className = 'toast'; t.setAttribute('role', 'status'); t.textContent = texto;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), ms);
}
function entrarNaSala(codigo, senha) {
  S.codigoEntrar = codigo;
  const salvo = ler('ur-sala', null);
  const mesma = salvo && salvo.codigo === codigo;
  const token = mesma ? salvo.token : null;
  if (mesma && !senha) senha = salvo.senha || '';
  S.online = null;
  conectar(() => enviar({ tipo: 'entrar', codigo, senha, token, apelido: S.apelido || 'Jogador', avatar: S.avatar }));
  S.online.senha = senha;
  if (mesma) { S.online.criacao = salvo.criacao; S.online.souDono = salvo.dono; }
}
function sairDaSala() {
  S.avisoRecriada = false;
  sairDaCall();
  if (S.online) clearInterval(S.online.vivo);
  document.querySelectorAll('.painel-som').forEach((x) => x.remove());
  const o = S.online;
  if (o) { o.saindo = true; enviar({ tipo: 'sair' }); setTimeout(() => o.ws && o.ws.close(), 200); }
  gravar('ur-sala', null);
  S.online = null; S.e = null; EU = 'eu';
  pararTimers();
  document.querySelectorAll('.palco, .vitoria-show').forEach((x) => x.remove());
  if (location.pathname.startsWith('/s/')) history.replaceState(null, '', '/');
  S.tela = 'inicio'; render();
}
function receberDoServidor(m) {
  const o = S.online;
  if (!o) return;
  if (m.tipo === 'entrou') {
    o.codigo = m.codigo; o.token = m.token; o.meuId = m.meuId; EU = m.meuId;
    if (o.recriando) { o.recriando = null; S.avisoRecriada = true; }
    guardarSala();
    if (location.pathname !== '/s/' + m.codigo) history.replaceState(null, '', '/s/' + m.codigo);
    return;
  }
  if (m.tipo === 'sala') {
    const donoAntes = o.sala && o.sala.dono;
    o.sala = m.sala;
    if (o.souDono !== (m.sala.dono === EU)) { o.souDono = m.sala.dono === EU; guardarSala(); }
    atualizarBotsConfig();
    atualizarCall();
    const eu = m.sala.assentos.find((a) => a.id === EU);
    if (m.sala.fase === 'espera' || (eu && eu.pendente)) { S.tela = 'espera'; render(); }
    else if (m.sala.fase === 'final') { if (S.e && S.tela !== 'arte') { document.querySelectorAll('.palco, .vitoria-show').forEach((x) => x.remove()); S.arteDe = 'final'; S.tela = 'arte'; render(); } }
    else if (S.tela === 'mesa') render();
    else if (S.tela === 'fim') { if (donoAntes !== m.sala.dono) telaFim(); else atualizarVotos(); }
    return;
  }
  if (m.tipo === 'removido') { S.erroInicio = 'Você saiu da mesa.'; return sairDaSala(); }
  if (m.tipo === 'rtc') return receberRtc(m);
  if (m.tipo === 'aviso') return mostrarToast(m.mensagem, m.curto ? 4000 : 9000);
  if (m.tipo === 'estado') return receberEstado(m);
  if (m.tipo === 'erro') {
    if (o.codigo && /não encontrada/i.test(m.mensagem)) return salaSumiu();
    if (S.tela === 'mesa' && S.ui) { tocar('erro'); S.ui.aviso = m.mensagem; S.ui.erro = true; render(); return; }
    if (!o.codigo) {
      o.saindo = true; o.ws.close(); S.online = null;
      if (S.tela === 'espera') { gravar('ur-sala', null); S.tela = S.codigoEntrar ? 'entrar' : 'inicio'; render(); }
    }
    const el = document.getElementById('erro-criar') || document.getElementById('erro-entrar') || document.getElementById('erro-espera');
    if (el) el.textContent = m.mensagem;
    const b = document.getElementById('comecar') || document.getElementById('btn-entrar');
    if (b) b.disabled = false;
  }
}
// Monta, a partir do que o servidor mostrou, um "espelho" da mesa no formato do motor:
// as mãos dos outros viram cartas viradas (só a quantidade), a sua mão é a real.
function espelho(v) {
  const avatarDe = (id) => (S.online && S.online.sala ? (S.online.sala.assentos.find((a) => a.id === id) || {}).avatar : null) || null;
  return {
    online: true, opcoes: v.opcoes, rodada: v.rodada, fase: v.fase,
    vez: Math.max(0, v.jogadores.findIndex((j) => j.id === v.vez)), sentido: v.sentido,
    topo: v.topo, corAtual: v.corAtual, compraPendente: v.compraPendente, regra9: v.regra9,
    comprou: v.cartaComprada, vulneravel: v.vulneravel, disseUltima: { [EU]: v.disseiUltima },
    espiadas: v.espiadas || [], resultadoRodada: v.resultadoRodada, ultimoMais5: v.podeDesafiar ? {} : null,
    monte: { length: v.monte }, descarte: [v.cartaDoTopo], historico: [],
    jogadores: v.jogadores.map((j) => ({
      id: j.id, nome: j.nome, bot: j.bot, pontos: j.pontos, vitorias: j.vitorias || 0, maos: j.maos || 0, avatar: avatarDe(j.id),
      mao: j.id === EU ? v.minhaMao : Array.from({ length: j.cartas }, (_, i) => ({ id: `x${j.id}${i}`, tipo: 'num', cor: null, valor: null })),
    })),
  };
}
function receberEstado(m) {
  EU = m.meuId;
  const ev = m.evento;
  const novo = espelho(m.visao);
  const comeco = !S.e || !S.ui || !ev || ev.tipo === 'inicio' || ev.tipo === 'rodada' || S.tela !== 'mesa' && S.tela !== 'fim';
  if (comeco && (!ev || ev.tipo === 'nada' || ev.tipo === 'acao')) {
    // entrou (ou voltou) no meio da partida: mostra a mesa como está
    S.e = novo;
    if (!S.ui) S.ui = novaUI();
    S.ui.prazoServidor = m.prazo;
    S.tela = novo.fase === 'jogando' ? 'mesa' : 'fim';
    if (S.online.sala && S.online.sala.fase === 'final') { S.arteDe = 'final'; S.tela = 'arte'; return render(); }
    if (S.tela === 'fim') { S.ui.vitoria = true; return render(); }
    return depoisDeMudar();
  }
  if (ev && (ev.tipo === 'inicio' || ev.tipo === 'rodada')) {
    S.avisoRecriada = false;
    document.querySelectorAll('.palco, .vitoria-show').forEach((x) => x.remove());
    S.e = novo;
    S.ui = novaUI();
    S.ui.prazoServidor = m.prazo;
    S.ui.aviso = `Rodada ${novo.rodada}. Começa: ${nomeJog(novo.jogadores[novo.vez].id).replace('Bot ', '')}`;
    S.tela = 'mesa';
    return comecarRodadaAnimada();
  }
  if (!ev || ev.tipo === 'nada') { S.e = novo; S.ui.prazoServidor = m.prazo; return depoisDeMudar(); }
  const antes = fotoAntes();
  S.e = novo;
  S.ui.prazoServidor = m.prazo;
  posAcao(ev.acao, ev.r || {}, ev.jogada || null, antes);
}

// ---------- telas do online ----------
function telaEntrar() {
  const codigo = S.codigoEntrar;
  app.innerHTML = `
  <main class="tela">
    <div class="linha" style="justify-content:flex-start">
      <button class="btn btn-icone" id="voltar" aria-label="Voltar"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 18l-6-6 6-6"/></svg></button>
      <h1 style="font-size:28px">Entrar na sala</h1>
      <span style="margin-left:auto">${botaoTelaCheia()}</span>
    </div>
    <div class="bloco" style="align-items:center;text-align:center">
      <span class="rotulo">Sala</span>
      <b style="font:800 36px var(--display);letter-spacing:4px;color:var(--destaque)">${esc(codigo)}</b>
    </div>
    <form id="f-entrar" class="bloco">
      <div class="escolher-foto" style="padding:0;background:none">
        <span class="avatar-grande" style="cursor:default;border-style:solid">${S.avatar ? `<img src="${S.avatar}" alt="">` : `<span>${esc((S.apelido || '?')[0].toUpperCase())}</span>`}</span>
        <span class="ajuda">Sua foto e o apelido vêm da tela inicial.</span>
      </div>
      <label for="apelido-e" style="font-weight:700">Seu apelido</label>
      <input id="apelido-e" class="campo" maxlength="14" value="${esc(S.apelido)}" required>
      <label for="senha-e" style="font-weight:700">Senha da sala</label>
      <input id="senha-e" class="campo" maxlength="20" autocomplete="off" placeholder="Deixe em branco se não tiver">
      <p class="aviso erro" id="erro-entrar" role="alert" style="height:auto;white-space:normal"></p>
      <button class="btn btn-principal" id="btn-entrar" type="submit" style="min-height:56px">Entrar</button>
    </form>
  </main>`;
  document.getElementById('voltar').onclick = () => { if (location.pathname.startsWith('/s/')) history.replaceState(null, '', '/'); S.tela = 'inicio'; render(); };
  ligarTelaCheia();
  document.getElementById('f-entrar').onsubmit = (ev) => {
    ev.preventDefault();
    S.apelido = document.getElementById('apelido-e').value.trim() || 'Jogador';
    gravar('ur-apelido', S.apelido);
    document.getElementById('btn-entrar').disabled = true;
    document.getElementById('erro-entrar').textContent = 'Entrando…';
    entrarNaSala(codigo, document.getElementById('senha-e').value.trim());
  };
}
function telaEspera() {
  const o = S.online, sala = o && o.sala;
  if (!sala && o && o.recriando) {
    app.innerHTML = `<main class="tela"><div class="bloco" style="align-items:center;text-align:center;gap:10px;margin-top:20vh">
      <h2 style="font-size:24px;color:var(--destaque)">O servidor reiniciou</h2>
      <span style="color:var(--suave)">As salas foram apagadas. ${o.recriando.dono ? 'Recriando a sua sala com o mesmo link…' : 'Esperando o dono recriar a sala para você entrar de novo…'}</span>
      <span class="ajuda">O placar da partida anterior se perdeu.</span></div>
      <button class="btn" id="sair-espera" style="margin-top:auto">Sair</button></main>`;
    document.getElementById('sair-espera').onclick = sairDaSala;
    return;
  }
  if (!sala) { app.innerHTML = '<main class="tela"><p class="aviso">Conectando…</p></main>'; return; }
  const souDono = sala.dono === EU;
  const link = `${location.origin}/s/${sala.codigo}`;
  if (sala.fase !== 'espera') return telaProximaMao(sala, link);
  const convite = `Bora jogar Uno Resenhas! Sala "${sala.nome}"\n${link}${sala.temSenha ? '\n(peça a senha no grupo)' : ''}`;
  const humanos = sala.assentos.filter((a) => a.tipo === 'humano').length;
  const ocupados = sala.assentos.filter((a) => a.tipo !== 'aberto').length;
  app.innerHTML = `
  <main class="tela">
    <div class="linha" style="justify-content:flex-start">
      <button class="btn btn-icone" id="sair-espera" aria-label="Sair da sala"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 18l-6-6 6-6"/></svg></button>
      <div style="display:flex;flex-direction:column;min-width:0">
        <h1 style="font-size:26px;line-height:1.1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(sala.nome)}</h1>
        <span class="ajuda" style="font-size:13px">Sala ${esc(sala.codigo)}${sala.temSenha ? ' · com senha' : ''}${o.caiu ? ' · reconectando…' : ''}</span>
      </div>
      <span style="margin-left:auto;display:flex;gap:6px">${botaoSom()}${botaoTelaCheia()}</span>
    </div>
    <section class="bloco">
      <span class="rotulo">Convite</span>
      <div class="linha" style="background:var(--chao);border:2px solid var(--borda);border-radius:12px;padding:6px 6px 6px 14px">
        <span style="font-weight:700;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;min-width:0;user-select:all" id="link-sala">${esc(link)}</span>
        <button class="btn" id="copiar" style="min-height:40px;flex:none">Copiar</button>
      </div>
      <a class="btn" id="zap" href="https://wa.me/?text=${encodeURIComponent(convite)}" target="_blank" rel="noopener" style="display:grid;place-items:center;text-decoration:none;background:#25D366;border-color:#25D366;color:#06210F;font-weight:800">Mandar no WhatsApp</a>
    </section>
    <div class="linha"><span class="rotulo">Na mesa</span><span style="font-weight:700">${ocupados} de ${sala.assentos.length}</span></div>
    <div style="display:flex;flex-direction:column;gap:8px">
      ${sala.assentos.map((a, i) => {
        if (a.tipo === 'aberto') return `<button class="lugar-espera aberto" ${souDono ? `data-alternar="${i}"` : 'disabled'}><span class="bola-espera">+</span><span>Esperando um amigo…</span><b>${souDono ? 'Pôr bot' : 'ABERTO'}</b></button>`;
        const voce = a.id === EU;
        return `<button class="lugar-espera" ${souDono && a.tipo === 'bot' ? `data-alternar="${i}"` : 'disabled'} style="--cor-jog:${CORES_JOG[i % CORES_JOG.length]}">
          <span class="avatar pequeno">${a.avatar || (voce && S.avatar) ? `<img class="figurinha" src="${voce && S.avatar ? S.avatar : a.avatar}" alt="">` : `<span class="inicial">${esc(a.nome.replace('Bot ', '')[0].toUpperCase())}</span>`}</span>
          <span style="font-weight:700">${esc(a.nome.replace('Bot ', ''))}${voce ? ' (você)' : ''}</span>
          <b>${a.id === sala.dono ? 'DONO' : a.tipo === 'bot' ? (souDono ? 'Tirar bot' : 'BOT') : a.conectado ? '' : 'caiu'}</b></button>`;
      }).join('')}
    </div>
    ${S.avisoRecriada ? '<p class="aviso" style="height:auto;white-space:normal;color:var(--destaque)">A sala foi recriada depois que o servidor reiniciou. O placar anterior se perdeu.</p>' : ''}
    <p class="aviso erro" id="erro-espera" role="alert" style="height:auto;white-space:normal"></p>
    ${souDono
      ? `<button class="btn" id="config-sala" style="margin-top:auto">⚙ Regras da sala</button>
         <button class="btn btn-principal" id="comecar-online" style="min-height:56px" ${ocupados < 2 ? 'disabled' : ''}>Começar${humanos < 2 ? ' com os bots' : ''}</button>
         <p class="ajuda" style="margin:0;text-align:center">Lugares que ficarem abertos saem da mesa quando você começar.</p>`
      : '<p class="aviso" style="margin-top:auto">Esperando quem criou a sala começar…</p>'}
  </main>`;
  document.getElementById('sair-espera').onclick = sairDaSala;
  ligarBotaoSom();
  document.getElementById('copiar').onclick = async (ev) => {
    const b = ev.currentTarget;
    try { await navigator.clipboard.writeText(link); b.textContent = 'Copiado!'; }
    catch { const r = document.createRange(); r.selectNodeContents(document.getElementById('link-sala')); const sel = getSelection(); sel.removeAllRanges(); sel.addRange(r); b.textContent = 'Selecionado'; }
  };
  app.querySelectorAll('[data-alternar]').forEach((b) => (b.onclick = () => enviar({ tipo: 'lugar', indice: Number(b.dataset.alternar) })));
  if (document.getElementById('config-sala')) document.getElementById('config-sala').onclick = abrirConfigSala;
  const cm = document.getElementById('comecar-online');
  if (cm) cm.onclick = () => { cm.disabled = true; enviar({ tipo: 'comecar' }); };
}

// Sala aberta: chegou com a mão rolando; entra quando ela acabar
function telaProximaMao(sala, link) {
  const o = S.online;
  app.innerHTML = `
  <main class="tela">
    <div class="linha" style="justify-content:flex-start">
      <button class="btn btn-icone" id="sair-espera" aria-label="Sair da sala"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 18l-6-6 6-6"/></svg></button>
      <div style="display:flex;flex-direction:column;min-width:0">
        <h1 style="font-size:26px;line-height:1.1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(sala.nome)}</h1>
        <span class="ajuda" style="font-size:13px">Sala aberta ${esc(sala.codigo)}${o.caiu ? ' · reconectando…' : ''}</span>
      </div>
      <span style="margin-left:auto;display:flex;gap:6px">${botaoSom()}${botaoTelaCheia()}</span>
    </div>
    <div class="bloco" style="align-items:center;text-align:center;gap:8px">
      <span class="avatar-grande" style="cursor:default;border-style:solid">${S.avatar ? `<img src="${S.avatar}" alt="">` : `<span>${esc((S.apelido || '?')[0].toUpperCase())}</span>`}</span>
      <h2 style="font-size:24px;color:var(--destaque)">Você entra na próxima mão</h2>
      <span style="color:var(--suave)">A mão está rolando. Assim que ela acabar, você senta na mesa com o placar zerado.</span>
    </div>
    <div class="linha"><span class="rotulo">Na mesa agora</span></div>
    <div style="display:flex;flex-direction:column;gap:8px">
      ${sala.assentos.map((a, i) => `<div class="lugar-espera" style="--cor-jog:${CORES_JOG[i % CORES_JOG.length]}">
        <span class="avatar pequeno">${a.avatar ? `<img class="figurinha" src="${a.avatar}" alt="">` : `<span class="inicial">${esc(a.nome.replace('Bot ', '')[0].toUpperCase())}</span>`}</span>
        <span style="font-weight:700">${esc(a.nome.replace('Bot ', ''))}${a.id === EU ? ' (você)' : ''}</span>
        <b>${a.pendente ? 'PRÓXIMA MÃO' : a.sai ? 'SAINDO' : a.id === sala.dono ? 'DONO' : a.tipo === 'bot' ? 'BOT' : 'JOGANDO'}</b></div>`).join('')}
    </div>
    <button class="btn" id="copiar" style="margin-top:auto">Copiar link da sala</button>
  </main>`;
  document.getElementById('sair-espera').onclick = sairDaSala;
  ligarBotaoSom();
  document.getElementById('copiar').onclick = async (ev) => { try { await navigator.clipboard.writeText(link); ev.currentTarget.textContent = 'Copiado!'; } catch { ev.currentTarget.textContent = link; } };
}

// Abriu um link de sala (/s/CODIGO): volta direto se já estava nela, senão pede a senha
// Só existe modo online quando a página vem do servidor do jogo
S.temServidor = null;
if (/^https?:$/.test(location.protocol)) {
  fetch('/saude', { cache: 'no-store' }).then((r) => r.ok && r.text()).then((t) => { S.temServidor = t === 'ok'; if (S.tela === 'inicio') render(); }).catch(() => { S.temServidor = false; if (S.tela === 'inicio') render(); });
} else S.temServidor = false;

(function abrirPeloLink() {
  const m = location.pathname.match(/^\/s\/([A-Z0-9]{5})$/i);
  if (!m) return;
  const codigo = m[1].toUpperCase();
  const salvo = ler('ur-sala', null);
  if (salvo && salvo.codigo === codigo) { S.tela = 'espera'; entrarNaSala(codigo, ''); }
  else { S.codigoEntrar = codigo; S.tela = 'entrar'; }
})();

window.addEventListener('resize', () => { aplicarZoom(); if (S.tela === 'mesa') render(); });
document.addEventListener('keydown', (ev) => { if (ev.key === '9') { const b = document.getElementById('apertar9'); if (b && !b.disabled) b.click(); } });
telaInicio = comRolagem('inicio', telaInicio);
telaCriar = comRolagem('criar', telaCriar);
telaFim = comRolagem('fim', telaFim);
telaEspera = comRolagem('espera', telaEspera);
telaEntrar = comRolagem('entrar', telaEntrar);
telaArte = comRolagem('arte', telaArte);
document.addEventListener('fullscreenchange', () => {
  if (S.tela === 'mesa') return render();
  // nas outras telas só troca o ícone (sem redesenhar e perder o que foi digitado)
  const b = document.getElementById('tela-cheia');
  if (b) { b.querySelector('svg').innerHTML = iconeTelaCheia(); b.setAttribute('aria-label', document.fullscreenElement ? 'Sair da tela cheia' : 'Tela cheia'); }
});
aplicarZoom();
// Verso das cartas: usa a arte do verso do deck escolhido
function carregarVerso() {
  document.body.classList.toggle('deck-min', PASTA === 'cartas-min');
  const i = new Image();
  i.onload = () => { document.body.style.setProperty('--verso-url', `url(${PASTA}/verso.webp)`); document.body.classList.add('tem-verso'); };
  i.onerror = () => document.body.classList.remove('tem-verso');
  i.src = `${PASTA}/verso.webp`;
}
carregarVerso();
render();
