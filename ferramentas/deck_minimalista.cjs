// Gera o deck "Minimalista" (web/cartas-min/) no estilo dos exemplos do usuário:
// fundo em degradê diagonal de uma cor, números finos brancos, ícones de traço fino.
// Uso: node ferramentas/deck_minimalista.cjs   (precisa do Playwright/Chromium e da fonte Inter)
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const SAIDA = path.join(__dirname, '..', 'web', 'cartas-min');
const W = 650, H = 1002;          // proporção das cartas do jogo
const PX = 300;                   // largura final (nítida em tela de celular)

// degradê de cada cor: canto claro → meio mais forte → canto claro (como nos exemplos)
const COR = {
  vermelho: ['#F0533A', '#EE2626', '#F04C3A'],
  azul: ['#1488C6', '#2560B0', '#1580C2'],
  verde: ['#86C64A', '#3FB54A', '#6DC24A'],
  amarelo: ['#F8D84E', '#FCCC12', '#F9D650'],
  roxo: ['#A066E0', '#7434C2', '#9258D8'],
};
const ESCURO = ['#58545A', '#2F2B2E', '#4A4649'];
const ORDEM_ANEL = ['amarelo', 'verde', 'vermelho', 'roxo', 'azul']; // segmentos do anel do coringa
const BASE = { vermelho: '#EE2626', azul: '#1D6BC0', verde: '#3FB54A', amarelo: '#FCCC12', roxo: '#8A45D6' };
const FONTE = "font-family: Inter, 'Helvetica Neue', sans-serif";

function fundo(c) {
  return `<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stop-color="${c[0]}"/><stop offset=".5" stop-color="${c[1]}"/><stop offset="1" stop-color="${c[2]}"/></linearGradient></defs>
    <rect width="${W}" height="${H}" fill="url(#g)"/>`;
}
// texto do canto: em cima à esquerda e, girado, embaixo à direita
// cantos maiores e mais grossos que nos exemplos, para ler bem com as cartas pequenas na mão
function cantos(txt, tam = 112, sub = false) {
  const t = (x, y, rot) => `<g transform="translate(${x} ${y}) rotate(${rot})"><text x="0" y="0" font-size="${tam}" font-weight="500" fill="#fff" style="${FONTE}">${txt}</text>${sub ? `<line x1="4" y1="20" x2="${tam * 0.56}" y2="20" stroke="#fff" stroke-width="9"/>` : ''}</g>`;
  return t(50, 50 + tam * 0.72, 0) + t(W - 50, H - 50 - tam * 0.72, 180);
}
function cantosIcone(icone, escala = 0.5) {
  return `<g transform="translate(118 122) scale(${escala})">${icone}</g><g transform="translate(${W - 118} ${H - 122}) rotate(180) scale(${escala})">${icone}</g>`;
}
const svg = (corpo) => `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${corpo}</svg>`;

// ---------- ícones (centrados em 0,0) ----------
const ICONE = {
  pular: (s = 13) => `<circle r="100" fill="none" stroke="#fff" stroke-width="${s}"/><line x1="-70" y1="70" x2="70" y2="-70" stroke="#fff" stroke-width="${s}"/>`,
  // duas cartas: a de trás aparece só fora da da frente
  mais2: (s = 11) => `<defs><mask id="m2"><rect x="-200" y="-200" width="400" height="400" fill="#fff"/><rect x="-62" y="-14" width="66" height="96" rx="9" fill="#000" stroke="#000" stroke-width="${s * 2}"/></mask></defs>
    <rect x="-12" y="-82" width="66" height="96" rx="9" fill="none" stroke="#fff" stroke-width="${s}" mask="url(#m2)"/>
    <rect x="-62" y="-14" width="66" height="96" rx="9" fill="none" stroke="#fff" stroke-width="${s}"/>`,
  // duas setas opostas ligadas por um zigue-zague
  reverso: (s = 11) => `<g fill="none" stroke="#fff" stroke-width="${s}" stroke-linecap="round" stroke-linejoin="round">
    <path d="M 30 -100 L 76 -100 L 76 -54"/><path d="M 76 -100 L 22 -46 C 4 -28 4 -6 22 8"/>
    <path d="M -30 100 L -76 100 L -76 54"/><path d="M -76 100 L -22 46 C -4 28 -4 6 -22 -8"/></g>`,
  anel: (cores, s = 18, r = 92) => {
    const n = cores.length, vao = 3; // graus de folga entre os segmentos
    return cores.map((c, i) => {
      const a0 = (-90 + i * 360 / n + vao / 2) * Math.PI / 180, a1 = (-90 + (i + 1) * 360 / n - vao / 2) * Math.PI / 180;
      return `<path d="M ${r * Math.cos(a0)} ${r * Math.sin(a0)} A ${r} ${r} 0 0 1 ${r * Math.cos(a1)} ${r * Math.sin(a1)}" fill="none" stroke="${c}" stroke-width="${s}"/>`;
    }).join('');
  },
  // cinco cartas em escada, uma de cada cor (o +4 dos exemplos ganhou a carta roxa)
  mais5: (cores, s = 9) => {
    const pos = [[-112, 18], [-62, -36], [-12, -4], [38, -58], [88, -26]];
    return cores.map((c, i) => `<rect x="${pos[i][0] - 30}" y="${pos[i][1] - 44}" width="60" height="88" rx="7" fill="none" stroke="${c}" stroke-width="${s}"/>`).join('');
  },
  // Ctrl+C: o desenho de "copiar" (duas folhas) e a letra C dentro
  ctrl: (cores, s = 11) => {
    const traco = cores ? `url(#gc)` : '#fff';
    return `${cores ? `<defs><linearGradient id="gc" x1="0" y1="0" x2="1" y2="1">${cores.map((c, i) => `<stop offset="${i / (cores.length - 1)}" stop-color="${c}"/>`).join('')}</linearGradient></defs>` : ''}
      <defs><mask id="mc"><rect x="-200" y="-200" width="400" height="400" fill="#fff"/><rect x="-78" y="-40" width="112" height="128" rx="16" fill="#000" stroke="#000" stroke-width="${s * 2}"/></mask></defs>
      <rect x="-34" y="-88" width="112" height="128" rx="16" fill="none" stroke="${traco}" stroke-width="${s}" mask="url(#mc)"/>
      <rect x="-78" y="-40" width="112" height="128" rx="16" fill="none" stroke="${traco}" stroke-width="${s}"/>
      <text x="-22" y="48" text-anchor="middle" font-size="96" font-weight="300" fill="#fff" style="${FONTE}">C</text>`;
  },
};
const CORES5 = ORDEM_ANEL.map((c) => BASE[c]);
const ESCADA5 = ['verde', 'azul', 'vermelho', 'amarelo', 'roxo'].map((c) => BASE[c]);
const centro = (x) => `<g transform="translate(${W / 2} ${H / 2})">${x}</g>`;

