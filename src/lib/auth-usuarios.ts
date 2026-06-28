import { supabase } from './supabase';
import crypto from 'crypto';

// Hash de contraseña
function hashPassword(password: string): string {
  return crypto.createHash('sha256').update(password).digest('hex');
}

// Login
export async function loginUsuario(username: string, password: string) {
  try {
    const passwordHash = hashPassword(password);

    const { data, error } = await supabase
      .from('usuarios')
      .select('id, username, nombre, email, activo')
      .eq('username', username)
      .eq('password_hash', passwordHash)
      .eq('activo', true)
      .single();

    if (error || !data) {
      return { error: 'Usuario o contraseña incorrectos' };
    }

    // Guardar sesión en localStorage
    if (typeof window !== 'undefined') {
      localStorage.setItem('usuario_actual', JSON.stringify(data));
      localStorage.setItem('usuario_token', btoa(`${username}:${password}`));
    }

    return { data, error: null };
  } catch (error) {
    return { error: String(error) };
  }
}

// Registro
export async function registroUsuario(
  username: string,
  password: string,
  email?: string,
  nombre?: string
) {
  try {
    const passwordHash = hashPassword(password);

    const { data, error } = await supabase.from('usuarios').insert({
      username,
      email,
      nombre,
      password_hash: passwordHash,
    });

    if (error) {
      return { error: error.message };
    }

    // Auto-login después del registro
    return loginUsuario(username, password);
  } catch (error) {
    return { error: String(error) };
  }
}

// Obtener usuario actual
export function obtenerUsuarioActual() {
  if (typeof window === 'undefined') return null;

  const usuario = localStorage.getItem('usuario_actual');
  return usuario ? JSON.parse(usuario) : null;
}

// Logout
export function logoutUsuario() {
  if (typeof window !== 'undefined') {
    localStorage.removeItem('usuario_actual');
    localStorage.removeItem('usuario_token');
  }
}

// Verificar si está autenticado
export function estaAutenticado(): boolean {
  if (typeof window === 'undefined') return false;
  return !!localStorage.getItem('usuario_actual');
}
