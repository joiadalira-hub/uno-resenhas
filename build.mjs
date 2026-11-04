// Junta o motor e a interface numa página só: dist/index.html (+ dist/cartas/)
import { readFileSync, writeFileSync, mkdirSync, cpSync } from 'node:fs';
const limpar = (f) => readFileSync(f, 'utf8')
  .replace(/^import .*$/gm, '')
  .replace(/^export \{[^}]*\};?$/gm, '')
  .replace(/^export (const|function|class|let) /gm, '$1 ');
const motor = ['motor/cartas.js', 'motor/regras.js', 'motor/bot.js'].map(limpar).join('\n');
import { createHash } from 'node:crypto';
const base = readFileSync('web/pagina.html', 'utf8')
  .replace('/*MOTOR*/', () => motor)
  .replace('/*APP*/', () => readFileSync('web/app.js', 'utf8'));
// versão da página (o servidor avisa quem está com a versão antiga aberta)
const versao = createHash('sha1').update(base).digest('hex').slice(0, 10);
const pagina = base.replace('__VERSAO__', versao);
mkdirSync('dist', { recursive: true });
writeFileSync('dist/index.html', pagina);
cpSync('web/cartas', 'dist/cartas', { recursive: true });
cpSync('web/cartas-min', 'dist/cartas-min', { recursive: true });
cpSync('web/sons', 'dist/sons', { recursive: true });
cpSync('web/publico', 'dist', { recursive: true });
console.log('dist/index.html', pagina.length, 'bytes', 'versão', versao);
