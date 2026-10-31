// Gera o ícone do app (web/publico/icone-*.png) e a imagem de compartilhamento dos links
// (web/publico/og.jpg, a "prévia" que aparece no WhatsApp). Uso: node ferramentas/icones.cjs
const { chromium } = require('playwright');
const path = require('path');
const { execFileSync } = require('child_process');

const PUB = path.join(__dirname, '..', 'web', 'publico');
const DEG = {
  vermelho: ['#F0533A', '#EE2626', '#F04C3A'], azul: ['#1488C6', '#2560B0', '#1580C2'],
  verde: ['#86C64A', '#3FB54A', '#6DC24A'], amarelo: ['#FFE27A', '#FFD43B', '#FCC419'], roxo: ['#A066E0', '#7434C2', '#9258D8'],
};
const deg = (c) => `linear-gradient(135deg, ${DEG[c][0]}, ${DEG[c][1]} 50%, ${DEG[c][2]})`;
const FUNDO = 'radial-gradient(circle at 50% 38%, #2A3770 0%, #18214A 45%, #10162B 100%)';
const FONTE = "'Inter Display', Inter, sans-serif";

// leque de 5 cartas (as 5 cores do jogo); a da frente é o +5 amarelo
function leque(w) {
  const h = w * 1.54, r = w * 0.13;
  const cores = ['vermelho', 'azul', 'amarelo', 'verde', 'roxo'];
  const giro = [-34, -17, 0, 17, 34];
  const ordem = [0, 1, 4, 3, 2]; // a amarela por cima
  return ordem.map((i) => {
    const c = cores[i];
    const frente = c === 'amarelo';
    return `<div style="position:absolute;left:50%;top:50%;width:${w}px;height:${h}px;margin:${-h / 2}px 0 0 ${-w / 2}px;
      transform-origin:50% 130%;transform:rotate(${giro[i]}deg);border-radius:${r}px;background:${deg(c)};
      box-shadow:0 ${w * 0.06}px ${w * 0.16}px rgba(0,0,0,.45), inset 0 0 0 ${w * 0.035}px rgba(255,255,255,.9);
      display:grid;place-items:center">
      ${frente ? `<b style="font:900 ${w * 0.62}px/1 ${FONTE};color:#10162B;letter-spacing:${-w * 0.02}px;margin-top:${w * 0.04}px">+5</b>
        <span style="position:absolute;left:${w * 0.12}px;top:${w * 0.08}px;font:800 ${w * 0.17}px/1 ${FONTE};color:#10162B">+5</span>
        <span style="position:absolute;right:${w * 0.12}px;bottom:${w * 0.08}px;font:800 ${w * 0.17}px/1 ${FONTE};color:#10162B;transform:rotate(180deg)">+5</span>` : ''}
    </div>`;
  }).join('');
}

const ICONE = (tam) => `<div style="position:relative;width:${tam}px;height:${tam}px;background:${FUNDO};overflow:hidden">
  <div style="position:absolute;left:50%;top:50%;width:${tam * 0.78}px;height:${tam * 0.78}px;margin:${-tam * 0.39}px;border-radius:50%;
    background:conic-gradient(from -90deg, #FFD43B 0 72deg, #3FB54A 72deg 144deg, #EE2626 144deg 216deg, #7434C2 216deg 288deg, #2560B0 288deg 360deg);
    -webkit-mask:radial-gradient(circle, transparent 63%, #000 64%, #000 68%, transparent 69%);opacity:.9"></div>
  <div style="position:absolute;left:0;top:${tam * 0.06}px;width:100%;height:100%">${leque(tam * 0.27)}</div>
</div>`;

const OG = `<div style="position:relative;width:1200px;height:630px;background:${FUNDO};overflow:hidden;font-family:${FONTE}">
  <div style="position:absolute;right:-40px;top:-10px;width:620px;height:650px">${leque(205)}</div>
  <div style="position:absolute;left:84px;top:150px;display:flex;flex-direction:column;gap:18px">
    <div style="display:flex;gap:10px">${['vermelho', 'azul', 'verde', 'amarelo', 'roxo'].map((c) => `<i style="width:70px;height:12px;border-radius:6px;background:${DEG[c][1]}"></i>`).join('')}</div>
    <b style="font:900 118px/0.95 ${FONTE};color:#FFD43B;letter-spacing:-2px;text-shadow:0 8px 0 #8A6A00, 0 18px 40px rgba(0,0,0,.5)">Uno<br>Resenhas</b>
    <span style="font:600 36px/1.2 ${FONTE};color:#E8ECFF">5 cores, +5, Ctrl+C<br>e muita resenha</span>
    <span style="align-self:flex-start;margin-top:6px;padding:12px 26px;border-radius:999px;background:#FFD43B;color:#1A1400;font:800 30px/1 ${FONTE}">Entra na mesa!</span>
  </div>
</div>`;

(async () => {
  const b = await chromium.launch();
  const p = await b.newPage();
  const foto = async (html, w, h, arquivo, fmt = 'png') => {
    await p.setViewportSize({ width: w, height: h });
    await p.setContent(`<!doctype html><html><body style="margin:0">${html}</body></html>`);
    await p.evaluate(() => document.fonts.ready);
    const tmp = arquivo + '.tmp.png';
    await p.screenshot({ path: tmp, clip: { x: 0, y: 0, width: w, height: h } });
    execFileSync('python3', ['-I', '-c', `from PIL import Image
im = Image.open(r'''${tmp}''').convert('RGB')
${fmt === 'jpg' ? `im.save(r'''${arquivo}''', 'JPEG', quality=86, optimize=True, progressive=True)` : `im.save(r'''${arquivo}''', optimize=True)`}
import os; os.remove(r'''${tmp}''')`]);
  };
  await foto(ICONE(512), 512, 512, path.join(PUB, 'icone-512.png'));
  await foto(ICONE(192), 192, 192, path.join(PUB, 'icone-192.png'));
  await foto(ICONE(180), 180, 180, path.join(PUB, 'icone-180.png'));
  await foto(OG, 1200, 630, path.join(PUB, 'og.jpg'), 'jpg');
  await b.close();
  console.log('ícones e og.jpg prontos em', PUB);
})();
