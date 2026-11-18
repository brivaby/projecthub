import { actor, endpoint } from "@/lib/security";
import { recommendations } from "@/lib/recommendations";
export const GET = endpoint(async () => {
  const u = await actor();
  return Response.json(await recommendations(u.id), {
    headers: { "Cache-Control": "private, no-store" },
  });
});
