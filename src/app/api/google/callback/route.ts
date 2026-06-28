import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get('code');
  const error = request.nextUrl.searchParams.get('error');

  const getBaseUrl = () => {
    if (process.env.VERCEL_URL) {
      return `https://${process.env.VERCEL_URL}`;
    }
    return 'http://localhost:3000';
  };

  const baseUrl = getBaseUrl();

  if (error) {
    return NextResponse.redirect(new URL(`/gestor?error=${error}`, baseUrl));
  }

  if (!code) {
    return NextResponse.redirect(new URL('/gestor?error=no_code', baseUrl));
  }

  try {
    console.log('1. Starting OAuth callback with code:', code.substring(0, 20) + '...');

    // Intercambiar código por tokens
    console.log('2. Exchanging code for tokens...');
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

    console.log('3. Token response status:', tokenResponse.status);
    const tokens = await tokenResponse.json();
    console.log('4. Tokens received:', tokens.access_token ? '✓' : '✗');

    if (!tokenResponse.ok) {
      console.error('Token exchange failed:', tokens);
      return NextResponse.redirect(new URL('/gestor?error=token_exchange_failed', baseUrl));
    }

    // Obtener info de usuario
    console.log('5. Fetching user info...');
    const userResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: {
        Authorization: `Bearer ${tokens.access_token}`,
      },
    });

    console.log('6. User response status:', userResponse.status);
    const user = await userResponse.json();
    console.log('7. User email:', user.email);

    if (!user.email) {
      console.error('No email in user response');
      return NextResponse.redirect(new URL('/gestor?error=no_email', baseUrl));
    }

    // Guardar credenciales en Supabase
    console.log('8. Saving to Supabase...');
    const { error: saveError, data } = await supabase
      .from('google_config')
      .upsert({
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token || null,
        email: user.email,
      });

    console.log('9. Save result - error:', saveError, 'data:', data);

    if (saveError) {
      console.error('Supabase save error:', saveError);
      return NextResponse.redirect(new URL(`/gestor?error=save_failed`, baseUrl));
    }

    console.log('10. OAuth complete, redirecting...');
    // Guardar email en cookie
    const response = NextResponse.redirect(new URL('/gestor?google_connected=true', baseUrl));
    response.cookies.set('google_email', user.email, { maxAge: 3600 * 24 * 365 });

    return response;
  } catch (error) {
    console.error('OAuth error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: String(error) },
      { status: 500 }
    );
  }
}
