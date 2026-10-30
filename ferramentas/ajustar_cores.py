# Ajuste de cores: azul um pouco mais claro e roxo um pouco mais escuro (cartas, coringas e versões pintadas)
import sys, os
from collections import deque
import numpy as np
from PIL import Image
ORIG, ROXO_DIR, SAIDA, WEB = sys.argv[1:5]  # pasta CARTAS DO JOGO original, pasta com roxo/coringas, saída em alta, web/cartas
AZUL_VELHO, AZUL_NOVO = np.array([58, 88, 228.]), np.array([74, 116, 242.])
ROXO_VELHO, ROXO_NOVO = np.array([138, 63, 217.]), np.array([116, 46, 192.])
CORES = {'vermelho': (241, 12, 12), 'azul': tuple(AZUL_NOVO.astype(int)), 'verde': (79, 203, 26), 'amarelo': (255, 230, 0), 'roxo': tuple(ROXO_NOVO.astype(int))}

def hsv(rgb):
    mx = rgb.max(-1); mn = rgb.min(-1); d = mx - mn
    r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
    h = np.zeros_like(mx); m = d > 1e-6
    i = m & (mx == r); h[i] = (60 * ((g[i] - b[i]) / d[i])) % 360
    i = m & (mx == g); h[i] = 60 * ((b[i] - r[i]) / d[i]) + 120
    i = m & (mx == b); h[i] = 60 * ((r[i] - g[i]) / d[i]) + 240
    s = np.where(mx > 0, d / np.maximum(mx, 1e-6), 0)
    return h, s, mx

def trocar(a, velho, novo, h0, h1):
    rgb = a[..., :3] / 255.0
    h, s, v = hsv(rgb)
    sv = (velho.max() - velho.min()) / velho.max()
    sel = (h >= h0) & (h <= h1) & (s > 0.08)
    t = np.clip(s / sv, 0, 1)[..., None]
    base = novo / (velho.max() / 255.0)  # mantém o brilho relativo
    nova = v[..., None] * ((1 - t) * 255 + t * base)
    out = a.copy(); out[..., :3][sel] = np.clip(nova[sel], 0, 255)
    return out

def carregar(p): return np.asarray(Image.open(p).convert('RGBA')).astype(float)
def salvar(a, alta, web):
    im = Image.fromarray(np.clip(a, 0, 255).astype(np.uint8), 'RGBA')
    if alta: os.makedirs(os.path.dirname(alta), exist_ok=True); im.save(alta)
    if web: w = im.copy(); w.thumbnail((200, 308), Image.LANCZOS); w.save(web, 'WEBP', quality=86)
    return im

nomes = [f'({v})' for v in range(10)] + ['+2', 'Pular', 'Reverso']
chave = [str(v) for v in range(10)] + ['mais2', 'pular', 'reverso']
for n, k in zip(nomes, chave):
    salvar(trocar(carregar(f'{ORIG}/AZUL/Azul {n}.png'), AZUL_VELHO, AZUL_NOVO, 212, 248), f'{SAIDA}/AZUL/Azul {n}.png', f'{WEB}/azul-{k}.webp')
    salvar(trocar(carregar(f'{ROXO_DIR}/ROXO/Roxo {n}.png'), ROXO_VELHO, ROXO_NOVO, 255, 290), f'{SAIDA}/ROXO/Roxo {n}.png', f'{WEB}/roxo-{k}.webp')

# coringas: os quadrados/fatias azuis e roxos também mudam
bases = {}
for arq, k in [('ESCOLHER COR.png', 'coringa'), ('+5.png', 'mais5'), ('CTRL-C + CTRL-V.png', 'ctrl')]:
    a = carregar(f'{ROXO_DIR}/CORINGA/{arq}')
    a = trocar(trocar(a, AZUL_VELHO, AZUL_NOVO, 222, 248), ROXO_VELHO, ROXO_NOVO, 255, 290)
    salvar(a, f'{SAIDA}/CORINGA/{arq}', f'{WEB}/{k}.webp')
    bases[k] = a

# versões com o fundo preto pintado na cor escolhida
for k, a in bases.items():
    h, w = a.shape[:2]
    rgb = a[..., :3]; lum = rgb.mean(-1); sat = rgb.max(-1) - rgb.min(-1)
    pode = (lum < 200) & (sat < 40) & (a[..., 3] > 0)
    vis = np.zeros((h, w), bool); q = deque()
    for y in (h // 8, h // 4, 3 * h // 4, 7 * h // 8):
        xs = np.where(lum[y, 20:] < 60)[0]
        if len(xs): q.append((y, 20 + xs[0]))
        xs = np.where(lum[y, :w - 20][::-1] < 60)[0]
        if len(xs): q.append((y, w - 21 - xs[0]))
    for p in q: vis[p] = True
    while q:
        y, x = q.popleft()
        for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            ny, nx = y + dy, x + dx
            if 0 <= ny < h and 0 <= nx < w and pode[ny, nx] and not vis[ny, nx]:
                vis[ny, nx] = True; q.append((ny, nx))
    t = (lum / 255.0)[..., None]
    for cor, c in CORES.items():
        novo = a.copy(); mix = np.array(c, float) * (1 - t) + 255 * t
        novo[..., :3][vis] = mix[vis]
        salvar(novo, None, f'{WEB}/{k}-{cor}.webp')
print('ok')
