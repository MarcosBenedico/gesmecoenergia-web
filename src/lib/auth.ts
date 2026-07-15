import { supabase } from './supabase';

export async function loginGestor(usuario: string, password: string) {
  // ── Usuarios con email → Supabase Auth (Marcos, Nicola, David...) ──
  if (usuario.includes('@')) {
    const { data, error } = await supabase.auth.signInWithPassword({ email: usuario.trim(), password });
    if (error || !data.user) {
      if (/email not confirmed/i.test(error?.message || '')) {
        throw new Error('Tu acceso existe pero está SIN CONFIRMAR. Un administrador debe confirmarlo en Supabase → Authentication → Users → tu email → Confirm email.');
      }
      throw new Error('Email o contraseña incorrectos');
    }
    // Comprobar que el perfil existe y está activo
    const { data: perfil } = await supabase.from('app_usuarios').select('activo, nombre').eq('id', data.user.id).single();
    if (perfil && !perfil.activo) {
      await supabase.auth.signOut();
      throw new Error('Tu usuario está desactivado. Habla con el administrador.');
    }
    if (typeof window !== 'undefined') {
      localStorage.setItem('admin_token', 'auth_' + data.user.id);
      localStorage.setItem('admin_user', perfil?.nombre || data.user.email || 'Usuario');
    }
    await supabase.from('app_usuarios').update({ ultimo_acceso: new Date().toISOString() }).eq('id', data.user.id);
    return { usuario: data.user.email, authenticated: true };
  }

  // El acceso maestro fue eliminado: solo se entra con usuario individual (email + contraseña).
  throw new Error('Introduce tu email y contraseña. El acceso maestro ya no existe.');
}

// Mantener para compatibilidad con código antiguo
export async function loginUsuario(email: string, password: string) {
  try {
    // Obtener usuario
    const { data: usuario, error } = await supabase
      .from('usuarios')
      .select('*')
      .eq('email', email)
      .single();

    if (error || !usuario) {
      throw new Error('Usuario o contraseña incorrectos');
    }

    // Verificar contraseña (simple - en producción usar bcrypt)
    if (usuario.password_hash !== password) {
      throw new Error('Usuario o contraseña incorrectos');
    }

    // Guardar en localStorage
    if (typeof window !== 'undefined') {
      localStorage.setItem('admin_token', usuario.id);
      localStorage.setItem('admin_email', usuario.email);
    }

    return usuario;
  } catch (error) {
    console.error('Error en login:', error);
    throw error;
  }
}

export async function logoutUsuario() {
  if (typeof window !== 'undefined') {
    localStorage.removeItem('admin_token');
    localStorage.removeItem('admin_email');
  }
}

export function obtenerUsuarioActual() {
  if (typeof window !== 'undefined') {
    return localStorage.getItem('admin_token');
  }
  return null;
}

export function obtenerEmailActual() {
  if (typeof window !== 'undefined') {
    return localStorage.getItem('admin_email');
  }
  return null;
}

// Tabla precios
export async function obtenerPreciosComercializadoras() {
  const { data, error } = await supabase
    .from('precios_comercializadoras')
    .select(`
      *,
      comercializadoras(nombre, codigo)
    `)
    .order('comercializadora_id');

  if (error) throw error;
  return data || [];
}

export async function obtenerComercializadoras() {
  const { data, error } = await supabase.from('comercializadoras').select('*');
  if (error) throw error;
  return data || [];
}
