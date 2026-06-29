'use client';

import { useState } from 'react';

interface DatosFormulario {
  // Cliente
  cliente_nombre: string;
  cliente_localidad: string;
  cliente_contacto: string;

  // Ubicación
  ubicacion_gps: string;
  ubicacion_observaciones: string;

  // Consumo anual
  consumo_anual: number;
  factura_cantidad: number;

  // Techo/Espacio
  techo_tipo: string;
  techo_area: number;
  techo_orientacion: string;
  techo_inclinacion: number;

  // Instalación eléctrica
  cuadro_accesible: string;
  tierra_adecuada: string;
  acometida_cambio: string;
  distancia_cable: number;

  // Clima
  clima_viento: boolean;
  clima_nieve: boolean;
  clima_salinidad: boolean;
  clima_polvo: boolean;
  dificultades_especiales: string;

  // Necesidades
  consumo_critico: string;
  independencia_prioridad: string;
  ampliacion_futura: string;

  // Inversión
  inversion_presupuesto: number;
  inversion_prioridades: string;
}

export function GeneradorFotovoltaico() {
  const [formulario, setFormulario] = useState<Partial<DatosFormulario>>({
    consumo_anual: 4000,
    factura_cantidad: 500,
    techo_area: 30,
    techo_inclinacion: 37,
    distancia_cable: 10,
    inversion_presupuesto: 10000,
  });

  const [resultados, setResultados] = useState<any | null>(null);
  const [mostrarResultados, setMostrarResultados] = useState(false);

  const handleInputChange = (field: string, value: any) => {
    setFormulario({ ...formulario, [field]: value });
  };

  const cargarPlantilla = (tipo: string) => {
    const plantillas: { [key: string]: Partial<DatosFormulario> } = {
      residencial_pequeño: {
        consumo_anual: 2400,
        techo_area: 20,
        inversion_presupuesto: 7000,
        independencia_prioridad: 'Media',
      },
      residencial_grande: {
        consumo_anual: 5000,
        techo_area: 40,
        inversion_presupuesto: 15000,
        independencia_prioridad: 'Alta',
      },
      comercial: {
        consumo_anual: 15000,
        techo_area: 80,
        inversion_presupuesto: 40000,
        independencia_prioridad: 'Media',
      },
      industrial: {
        consumo_anual: 50000,
        techo_area: 200,
        inversion_presupuesto: 120000,
        independencia_prioridad: 'Alta',
      },
      agricultura: {
        consumo_anual: 8000,
        techo_area: 60,
        inversion_presupuesto: 20000,
        independencia_prioridad: 'Media',
      },
      aislada: {
        consumo_anual: 3000,
        techo_area: 30,
        inversion_presupuesto: 18000,
        independencia_prioridad: 'Alta',
      },
    };

    if (plantillas[tipo]) {
      setFormulario({ ...formulario, ...plantillas[tipo] });
    }
  };

  const calcularResultados = () => {
    // Cálculos básicos
    const consumoAnual = formulario.consumo_anual || 4000;
    const areaDisponible = formulario.techo_area || 30;
    const inclinacion = formulario.techo_inclinacion || 37;

    // Potencia estimada (5.5 kWp por 100m²)
    const potenciaEstimada = (areaDisponible * 5.5) / 100;

    // Producción anual (kWh/m²/año × área × 0.8 rendimiento)
    const produccionAnual = 1280 * areaDisponible * 0.8;

    // Necesidad de batería
    const necesidadBateria = consumoAnual < produccionAnual ? 'No urgente' : 'Recomendado';
    const capacidadBateria = (consumoAnual * 3) / 365;

    // Coste estimado (1.200€ por kWp instalado)
    const costePhase1 = Math.round(potenciaEstimada * 1200);
    const costePhase2 = Math.round(capacidadBateria * 400); // 400€ por kWh
    const costeTotal = costePhase1 + costePhase2;

    // Ahorro anual
    const ahorroAnual = Math.round((produccionAnual * 0.18) - 200); // 0.18€/kWh - mantenimiento

    // ROI
    const roi = Math.round((costeTotal / ahorroAnual) * 10) / 10;

    setResultados({
      potenciaEstimada: potenciaEstimada.toFixed(2),
      produccionAnual: Math.round(produccionAnual),
      necesidadBateria,
      capacidadBateria: capacidadBateria.toFixed(1),
      costePhase1,
      costePhase2,
      costeTotal,
      ahorroAnual,
      roi,
    });

    setMostrarResultados(true);
  };

  const generarPDF = () => {
    if (!resultados) return;

    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Especificación Fotovoltaica</title>
  <style>
    body { font-family: Arial, sans-serif; background: #f5f5f5; margin: 0; padding: 20px; }
    .container { max-width: 900px; margin: 0 auto; background: white; padding: 40px; }
    .header { text-align: center; margin-bottom: 40px; border-bottom: 2px solid #ff3333; padding-bottom: 20px; }
    .header h1 { color: #ff3333; margin: 0; }
    .header p { color: #666; margin: 5px 0; }
    .section { margin: 30px 0; }
    .section-title { color: #ff3333; font-size: 18px; font-weight: bold; border-bottom: 1px solid #ddd; padding-bottom: 10px; margin: 20px 0 15px; }
    .row { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 15px; }
    .box { background: #f9f9f9; padding: 15px; border-left: 3px solid #ff3333; }
    .label { color: #666; font-size: 12px; font-weight: bold; text-transform: uppercase; }
    .value { color: #000; font-size: 20px; font-weight: bold; margin-top: 5px; }
    table { width: 100%; border-collapse: collapse; margin: 15px 0; }
    th { background: #ff3333; color: white; padding: 10px; text-align: left; font-weight: bold; }
    td { padding: 10px; border-bottom: 1px solid #ddd; }
    tr:hover { background: #f9f9f9; }
    .total-row { background: #ffe6e6; font-weight: bold; }
    .footer { text-align: center; color: #999; font-size: 12px; margin-top: 40px; border-top: 1px solid #ddd; padding-top: 20px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>⚡ ESPECIFICACIÓN FOTOVOLTAICA</h1>
      <p><strong>GESMECO ENERGAI</strong> · Binéfar, Comarca Litera · Aragón</p>
      <p>Documento generado el ${new Date().toLocaleDateString('es-ES')}</p>
    </div>

    <div class="section">
      <div class="section-title">Datos del Cliente</div>
      <div class="row">
        <div class="box">
          <div class="label">Cliente</div>
          <div class="value">${formulario.cliente_nombre || 'No especificado'}</div>
        </div>
        <div class="box">
          <div class="label">Localidad</div>
          <div class="value">${formulario.cliente_localidad || 'No especificada'}</div>
        </div>
      </div>
    </div>

    <div class="section">
      <div class="section-title">Especificaciones Técnicas</div>
      <table>
        <tr>
          <th>Concepto</th>
          <th>Valor</th>
        </tr>
        <tr>
          <td>Consumo anual estimado</td>
          <td>${formulario.consumo_anual?.toLocaleString()} kWh/año</td>
        </tr>
        <tr>
          <td>Potencia instalada recomendada</td>
          <td>${resultados.potenciaEstimada} kWp</td>
        </tr>
        <tr>
          <td>Producción anual estimada</td>
          <td>${resultados.produccionAnual?.toLocaleString()} kWh/año</td>
        </tr>
        <tr>
          <td>Área disponible</td>
          <td>${formulario.techo_area} m²</td>
        </tr>
        <tr>
          <td>Inclinación óptima</td>
          <td>${formulario.techo_inclinacion}°</td>
        </tr>
      </table>
    </div>

    <div class="section">
      <div class="section-title">Presupuesto</div>
      <table>
        <tr>
          <th>Fase</th>
          <th>Descripción</th>
          <th>Presupuesto</th>
        </tr>
        <tr>
          <td>Fase 1</td>
          <td>Sistema fotovoltaico (paneles, inversores, estructura)</td>
          <td>${resultados.costePhase1?.toLocaleString()} €</td>
        </tr>
        <tr>
          <td>Fase 2</td>
          <td>Sistema de almacenamiento (baterías)</td>
          <td>${resultados.costePhase2?.toLocaleString()} €</td>
        </tr>
        <tr class="total-row">
          <td colspan="2">PRESUPUESTO TOTAL</td>
          <td>${resultados.costeTotal?.toLocaleString()} €</td>
        </tr>
      </table>
    </div>

    <div class="section">
      <div class="section-title">Análisis de Retorno de Inversión</div>
      <div class="row">
        <div class="box">
          <div class="label">Ahorro anual estimado</div>
          <div class="value">${resultados.ahorroAnual?.toLocaleString()} €/año</div>
        </div>
        <div class="box">
          <div class="label">Tiempo de amortización</div>
          <div class="value">${resultados.roi} años</div>
        </div>
      </div>
    </div>

    <div class="footer">
      <p>Este documento es una especificación técnica elaborada por GESMECO ENERGAI.</p>
      <p>Los importes indicados son orientativos. Se recomienda visita técnica previa para validar las especificaciones.</p>
    </div>
  </div>
</body>
</html>
    `;

    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const ventana = window.open(url, '_blank');
    if (ventana) {
      setTimeout(() => ventana.print(), 1000);
    }
  };

  const limpiarFormulario = () => {
    setFormulario({
      consumo_anual: 4000,
      factura_cantidad: 500,
      techo_area: 30,
      techo_inclinacion: 37,
      distancia_cable: 10,
      inversion_presupuesto: 10000,
    });
    setResultados(null);
    setMostrarResultados(false);
  };

  return (
    <div className="space-y-6">
      {/* Plantillas Rápidas */}
      <div className="card rounded-2xl p-6 md:p-8 bg-accent/5 border-2 border-accent/30">
        <h3 className="font-bold text-foreground text-lg mb-4">Plantillas Rápidas</h3>
        <div className="grid gap-2 grid-cols-2 md:grid-cols-3">
          {[
            { id: 'residencial_pequeño', label: 'Residencial Pequeño' },
            { id: 'residencial_grande', label: 'Residencial Grande' },
            { id: 'comercial', label: 'Comercial' },
            { id: 'industrial', label: 'Industrial' },
            { id: 'agricultura', label: 'Agricultura' },
            { id: 'aislada', label: 'Aislada' },
          ].map((p) => (
            <button
              key={p.id}
              onClick={() => cargarPlantilla(p.id)}
              className="px-3 py-2 rounded-lg bg-card/80 text-foreground border border-border/50 hover:border-accent hover:bg-accent/20 transition text-sm font-semibold"
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* Formulario */}
      <div className="card rounded-2xl p-6 md:p-8 bg-surface/50">
        <h3 className="font-bold text-foreground text-lg mb-4">Datos del Cliente</h3>

        <div className="grid gap-4 grid-cols-1 md:grid-cols-2 mb-6">
          <div>
            <label className="block text-sm font-bold text-muted mb-2">Nombre Cliente</label>
            <input
              type="text"
              value={formulario.cliente_nombre || ''}
              onChange={(e) => handleInputChange('cliente_nombre', e.target.value)}
              className="w-full rounded-lg border border-border bg-card px-4 py-3 text-foreground"
            />
          </div>
          <div>
            <label className="block text-sm font-bold text-muted mb-2">Localidad</label>
            <input
              type="text"
              value={formulario.cliente_localidad || ''}
              onChange={(e) => handleInputChange('cliente_localidad', e.target.value)}
              className="w-full rounded-lg border border-border bg-card px-4 py-3 text-foreground"
            />
          </div>
          <div>
            <label className="block text-sm font-bold text-muted mb-2">Consumo Anual (kWh)</label>
            <input
              type="number"
              value={formulario.consumo_anual || 4000}
              onChange={(e) => handleInputChange('consumo_anual', parseFloat(e.target.value))}
              className="w-full rounded-lg border border-border bg-card px-4 py-3 text-foreground"
            />
          </div>
          <div>
            <label className="block text-sm font-bold text-muted mb-2">Área Techo (m²)</label>
            <input
              type="number"
              value={formulario.techo_area || 30}
              onChange={(e) => handleInputChange('techo_area', parseFloat(e.target.value))}
              className="w-full rounded-lg border border-border bg-card px-4 py-3 text-foreground"
            />
          </div>
          <div>
            <label className="block text-sm font-bold text-muted mb-2">Inclinación (°)</label>
            <input
              type="number"
              value={formulario.techo_inclinacion || 37}
              onChange={(e) => handleInputChange('techo_inclinacion', parseFloat(e.target.value))}
              className="w-full rounded-lg border border-border bg-card px-4 py-3 text-foreground"
            />
          </div>
          <div>
            <label className="block text-sm font-bold text-muted mb-2">Presupuesto Máximo (€)</label>
            <input
              type="number"
              value={formulario.inversion_presupuesto || 10000}
              onChange={(e) => handleInputChange('inversion_presupuesto', parseFloat(e.target.value))}
              className="w-full rounded-lg border border-border bg-card px-4 py-3 text-foreground"
            />
          </div>
        </div>

        <div className="flex gap-3 mt-6">
          <button
            onClick={calcularResultados}
            className="flex-1 px-6 py-3 rounded-lg bg-accent text-white font-bold hover:bg-accent/90 transition"
          >
            Calcular Especificación
          </button>
          <button
            onClick={limpiarFormulario}
            className="px-6 py-3 rounded-lg border border-border bg-card/50 text-foreground font-semibold hover:bg-card transition"
          >
            Limpiar
          </button>
        </div>
      </div>

      {/* Resultados */}
      {mostrarResultados && resultados && (
        <div className="space-y-6">
          <div className="card rounded-2xl p-6 md:p-8 bg-secondary/10 border border-secondary/30">
            <h3 className="font-bold text-foreground text-lg mb-6">Resultados del Cálculo</h3>

            <div className="grid gap-4 grid-cols-1 md:grid-cols-3">
              <div className="bg-card/80 rounded-lg p-4 border border-border/50">
                <div className="text-xs font-bold text-muted mb-2">POTENCIA ESTIMADA</div>
                <div className="text-2xl font-black text-secondary">{resultados.potenciaEstimada} kWp</div>
              </div>
              <div className="bg-card/80 rounded-lg p-4 border border-border/50">
                <div className="text-xs font-bold text-muted mb-2">PRODUCCIÓN ANUAL</div>
                <div className="text-2xl font-black text-secondary">{resultados.produccionAnual.toLocaleString()} kWh</div>
              </div>
              <div className="bg-card/80 rounded-lg p-4 border border-border/50">
                <div className="text-xs font-bold text-muted mb-2">AHORRO ANUAL</div>
                <div className="text-2xl font-black text-secondary">{resultados.ahorroAnual.toLocaleString()} €</div>
              </div>
            </div>

            <div className="mt-6 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted">Fase 1 (Sistema):</span>
                <span className="font-semibold text-foreground">{resultados.costePhase1.toLocaleString()} €</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted">Fase 2 (Baterías):</span>
                <span className="font-semibold text-foreground">{resultados.costePhase2.toLocaleString()} €</span>
              </div>
              <div className="flex justify-between text-sm border-t border-border pt-2 mt-2">
                <span className="font-bold text-foreground">TOTAL:</span>
                <span className="text-xl font-black text-accent">{resultados.costeTotal.toLocaleString()} €</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted">Amortización:</span>
                <span className="font-semibold text-secondary">{resultados.roi} años</span>
              </div>
            </div>

            <button
              onClick={generarPDF}
              className="w-full mt-6 px-6 py-3 rounded-lg bg-secondary text-white font-bold hover:bg-secondary/90 transition"
            >
              Generar PDF
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
