// Real ClamAV INSTREAM adapter for local development or a private scanner service.
import { createServer } from "node:http";
import { connect } from "node:net";
import { timingSafeEqual } from "node:crypto";
const token = process.env.SCAN_TOKEN;
if (!token || token.length < 24)
  throw new Error("Set SCAN_TOKEN to at least 24 random characters");
createServer(async (req, res) => {
  const supplied = req.headers.authorization || "";
  const expected = `Bearer ${token}`;
  if (
    req.method !== "POST" ||
    supplied.length !== expected.length ||
    !timingSafeEqual(Buffer.from(supplied), Buffer.from(expected))
  ) {
    res.writeHead(401).end();
    return;
  }
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const part of req) {
    size += part.length;
    if (size > 25 * 1024 * 1024) {
      res.writeHead(413).end();
      return;
    }
    chunks.push(part);
  }
  const socket = connect({
    host: process.env.CLAMAV_HOST || "127.0.0.1",
    port: 3310,
  });
  let result = "";
  socket.setTimeout(30000, () =>
    socket.destroy(new Error("Scanner timed out")),
  );
  socket.on("connect", () => {
    socket.write("zINSTREAM\0");
    for (const chunk of chunks) {
      const header = Buffer.alloc(4);
      header.writeUInt32BE(chunk.length);
      socket.write(header);
      socket.write(chunk);
    }
    socket.write(Buffer.alloc(4));
  });
  socket.on("data", (data) => {
    result += data.toString();
  });
  socket.on("end", () => {
    res
      .writeHead(200, { "Content-Type": "application/json" })
      .end(JSON.stringify({ clean: /stream: OK\0?$/.test(result) }));
  });
  socket.on("error", () => {
    if (!res.headersSent) res.writeHead(503);
    res.end();
  });
}).listen(Number(process.env.SCAN_PORT || 3311), "127.0.0.1", () =>
  console.log("ClamAV adapter listening on 127.0.0.1:3311"),
);
