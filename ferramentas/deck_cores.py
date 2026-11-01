# Cartas dos modos Tradicional (4 cores, +4) e Resenhas estendido (6 cores, rosa, +6) no deck clássico.
# Uso: python3 ferramentas/deck_cores.py "<CARTAS DO JOGO original>" "<pasta com AZUL/ROXO/CORINGA ajustados>" <saída alta> web/cartas
import sys, os, math
from collections import deque
import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage

ORIG, AJUST, SAIDA, WEB = sys.argv[1:5]
CORES = {'vermelho': (241, 12, 12), 'azul': (74, 116, 242), 'verde': (79, 203, 26), 'amarelo': (255, 230, 0), 'roxo': (116, 46, 192), 'rosa': (255, 102, 196)}
OUTLINE = 6
MINI = (139, 215)  # miolo das cartinhas do +N (sem o contorno)


def carregar(p): return np.asarray(Image.open(p).convert('RGB')).astype(float)


def salvar(a, alta, web):
    im = Image.fromarray(np.clip(a, 0, 255).astype(np.uint8), 'RGB')
    if alta: os.makedirs(os.path.dirname(alta), exist_ok=True); im.save(alta)
    if web: w = im.copy(); w.thumbnail((200, 308), Image.LANCZOS); w.save(web, 'WEBP', quality=86)
    return im


# ---------- cor rosa: a arte original do usuário ----------
nomes = [f'({v})' for v in range(10)] + ['+2', 'Pular', 'Reverso']
chave = [str(v) for v in range(10)] + ['mais2', 'pular', 'reverso']
for n, k in zip(nomes, chave):
    salvar(carregar(f'{ORIG}/ROSA/Rosa {n}.png'), None, f'{WEB}/rosa-{k}.webp')


# ---------- algarismo branco dos cantos das cartas de número ----------
def glifo(arq):
    a = carregar(arq); L = a.mean(-1); sat = a.max(-1) - a.min(-1)
    lab, _ = ndimage.label((L > 200) & (sat < 40))
    melhor = None
    for i, s in enumerate(ndimage.find_objects(lab)):
        if s[0].start > 0 and s[1].start > 0 and s[0].stop < 250 and s[1].stop < 250:
            m = lab[s] == i + 1
            if melhor is None or m.sum() > melhor.sum(): melhor = m
    return melhor


def colar_numero(a, mask, x0, y0, alt):
    """Desenha o algarismo no estilo do canto do +5: branco, contorno preto e uma cópia branca deslocada atrás."""
    h, w = mask.shape
    nw = round(w * alt / h)
    m = np.asarray(Image.fromarray((mask * 255).astype(np.uint8)).resize((nw, alt), Image.LANCZOS)).astype(float) / 255
    pad = 20
    M = np.zeros((alt + 2 * pad, nw + 2 * pad)); M[pad:pad + alt, pad:pad + nw] = m
    sombra = np.zeros_like(M); sombra[10:, 8:] = M[:-10, :-8]
    contorno = ndimage.grey_dilation(M, footprint=np.ones((9, 9)))
    reg = a[y0 - pad:y0 - pad + M.shape[0], x0 - pad:x0 - pad + M.shape[1]]
    for camada, cor in ((sombra, 255), (contorno, 0), (M, 255)):
        t = camada[..., None]
        reg[:] = reg * (1 - t) + cor * t


def trocar_canto(a, glif):
    # apaga o "5" (e a sombra dele) e desenha o novo número; o canto de baixo é o de cima girado
    a[64:164, 131:212] = 0
    colar_numero(a, glif, 135, 73, 73)
    H, W = a.shape[:2]
    topo = a[40:175, 45:220].copy()
    a[H - 175:H - 40, W - 220:W - 45] = topo[::-1, ::-1]


def cartinha(d, x, y, cor):
    w, h = MINI
    d.rectangle([x - OUTLINE, y - OUTLINE, x + w + OUTLINE - 1, y + h + OUTLINE - 1], fill=(0, 0, 0))
    d.rectangle([x, y, x + w - 1, y + h - 1], fill=CORES[cor])


LAYOUT = {
    4: [('amarelo', 262, 250), ('azul', 172, 360), ('verde', 352, 360), ('vermelho', 262, 462)],
    6: [('roxo', 314, 207), ('azul', 144, 317), ('amarelo', 391, 336), ('vermelho', 264, 469), ('verde', 143, 579), ('rosa', 352, 588)],
}


