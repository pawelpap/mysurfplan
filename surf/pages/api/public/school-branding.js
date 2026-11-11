import { sql } from '../../../lib/db';
import { publicSchoolBranding } from '../../../lib/school-branding-server.mjs';
export default async function handler(req,res) {
  res.setHeader('Cache-Control','no-store');
  if(req.method!=='GET'){res.setHeader('Allow','GET');return res.status(405).json({ok:false,error:'branding.unavailable'});}
  try {
    const data=await publicSchoolBranding(sql,req.query.school);
    return data?res.json({ok:true,data}):res.status(404).json({ok:false,error:'branding.notPublished'});
  }catch{return res.status(503).json({ok:false,error:'branding.unavailable'});}
}
