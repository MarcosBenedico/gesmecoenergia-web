import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get('code');
  const error = request.nextUrl.searchParams.get('error');

  const logs: string[] = [];
  const log = (msg: string) => {
    console.log(msg);
    logs.push(msg);
  };

  const getBaseUrl = () => {
    if (process.env.VERCEL_URL) {
      return `https://${process.env.VERCEL_URL}`;
    }
    return 'http://localhost:3000';
  };

  const baseUrl = getBaseUrl();

  try {
    log(`🔍 Iniciando callback...`);
    log(`📍 Base URL: ${baseUrl}`);

    if (error) {
      log(`❌ Error de Google: ${error}`);
      return renderResponse('ERROR', logs);
    }

    if (!code) {
      log(`❌ Sin código de autorización`);
      return renderResponse('ERROR', logs);
    }

    log(`✓ Código recibido: ${code.substring(0, 10)}...`);

    // Validar variables de entorno
    log(`\n🔐 Validando credenciales...`);
    if (!process.env.GOOGLE_CLIENT_ID) log(`❌ GOOGLE_CLIENT_ID no está configurado`);
    if (!process.env.GOOGLE_CLIENT_SECRET) log(`❌ GOOGLE_CLIENT_SECRET no está configurado`);
    if (!process.env.GOOGLE_REDIRECT_URI) log(`❌ GOOGLE_REDIRECT_URI no está configurado`);

    // Intercambiar código por tokens
    log(`\n🔄 Intercambiando código por tokens...`);
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        code,
        client_id: process.env.GOOGLE_CLIENT_ID || '',
        client_secret: process.env.GOOGLE_CLIENT_SECRET || '',
        redirect_uri: process.env.GOOGLE_REDIRECT_URI || baseUrl + '/api/google/callback',
        grant_type: 'authorization_code',
      }),
    });

    log(`Token response status: ${tokenResponse.status}`);
    const tokens = await tokenResponse.json();

    if (!tokenResponse.ok) {
      log(`❌ Error en intercambio de tokens:`);
      log(`${JSON.stringify(tokens, null, 2)}`);
      return renderResponse('ERROR', logs);
    }

    log(`✅ Tokens recibidos`);
    log(`Access token: ${tokens.access_token?.substring(0, 20)}...`);
    log(`Refresh token: ${tokens.refresh_token ? '✓' : '✗'}`);

    // Obtener info de usuario
    log(`\n👤 Obteniendo información del usuario...`);
    const userResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: {
        Authorization: `Bearer ${tokens.access_token}`,
      },
    });

    log(`User response status: ${userResponse.status}`);
    const user = await userResponse.json();
    log(`Email: ${user.email}`);

    if (!user.email) {
      log(`❌ Sin email en respuesta`);
      return renderResponse('ERROR', logs);
    }

    // Guardar en Supabase
    log(`\n💾 Guardando en Supabase...`);
    log(`Intentando actualizar registro ID=1...`);

    const { error: updateError, data: updateData, count } = await supabase
      .from('google_config')
      .update({
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token || null,
        email: user.email,
        updated_at: new Date().toISOString(),
      })
      .eq('id', 1)
      .select();

    log(`Update response - error: ${updateError ? updateError.message : 'ninguno'}`);
    log(`Update response - count: ${count}`);

    if (updateError) {
      log(`⚠️ Update fallió, intentando insertar...`);

      const { error: insertError, data: insertData } = await supabase
        .from('google_config')
        .insert({
          id: 1,
          access_token: tokens.access_token,
          refresh_token: tokens.refresh_token || null,
          email: user.email,
        })
        .select();

      log(`Insert response - error: ${insertError ? insertError.message : 'ninguno'}`);
      log(`Insert data: ${JSON.stringify(insertData)}`);

      if (insertError) {
        log(`❌ Ambas operaciones fallaron`);
        log(`Error: ${insertError.message}`);
        return renderResponse('ERROR', logs);
      }

      log(`✅ Inserción exitosa`);
    } else {
      log(`✅ Actualización exitosa`);
    }

    // Verificar que se guardó
    log(`\n🔍 Verificando que se guardó...`);
    const { data: verification, error: verifyError } = await supabase
      .from('google_config')
      .select('*')
      .eq('id', 1)
      .single();

    if (verifyError) {
      log(`❌ Error al verificar: ${verifyError.message}`);
    } else {
      log(`✅ Verificación exitosa`);
      log(`Email en DB: ${verification?.email}`);
      log(`Token guardado: ${verification?.access_token ? '✓' : '✗'}`);
    }

    log(`\n✅ ¡CONEXIÓN COMPLETADA!`);
    log(`Redirigiendo a calendario...`);

    return renderResponse('SUCCESS', logs, baseUrl);
  } catch (error) {
    log(`\n💥 ERROR CRÍTICO:`);
    log(String(error));
    return renderResponse('ERROR', logs);
  }
}

