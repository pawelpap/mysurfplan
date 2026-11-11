import{sql}from'../../../lib/db';import{requireAuth,authenticatedSessionHash}from'../../../lib/auth';import{schoolPilotHandler}from'../../../lib/school-pilot-server.mjs';
export const config={api:{bodyParser:{sizeLimit:'3kb'}}};
export default schoolPilotHandler({sql,requireAuth,getSessionHash:authenticatedSessionHash});
