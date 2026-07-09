import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { tituloVencimiento, SEGMENTO_COLOR } from '@/lib/correbin';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

/**
 * Datos de prueba realistas del módulo Vencimientos y Cartera.
 * POST /api/correbin/seed — crea el juego de pruebas (marca [DEMO] en el nombre).
 * DELETE /api/correbin/seed — elimina todos los datos [DEMO].
 */

const dias = (n: number) => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10);

export async function POST() {
  try {
    // Evitar duplicar el seed
    const { data: yaExiste } = await supabase.from('vct_clientes').select('id').like('nombre', '[DEMO]%').limit(1);
    if (yaExiste && yaExiste.length > 0) {
      return NextResponse.json({ ok: false, error: 'Los datos de prueba ya existen. Bórralos primero (botón "Eliminar datos de prueba").' }, { status: 409 });
    }

    const crearCliente = async (c: Record<string, unknown>) => {
      const { data, error } = await supabase.from('vct_clientes').insert([c]).select('id, nombre, segmento').single();
      if (error || !data) throw new Error(`cliente: ${error?.message}`);
      return data;
    };
    const crearPoliza = async (p: Record<string, unknown>) => {
      const { data, error } = await supabase.from('vct_polizas').insert([p]).select('id').single();
      if (error || !data) throw new Error(`póliza: ${error?.message}`);
      return data;
    };
    const crearVcto = async (cliente: { id: string; nombre: string; segmento: string }, polizaId: string | null, fecha: string, ramo: string, prima: number, cia: string, responsable: string | null, extra: Record<string, unknown> = {}) => {
      const { error } = await supabase.from('vct_vencimientos').insert([{
        cliente_id: cliente.id, poliza_id: polizaId, fecha_vct: fecha,
        titulo_evento: tituloVencimiento(cliente.nombre.replace('[DEMO] ', ''), ramo, prima, cia),
        segmento: cliente.segmento, color: SEGMENTO_COLOR[cliente.segmento]?.nombre || 'gris',
        responsable, ...extra,
      }]);
      if (error) throw new Error(`vencimiento: ${error.message}`);
    };

    // 1. Cuenta A transporte con flota y prima alta
    const ibs = await crearCliente({
      nombre: '[DEMO] IBS Trans SL', nif: 'B22990011', telefono: '974420001', email: 'flota@ibstrans.es',
      poblacion: 'Binéfar', tipo: 'empresa', contacto_principal: 'Ignacio Bistué',
      prioridad: 'A', segmento: 'flota_transporte', potencial_comercial: 'Flota 28 camiones + naves + RC. Cliente estratégico.',
      responsable: 'Dirección',
    });
    const polFlota = await crearPoliza({
      cliente_id: ibs.id, numero_poliza: 'FL-778899', compania: 'Allianz', ramo: 'flota',
      prima_anual: 60000, comision: 6000, fecha_vencimiento: dias(45), estado: 'activa',
      responsable: 'Dirección', prioridad: 'A', segmento: 'flota_transporte',
    });
    await crearVcto(ibs, polFlota.id, dias(45), 'flota', 60000, 'Allianz', 'Dirección', {
      estado_vencimiento: 'doc_solicitada', proxima_accion: 'Recibir relación de flota actualizada', fecha_proxima_accion: dias(7),
    });

    // 2. Pyme importante
    const talleres = await crearCliente({
      nombre: '[DEMO] Talleres Cinca SL', nif: 'B22881122', telefono: '974420002',
      poblacion: 'Monzón', tipo: 'empresa', prioridad: 'B', segmento: 'pyme_importante',
      potencial_comercial: 'Multirriesgo + convenio. Posible vida colectivo.', responsable: 'Renovaciones',
    });
    const polTalleres = await crearPoliza({
      cliente_id: talleres.id, numero_poliza: 'MR-445566', compania: 'Mapfre', ramo: 'multirriesgo',
      prima_anual: 4200, comision: 630, fecha_vencimiento: dias(80), estado: 'activa', responsable: 'Renovaciones',
    });
    await crearVcto(talleres, polTalleres.id, dias(80), 'multirriesgo', 4200, 'Mapfre', 'Renovaciones');

    // 3. Ayuntamiento
    const ayto = await crearCliente({
      nombre: '[DEMO] Ayuntamiento de Binéfar', nif: 'P2208900I', telefono: '974428100',
      poblacion: 'Binéfar', tipo: 'empresa', prioridad: 'A', segmento: 'ayuntamiento',
      potencial_comercial: 'RC + flota municipal + edificios. Licitación anual.', responsable: 'Dirección',
    });
    const polAyto = await crearPoliza({
      cliente_id: ayto.id, numero_poliza: 'RC-901234', compania: 'Zurich', ramo: 'rc',
      prima_anual: 18000, comision: 2160, fecha_vencimiento: dias(110), estado: 'activa', responsable: 'Dirección',
    });
    await crearVcto(ayto, polAyto.id, dias(110), 'rc', 18000, 'Zurich', 'Dirección');

    // 4. Particular selectivo
    const laura = await crearCliente({
      nombre: '[DEMO] Laura Solano Pueyo', nif: '73201456X', telefono: '600112233',
      poblacion: 'Binéfar', tipo: 'particular', prioridad: 'B', segmento: 'particular_selectivo',
      potencial_comercial: 'Hogar + auto + vida. Buena vinculación.', responsable: 'Auto / Particulares',
    });
    const polLaura = await crearPoliza({
      cliente_id: laura.id, numero_poliza: 'HG-556677', compania: 'AXA', ramo: 'hogar',
      prima_anual: 420, comision: 63, fecha_vencimiento: dias(25), estado: 'activa', responsable: 'Auto / Particulares',
    });
    await crearVcto(laura, polLaura.id, dias(25), 'hogar', 420, 'AXA', 'Auto / Particulares');

    // 5. Póliza SIN PRIMA (datos incompletos)
    await crearPoliza({
      cliente_id: talleres.id, numero_poliza: 'AU-111222', compania: 'Reale', ramo: 'auto',
      prima_anual: 0, fecha_vencimiento: dias(60), estado: 'sin_datos', responsable: 'Renovaciones',
      notas: 'Importada sin prima — pedir recibo',
    });

    // 6. Póliza SIN VENCIMIENTO
    await crearPoliza({
      cliente_id: laura.id, numero_poliza: 'VD-333444', compania: 'Generali', ramo: 'vida',
      prima_anual: 380, fecha_vencimiento: null, estado: 'sin_datos', responsable: 'Auto / Particulares',
      notas: 'Falta fecha de vencimiento',
    });

    // 7. Oportunidad de pipeline SIN PRÓXIMA ACCIÓN
    await supabase.from('vct_oportunidades').insert([{
      cliente_id: null, nombre_contacto: '[DEMO] Transportes Litera SL', telefono: '974420088',
      ramo: 'flota', compania_actual: 'Mapfre (competencia)', etapa: 'seguimiento',
      prima_estimada: 32000, probabilidad: 60, documentacion_recibida: true,
      proxima_accion: null, fecha_proxima_accion: null, responsable: 'Dirección',
      notas: 'Vio nuestra propuesta, dice que la estudia. SIN PRÓXIMA ACCIÓN → alerta.',
    }]);

    // 8. Anulación REAL
    await supabase.from('vct_anulaciones').insert([{
      cliente_id: laura.id, fecha_anulacion: dias(-20), prima: 310,
      motivo: 'Se lo llevó el banco con la hipoteca', tipo_anulacion: 'real', afecta_cartera: true,
      responsable: 'Auto / Particulares',
    }]);

    // 9. Sustitución técnica
    await supabase.from('vct_anulaciones').insert([{
      cliente_id: talleres.id, poliza_id: polTalleres.id, fecha_anulacion: dias(-10), prima: 3900,
      motivo: 'Reemplazada por MR-445566 con mejores garantías', tipo_anulacion: 'sustitucion_tecnica',
      poliza_sustituta_id: polTalleres.id, afecta_cartera: false, responsable: 'Renovaciones',
    }]);

    // 10. Cambio de mediador pendiente de aceptación
    await supabase.from('vct_cambios_mediador').insert([{
      cliente_id: ibs.id, prima: 8500, compania: 'Allianz', ramo: 'rc',
      carta_firmada: true, estado_compania: 'En trámite', fecha_solicitud: dias(-15),
      fecha_envio_compania: dias(-8), estado: 'enviado_compania', responsable: 'Administración',
      observaciones: 'RC de la empresa, pendiente de aceptación por la compañía.',
    }]);

    // Extra: producción del año (real + técnica) y tareas
    await supabase.from('vct_produccion').insert([
      { cliente_id: talleres.id, fecha_emision: dias(-30), ramo: 'multirriesgo', compania: 'Mapfre', prima: 4200, comision: 630, tipo_produccion: 'nueva', responsable: 'Renovaciones' },
      { cliente_id: talleres.id, fecha_emision: dias(-10), ramo: 'multirriesgo', compania: 'Mapfre', prima: 3900, comision: 585, tipo_produccion: 'sustitucion', responsable: 'Renovaciones' },
    ]);
    await supabase.from('vct_tareas').insert([
      { cliente_id: ibs.id, poliza_id: polFlota.id, titulo: 'Pedir relación de flota actualizada', tipo_tarea: 'cargar_documentacion', fecha_limite: dias(7), prioridad: 'alta', responsable: 'Dirección' },
      { cliente_id: laura.id, titulo: 'Llamar antes del vencimiento del hogar', tipo_tarea: 'llamar_cliente', fecha_limite: dias(10), prioridad: 'media', responsable: 'Auto / Particulares' },
    ]);

    // Totales de clientes
    for (const c of [ibs, talleres, ayto, laura]) {
      const { data: pols } = await supabase.from('vct_polizas')
        .select('prima_anual, comision, estado').eq('cliente_id', c.id);
      const vivas = (pols || []).filter((p) => ['activa', 'viva', 'pendiente_revision', 'sin_datos'].includes(p.estado));
      await supabase.from('vct_clientes').update({
        prima_total: vivas.reduce((s, p) => s + (Number(p.prima_anual) || 0), 0),
        comision_total: vivas.reduce((s, p) => s + (Number(p.comision) || 0), 0),
      }).eq('id', c.id);
    }

    return NextResponse.json({
      ok: true,
      mensaje: 'Datos de prueba creados: 4 clientes [DEMO], 6 pólizas, 4 vencimientos, 1 oportunidad sin próxima acción, 2 anulaciones (real + técnica), 1 cambio de mediador en trámite, 2 producciones y 2 tareas.',
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Error creando datos de prueba.';
    return NextResponse.json({
      error: /does not exist|Could not find/i.test(msg)
        ? 'Faltan tablas v2. Ejecuta supabase_correbin_v2.sql en Supabase.'
        : msg,
    }, { status: 500 });
  }
}

export async function DELETE() {
  try {
    const { data: demos } = await supabase.from('vct_clientes').select('id').like('nombre', '[DEMO]%');
    const ids = (demos || []).map((d) => d.id);
    if (ids.length > 0) {
      // Las FK con ON DELETE CASCADE/SET NULL limpian pólizas, vencimientos y tareas
      await supabase.from('vct_produccion').delete().in('cliente_id', ids);
      await supabase.from('vct_anulaciones').delete().in('cliente_id', ids);
      await supabase.from('vct_cambios_mediador').delete().in('cliente_id', ids);
      await supabase.from('vct_clientes').delete().in('id', ids);
    }
    await supabase.from('vct_oportunidades').delete().like('nombre_contacto', '[DEMO]%');
    return NextResponse.json({ ok: true, eliminados: ids.length });
  } catch (e) {
    return NextResponse.json({ error: 'Error eliminando datos de prueba.' }, { status: 500 });
  }
}
