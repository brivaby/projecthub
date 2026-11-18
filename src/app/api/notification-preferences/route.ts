import { db } from '@/lib/db';
import { actor,endpoint,sameOrigin,limit } from '@/lib/security';
import { notificationKinds } from '@/lib/platform-settings';
import { z } from 'zod';
export const GET=endpoint(async()=>{const user=await actor();return Response.json(await db.notificationPreference.findMany({where:{userId:user.id}}),{headers:{'Cache-Control':'private, no-store'}});});
export const PATCH=endpoint(async r=>{sameOrigin(r);const user=await actor();await limit(`notification-prefs:${user.id}`);const v=z.object({kind:z.enum(notificationKinds),email:z.boolean(),inApp:z.boolean()}).parse(await r.json());await db.notificationPreference.upsert({where:{userId_kind:{userId:user.id,kind:v.kind}},create:{userId:user.id,...v},update:{email:v.email,inApp:v.inApp}});return Response.json({ok:true});});
