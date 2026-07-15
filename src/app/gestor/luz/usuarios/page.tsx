'use client';

import { useCallback, useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import { Plus, RefreshCw, X, ShieldCheck, History } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { PerfilUsuario, PermisosUsuario, PERMISOS_POR_ROL, MODULOS_APP, useUsuario } from '@/lib/usuario';
import { Card, inputCls, labelCls, btnPrimario, btnSecundario, SelectorResponsable } from '../ui';

const ROLES: [PerfilUsuario['rol'], string][] = [
  ['admin', 'Administrador — todo, incluida la gestión de usuarios'],
  ['estandar', 'Usuario estándar — trabaja con clientes y tareas (permisos configurables)'],
  ['lectura', 'Solo lectura — consulta sin crear ni modificar'],
];

const PERMISO_LABEL: Record<keyof PermisosUsuario, string> = {
  ver: 'Ver información',
  crear: 'Crear información',
  modificar: 'Modificar información',
  eliminar: 'Eliminar información',
  exportar: 'Exportar información',
  gestionar_usuarios: 'Gestionar usuarios y permisos',
  solo_asignados: 'Solo ve sus clientes/tareas asignados',
};

interface Auditoria { id: string; usuario: string | null; accion: string; tabla: string; registro_id: string | null; creado_en: string }

export default function UsuariosPage() {
  const { perfil: yo, esAdmin } = useUsuario();
  const [usuarios, setUsuarios] = useState<PerfilUsuario[]>([]);
  const [auditoria, setAuditoria] = useState<Auditoria[]>([]);
  const [verAuditoria, setVerAuditoria] = useState(false);
  const [cargando, setCargando] = useState(true);
  const [faltaTabla, setFaltaTabla] = useState(false);
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');
  const [mostrarForm, setMostrarForm] = useState(false);
  const [nuevo, setNuevo] = useState({ nombre: '', email: '', password: '', rol: 'estandar' as PerfilUsuario['rol'], responsable: '' });

  const cargar = useCallback(async () => {
    setCargando(true);
    const { data, error: e } = await supabase.from('app_usuarios').select('*').order('creado_en');
    if (e) { setFaltaTabla(/does not exist|Could not find/i.test(e.message)); setCargando(false); return; }
    setFaltaTabla(false);
    setUsuarios((data || []) as PerfilUsuario[]);
    const { data: aud } = await supabase.from('app_auditoria').select('id, usuario, accion, tabla, registro_id, creado_en').order('creado_en', { ascending: false }).limit(100);
    setAuditoria((aud || []) as Auditoria[]);
    setCargando(false);
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  async function crearUsuario(e: React.FormEvent) {
    e.preventDefault();
    setError(''); setMsg('');
    if (!nuevo.nombre.trim() || !nuevo.email.includes('@') || nuevo.password.length < 8) {
      setError('Nombre, email válido y contraseña de al menos 8 caracteres.');
      return;
    }
    // Cliente secundario sin persistencia: crear el usuario NO cierra tu sesión de admin
    const auxiliar = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { auth: { persistSession: false, autoRefreshToken: false } }
    );
    const { data, error: e1 } = await auxiliar.auth.signUp({ email: nuevo.email.trim(), password: nuevo.password });
    if (e1) { setError(`No se pudo crear el acceso: ${e1.message}`); return; }
    if (!data.user) { setError('Supabase no devolvió el usuario. ¿Está activada la confirmación por email? Desactívala en Authentication → Providers → Email.'); return; }

    const { error: e2 } = await supabase.from('app_usuarios').insert([{
      id: data.user.id,
      email: nuevo.email.trim(),
      nombre: nuevo.nombre.trim(),
      rol: nuevo.rol,
      activo: true,
      responsable: nuevo.responsable || null,
      permisos: PERMISOS_POR_ROL[nuevo.rol],
      modulos: nuevo.rol === 'admin' ? ['luz', 'correbin', 'app_clientes', 'herramientas', 'admin'] : ['luz', 'correbin', 'app_clientes', 'herramientas'],
    }]);
    if (e2) { setError(`Acceso creado pero falló el perfil: ${e2.message}`); return; }
    setMsg(`✓ Usuario ${nuevo.nombre} creado. Ya puede entrar con ${nuevo.email} y su contraseña.`);
    setNuevo({ nombre: '', email: '', password: '', rol: 'estandar', responsable: '' });
    setMostrarForm(false);
    cargar();
  }

  async function actualizar(u: PerfilUsuario, cambios: Partial<PerfilUsuario>) {
    setError('');
    const { error: e } = await supabase.from('app_usuarios').update(cambios).eq('id', u.id);
    if (e) { setError(e.message); return; }
    setMsg('✓ Guardado.');
    cargar();
  }

  if (faltaTabla) {
    return (
      <div className="space-y-4">
        <h2 className="text-xl font-black text-foreground">Usuarios y Permisos</h2>
        <Card>
          <p className="text-sm text-amber-300">
            ⚠️ Las tablas de usuarios no existen todavía. Ejecuta <code className="font-mono bg-card/80 px-1.5 py-0.5 rounded">supabase_equipo_usuarios.sql</code> en
            el SQL Editor de Supabase (está en la raíz del proyecto) y recarga esta página.
          </p>
        </Card>
      </div>
    );
  }

  if (!esAdmin) {
    return <Card><p className="text-sm text-muted text-center py-8">No tienes permiso para gestionar usuarios.</p></Card>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-xl font-black text-foreground">Usuarios y Permisos</h2>
          <p className="text-xs text-muted mt-0.5">Quién entra en la plataforma y qué puede ver y hacer cada uno.</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setVerAuditoria((v) => !v)} className={btnSecundario}>
            <History className="w-4 h-4" /> Historial
          </button>
          <button onClick={cargar} className={btnSecundario} disabled={cargando}>
            <RefreshCw className={`w-4 h-4 ${cargando ? 'animate-spin' : ''}`} />
          </button>
          <button onClick={() => setMostrarForm((v) => !v)} className={btnPrimario}>
            {mostrarForm ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />} {mostrarForm ? 'Cancelar' : 'Nuevo usuario'}
          </button>
        </div>
      </div>

      {msg && <p className="text-xs text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-2.5">{msg}</p>}
      {error && <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/30 rounded-lg p-2.5">{error}</p>}

      {mostrarForm && (
        <Card>
          <form onSubmit={crearUsuario} className="space-y-3">
            <div className="grid md:grid-cols-3 gap-3">
              <div><label className={labelCls}>Nombre *</label><input className={inputCls} value={nuevo.nombre} onChange={(e) => setNuevo({ ...nuevo, nombre: e.target.value })} placeholder="Nicola, David..." /></div>
              <div><label className={labelCls}>Email *</label><input className={inputCls} type="email" value={nuevo.email} onChange={(e) => setNuevo({ ...nuevo, email: e.target.value })} /></div>
              <div><label className={labelCls}>Contraseña * (mín. 8)</label><input className={inputCls} type="password" value={nuevo.password} onChange={(e) => setNuevo({ ...nuevo, password: e.target.value })} /></div>
              <div>
                <label className={labelCls}>Rol</label>
                <select className={inputCls} value={nuevo.rol} onChange={(e) => setNuevo({ ...nuevo, rol: e.target.value as PerfilUsuario['rol'] })}>
                  {ROLES.map(([v, n]) => <option key={v} value={v}>{n}</option>)}
                </select>
              </div>
              <div>
                <label className={labelCls}>Responsable comercial vinculado</label>
                <SelectorResponsable valor={nuevo.responsable} onCambio={(v) => setNuevo((f) => ({ ...f, responsable: v || '' }))} className={inputCls} />
              </div>
            </div>
            <button type="submit" className={btnPrimario}><ShieldCheck className="w-4 h-4" /> Crear usuario</button>
          </form>
        </Card>
      )}

      {usuarios.length === 0 && !cargando && (
        <Card>
          <p className="text-sm text-muted text-center py-6">
            Aún no hay usuarios. Crea el tuyo primero (Marcos, rol Administrador) y después los de Nicola y David.
          </p>
        </Card>
      )}

      {usuarios.map((u) => (
        <Card key={u.id} className={!u.activo ? 'opacity-60' : ''}>
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div>
              <p className="font-bold text-foreground">{u.nombre} {yo?.id === u.id && <span className="text-[10px] text-accent font-black">(tú)</span>}</p>
              <p className="text-xs text-muted">{u.email} · alta {u.creado_en?.slice(0, 10) || '—'} · último acceso {u.ultimo_acceso ? u.ultimo_acceso.slice(0, 16).replace('T', ' ') : 'nunca'}</p>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <select
                value={u.rol}
                onChange={(e) => {
                  const rol = e.target.value as PerfilUsuario['rol'];
                  actualizar(u, { rol, permisos: PERMISOS_POR_ROL[rol] });
                }}
                className="rounded-lg border border-border/40 bg-background/60 px-2 py-1.5 text-xs font-semibold"
              >
                {ROLES.map(([v]) => <option key={v} value={v}>{v === 'admin' ? 'Administrador' : v === 'estandar' ? 'Estándar' : 'Solo lectura'}</option>)}
              </select>
              <SelectorResponsable valor={u.responsable} onCambio={(v) => actualizar(u, { responsable: v })} />
              <button
                onClick={() => actualizar(u, { activo: !u.activo })}
                className={`px-2.5 py-1 rounded-full border text-[11px] font-bold ${u.activo ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/25' : 'bg-card/80 text-muted border-border/50'}`}
              >
                {u.activo ? 'Activo' : 'Desactivado'}
              </button>
            </div>
          </div>

          {/* Permisos individuales */}
          <div className="mt-3 pt-3 border-t border-border/30">
            <p className="text-[10px] font-bold uppercase tracking-wide text-muted mb-2">Permisos individuales</p>
            <div className="flex gap-1.5 flex-wrap">
              {(Object.keys(PERMISO_LABEL) as (keyof PermisosUsuario)[]).map((p) => {
                const activoP = u.rol === 'admin' ? p !== 'solo_asignados' : !!u.permisos?.[p];
                return (
                  <button
                    key={p}
                    disabled={u.rol === 'admin'}
                    onClick={() => actualizar(u, { permisos: { ...u.permisos, [p]: !u.permisos?.[p] } })}
                    className={`px-2.5 py-1.5 rounded-lg border text-[11px] font-semibold transition ${
                      activoP ? 'bg-accent/15 text-accent border-accent/30' : 'bg-card/60 text-muted border-border/40'
                    } ${u.rol === 'admin' ? 'cursor-not-allowed' : 'hover:border-accent/50'}`}
                    title={u.rol === 'admin' ? 'Los administradores tienen todos los permisos' : 'Pulsar para cambiar'}
                  >
                    {activoP ? '✓' : '✕'} {PERMISO_LABEL[p]}
                  </button>
                );
              })}
            </div>
            <p className="text-[10px] font-bold uppercase tracking-wide text-muted mt-3 mb-2">Módulos accesibles</p>
            <div className="flex gap-1.5 flex-wrap">
              {MODULOS_APP.map(([m, nombre]) => {
                const tiene = u.rol === 'admin' || (u.modulos || []).includes(m);
                return (
                  <button
                    key={m}
                    disabled={u.rol === 'admin'}
                    onClick={() => actualizar(u, {
                      modulos: tiene ? (u.modulos || []).filter((x) => x !== m) : [...(u.modulos || []), m],
                    })}
                    className={`px-2.5 py-1.5 rounded-lg border text-[11px] font-semibold transition ${
                      tiene ? 'bg-secondary/15 text-secondary border-secondary/30' : 'bg-card/60 text-muted border-border/40'
                    } ${u.rol === 'admin' ? 'cursor-not-allowed' : 'hover:border-secondary/50'}`}
                  >
                    {tiene ? '✓' : '✕'} {nombre}
                  </button>
                );
              })}
            </div>
          </div>
        </Card>
      ))}

      {/* Historial de modificaciones */}
      {verAuditoria && (
        <Card className="!p-0 overflow-x-auto">
          <p className="px-4 pt-3 pb-1 text-xs font-black uppercase tracking-wide text-muted">Historial de modificaciones (últimas 100)</p>
          {auditoria.length === 0 ? (
            <p className="text-sm text-muted text-center py-6">Sin registros todavía. La auditoría empieza a grabar tras ejecutar el SQL del paso 1.</p>
          ) : (
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-[10px] uppercase tracking-wide text-muted border-b border-border/40">
                  <th className="px-4 py-2">Fecha</th><th className="px-4 py-2">Usuario</th>
                  <th className="px-4 py-2">Acción</th><th className="px-4 py-2">Tabla</th><th className="px-4 py-2">Registro</th>
                </tr>
              </thead>
              <tbody>
                {auditoria.map((a) => (
                  <tr key={a.id} className="border-b border-border/20">
                    <td className="px-4 py-1.5 whitespace-nowrap text-muted">{a.creado_en.slice(0, 16).replace('T', ' ')}</td>
                    <td className="px-4 py-1.5">{a.usuario || 'sistema'}</td>
                    <td className="px-4 py-1.5 font-bold">{a.accion === 'INSERT' ? '➕ Alta' : a.accion === 'UPDATE' ? '✏️ Cambio' : '🗑️ Borrado'}</td>
                    <td className="px-4 py-1.5">{a.tabla}</td>
                    <td className="px-4 py-1.5 font-mono text-[10px] text-muted">{a.registro_id?.slice(0, 8) || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
      )}
    </div>
  );
}
