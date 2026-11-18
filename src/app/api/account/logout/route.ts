import { endpoint, sameOrigin } from "@/lib/security";
import { endSession } from "@/lib/session";
export const POST = endpoint(async (r) => {
  sameOrigin(r);
  await endSession();
  return Response.json({ ok: true });
});
