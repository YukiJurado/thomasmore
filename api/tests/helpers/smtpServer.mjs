import net from 'node:net';

// Minimal local SMTP receiver: tests the real Nodemailer SMTP transport without outside services.
export async function startSmtpCapture() {
  const messages = [];
  const sockets = new Set();
  const server = net.createServer((socket) => {
    sockets.add(socket);
    socket.on('close', () => sockets.delete(socket));
    socket.setEncoding('utf8');
    socket.write('220 localhost test SMTP\r\n');
    let buffer = '';
    let collecting = false;
    let message = '';
    function handleLine(line) {
      if (collecting) {
        if (line !== '.') { message += line + '\n'; return; }
        messages.push(message);
        collecting = false;
        socket.write('250 Message accepted\r\n');
        return;
      }
      if (line === 'DATA') {
        collecting = true; message = '';
        socket.write('354 End with a dot\r\n');
      } else if (line === 'QUIT') {
        socket.end('221 Goodbye\r\n');
      } else {
        socket.write('250 OK\r\n');
      }
    }
    socket.on('data', (chunk) => {
      buffer += chunk;
      let end;
      while ((end = buffer.indexOf('\r\n')) !== -1) {
        const line = buffer.slice(0, end);
        buffer = buffer.slice(end + 2);
        handleLine(line);
      }
    });
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  return {
    messages, smtpUrl: `smtp://127.0.0.1:${server.address().port}`,
    async close() {
      for (const socket of sockets) socket.destroy();
      await new Promise((resolve) => server.close(resolve));
    }
  };
}
