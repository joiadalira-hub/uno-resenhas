// Junta o motor e a interface numa página só: dist/index.html (+ dist/cartas/)
import { readFileSync, writeFileSync, mkdirSync, cpSync } from 'node:fs';
const limpar = (f) => readFileSync(f, 'utf8')
  .replace(/^import .*$/gm, '')
  .replace(/^export \{[^}]*\};?$/gm, '')
  .replace(/^export (const|function|class|let) /gm, '$1 ');
const motor = ['motor/cartas.js', 'motor/regras.js', 'motor/bot.js'].map(limpar).join('\n');
const pagina = readFileSync('web/pagina.html', 'utf8')
  .replace('/*MOTOR*/', () => motor)
  .replace('/*APP*/', () => readFileSync('web/app.js', 'utf8'));
mkdirSync('dist', { recursive: true });
writeFileSync('dist/index.html', pagina);
cpSync('web/cartas', 'dist/cartas', { recursive: true });
cpSync('web/cartas-min', 'dist/cartas-min', { recursive: true });
cpSync('web/sons', 'dist/sons', { recursive: true });
cpSync('web/publico', 'dist', { recursive: true });
console.log('dist/index.html', pagina.length, 'bytes');
