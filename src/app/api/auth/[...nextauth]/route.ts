// Legacy Auth.js paths intentionally grant no sessions. Password flows use /api/account.
export async function GET(){return Response.json({error:{code:'NOT_FOUND',message:'Use the account sign-in form'}},{status:404});}
export const POST=GET;
