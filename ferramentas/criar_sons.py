# Gera os sons do Uno Resenhas que não vieram prontos (síntese simples, estilo jogo de cartas)
import numpy as np, subprocess, os, sys
R = 44100
OUT = sys.argv[1]
def t(d): return np.arange(int(R * d)) / R
def env(n, a=0.005, r=0.1, s=1.0):
    e = np.ones(n) * s
    na, nr = int(R * a), int(R * r)
    if na: e[:na] = np.linspace(0, s, na)
    if nr: e[-nr:] *= np.linspace(1, 0, nr) ** 2
    return e
def tom(freq, d, forma='sin', a=0.005, r=0.1, vib=0):
    x = t(d)
    f = freq(x) if callable(freq) else np.full_like(x, freq)
    if vib: f = f * (1 + 0.02 * np.sin(2 * np.pi * vib * x))
    fase = 2 * np.pi * np.cumsum(f) / R
    if forma == 'sin': y = np.sin(fase)
    elif forma == 'tri': y = 2 / np.pi * np.arcsin(np.sin(fase))
    elif forma == 'saw': y = sum(np.sin(k * fase) / k for k in range(1, 9)) * 0.6
    elif forma == 'sq': y = sum(np.sin(k * fase) / k for k in range(1, 12, 2)) * 0.8
    return y * env(len(x), a, r)
def ruido(d, a=0.005, r=0.1, passa=None):
    y = np.random.default_rng(7).standard_normal(int(R * d))
    if passa:  # filtro simples (média móvel) para tirar o chiado
        k = np.ones(passa) / passa; y = np.convolve(y, k, 'same')
    return y * env(len(y), a, r)
def junta(*partes):
    n = max(int(R * o) + len(p) for o, p in partes)
    y = np.zeros(n)
    for o, p in partes: i = int(R * o); y[i:i + len(p)] += p
    return y
def soma(*arrs):
    n = max(len(a) for a in arrs); y = np.zeros(n)
    for a in arrs: y[:len(a)] += a
    return y
def salva(nome, y, pico=-5.0):
    y = y / (np.max(np.abs(y)) + 1e-9) * 10 ** (pico / 20)
    wav = f'/tmp/{nome}.wav'
    import wave
    with wave.open(wav, 'w') as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(R)
        w.writeframes((y * 32767).astype('<i2').tobytes())
    subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', wav, '-ac', '1', '-b:a', '80k', f'{OUT}/{nome}.mp3'], check=True)
    os.remove(wav)
nota = lambda n: 440 * 2 ** ((n - 69) / 12)  # número MIDI -> Hz

