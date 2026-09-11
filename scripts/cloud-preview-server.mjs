// ローカル画面検証専用。実メールを送らず、認証だけを代替して実PostgreSQLへ接続する。
// 本番アプリから参照せず、localhostの検証DB以外では起動しない。
import http from 'node:http';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { randomUUID } from 'node:crypto';
const run=promisify(execFile);
const database=process.env.DATABASE_TEST_URL;
if(!database||!/^postgresql:\/\/postgres@127\.0\.0\.1:\d+\/score_cloud_test$/.test(database))throw new Error('Disposable localhost test database required');
const quote=value=>"'"+String(value).replaceAll("'","''")+"'";
const sessions=new Map();
async function sql(query,user) {const prefix=user?`set role authenticated; set request.jwt.claim.sub=${quote(user)};`:'';const {stdout}=await run('psql',[database,'-X','-A','-t','-q','-v','ON_ERROR_STOP=1','-c',prefix+query]);return stdout.trim();}
const columns={score_teams:['id','name'],score_memberships:['team_id','user_id','role','display_name'],score_books:['data','revision','team_id'],score_invites:['id','team_id','email','role','expires_at','used_at','revoked_at']};
const rpcArgs={score_create_team:['p_name','p_display_name'],score_save_book:['p_team','p_revision','p_data','p_write_id'],score_create_invite:['p_team','p_email','p_role'],score_accept_invite:['p_token','p_display_name'],score_revoke_invite:['p_team','p_id'],score_set_role:['p_team','p_user','p_role']};
http.createServer(async(req,res)=>{res.setHeader('Access-Control-Allow-Origin','http://localhost:3004');res.setHeader('Access-Control-Allow-Headers','*');res.setHeader('Access-Control-Allow-Methods','GET,POST,OPTIONS');res.setHeader('Content-Type','application/json');if(req.method==='OPTIONS'){res.end();return;}
  try{const url=new URL(req.url,'http://localhost');let text='';for await(const chunk of req)text+=chunk;const body=text?JSON.parse(text):{};let session=sessions.get((req.headers.authorization??'').replace('Bearer ',''));
    if(url.pathname==='/auth/v1/otp'){res.end('{}');return;}
    if(url.pathname==='/auth/v1/verify'){
      if(body.token!=='123456'||!String(body.email).endsWith('@example.test'))throw new Error('Invalid test credentials');
      const email=String(body.email).toLowerCase();let id=await sql(`select id from auth.users where email=${quote(email)}`);if(!id){id=randomUUID();await sql(`insert into auth.users values(${quote(id)},${quote(email)},now())`);}
      const user={id,email,aud:'authenticated',role:'authenticated',email_confirmed_at:new Date().toISOString(),app_metadata:{provider:'email'},user_metadata:{}};
      const exp=Math.floor(Date.now()/1000)+3600;const token=Buffer.from(JSON.stringify({alg:'HS256',typ:'JWT'})).toString('base64url')+'.'+Buffer.from(JSON.stringify({sub:id,exp,email,role:'authenticated'})).toString('base64url')+'.localpreview';
      session={access_token:token,refresh_token:randomUUID(),token_type:'bearer',expires_in:3600,expires_at:exp,user};sessions.set(token,session);res.end(JSON.stringify(session));return;
    }
    if(!session){res.statusCode=401;res.end(JSON.stringify({message:'AUTH_REQUIRED'}));return;}
    if(url.pathname==='/auth/v1/user'){res.end(JSON.stringify(session.user));return;}
    if(url.pathname==='/auth/v1/logout'){sessions.delete(session.access_token);res.end('{}');return;}
    if(url.pathname.startsWith('/rest/v1/rpc/')){const name=url.pathname.split('/').at(-1);const args=rpcArgs[name];if(!args)throw new Error('Unknown RPC');const values=args.map(key=>body[key]===null?'NULL':quote(typeof body[key]==='object'?JSON.stringify(body[key]):body[key]));const value=await sql(`select to_json(public.${name}(${values.join(',')}))`,session.user.id);res.end(value||'null');return;}
    const table=url.pathname.split('/').at(-1);const allowed=columns[table];if(!allowed)throw new Error('Unknown table');
    const selected=(url.searchParams.get('select')??'').split(',');if(selected.some(column=>!allowed.includes(column)))throw new Error('Unknown column');
    const filters=[];for(const [key,value] of url.searchParams){if(key==='select')continue;if(!allowed.includes(key)||!value.startsWith('eq.'))throw new Error('Invalid filter');filters.push(`${key}=${quote(value.slice(3))}`);}
    const rows=await sql(`select coalesce(json_agg(t),'[]'::json) from (select ${selected.join(',')} from public.${table}${filters.length?' where '+filters.join(' and '):''})t`,session.user.id);
    res.end(rows);
  }catch(error){res.statusCode=400;const message=String(error.message);res.end(JSON.stringify({message:['FORBIDDEN','REVISION_CONFLICT','LAST_ADMIN','INVALID_INVITE','INVALID_BOOK'].find(code=>message.includes(code))??'Preview request failed'}));}
}).listen(54329,'127.0.0.1',()=>console.log('Local preview API ready. Test-only OTP: 123456; use @example.test addresses.'));
