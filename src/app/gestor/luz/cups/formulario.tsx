'use client';

/**
 * EL FORMULARIO DEL SUMINISTRO, POR BLOQUES.
 *
 * Sustituye a la rejilla de veinte campos. El criterio entero —qué bloques
 * hay, qué bloquea, qué solo avisa y cómo se guarda cada cosa— vive en
 * `src/lib/formulario-suministro.ts` y está cubierto por
 * `npm run test:suministro`. Aquí solo se pinta.
 *
 * Lo que esta pantalla añade por su cuenta:
 *
 *  · Cada bloque lleva SU PORQUÉ arriba y su contador de relleno. Con la
 *    rejilla, lo que faltaba no se veía: había que repasarla entera.
 *  · Las casillas de potencia son EXACTAMENTE las que tiene la tarifa. Así el
 *    error de rellenar tres periodos de seis no se puede cometer, que es lo
 *    mismo que resolvió tener una plantilla de Excel por tarifa.
 *  · El consumo enseña siempre cómo se ha entendido («Se guardará 53.558 kWh
 *    al año»), no solo cuando hay problema — ver `AvisoConsumo`.
 *  · El último día para preavisar se PROPONE con un botón, no se escribe solo
 *    encima de lo que haya puesto una persona leyendo el contrato.
 */

import { useMemo } from 'react';
import { AlertTriangle, Info, Wand2 } from 'lucide-react';
import { leerConsumo, TIPO_CONTRATO_LABEL } from '@/lib/luz';
import {
  BLOQUES_SUMINISTRO, ajustarPotencias, nombresDePeriodo, revisarSuministro,
  sePuedeGuardar, avisosDelBloque, preavisoSugerido, completitudPorBloque,
  type Campo, type ValoresSuministro,
} from '@/lib/formulario-suministro';
import { Card, inputCls, labelCls, AvisoConsumo, SelectorResponsable } from '../ui';

interface Props {
  valores: ValoresSuministro;
  onCambio: (v: ValoresSuministro) => void;
  /** Qué bloques pintar. Sin esto, todos. */
  soloBloques?: string[];
}

export function useAvisosSuministro(valores: ValoresSuministro) {
  const avisos = useMemo(() => revisarSuministro(valores), [valores]);
  return { avisos, puedeGuardar: sePuedeGuardar(avisos) };
}

