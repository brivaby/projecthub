import { db } from '@/lib/db';
import { actor, endpoint, sameOrigin, limit, HttpError } from '@/lib/security';
import { projectInput } from '@/lib/validation';
import { projectWrite } from '@/lib/project-write';
import { discover } from '@/lib/projects';
import { auth } from '@/auth';
export const GET=endpoint(async r=>{const session=await auth();return Response.json(await discover(Object.fromEntries(new URL(r.url).searchParams),[],session?.user?.id));});
export const POST=endpoint(async r=>{sameOrigin(r);const user=await actor();await limit(`publish:${user.id}`,10,3600);const v=projectInput.parse(await r.json());const project=await db.$transaction(async tx=>{
 if(v.originalId){const approved=await tx.request.findFirst({where:{projectId:v.originalId,userId:user.id,type:'CLONE',status:{in:['ACCEPTED','COMPLETED']}}});if(!approved)throw new HttpError(403,'An approved clone request is required');}
 const data=await projectWrite(tx,user,v);const p=await tx.project.create({data:{...data,ownerId:user.id,owners:{create:{userId:user.id}},activity:{create:{actorId:user.id,kind:'PROJECT_CREATED',public:false}}}});await tx.auditLog.create({data:{actorId:user.id,action:'PROJECT_CREATED',targetId:p.id}});return p;});return Response.json({id:project.id},{status:201});});
