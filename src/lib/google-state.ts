import { supabase } from './supabase';

export async function verificarGoogleConectado(): Promise<{
  conectado: boolean;
  email?: string;
  token?: string;
}> {
  try {
    console.log('🔍 Verificando Google en Supabase...');

    const { data, error } = await supabase
      .from('google_config')
      .select('id, access_token, email')
      .eq('id', 1)
      .single();

    if (error) {
      console.log('❌ No hay datos en google_config:', error.code);
      return { conectado: false };
    }

    if (!data) {
      console.log('⚠️ Dato vacío en google_config');
      return { conectado: false };
    }

    if (data.access_token && data.email) {
      console.log('✅ Google CONECTADO:', data.email);
      return {
        conectado: true,
        email: data.email,
        token: data.access_token,
      };
    }

    console.log('⚠️ Token o email faltante');
    return { conectado: false };
  } catch (error) {
    console.error('💥 Error al verificar Google:', error);
    return { conectado: false };
  }
}
