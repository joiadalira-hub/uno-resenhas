# Uno Resenhas

Jogo de cartas com 5 cores, +5, Ctrl+C Ctrl+V, combos, Zero (Trocar/Espiar), Regra do 9 e salas online.

## Pastas
- `motor/` — as regras do jogo (cartas, jogadas, combos, pontuação, bots). Usado no navegador e no servidor.
- `servidor/` — o servidor online: entrega o site e cuida das salas em tempo real (sem dependências).
- `web/` — a interface (`pagina.html`, `app.js`), as cartas (`cartas/`), os sons (`sons/`) e o ícone do app (`publico/`).
- `build.mjs` — junta tudo em `dist/` (o site pronto).
- `testes/` — testes automáticos das regras (`npm test`).
- `ferramentas/criar_sons.py` — gera os sons criados para o jogo.

## Jogar no computador (treino contra bots)
Abra `dist/index.html` no Chrome.

## Rodar o servidor no computador
Precisa do Node.js 20 ou mais novo.

    npm run build
    npm start

Depois abra http://localhost:3000

## Publicar no Render (grátis)
1. Coloque esta pasta num repositório do GitHub.
2. No Render: New → Blueprint → escolha o repositório. Ele lê o `render.yaml` sozinho.
3. Em alguns minutos o jogo fica em https://uno-resenhas.onrender.com (ou o nome que o Render der).

No plano grátis o servidor dorme depois de 15 minutos sem ninguém jogando; a primeira pessoa a abrir
o link espera cerca de 1 minuto para ele acordar. Durante a partida ele fica ligado.