export default function FormularioSuministro({ valores, onCambio, soloBloques }: Props) {
  const { avisos } = useAvisosSuministro(valores);
  const conteo = useMemo(() => completitudPorBloque(valores), [valores]);
  const sugerido = preavisoSugerido(valores);

  const poner = (clave: string, valor: unknown) => {
    const v = { ...valores, [clave]: valor };
    // Al cambiar de tarifa se reajustan las casillas de potencia en el acto,
    // conservando lo ya escrito. Si se vaciaran, nadie corregiría la tarifa.
    if (clave === 'tarifa_acceso') v.potencias_kw = ajustarPotencias(valores.potencias_kw, String(valor));
    onCambio(v);
  };

  const bloques = soloBloques
    ? BLOQUES_SUMINISTRO.filter((b) => soloBloques.includes(b.clave))
    : BLOQUES_SUMINISTRO;

  const campo = (c: Campo) => {
    const valor = valores[c.clave];
    const propios = avisos.filter((a) => a.campo === c.clave);

    return (
      <div key={c.clave} className={c.tipo === 'textarea' || c.tipo === 'potencias' ? 'md:col-span-2' : ''}>
        <label className={labelCls}>
          {c.etiqueta}{c.obligatorio && <span className="text-red-400"> *</span>}
          {c.sufijo && <span className="text-muted font-normal"> ({c.sufijo})</span>}
        </label>

        {c.tipo === 'potencias' ? (
          <div className="flex gap-1.5 flex-wrap">
            {nombresDePeriodo(String(valores.tarifa_acceso || '')).map((nombre, i) => (
              <span key={nombre} className="flex flex-col">
                <span className="text-[10px] font-bold text-muted text-center">{nombre}</span>
                <input
                  className={`${inputCls} !w-20 text-center tabular-nums`}
                  inputMode="decimal"
                  value={(Array.isArray(valor) ? valor[i] : null) ?? ''}
                  onChange={(e) => {
                    const lista = ajustarPotencias(valores.potencias_kw, String(valores.tarifa_acceso || ''));
                    const n = Number(e.target.value.replace(',', '.'));
                    lista[i] = e.target.value.trim() && Number.isFinite(n) ? n : null;
                    poner('potencias_kw', lista);
                  }}
                />
              </span>
            ))}
          </div>
        ) : c.tipo === 'checkbox' ? (
          <label className="flex items-center gap-2 text-sm font-semibold py-2 cursor-pointer">
            <input type="checkbox" checked={valor === true} onChange={(e) => poner(c.clave, e.target.checked)} />
            {valor === true ? 'Sí' : 'No'}
          </label>
        ) : c.tipo === 'select' ? (
          <select className={inputCls} value={String(valor ?? '')} onChange={(e) => poner(c.clave, e.target.value)}>
            <option value="">— Sin elegir —</option>
            {(c.opciones || []).map((o) => (
              <option key={o} value={o}>{TIPO_CONTRATO_LABEL[o] || o}</option>
            ))}
          </select>
        ) : c.tipo === 'textarea' ? (
          <textarea className={`${inputCls} min-h-20`} value={String(valor ?? '')} onChange={(e) => poner(c.clave, e.target.value)} />
        ) : c.clave === 'responsable' ? (
          <SelectorResponsable valor={String(valor ?? '') || null} onCambio={(v) => poner(c.clave, v || '')} />
        ) : (
          <input
            className={`${inputCls} ${c.clave === 'cups' ? 'font-mono uppercase' : ''}`}
            type={c.tipo === 'fecha' ? 'date' : 'text'}
            // El consumo va como texto y NO como number a propósito: un campo
            // numérico no deja teclear el punto de miles en algunos
            // navegadores y empuja a escribir mal justo el dato que más duele.
            inputMode={c.tipo === 'numero' ? 'decimal' : undefined}
            value={String(valor ?? '')}
            onChange={(e) => poner(c.clave, e.target.value)}
          />
        )}

        {/* El consumo enseña SIEMPRE cómo se ha entendido, no solo si hay lío. */}
        {c.clave === 'consumo_anual_kwh' && (
          <AvisoConsumo consumo={leerConsumo(String(valor ?? ''))} bruto={String(valor ?? '')} />
        )}

        {/* El preaviso se propone con un botón. Escribirlo solo encima sería
            cambiarle un dato a quien lo puso leyendo el contrato de verdad. */}
        {c.clave === 'fecha_limite_preaviso' && sugerido && (
          <button
            type="button"
            onClick={() => poner('fecha_limite_preaviso', sugerido)}
            className="mt-1 inline-flex items-center gap-1 text-[11px] font-bold text-accent hover:underline"
          >
            <Wand2 className="w-3 h-3" />
            Poner {sugerido.split('-').reverse().join('/')} ({String(valores.dias_preaviso ?? '')} días antes del fin)
          </button>
        )}

        {propios.map((a, i) => (
          <p key={i} className={`mt-1 flex gap-1.5 text-xs ${a.bloquea ? 'text-red-400 font-semibold' : 'text-amber-400'}`}>
            <span aria-hidden>{a.bloquea ? '⛔' : '⚠'}</span>
            <span>{a.texto}</span>
          </p>
        ))}

        {c.ayuda && propios.length === 0 && (
          <p className="mt-1 text-[11px] text-muted leading-snug">{c.ayuda}</p>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-3">
      {bloques.map((b) => {
        const n = conteo.find((x) => x.bloque === b.clave)!;
        const malos = avisosDelBloque(avisos, b.clave).filter((a) => a.bloquea).length;
        return (
          <Card key={b.clave} className="!p-4">
            <div className="flex items-start justify-between gap-3 mb-3">
              <div className="min-w-0">
                <h3 className="text-sm font-black text-foreground">{b.titulo}</h3>
                {/* El porqué del bloque. Sin esto, un bloque es una rejilla más. */}
                <p className="text-[11px] text-muted leading-snug mt-0.5 flex gap-1.5">
                  <Info className="w-3 h-3 shrink-0 mt-0.5" />
                  <span>{b.porque}</span>
                </p>
              </div>
              <span className={`shrink-0 text-[11px] font-bold tabular-nums px-2 py-0.5 rounded-md border ${
                malos ? 'border-red-500/40 bg-red-500/10 text-red-400'
                  : n.rellenos === n.total ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-400'
                  : 'border-border/50 bg-card/70 text-muted'
              }`}>
                {malos ? <AlertTriangle className="w-3 h-3 inline -mt-0.5" /> : null} {n.rellenos}/{n.total}
              </span>
            </div>
            <div className="grid md:grid-cols-2 gap-3">
              {b.campos.map(campo)}
            </div>
          </Card>
        );
      })}
    </div>
  );
}