def mais_n(n, glif):
    a = carregar(f'{AJUST}/CORINGA/+5.png')
    # tira as 5 cartinhas (retângulos alinhados) e desenha as novas
    for (y0, y1, x0, x1) in [(207, 427, 314, 456), (317, 532, 144, 283), (336, 561, 391, 536), (469, 695, 264, 410), (579, 800, 143, 286)]:
        a[y0 - 9:y1 + 9, x0 - 9:x1 + 9] = 255
    im = Image.fromarray(a.astype(np.uint8)); d = ImageDraw.Draw(im)
    for cor, x, y in LAYOUT[n]: cartinha(d, x, y, cor)
    a = np.asarray(im).astype(float).copy()
    trocar_canto(a, glif)
    return a


def coringa_n(n):
    a = carregar(f'{AJUST}/CORINGA/ESCOLHER COR.png')
    sat = a.max(-1) - a.min(-1)
    lab, _ = ndimage.label(sat > 25)
    ordem = {4: ['amarelo', 'vermelho', 'azul', 'verde'], 6: ['amarelo', 'vermelho', 'roxo', 'azul', 'verde', 'rosa']}[n]
    pura = np.array([CORES[c] for c in ['vermelho', 'azul', 'verde', 'amarelo', 'roxo', 'rosa']], float)
    for i, s in enumerate(ndimage.find_objects(lab)):
        m = lab == i + 1
        if m.sum() < 500: continue
        ys, xs = np.where(m); cy, cx = ys.mean(), xs.mean()
        ang = (np.degrees(np.arctan2(ys - cy, xs - cx)) + 90 - 15) % 360  # começa no alto
        setor = (ang // (360 / n)).astype(int)
        px = a[ys, xs]
        # quanto de branco/preto tem misturado na borda (antialias)
        sp = px.max(-1) - px.min(-1)
        t = np.clip(sp / 120.0, 0, 1)
        dentro = ndimage.binary_erosion(ndimage.binary_fill_holes(m), iterations=5)[ys, xs]
        t = np.where(dentro, 1.0, t)[:, None]  # emendas entre as fatias antigas somem
        branco = (px.min(-1) > 60)[:, None]
        alvo = np.array([CORES[ordem[k]] for k in setor], float)
        a[ys, xs] = np.where(branco, alvo * t + 255 * (1 - t), alvo * t)
    return a


def pintar_fundo(a, cor, protegido=None):
    # o fundo preto da carta vira a cor escolhida (como já acontece com o +5 e o coringa)
    h, w = a.shape[:2]
    rgb = a[..., :3]; lum = rgb.mean(-1); sat = rgb.max(-1) - rgb.min(-1)
    pode = (lum < 200) & (sat < 40)
    if protegido is not None: pode &= ~protegido
    vis = np.zeros((h, w), bool); q = deque()
    # sementes: o preto perto das bordas da carta (as cartinhas e o desenho do meio nunca chegam lá)
    borda = np.zeros((h, w), bool); borda[:, 20:70] = True; borda[:, w - 70:w - 20] = True; borda[:40] = False; borda[h - 40:] = False
    for p in zip(*np.where(borda & pode & (lum < 60))): vis[p] = True; q.append(p)
    while q:
        y, x = q.popleft()
        for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            ny, nx = y + dy, x + dx
            if 0 <= ny < h and 0 <= nx < w and pode[ny, nx] and not vis[ny, nx]:
                vis[ny, nx] = True; q.append((ny, nx))
    t = (lum / 255.0)[..., None]
    novo = a.copy(); mix = np.array(CORES[cor], float) * (1 - t) + 255 * t
    novo[vis] = mix[vis]
    return novo


g4 = glifo(f'{ORIG}/VERMELHO/Vermelho (4).png')
g6 = glifo(f'{ORIG}/VERMELHO/Vermelho (6).png')
c4 = ['vermelho', 'azul', 'verde', 'amarelo']
c6 = c4 + ['roxo', 'rosa']
bases = {
    'mais4': (mais_n(4, g4), c4), 'mais6': (mais_n(6, g6), c6),
    'coringa4': (coringa_n(4), c4), 'coringa6': (coringa_n(6), c6),
    'ctrl': (carregar(f'{AJUST}/CORINGA/CTRL-C + CTRL-V.png'), ['rosa']),
}
for k, (a, cores) in bases.items():
    if k != 'ctrl': salvar(a, f'{SAIDA}/CORINGA/{k}.png', f'{WEB}/{k}.webp')
    prot = None
    if k.startswith('mais'):
        prot = np.zeros(a.shape[:2], bool)
        for _, x, y in LAYOUT[int(k[4:])]: prot[y - OUTLINE - 1:y + MINI[1] + OUTLINE + 1, x - OUTLINE - 1:x + MINI[0] + OUTLINE + 1] = True
    for cor in cores: salvar(pintar_fundo(a, cor, prot), None, f'{WEB}/{k}-{cor}.webp')
print('ok')