# Pular: "boing" que sobe e desce
salva('pular', tom(lambda x: 220 + 520 * np.sin(np.pi * np.minimum(x / 0.42, 1)), 0.45, 'tri', r=0.12, vib=18) + 0.3 * tom(lambda x: 440 + 1040 * np.sin(np.pi * np.minimum(x / 0.42, 1)), 0.45, 'sin', r=0.12))
# +2 / +5: ataque — "uóóóm" descendo, metálico
salva('ataque', junta((0, tom(lambda x: 330 - 180 * x / 0.6, 0.6, 'saw', a=0.01, r=0.25, vib=7)), (0, 0.5 * tom(lambda x: 165 - 90 * x / 0.6, 0.6, 'sq', a=0.01, r=0.25)), (0, 0.25 * ruido(0.12, r=0.1, passa=6))))
# Coringa pintando: arpejo mágico subindo + brilho
arp = [nota(n) for n in (72, 76, 79, 84, 88, 91)]
salva('coringa', junta(*[(i * 0.055, soma(0.7 * tom(f, 0.35, 'sin', r=0.25), 0.25 * tom(f * 2, 0.25, 'sin', r=0.2))) for i, f in enumerate(arp)], (0.25, 0.15 * ruido(0.4, a=0.05, r=0.3, passa=2))), pico=-7)
# Ctrl+C Ctrl+V: dois cliques de teclado + "blip" digital de copiar
clique = lambda: ruido(0.03, a=0.001, r=0.025, passa=3) + 0.4 * tom(2400, 0.03, 'sq', a=0.001, r=0.02)
salva('ctrl', junta((0, clique()), (0.11, clique()), (0.22, 0.6 * tom(lambda x: 880 + 1200 * x / 0.12, 0.12, 'sq', a=0.002, r=0.05)), (0.34, 0.6 * tom(1760, 0.16, 'sq', a=0.002, r=0.12))), pico=-8)
# Zero — Trocar mãos: "fuuush" de ida e volta
sw = lambda d, f0, f1: tom(lambda x: f0 + (f1 - f0) * x / d, d, 'sin', a=0.03, r=0.15)
salva('trocar', junta((0, 0.5 * ruido(0.55, a=0.15, r=0.25, passa=4)), (0, 0.6 * sw(0.28, 300, 900)), (0.27, 0.6 * sw(0.28, 900, 300))), pico=-8)
# Zero — Espiar: dois tons misteriosos
salva('espiar', junta((0, tom(nota(62), 0.35, 'tri', a=0.04, r=0.2, vib=6)), (0.28, tom(nota(66), 0.45, 'tri', a=0.04, r=0.3, vib=6))), pico=-9)
# Regra do 9: alarme (abre o botão) e o "toc" de apertar
salva('nove', junta((0, tom(988, 0.12, 'sq', a=0.002, r=0.03)), (0.16, tom(988, 0.12, 'sq', a=0.002, r=0.03)), (0.32, tom(1318, 0.18, 'sq', a=0.002, r=0.08))), pico=-10)
salva('apertou', junta((0, tom(lambda x: 600 - 300 * x / 0.08, 0.08, 'sin', a=0.001, r=0.05)), (0, 0.3 * ruido(0.02, a=0.001, r=0.015))), pico=-8)
# "Última!": plim-plim brilhante
salva('ultima', junta((0, soma(tom(nota(84), 0.25, 'sin', r=0.2), 0.3 * tom(nota(96), 0.2, 'sin', r=0.15))), (0.13, soma(tom(nota(88), 0.4, 'sin', r=0.3), 0.3 * tom(nota(100), 0.3, 'sin', r=0.25)))), pico=-7)
# "Pegou!": trombone triste descendo
salva('pegou', junta(*[(i * 0.2, tom(nota(n), 0.24 if i < 3 else 0.6, 'saw', a=0.02, r=0.1 if i < 3 else 0.4, vib=0 if i < 3 else 6)) for i, n in enumerate((58, 57, 56, 55))]), pico=-8)
# Sua vez: sininho suave
salva('sua-vez', junta((0, tom(nota(79), 0.5, 'sin', r=0.4)), (0.08, 0.6 * tom(nota(86), 0.45, 'sin', r=0.35))), pico=-12)
# Relógio acabando: tique curto
salva('tique', tom(1500, 0.05, 'sq', a=0.001, r=0.04), pico=-16)
# Jogada inválida
salva('erro', junta((0, tom(150, 0.1, 'sq', a=0.002, r=0.03)), (0.12, tom(120, 0.16, 'sq', a=0.002, r=0.08))), pico=-12)
# Vitória na rodada: fanfarra curta
fan = [(0, 72, 0.14), (0.14, 76, 0.14), (0.28, 79, 0.14), (0.42, 84, 0.7)]
salva('vitoria', junta(*[(o, tom(nota(n), d, 'saw', a=0.01, r=0.12 if d < 0.5 else 0.45) + 0.5 * tom(nota(n - 12), d, 'sq', a=0.01, r=0.12 if d < 0.5 else 0.45)) for o, n, d in fan], (0.42, 0.4 * tom(nota(88), 0.7, 'sin', r=0.45)), (0.42, 0.3 * tom(nota(91), 0.7, 'sin', r=0.45))), pico=-5)
# Vitória na partida: fanfarra maior + "aplausos"
fan2 = [(0, 67, 0.16), (0.16, 72, 0.16), (0.32, 76, 0.16), (0.48, 79, 0.3), (0.82, 76, 0.16), (0.98, 79, 0.16), (1.14, 84, 1.3)]
aplauso = ruido(2.6, a=0.3, r=1.2, passa=3) * (0.6 + 0.4 * np.abs(np.sin(2 * np.pi * 9 * t(2.6))))
salva('vitoria-partida', junta(*[(o, tom(nota(n), d, 'saw', a=0.01, r=0.12 if d < 0.5 else 0.8) + 0.5 * tom(nota(n - 12), d, 'sq', a=0.01, r=0.12 if d < 0.5 else 0.8)) for o, n, d in fan2], (1.14, 0.4 * tom(nota(88), 1.3, 'sin', r=0.8)), (1.14, 0.3 * tom(nota(91), 1.3, 'sin', r=0.8)), (0.9, 0.18 * aplauso)), pico=-4)
# Alguém outro venceu: "ôôô" descendo
salva('derrota', junta(*[(i * 0.28, tom(nota(n), 0.3 if i < 2 else 0.9, 'tri', a=0.02, r=0.15 if i < 2 else 0.6, vib=0 if i < 2 else 5)) for i, n in enumerate((67, 63, 60))]), pico=-8)
print('ok')
