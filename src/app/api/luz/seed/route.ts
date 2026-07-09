import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { tituloFechaCritica } from '@/lib/luz';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

/**
 * Datos de prueba del módulo Gestión Luz (marcados [DEMO]).
 * POST → crea · DELETE → elimina todo lo [DEMO]
 */

const dias = (n: number) => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10);

export async function POST() {
  try {
    const { data: yaExiste } = await supabase.from('luz_clientes').select('id').like('nombre', '[DEMO]%').limit(1);
    if (yaExiste && yaExiste.length > 0) {
      return NextResponse.json({ error: 'Los datos de prueba ya existen. Elimínalos primero.' }, { status: 409 });
    }

    const crearCliente = async (c: Record<string, unknown>) => {
      const { data, error } = await supabase.from('luz_clientes').insert([c]).select('id, nombre, prioridad').single();
      if (error || !data) throw new Error(`cliente: ${error?.message}`);
      return data;
    };
    const crearCups = async (c: Record<string, unknown>) => {
      const { data, error } = await supabase.from('luz_cups').insert([c]).select('id, cups').single();
      if (error || !data) throw new Error(`cups: ${error?.message}`);
      return data;
    };
    const crearFC = async (cliente: { id: string; nombre: string; prioridad: string }, cupsId: string | null, cups: string, tipo: string, fecha: string, cia: string | null, responsable: string | null) => {
      await supabase.from('luz_fechas_criticas').insert([{
        cliente_id: cliente.id, cups_id: cupsId, tipo_fecha: tipo, fecha,
        titulo: tituloFechaCritica(cliente.nombre.replace('[DEMO] ', ''), cups, tipo, cia),
        prioridad: cliente.prioridad, responsable,
      }]);
    };

    // 1. Cliente A industrial: Carnes Binéfar, 3 CUPS, consumo alto
    const carnes = await crearCliente({
      nombre: '[DEMO] Carnes Binéfar SA', nif: 'A22110033', tipo_cliente: 'industria',
      persona_contacto: 'José Pérez', telefono: '974430001', email: 'admin@carnesbinefar.demo',
      prioridad: 'A', estado_comercial: 'en_analisis', responsable: 'Energía',
      potencial_comercial: '3 CUPS industriales, ~1,4 GWh/año. Comisión potencial alta.',
    });
    const cupsCarnes1 = await crearCups({
      cliente_id: carnes.id, cups: 'ES0021000000000001DEMO', alias_suministro: 'Nave matadero',
      tarifa_acceso: '6.1TD', comercializadora_actual: 'Endesa', consumo_anual_kwh: 850000,
      coste_anual_estimado: 110000, tipo_contrato: 'fijo', fecha_fin_contrato: dias(75),
      estado_cups: 'pendiente_ofertar', responsable: 'Energía', prioridad: 'A',
    });
    await crearCups({
      cliente_id: carnes.id, cups: 'ES0021000000000002DEMO', alias_suministro: 'Sala despiece',
      tarifa_acceso: '3.0TD', comercializadora_actual: 'Endesa', consumo_anual_kwh: 420000,
      fecha_fin_contrato: dias(75), estado_cups: 'pendiente_ofertar', responsable: 'Energía', prioridad: 'A',
    });
    // CUPS SIN fecha fin contrato (incidencia)
    await crearCups({
      cliente_id: carnes.id, cups: 'ES0021000000000003DEMO', alias_suministro: 'Oficinas',
      tarifa_acceso: '2.0TD', comercializadora_actual: 'Endesa', consumo_anual_kwh: 18000,
      fecha_fin_contrato: null, estado_cups: 'datos_incompletos', responsable: 'Energía', prioridad: 'A',
    });
    await crearFC(carnes, cupsCarnes1.id, cupsCarnes1.cups, 'fin_contrato', dias(75), 'Endesa', 'Energía');
    await supabase.from('luz_pipeline').insert([{
      cliente_id: carnes.id, cups_id: cupsCarnes1.id,
      nombre_oportunidad: '[DEMO] Carnes Binéfar · cambio comercializadora 3 CUPS',
      tipo_oportunidad: 'alto_consumo', consumo_anual_kwh: 1288000, comision_potencial: 6500,
      estado: 'pendiente_ofertar', probabilidad: 70, responsable: 'Energía',
      proxima_accion: 'Preparar oferta con Nufri y Audax', fecha_proxima_accion: dias(5),
    }]);

    // 2. Cliente B pyme: Talleres Urgeles, permanencia próxima, oferta enviada
    const talleres = await crearCliente({
      nombre: '[DEMO] Talleres Urgeles SL', nif: 'B22220044', tipo_cliente: 'pyme',
      telefono: '974430002', prioridad: 'B', estado_comercial: 'pendiente_decision', responsable: 'Energía',
    });
    const cupsTalleres = await crearCups({
      cliente_id: talleres.id, cups: 'ES0021000000000004DEMO', tarifa_acceso: '3.0TD',
      comercializadora_actual: 'Iberdrola', consumo_anual_kwh: 45000, tiene_permanencia: true,
      fecha_fin_permanencia: dias(40), dias_preaviso: 30, fecha_limite_preaviso: dias(10),
      penalizacion: '350 €', fecha_fin_contrato: dias(40),
      estado_cups: 'oferta_enviada', responsable: 'Energía', prioridad: 'B',
    });
    await crearFC(talleres, cupsTalleres.id, cupsTalleres.cups, 'fin_permanencia', dias(40), 'Iberdrola', 'Energía');
    await crearFC(talleres, cupsTalleres.id, cupsTalleres.cups, 'limite_preaviso', dias(10), 'Iberdrola', 'Energía');
    await supabase.from('luz_pipeline').insert([{
      cliente_id: talleres.id, cups_id: cupsTalleres.id,
      nombre_oportunidad: '[DEMO] Talleres Urgeles · renovación',
      tipo_oportunidad: 'renovacion', consumo_anual_kwh: 45000, comision_potencial: 900,
      estado: 'oferta_enviada', probabilidad: 60, responsable: 'Energía',
      proxima_accion: 'Llamar para cerrar antes del preaviso', fecha_proxima_accion: dias(7),
    }]);

    // 3. Comunidad: contrato enviado pendiente firma
    const comunidad = await crearCliente({
      nombre: '[DEMO] Comunidad Plaza Mayor', nif: 'H22330055', tipo_cliente: 'comunidad',
      persona_contacto: 'Administrador: Fincas Litera', telefono: '974430003',
      prioridad: 'B', estado_comercial: 'contrato_tramite', responsable: 'Energía',
    });
    const cupsCom1 = await crearCups({
      cliente_id: comunidad.id, cups: 'ES0021000000000005DEMO', alias_suministro: 'Servicios comunes',
      tarifa_acceso: '2.0TD', comercializadora_actual: 'Naturgy', consumo_anual_kwh: 12000,
      fecha_fin_contrato: dias(20), estado_cups: 'pendiente_firma', responsable: 'Energía', prioridad: 'B',
    });
    await crearCups({
      cliente_id: comunidad.id, cups: 'ES0021000000000006DEMO', alias_suministro: 'Garaje',
      tarifa_acceso: '2.0TD', comercializadora_actual: 'Naturgy', consumo_anual_kwh: 8000,
      fecha_fin_contrato: dias(20), estado_cups: 'pendiente_firma', responsable: 'Energía', prioridad: 'B',
    });
    const { data: conCom } = await supabase.from('luz_contratos').insert([{
      cliente_id: comunidad.id, cups_id: cupsCom1.id, comercializadora_final: 'Nufri',
      tarifa_acceso: '2.0TD', fecha_envio_contrato: dias(-10), estado_contrato: 'pendiente_firma',
      responsable: 'Energía', observaciones: '[DEMO] Enviado hace 10 días, sin firma → alerta',
    }]).select('id').single();
    await crearFC(comunidad, cupsCom1.id, cupsCom1.cups, 'contrato_pendiente_firma', dias(3), 'Nufri', 'Energía');

    // 4. Ayuntamiento: varios CUPS, fechas críticas próximas, prioridad A — y SIN responsable en un CUPS
    const ayto = await crearCliente({
      nombre: '[DEMO] Ayuntamiento de Ejemplo', nif: 'P2299900J', tipo_cliente: 'ayuntamiento',
      telefono: '974430004', prioridad: 'A', estado_comercial: 'contacto_iniciado', responsable: 'Energía',
    });
    const cupsAyto1 = await crearCups({
      cliente_id: ayto.id, cups: 'ES0021000000000007DEMO', alias_suministro: 'Casa consistorial',
      tarifa_acceso: '3.0TD', comercializadora_actual: 'Endesa', consumo_anual_kwh: 95000,
      fecha_fin_contrato: dias(25), estado_cups: 'factura_recibida', responsable: 'Energía', prioridad: 'A',
    });
    // CUPS SIN responsable (incidencia)
    await crearCups({
      cliente_id: ayto.id, cups: 'ES0021000000000008DEMO', alias_suministro: 'Alumbrado sector norte',
      tarifa_acceso: '3.0TD', comercializadora_actual: 'Endesa', consumo_anual_kwh: 130000,
      fecha_fin_contrato: dias(25), estado_cups: 'factura_recibida', responsable: null, prioridad: 'A',
    });
    await crearFC(ayto, cupsAyto1.id, cupsAyto1.cups, 'fin_contrato', dias(25), 'Endesa', 'Energía');

    // 5. Incidencias sueltas
    // Oportunidad SIN próxima acción
    await supabase.from('luz_pipeline').insert([{
      cliente_id: ayto.id, nombre_oportunidad: '[DEMO] Ayuntamiento · licitación suministros',
      tipo_oportunidad: 'varios_cups', consumo_anual_kwh: 225000, comision_potencial: 2800,
      estado: 'seguimiento', probabilidad: 40, responsable: 'Energía',
      proxima_accion: null, fecha_proxima_accion: null,
      observaciones: '[DEMO] SIN PRÓXIMA ACCIÓN → debe generar alerta',
    }]);
    // Contrato firmado sin activar
    await supabase.from('luz_contratos').insert([{
      cliente_id: talleres.id, cups_id: cupsTalleres.id, comercializadora_final: 'Audax',
      fecha_envio_contrato: dias(-30), fecha_firma: dias(-20), fecha_activacion_prevista: dias(-5),
      estado_contrato: 'pendiente_activacion', responsable: 'Energía',
      observaciones: '[DEMO] Firmado hace 20 días, activación prevista vencida → alerta',
    }]);
    // Comisión pendiente vencida
    await supabase.from('luz_comisiones').insert([{
      cliente_id: carnes.id, cups_id: cupsCarnes1.id, comercializadora: 'Endesa',
      tipo_comision: 'por_kwh', importe_previsto: 1200, importe_cobrado: 0,
      fecha_prevista_cobro: dias(-15), estado_comision: 'pendiente_cobro',
      observaciones: '[DEMO] Cobro vencido hace 15 días → alerta',
    }]);
    // Comisión cobrada parcial
    await supabase.from('luz_comisiones').insert([{
      cliente_id: talleres.id, cups_id: cupsTalleres.id, contrato_id: conCom?.id || null,
      comercializadora: 'Nufri', tipo_comision: 'pago_unico', importe_previsto: 900, importe_cobrado: 600,
      fecha_prevista_cobro: dias(-5), fecha_cobro: dias(-5), estado_comision: 'cobrada_parcial',
    }]);
    // Tareas
    await supabase.from('luz_tareas').insert([
      { cliente_id: carnes.id, cups_id: cupsCarnes1.id, tipo_tarea: 'preparar_oferta', descripcion: 'Preparar comparativa 3 CUPS Carnes Binéfar', responsable: 'Energía', fecha_limite: dias(5), prioridad: 'alta' },
      { cliente_id: comunidad.id, tipo_tarea: 'reclamar_firma', descripcion: 'Reclamar firma contrato comunidad', responsable: 'Energía', fecha_limite: dias(-2), prioridad: 'alta' },
    ]);

    return NextResponse.json({
      ok: true,
      mensaje: 'Datos de prueba creados: 4 clientes [DEMO], 8 CUPS (uno sin fecha fin, uno sin responsable), 5 fechas críticas, 3 oportunidades (una sin próxima acción), 2 contratos (uno firmado sin activar), 2 comisiones (una vencida, una parcial) y 2 tareas.',
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Error creando datos de prueba.';
    return NextResponse.json({
      error: /does not exist|Could not find/i.test(msg)
        ? 'Faltan las tablas del módulo. Ejecuta supabase_luz.sql en Supabase.'
        : msg,
    }, { status: 500 });
  }
}

export async function DELETE() {
  try {
    const { data: demos } = await supabase.from('luz_clientes').select('id').like('nombre', '[DEMO]%');
    const ids = (demos || []).map((d) => d.id);
    if (ids.length > 0) {
      await supabase.from('luz_pipeline').delete().in('cliente_id', ids);
      await supabase.from('luz_contratos').delete().in('cliente_id', ids);
      await supabase.from('luz_comisiones').delete().in('cliente_id', ids);
      await supabase.from('luz_clientes').delete().in('id', ids); // cascade: cups, fechas, tareas
    }
    return NextResponse.json({ ok: true, eliminados: ids.length });
  } catch {
    return NextResponse.json({ error: 'Error eliminando datos de prueba.' }, { status: 500 });
  }
}
