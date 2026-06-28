import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  return NextResponse.json({
    GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID ? '✅ Configurado' : '❌ NO configurado',
    GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET ? '✅ Configurado' : '❌ NO configurado',
    GOOGLE_REDIRECT_URI: process.env.GOOGLE_REDIRECT_URI || '❌ NO configurado',
    NODE_ENV: process.env.NODE_ENV,
    VERCEL_ENV: process.env.VERCEL_ENV,
  });
}
