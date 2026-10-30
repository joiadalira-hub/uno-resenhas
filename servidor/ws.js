// WebSocket mínimo (RFC 6455) sem dependências: só o que o jogo precisa (mensagens de texto JSON)
import { createHash } from 'node:crypto';
import { EventEmitter } from 'node:events';

const GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';
const LIMITE = 1024 * 1024; // 1 MB por mensagem (a foto do avatar cabe folgado)

export function aceitarUpgrade(req, socket) {
  const chave = req.headers['sec-websocket-key'];
  if (!chave || (req.headers.upgrade || '').toLowerCase() !== 'websocket') { socket.destroy(); return null; }
  const aceite = createHash('sha1').update(chave + GUID).digest('base64');
  socket.write('HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\n' + `Sec-WebSocket-Accept: ${aceite}\r\n\r\n`);
  socket.setNoDelay(true);
  return new Conexao(socket);
}

class Conexao extends EventEmitter {
  constructor(socket) {
    super();
    this.socket = socket;
    this.buffer = Buffer.alloc(0);
    this.partes = [];
    this.aberta = true;
    socket.on('data', (d) => this.receber(d));
    socket.on('close', () => this.fechou());
    socket.on('error', () => this.fechou());
  }
  fechou() { if (this.aberta) { this.aberta = false; this.emit('close'); } }
  receber(dados) {
    this.buffer = Buffer.concat([this.buffer, dados]);
    while (this.buffer.length >= 2) {
      const b0 = this.buffer[0], b1 = this.buffer[1];
      const fim = (b0 & 0x80) !== 0, op = b0 & 0x0f, mascarado = (b1 & 0x80) !== 0;
      let tam = b1 & 0x7f, pos = 2;
      if (tam === 126) { if (this.buffer.length < 4) return; tam = this.buffer.readUInt16BE(2); pos = 4; }
      else if (tam === 127) { if (this.buffer.length < 10) return; tam = Number(this.buffer.readBigUInt64BE(2)); pos = 10; }
      if (tam > LIMITE) { this.fechar(); return; }
      const mascara = mascarado ? this.buffer.subarray(pos, pos + 4) : null;
      if (mascarado) pos += 4;
      if (this.buffer.length < pos + tam) return;
      let carga = Buffer.from(this.buffer.subarray(pos, pos + tam));
      this.buffer = this.buffer.subarray(pos + tam);
      if (mascara) for (let i = 0; i < carga.length; i++) carga[i] ^= mascara[i & 3];
      if (op === 0x8) { this.fechar(); return; }
      if (op === 0x9) { this.enviarQuadro(0xA, carga); continue; }
      if (op === 0xA) continue;
      if (op === 0x1 || op === 0x0) {
        this.partes.push(carga);
        if (fim) {
          const texto = Buffer.concat(this.partes).toString('utf8');
          this.partes = [];
          let msg;
          try { msg = JSON.parse(texto); } catch { continue; }
          this.emit('mensagem', msg);
        }
      }
    }
  }
  enviarQuadro(op, carga) {
    if (!this.aberta) return;
    const n = carga.length;
    let cab;
    if (n < 126) { cab = Buffer.from([0x80 | op, n]); }
    else if (n < 65536) { cab = Buffer.alloc(4); cab[0] = 0x80 | op; cab[1] = 126; cab.writeUInt16BE(n, 2); }
    else { cab = Buffer.alloc(10); cab[0] = 0x80 | op; cab[1] = 127; cab.writeBigUInt64BE(BigInt(n), 2); }
    try { this.socket.write(Buffer.concat([cab, carga])); } catch { this.fechou(); }
  }
  enviar(obj) { this.enviarQuadro(0x1, Buffer.from(JSON.stringify(obj), 'utf8')); }
  fechar() { try { this.enviarQuadro(0x8, Buffer.alloc(0)); this.socket.end(); } catch { /* já fechada */ } this.fechou(); }
}
