import type { Prisma } from '@prisma/client';
import { canManageProject,assertWorkspaceAccess } from './project-access';
import { verifiedVic } from './eligibility';
import { HttpError } from './http-error';
/** Lock order shared with ownership and collaboration mutations: Project, then User. */
export async function lockedProject(tx:Prisma.TransactionClient,userId:string,projectId:string,scope:'OWNER'|'UPLOAD'='OWNER'){
 await tx.$queryRaw`SELECT id FROM "Project" WHERE id=${projectId} FOR UPDATE`;
 await tx.$queryRaw`SELECT id FROM "User" WHERE id=${userId} FOR UPDATE`;
 const [user,project]=await Promise.all([tx.user.findUnique({where:{id:userId}}),tx.project.findUnique({where:{id:projectId}})]);
 if(!user||user.suspended||user.deletedAt||!user.emailVerified)throw new HttpError(403,'Account unavailable');
 if(!project)throw new HttpError(404,'Project not found');
 const owner=await canManageProject(user,project,tx);
 if(scope==='OWNER'&&!owner)throw new HttpError(403,'Project ownership required');
 if(scope==='UPLOAD'){
  if(!verifiedVic(user))throw new HttpError(403,'Only verified Vine Iternational Christian Academy accounts may upload project files');
  if(project.deletedAt||project.archived||['SUSPENDED','REMOVED','DELETED'].includes(project.status))throw new HttpError(409,'Project unavailable for uploads');
  if(!owner){await assertWorkspaceAccess(user,project,tx);const member=await tx.collaborator.findUnique({where:{projectId_userId:{projectId,userId}}});if(!member||!['CONTRIBUTOR','EDITOR','MANAGER'].includes(member.permission))throw new HttpError(403,'Contributor access is required');}
 }
 return {user,project};
}
