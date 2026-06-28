// Credenciales simples
const MASTER_USERNAME = 'Master';
const MASTER_PASSWORD = '2134';

// Login simple
export async function loginUsuario(username: string, password: string) {
  try {
    if (username === MASTER_USERNAME && password === MASTER_PASSWORD) {
      const usuario = {
        username: MASTER_USERNAME,
        nombre: 'Administrador',
      };

      // Guardar sesión en localStorage
      if (typeof window !== 'undefined') {
        localStorage.setItem('usuario_actual', JSON.stringify(usuario));
        localStorage.setItem('usuario_autenticado', 'true');
      }

      return { data: usuario, error: null };
    }

    return { error: 'Usuario o contraseña incorrectos' };
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
    localStorage.removeItem('usuario_autenticado');
  }
}

// Verificar si está autenticado
export function estaAutenticado(): boolean {
  if (typeof window === 'undefined') return false;
  return !!localStorage.getItem('usuario_autenticado');
}
