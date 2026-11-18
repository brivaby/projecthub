import { db } from '@/lib/db';
import { admin,endpoint,sameOrigin,limit } from '@/lib/security';
import { settingInput } from '@/lib/platform-settings';
export const GET=endpoint(async()=>{await admin();return Response.json(await db.platformSetting.findMany(),{headers:{'Cache-Control':'private, no-store'}});});
export const POST=endpoint(async r=>{sameOrigin(r);const user=await admin();await limit(`settings:${user.id}`,20,3600);const v=settingInput.parse(await r.json());await db.$transaction([db.platformSetting.upsert({where:{key:v.key},create:v,update:{value:v.value}}),db.auditLog.create({data:{actorId:user.id,action:'PLATFORM_SETTING_CHANGED',targetId:v.key}})]);return Response.json({ok:true});});
