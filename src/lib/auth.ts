import { supabase } from './supabase';

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

export async function actualizarPrecio(
  id: number,
  precio_potencia: number,
  precio_energia: number
) {
  const { error } = await supabase
    .from('precios_comercializadoras')
    .update({ precio_potencia, precio_energia, updated_at: new Date().toISOString() })
    .eq('id', id);

  if (error) throw error;
  return true;
}

export async function obtenerComercializadoras() {
  const { data, error } = await supabase.from('comercializadoras').select('*');
  if (error) throw error;
  return data || [];
}
