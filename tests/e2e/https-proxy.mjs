import { readFileSync } from "node:fs";
import { request } from "node:http";
import { createServer } from "node:https";

// The production application sets Secure cookies. Use TLS for browser journeys.
const server = createServer({
  key: readFileSync(process.env.PROJECTHUB_TEST_TLS_KEY),
  cert: readFileSync(process.env.PROJECTHUB_TEST_TLS_CERT),
}, (incoming, outgoing) => {
  const upstream = request({
    hostname: "127.0.0.1",
    port: 3000,
    method: incoming.method,
    path: incoming.url,
    headers: {
      ...incoming.headers,
      "x-forwarded-proto": "https",
      "x-forwarded-host": incoming.headers.host,
    },
  }, (response) => {
    outgoing.writeHead(response.statusCode, response.headers);
    response.pipe(outgoing);
  });
  upstream.on("error", () => {
    outgoing.writeHead(502);
    outgoing.end();
  });
  outgoing.on("close", () => upstream.destroy());
  incoming.pipe(upstream);
});

server.listen(3443, "127.0.0.1");
