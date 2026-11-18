import { inflateRawSync } from "node:zlib";
export type ArchiveLimits = {
  maxEntries: number;
  maxExpandedBytes: number;
  maxRatio: number;
};
const defaultLimits: ArchiveLimits = {
  maxEntries: 1000,
  maxExpandedBytes: 100 * 1024 * 1024,
  maxRatio: 100,
};
const forbidden =
  /\.(?:exe|dll|com|bat|cmd|ps1|sh|msi|scr|vbs|jar|zip|7z|rar|gz|bz2|xz|tar|app)$/i;
/** Inspect and decompress each ZIP member under a bounded budget without writing or extracting any file. ZIP64, encryption, symlinks and nested archives are rejected. */
export function inspectZip(bytes: Buffer, limits: Partial<ArchiveLimits> = {}) {
  const config = { ...defaultLimits, ...limits };
  let end = -1;
  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 65557); i--) {
    if (
      bytes.readUInt32LE(i) === 0x06054b50 &&
      i + 22 + bytes.readUInt16LE(i + 20) === bytes.length
    ) {
      end = i;
      break;
    }
  }
  if (end < 0) throw new Error("ZIP central directory is missing or malformed");
  if (bytes.readUInt16LE(end + 4) !== 0 || bytes.readUInt16LE(end + 6) !== 0)
    throw new Error("Multipart ZIP archives are not supported");
  const count = bytes.readUInt16LE(end + 10);
  const diskCount = bytes.readUInt16LE(end + 8);
  const centralSize = bytes.readUInt32LE(end + 12);
  const centralOffset = bytes.readUInt32LE(end + 16);
  if (
    count === 0xffff ||
    centralSize === 0xffffffff ||
    centralOffset === 0xffffffff
  )
    throw new Error("ZIP64 archives are not supported");
  if (
    count !== diskCount ||
    count > config.maxEntries ||
    centralOffset + centralSize > end
  )
    throw new Error("ZIP entry or directory limit exceeded");
  let cursor = centralOffset,
    total = 0;
  const names = new Set<string>();
  for (let index = 0; index < count; index++) {
    if (
      cursor + 46 > centralOffset + centralSize ||
      bytes.readUInt32LE(cursor) !== 0x02014b50
    )
      throw new Error("Invalid ZIP directory entry");
    const flags = bytes.readUInt16LE(cursor + 8),
      method = bytes.readUInt16LE(cursor + 10),
      compressed = bytes.readUInt32LE(cursor + 20),
      expanded = bytes.readUInt32LE(cursor + 24),
      nameLength = bytes.readUInt16LE(cursor + 28),
      extraLength = bytes.readUInt16LE(cursor + 30),
      commentLength = bytes.readUInt16LE(cursor + 32),
      external = bytes.readUInt32LE(cursor + 38),
      localOffset = bytes.readUInt32LE(cursor + 42);
    if (flags & 1) throw new Error("Encrypted archives cannot be scanned");
    if (method !== 0 && method !== 8)
      throw new Error("Unsupported ZIP compression");
    if (
      cursor + 46 + nameLength + extraLength + commentLength >
      centralOffset + centralSize
    )
      throw new Error("Invalid ZIP metadata lengths");
    const nameBytes = bytes.subarray(cursor + 46, cursor + 46 + nameLength);
    let name: string;
    try {
      name = new TextDecoder("utf-8", { fatal: true }).decode(nameBytes);
    } catch {
      throw new Error("ZIP filenames must be valid UTF-8");
    }
    if (
      !name ||
      name.length > 500 ||
      /[\x00-\x1f\x7f\\:]/.test(name) ||
      name.startsWith("/") ||
      name.split("/").some((p) => p === "." || p === "..")
    )
      throw new Error("Unsafe path in ZIP archive");
    const canonical = name.toLowerCase();
    if (names.has(canonical))
      throw new Error("Duplicate filename in ZIP archive");
    names.add(canonical);
    if (((external >>> 16) & 0xf000) === 0xa000)
      throw new Error("Symbolic links are not permitted in ZIP archives");
    if (forbidden.test(name.replace(/\/+$/, "")))
      throw new Error(
        "Executable or nested archive inside ZIP is not permitted",
      );
    let extra = cursor + 46 + nameLength;
    const extraEnd = extra + extraLength;
    while (extra + 4 <= extraEnd) {
      const tag = bytes.readUInt16LE(extra),
        length = bytes.readUInt16LE(extra + 2);
      if (extra + 4 + length > extraEnd)
        throw new Error("Malformed ZIP extra fields");
      if (tag === 0x7075 || tag === 0x0001)
        throw new Error(
          "Ambiguous Unicode paths and ZIP64 entries are not supported",
        );
      extra += 4 + length;
    }
    if (extra !== extraEnd) throw new Error("Malformed ZIP extra fields");
    if (
      expanded > config.maxExpandedBytes - total ||
      expanded / Math.max(1, compressed) > config.maxRatio
    )
      throw new Error("Archive expansion limit exceeded");
    if (
      localOffset + 30 > centralOffset ||
      bytes.readUInt32LE(localOffset) !== 0x04034b50
    )
      throw new Error("Invalid ZIP local header");
    const localNameLength = bytes.readUInt16LE(localOffset + 26),
      localExtraLength = bytes.readUInt16LE(localOffset + 28);
    const start = localOffset + 30 + localNameLength + localExtraLength;
    if (
      start + compressed > centralOffset ||
      !bytes
        .subarray(localOffset + 30, localOffset + 30 + localNameLength)
        .equals(nameBytes)
    )
      throw new Error("ZIP local path or data does not match directory");
    const packed = bytes.subarray(start, start + compressed);
    let actual: number;
    try {
      actual =
        method === 0
          ? packed.length
          : inflateRawSync(packed, {
              maxOutputLength: Math.max(
                1,
                Math.min(config.maxExpandedBytes - total, expanded + 1),
              ),
            }).length;
    } catch {
      throw new Error("Invalid or oversized compressed ZIP content");
    }
    if (actual !== expanded)
      throw new Error("ZIP expanded size does not match directory");
    total += actual;
    cursor += 46 + nameLength + extraLength + commentLength;
  }
  if (cursor !== centralOffset + centralSize)
    throw new Error("Unexpected ZIP directory content");
  return { entries: count, expandedBytes: total };
}
export function storageQuota(
  currentBytes: number,
  incomingBytes: number,
  limitBytes = Number(
    process.env.PROJECT_STORAGE_LIMIT_BYTES || 250 * 1024 * 1024,
  ),
) {
  if (!Number.isSafeInteger(limitBytes) || limitBytes <= 0)
    throw new Error("Storage quota is not configured correctly");
  if (
    currentBytes < 0 ||
    incomingBytes <= 0 ||
    currentBytes + incomingBytes > limitBytes
  )
    throw new Error("Project storage quota exceeded");
  return currentBytes + incomingBytes;
}