function renderResponse(status: 'SUCCESS' | 'ERROR', logs: string[], baseUrl?: string) {
  const html = `
    <!DOCTYPE html>
    <html lang="es">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Google Calendar - ${status === 'SUCCESS' ? 'Conectado' : 'Error'}</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
          background: linear-gradient(135deg, #0f0f1e 0%, #1a1a2e 50%, #16213e 100%);
          color: #fff;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 20px;
        }
        .container {
          max-width: 700px;
          width: 100%;
        }
        .card {
          background: rgba(22, 33, 62, 0.95);
          border: 1px solid #2d2d44;
          border-radius: 18px;
          padding: 40px;
          backdrop-filter: blur(20px);
        }
        .header {
          text-align: center;
          margin-bottom: 30px;
        }
        .status-icon {
          font-size: 60px;
          margin-bottom: 15px;
        }
        h1 {
          font-size: 28px;
          margin-bottom: 10px;
        }
        .subtitle {
          color: #b0b0c0;
          font-size: 16px;
        }
        .logs {
          background: rgba(15, 15, 30, 0.8);
          border: 1px solid #2d2d44;
          border-radius: 12px;
          padding: 20px;
          margin: 30px 0;
          max-height: 400px;
          overflow-y: auto;
          font-family: 'Monaco', 'Courier New', monospace;
          font-size: 13px;
          line-height: 1.6;
        }
        .log-line {
          margin: 5px 0;
          color: #00d4ff;
        }
        .log-line.error { color: #ff3333; }
        .log-line.success { color: #00ff00; }
        .buttons {
          display: flex;
          gap: 15px;
          margin-top: 30px;
        }
        button {
          flex: 1;
          padding: 12px 20px;
          border: none;
          border-radius: 10px;
          font-weight: bold;
          cursor: pointer;
          transition: all 0.3s;
          font-size: 14px;
        }
        .btn-primary {
          background: linear-gradient(135deg, #ff3333 0%, #ff6b6b 100%);
          color: white;
        }
        .btn-primary:hover {
          transform: translateY(-2px);
          box-shadow: 0 0 40px rgba(255, 51, 51, 0.3);
        }
        .btn-secondary {
          background: rgba(0, 212, 255, 0.2);
          color: #00d4ff;
          border: 1px solid #00d4ff;
        }
        .btn-secondary:hover {
          background: rgba(0, 212, 255, 0.3);
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="card">
          <div class="header">
            <div class="status-icon">${status === 'SUCCESS' ? '✅' : '❌'}</div>
            <h1>${status === 'SUCCESS' ? 'Conectado a Google Calendar' : 'Error de Conexión'}</h1>
            <p class="subtitle">
              ${status === 'SUCCESS'
                ? 'Tu Google Calendar está listo para usar'
                : 'Algo salió mal con la conexión'}
            </p>
          </div>

          <div class="logs">
            ${logs.map(log => {
              let className = '';
              if (log.includes('❌') || log.includes('Error')) className = 'error';
              if (log.includes('✅') || log.includes('exitosa')) className = 'success';
              return `<div class="log-line ${className}">${log}</div>`;
            }).join('')}
          </div>

          <div class="buttons">
            ${status === 'SUCCESS'
              ? `<button class="btn-primary" onclick="window.location.href='${baseUrl}/gestor?seccion=calendario'">
                   📅 Ir al Calendario
                 </button>`
              : `<button class="btn-primary" onclick="window.location.href='${baseUrl}/gestor'">
                   🏠 Volver al Panel
                 </button>`
            }
            <button class="btn-secondary" onclick="window.location.href='${baseUrl}/gestor?seccion=seguimientos'">
              📝 Seguimientos
            </button>
          </div>
        </div>
      </div>
    </body>
    </html>
  `;

  return new NextResponse(html, {
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  });
}
