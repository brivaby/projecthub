import { z } from "zod";
import { HttpError } from "./http-error";
export const emailInput = z.string().trim().toLowerCase().email().max(254);
export const passwordInput = z
  .string()
  .min(12, "Use at least 12 characters")
  .max(128);
export const codeInput = z
  .string()
  .regex(/^\d{6}$/, "Enter exactly six numeric digits");
export async function accountJson(request: Request) {
  if (!request.body) throw new HttpError(422, "A request body is required");
  const reader = request.body.getReader();
  let size = 0;
  const chunks: Uint8Array[] = [];
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > 16384) {
      await reader.cancel();
      throw new HttpError(413, "Request too large");
    }
    chunks.push(value);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw new HttpError(422, "Invalid JSON request");
  }
}
