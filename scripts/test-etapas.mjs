/**
 * Tests del vocabulario único de etapas (GL-01).
 *
 *   npm run test:etapas
 *
 * Lo que se protege: que los cuatro objetos —cliente, oportunidad, suministro
 * y contrato— se lean SIEMPRE contra la misma escalera, y que cuando la
 * etiqueta guardada y los hechos digan cosas distintas, ganen los hechos.
 */
import {
  ETAPAS, ETAPA, ETAPAS_EN_JUEGO, etapaDe, etapaDeCliente, contradicciones,
} from '../src/lib/etapas.ts';

let ok = 0, fallos = 0;
const comprueba = (n, c, d = '') => {
  if (c) { ok++; console.log(`  ✓ ${n}`); }
  else { fallos++; console.log(`  ✗ ${n}${d ? ` — ${d}` : ''}`); }
};
const titulo = (t) => console.log(`\n${t}`);

titulo('La escalera está bien formada');
{
  comprueba('cada etapa tiene título y condición',
    ETAPAS.every((e) => e.titulo.length > 2 && e.condicion.length > 10));

  const avances = ETAPAS.filter((e) => e.avance >= 0).map((e) => e.avance);
  comprueba('los peldaños van seguidos y sin repetir',
    avances.every((a, i) => a === i), avances.join(','));

  comprueba('aparcado y perdido no avanzan',
    ETAPA.aparcado.avance === -1 && ETAPA.perdido.avance === -1);

  comprueba('«activo» es el último peldaño',
    ETAPA.activo.avance === Math.max(...avances));

  comprueba('las etapas en juego excluyen activo, perdido y aparcado',
    !ETAPAS_EN_JUEGO.includes('activo')
    && !ETAPAS_EN_JUEGO.includes('perdido')
    && !ETAPAS_EN_JUEGO.includes('aparcado'));
}

titulo('Los cuatro objetos hablan el mismo idioma');
{
  // Lo mismo dicho de cuatro maneras distintas tiene que dar la misma etapa.
  comprueba('«oferta enviada» es propuesta enviada, venga de donde venga',
    etapaDe('pipeline', 'oferta_enviada') === 'propuesta_enviada'
    && etapaDe('cups', 'oferta_enviada') === 'propuesta_enviada');

  comprueba('«activado» es activo en suministro y en contrato',
    etapaDe('cups', 'activado') === 'activo'
    && etapaDe('contrato', 'activado') === 'activo');

  comprueba('esperar papel es la misma etapa se llame como se llame',
    etapaDe('cups', 'sin_factura') === 'factura_solicitada'
    && etapaDe('cups', 'datos_incompletos') === 'factura_solicitada'
    && etapaDe('pipeline', 'doc_incompleta') === 'factura_solicitada');

  comprueba('permanencia y «revisar más adelante» son aparcado, no decisión',
    etapaDe('pipeline', 'pendiente_permanencia') === 'aparcado'
    && etapaDe('pipeline', 'revisar_adelante') === 'aparcado');

  comprueba('no viable y rechazado son perdido',
    etapaDe('cups', 'no_viable') === 'perdido'
    && etapaDe('contrato', 'rechazado') === 'perdido');

  comprueba('un contrato firmado espera activación, no está activo',
    etapaDe('contrato', 'firmado') === 'activacion');
}

titulo('Un estado desconocido no puede tumbar la pantalla');
{
  comprueba('valor inventado cae en el primer peldaño',
    etapaDe('pipeline', 'lo_que_sea') === 'detectado');
  comprueba('null y vacío tampoco revientan',
    etapaDe('cups', null) === 'detectado' && etapaDe('cliente', '') === 'detectado');
}

titulo('La etapa del cliente sale de los hechos, no de la etiqueta');
{
  comprueba('sin nada colgando, vale la etiqueta',
    etapaDeCliente({ estadoComercial: 'en_analisis' }) === 'en_analisis');

  // El caso real encontrado: contratos con firma puesta marcados como pendientes.
  comprueba('una fecha de firma manda sobre el estado del contrato',
    etapaDeCliente({
      contratos: [{ estado_contrato: 'pendiente_firma', fecha_firma: '2026-08-01' }],
    }) === 'activacion');

  comprueba('una fecha de activación manda sobre todo',
    etapaDeCliente({
      estadoComercial: 'detectado',
      contratos: [{ estado_contrato: 'firmado', fecha_activacion_real: '2026-08-10' }],
    }) === 'activo');

  comprueba('gana lo MÁS avanzado, no lo más reciente',
    etapaDeCliente({
      cups: [{ estado_cups: 'activado' }, { estado_cups: 'datos_incompletos' }],
    }) === 'activo');

  comprueba('todo aparcado se lee aparcado, no perdido',
    etapaDeCliente({ pipeline: [{ estado: 'revisar_adelante' }] }) === 'aparcado');

  comprueba('aparcado gana a perdido: uno vuelve y el otro no',
    etapaDeCliente({
      pipeline: [{ estado: 'perdido' }, { estado: 'pendiente_permanencia' }],
    }) === 'aparcado');

  comprueba('todo perdido se lee perdido',
    etapaDeCliente({ pipeline: [{ estado: 'perdido' }], cups: [{ estado_cups: 'no_viable' }] }) === 'perdido');

  comprueba('un aparcado no tapa a un suministro que sí avanza',
    etapaDeCliente({
      pipeline: [{ estado: 'revisar_adelante' }],
      cups: [{ estado_cups: 'oferta_enviada' }],
    }) === 'propuesta_enviada');
}

titulo('Contradicciones: solo cuando la etiqueta va por detrás');
{
  const c1 = contradicciones({
    contratos: [{ estado_contrato: 'pendiente_firma', fecha_firma: '2026-08-01' }],
  });
  comprueba('avisa de la firma puesta con el estado atrasado',
    c1.some((x) => x.includes('fecha de firma')), c1.join(' | '));

  const c2 = contradicciones({
    contratos: [{ estado_contrato: 'firmado', fecha_activacion_real: '2026-08-10' }],
  });
  comprueba('avisa de la activación puesta sin marcar activado',
    c2.some((x) => x.includes('activación')), c2.join(' | '));

  comprueba('un contrato coherente no genera ruido',
    contradicciones({
      contratos: [{ estado_contrato: 'activado', fecha_firma: '2026-07-01', fecha_activacion_real: '2026-07-20' }],
    }).length === 0);

  const c3 = contradicciones({ estadoComercial: 'detectado', cups: [{ estado_cups: 'activado' }] });
  comprueba('avisa si el cliente figura por detrás de sus datos',
    c3.some((x) => x.includes('Detectado')), c3.join(' | '));

  // Al revés NO se avisa: hoy hay contratos en papel, así que ir por delante
  // es normal y llenaría la pantalla de falsos positivos.
  comprueba('NO avisa si la etiqueta va por delante de los datos',
    contradicciones({ estadoComercial: 'activo', cups: [{ estado_cups: 'datos_incompletos' }] }).length === 0);

  comprueba('no repite el mismo aviso dos veces',
    (() => {
      const c = contradicciones({
        contratos: [
          { estado_contrato: 'pendiente_firma', fecha_firma: '2026-08-01' },
          { estado_contrato: 'pendiente_firma', fecha_firma: '2026-08-02' },
        ],
      });
      return c.length === new Set(c).size;
    })());
}

console.log(`\n${fallos === 0 ? '✅' : '❌'} ${ok} bien, ${fallos} mal\n`);
process.exit(fallos === 0 ? 0 : 1);
