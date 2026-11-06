import { NextRequest, NextResponse } from 'next/server';
import { requireAuthenticatedUser } from '@/lib/server/supabase';
function token(request:NextRequest){const value=request.headers.get('authorization');return value?.startsWith('Bearer ')?value.slice(7):'';}
export async function GET(request:NextRequest){try{const accessToken=token(request);if(!accessToken)return NextResponse.json({error:'Unauthorized'},{status:401});const{client}=await requireAuthenticatedUser(accessToken);const{data,error}=await client.rpc('get_my_loans_workspace');if(error)return NextResponse.json({error:error.message},{status:403});return NextResponse.json(data||{loans:[],applications:[]});}catch{return NextResponse.json({error:'Unable to load loans'},{status:500});}}
