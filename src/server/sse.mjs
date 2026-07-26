const clients = new Set();

export function handle(req, res) {
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    "Connection": "keep-alive",
    "X-Accel-Buffering": "no",
  });

  clients.add(res);
  res.write("event: connected\ndata: {}\n\n");

  req.on("close", () => clients.delete(res));
  req.on("error", () => clients.delete(res));
}

export function broadcast(event, data) {
  const msg = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const client of clients) {
    try { client.write(msg); } catch { clients.delete(client); }
  }
}

export function getClientCount() {
  return clients.size;
}