function carta(nome) {
  let m;
  if ((m = nome.match(/^(\w+)-(\d)$/))) { // número
    const [, cor, v] = m;
    const sub = v === '9'; // como nos exemplos: só o 9 é sublinhado
    return svg(fundo(COR[cor]) + cantos(v, 84, sub)
      + `<text x="${W / 2}" y="${H / 2 + 105}" text-anchor="middle" font-size="300" font-weight="200" fill="#fff" style="${FONTE}">${v}</text>`
      + (sub ? `<line x1="${W / 2 - 62}" y1="${H / 2 + 150}" x2="${W / 2 + 62}" y2="${H / 2 + 150}" stroke="#fff" stroke-width="10"/>` : ''));
  }
  if ((m = nome.match(/^(\w+)-(pular|mais2|reverso)$/))) {
    const [, cor, t] = m;
    const canto = t === 'mais2' ? cantos('+2') : cantosIcone(ICONE[t](t === 'pular' ? 22 : 20));
    return svg(fundo(COR[cor]) + canto + centro(`<g transform="scale(${t === 'mais2' ? 1.25 : t === 'reverso' ? 1.15 : 1.05})">${ICONE[t](t === 'reverso' ? 12 : undefined)}</g>`));
  }
  if ((m = nome.match(/^(coringa|mais5|ctrl)(?:-(\w+))?$/))) {
    const [, t, cor] = m;
    const bg = cor ? COR[cor] : ESCURO;
    const branco = (n) => Array(n).fill('#fff');
    if (t === 'coringa') {
      const cores = cor ? branco(5) : CORES5;
      return svg(fundo(bg) + cantosIcone(ICONE.anel(cores, 30, 92), 0.5) + centro(ICONE.anel(cores, 20, 92)));
    }
    if (t === 'mais5') {
      const cores = cor ? branco(5) : ESCADA5;
      return svg(fundo(bg) + cantos('+5') + centro(`<g transform="scale(1.25)">${ICONE.mais5(cores)}</g>`));
    }
    return svg(fundo(bg) + cantos('Ctrl+C', 74) + centro(`<g transform="scale(1.15)">${ICONE.ctrl(cor ? null : CORES5)}</g>`));
  }
  if (nome === 'verso') {
    return svg(fundo(ESCURO) + centro(ICONE.anel(CORES5, 12, 190)
      + `<text x="0" y="22" text-anchor="middle" font-size="128" font-weight="200" letter-spacing="6" fill="#fff" style="${FONTE}">UNO</text>`
      + `<text x="0" y="80" text-anchor="middle" font-size="34" font-weight="300" letter-spacing="14" fill="#fff" style="${FONTE}">RESENHAS</text>`));
  }
  throw new Error('carta desconhecida: ' + nome);
}

function todas() {
  const l = ['coringa', 'mais5', 'ctrl', 'verso'];
  for (const c of Object.keys(COR)) {
    for (let v = 0; v <= 9; v++) l.push(`${c}-${v}`);
    for (const t of ['pular', 'reverso', 'mais2']) l.push(`${c}-${t}`);
    for (const b of ['coringa', 'mais5', 'ctrl']) l.push(`${b}-${c}`);
  }
  return l;
}

(async () => {
  fs.mkdirSync(SAIDA, { recursive: true });
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: PX / W });
  const tmp = path.join(SAIDA, '_tmp.png');
  const lista = process.argv[2] ? process.argv[2].split(',') : todas();
  for (const nome of lista) {
    await p.setContent(`<!doctype html><html><body style="margin:0;background:#000">${carta(nome)}</body></html>`);
    await p.evaluate(() => document.fonts.ready);
    await p.screenshot({ path: tmp, clip: { x: 0, y: 0, width: W, height: H } });
    execFileSync('python3', ['-I', '-c', `from PIL import Image; Image.open(r'''${tmp}''').convert('RGB').save(r'''${path.join(SAIDA, nome + '.webp')}''', 'WEBP', quality=88, method=6)`]);
  }
  fs.unlinkSync(tmp);
  await b.close();
  console.log(lista.length, 'cartas em', SAIDA);
})();
