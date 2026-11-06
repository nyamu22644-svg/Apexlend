import { NextRequest,NextResponse } from 'next/server';
import { requireAuthenticatedUser } from '@/lib/server/supabase';
const token=(r:NextRequest)=>{const v=r.headers.get('authorization');return v?.startsWith('Bearer ')?v.slice(7):''};
export async function GET(r:NextRequest){try{const t=token(r);if(!t)return NextResponse.json({error:'Unauthorized'},{status:401});const{client}=await requireAuthenticatedUser(t);const{data,error}=await client.rpc('get_my_customer_portal_branding');if(error)return NextResponse.json({error:error.message},{status:403});return NextResponse.json({branding:data||{}})}catch{return NextResponse.json({error:'Unable to load payment instructions'},{status:500})}}
