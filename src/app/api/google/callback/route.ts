import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get('code');
  const error = request.nextUrl.searchParams.get('error');

  if (error) {
    return NextResponse.redirect(`/gestor?error=${error}`);
  }

  if (!code) {
    return NextResponse.redirect('/gestor?error=no_code');
  }

  try {
    // Intercambiar código por tokens
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        code,
        client_id: process.env.GOOGLE_CLIENT_ID || '',
        client_secret: process.env.GOOGLE_CLIENT_SECRET || '',
        redirect_uri: process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3000/api/google/callback',
        grant_type: 'authorization_code',
      }),
    });

    const tokens = await tokenResponse.json();

    if (!tokenResponse.ok) {
      return NextResponse.redirect(`/gestor?error=token_exchange_failed`);
    }

    // Obtener info de usuario
    const userResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: {
        Authorization: `Bearer ${tokens.access_token}`,
      },
    });

    const user = await userResponse.json();

    // Guardar credenciales en Supabase
    const { error: saveError } = await supabase
      .from('google_config')
      .upsert({
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token || null,
        email: user.email,
      }, {
        onConflict: 'email',
      });

    if (saveError) {
      return NextResponse.redirect(`/gestor?error=save_failed`);
    }

    // Guardar email en localStorage del cliente
    const response = NextResponse.redirect('/gestor?google_connected=true');
    response.cookies.set('google_email', user.email, { maxAge: 3600 * 24 * 365 });

    return response;
  } catch (error) {
    console.error('OAuth error:', error);
    return NextResponse.redirect(`/gestor?error=internal_error`);
  }
}
