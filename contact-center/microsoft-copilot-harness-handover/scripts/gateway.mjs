import http from 'node:http';

export function tunnelUrl(output, port) {
  return output.match(new RegExp(`https://[a-z0-9-]+-${port}(?:\\.[a-z0-9-]+)*\\.devtunnels\\.ms\\b`, 'i'))?.[0];
}

export function gateway(relayPort) {
  const callbacks = new Set(['/api/messages', '/api/escalate']);
  const publicPages = new Set(['/health', '/privacy', '/terms']);
  return http.createServer((request, response) => {
    const pathname = new URL(request.url, 'http://localhost').pathname;
    if (request.method === 'GET' && pathname === '/') {
      response.writeHead(200, { 'Content-Type': 'text/plain' });
      response.end('Copilot Studio handover callback gateway. The support console is available only on localhost.');
      return;
    }
    if (!(request.method === 'POST' && callbacks.has(pathname)) && !(request.method === 'GET' && publicPages.has(pathname))) {
      response.writeHead(404); response.end('Not exposed through the tunnel'); return;
    }
    const upstream = http.request({
      hostname: '127.0.0.1', port: relayPort, path: request.url, method: request.method,
      headers: { ...request.headers, host: `127.0.0.1:${relayPort}` }
    }, incoming => {
      response.writeHead(incoming.statusCode, incoming.headers); incoming.pipe(response);
    });
    upstream.on('error', () => {
      if (!response.headersSent) response.writeHead(502);
      response.end('Local relay is unavailable');
    });
    request.on('aborted', () => upstream.destroy());
    request.pipe(upstream);
  });
}
