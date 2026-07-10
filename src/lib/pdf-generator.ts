/**
 * Generador de PDF para especificaciones técnicas
 * Exporta la información técnica en formato PDF profesional y limpio
 */

export async function generarPdfEspecificacion(datos: any) {
  // Importar dinámicamente para evitar errores en SSR
  const html2pdf = (await import('html2pdf.js')).default;

  // Mapeos de valores para mostrar nombres legibles
  const mapeos: { [key: string]: { [key: string]: string } } = {
    fase_sistema: {
      mono: 'Monofásico (220V)',
      tri: 'Trifásico (400V)',
    },
    acceso_tejado: {
      escalera_interior: 'Escalera interior (fácil)',
      escalera_exterior: 'Escalera exterior fija',
      escala_port: 'Escala portátil',
      altura_dificil: 'Acceso difícil (altura, complicado)',
    },
    orientacion_tejado: {
      norte: 'Norte (no ideal)',
      noreste: 'Noreste',
      este: 'Este (bueno)',
      sureste: 'Sureste (muy bueno)',
      sur: 'Sur (óptimo)',
      suroeste: 'Suroeste (muy bueno)',
      oeste: 'Oeste (bueno)',
      noroeste: 'Noroeste',
    },
    inclinacion_tejado: {
      plano: 'Plano (0-10°)',
      bajo: 'Bajo (10-20°)',
      medio: 'Medio (20-35°, óptimo)',
      alto: 'Alto (35-50°)',
      muy_alto: 'Muy alto (>50°)',
    },
  };

  const traducir = (campo: string, valor: string): string => {
    if (!valor) return '—';
    return mapeos[campo]?.[valor] || valor;
  };

  // HTML del PDF
  const htmlContent = `
    <!DOCTYPE html>
    <html lang="es">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Especificación Técnica Fotovoltaica</title>
      <style>
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }

        body {
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
          color: #2c3e50;
          line-height: 1.6;
          background: white;
          padding: 40px;
        }

        .page-break {
          page-break-after: always;
        }

        /* HEADER */
        .header {
          border-bottom: 3px solid #ff3333;
          padding-bottom: 20px;
          margin-bottom: 30px;
        }

        .header-title {
          font-size: 28px;
          font-weight: 700;
          color: #1a1a2e;
          margin-bottom: 5px;
          letter-spacing: -0.5px;
        }

        .header-subtitle {
          font-size: 13px;
          color: #7f8c8d;
          text-transform: uppercase;
          letter-spacing: 1px;
        }

        .header-date {
          font-size: 12px;
          color: #95a5a6;
          margin-top: 10px;
        }

        /* SECCIONES */
        .section {
          margin-bottom: 35px;
        }

        .section-title {
          font-size: 16px;
          font-weight: 700;
          color: #ff3333;
          border-left: 4px solid #ff3333;
          padding-left: 12px;
          margin-bottom: 15px;
          text-transform: uppercase;
          letter-spacing: 0.8px;
        }

        /* CLIENTE */
        .cliente-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 20px;
          margin-bottom: 20px;
        }

        .cliente-item {
          background: #f8f9fa;
          padding: 12px 15px;
          border-radius: 6px;
          border-left: 3px solid #00d4ff;
        }

        .cliente-label {
          font-size: 11px;
          font-weight: 700;
          color: #7f8c8d;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          margin-bottom: 4px;
        }

        .cliente-value {
          font-size: 13px;
          font-weight: 600;
          color: #2c3e50;
        }

        /* ESPECIFICACIONES */
        .spec-grid {
          display: grid;
          grid-template-columns: 1fr 1fr 1fr;
          gap: 15px;
          margin-bottom: 20px;
        }

        .spec-box {
          background: linear-gradient(135deg, #f5f7fa 0%, #f0f3f7 100%);
          padding: 15px;
          border-radius: 8px;
          border: 1px solid #e8eef5;
        }

        .spec-label {
          font-size: 10px;
          font-weight: 700;
          color: #95a5a6;
          text-transform: uppercase;
          letter-spacing: 0.6px;
          margin-bottom: 6px;
        }

        .spec-value {
          font-size: 18px;
          font-weight: 700;
          color: #ff3333;
        }

        .spec-unit {
          font-size: 11px;
          color: #7f8c8d;
          font-weight: 500;
          margin-top: 3px;
        }

        /* TABLA TÉCNICA */
        .technical-table {
          width: 100%;
          border-collapse: collapse;
          margin: 20px 0;
          font-size: 12px;
        }

        .technical-table thead {
          background: #f8f9fa;
          border-top: 2px solid #ff3333;
          border-bottom: 2px solid #ff3333;
        }

        .technical-table th {
          padding: 12px;
          text-align: left;
          font-weight: 700;
          color: #2c3e50;
          letter-spacing: 0.3px;
        }

        .technical-table td {
          padding: 11px 12px;
          border-bottom: 1px solid #ecf0f1;
          color: #34495e;
        }

        .technical-table tr:hover {
          background: #f8f9fa;
        }

        .label-col {
          font-weight: 600;
          color: #2c3e50;
          width: 40%;
        }

        .value-col {
          color: #555;
        }

        /* ALERTAS */
        .alerts {
          background: #fff3cd;
          border-left: 4px solid #ffc107;
          padding: 15px;
          margin: 20px 0;
          border-radius: 4px;
        }

        .alerts-title {
          font-weight: 700;
          color: #856404;
          margin-bottom: 10px;
          font-size: 12px;
          text-transform: uppercase;
        }

        .alert-item {
          font-size: 12px;
          color: #7a5c3a;
          margin: 6px 0;
          padding-left: 20px;
          position: relative;
        }

        .alert-item:before {
          content: '⚠';
          position: absolute;
          left: 0;
        }

        /* FOOTER */
        .footer {
          margin-top: 40px;
          padding-top: 20px;
          border-top: 1px solid #ecf0f1;
          font-size: 11px;
          color: #95a5a6;
          text-align: center;
        }

        .footer-note {
          font-size: 10px;
          color: #7f8c8d;
          background: #f8f9fa;
          padding: 12px;
          border-radius: 4px;
          margin-top: 15px;
          border-left: 3px solid #00d4ff;
        }
      </style>
    </head>
    <body>
      <!-- HEADER -->
      <div class="header">
        <div class="header-title">⚡ ESPECIFICACIÓN TÉCNICA FOTOVOLTAICA</div>
        <div class="header-subtitle">GESMECO ENERGÍA · Comarca Litera, Aragón</div>
        <div class="header-date">Documento generado: ${new Date().toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric' })}</div>
      </div>

      <!-- DATOS DEL CLIENTE -->
      <div class="section">
        <div class="section-title">👤 Datos del Cliente</div>
        <div class="cliente-grid">
          <div class="cliente-item">
            <div class="cliente-label">Cliente</div>
            <div class="cliente-value">${datos.cliente_nombre || '—'}</div>
          </div>
          <div class="cliente-item">
            <div class="cliente-label">Email</div>
            <div class="cliente-value">${datos.cliente_email || '—'}</div>
          </div>
          <div class="cliente-item">
            <div class="cliente-label">Teléfono</div>
            <div class="cliente-value">${datos.cliente_telefono || '—'}</div>
          </div>
          <div class="cliente-item">
            <div class="cliente-label">Ubicación</div>
            <div class="cliente-value">${datos.cliente_ubicacion || '—'}</div>
          </div>
        </div>
      </div>

      <!-- ESPECIFICACIONES TÉCNICAS -->
      <div class="section">
        <div class="section-title">📐 Especificaciones Técnicas</div>
        <div class="spec-grid">
          <div class="spec-box">
            <div class="spec-label">Consumo Anual</div>
            <div class="spec-value">${datos.consumo_anual ? datos.consumo_anual.toLocaleString('es-ES') : '—'}</div>
            <div class="spec-unit">kWh/año</div>
          </div>
          <div class="spec-box">
            <div class="spec-label">Potencia Deseada</div>
            <div class="spec-value">${datos.potencia_deseada || '—'}</div>
            <div class="spec-unit">kW</div>
          </div>
          <div class="spec-box">
            <div class="spec-label">Espacio Disponible</div>
            <div class="spec-value">${datos.espacio_disponible || '—'}</div>
            <div class="spec-unit">m²</div>
          </div>
          ${datos.num_paneles ? `
          <div class="spec-box">
            <div class="spec-label">Paneles Necesarios</div>
            <div class="spec-value">${datos.num_paneles}</div>
            <div class="spec-unit">unidades × 450W</div>
          </div>
          ` : ''}
          ${datos.potencia_real ? `
          <div class="spec-box">
            <div class="spec-label">Potencia Real</div>
            <div class="spec-value">${datos.potencia_real.toFixed(2)}</div>
            <div class="spec-unit">kW instalados</div>
          </div>
          ` : ''}
          ${datos.produccion_anual ? `
          <div class="spec-box">
            <div class="spec-label">Producción Anual</div>
            <div class="spec-value">${datos.produccion_anual.toLocaleString('es-ES')}</div>
            <div class="spec-unit">kWh/año</div>
          </div>
          ` : ''}
        </div>
      </div>

      <!-- TABLA TÉCNICA -->
      <div class="section">
        <div class="section-title">⚙️ Análisis Técnico Detallado</div>
        <table class="technical-table">
          <thead>
            <tr>
              <th>Parámetro Técnico</th>
              <th>Especificación</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td class="label-col">Sistema Eléctrico</td>
              <td class="value-col">${traducir('fase_sistema', datos.fase_sistema)}</td>
            </tr>
            <tr>
              <td class="label-col">Tipo de Tejado</td>
              <td class="value-col">${datos.tipo_tejado || '—'}</td>
            </tr>
            <tr>
              <td class="label-col">Acceso al Tejado</td>
              <td class="value-col">${traducir('acceso_tejado', datos.acceso_tejado)}</td>
            </tr>
            <tr>
              <td class="label-col">Orientación</td>
              <td class="value-col">${traducir('orientacion_tejado', datos.orientacion_tejado)}</td>
            </tr>
            <tr>
              <td class="label-col">Inclinación</td>
              <td class="value-col">${traducir('inclinacion_tejado', datos.inclinacion_tejado)}</td>
            </tr>
            <tr>
              <td class="label-col">Sombreado</td>
              <td class="value-col">${datos.sombreado || '—'}</td>
            </tr>
            <tr>
              <td class="label-col">Estado del Tejado</td>
              <td class="value-col">${datos.estado_tejado || '—'}</td>
            </tr>
            <tr>
              <td class="label-col">Acometida Eléctrica</td>
              <td class="value-col">${datos.acometida_cambio || '—'}</td>
            </tr>
            <tr>
              <td class="label-col">Tierra Eléctrica</td>
              <td class="value-col">${datos.tierra_adecuada || '—'}</td>
            </tr>
            <tr>
              <td class="label-col">Altura (pisos)</td>
              <td class="value-col">${datos.altura_edificio_pisos || '—'}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- CONDICIONES CLIMÁTICAS -->
      <div class="section">
        <div class="section-title">🌤️ Condiciones Climáticas</div>
        <table class="technical-table">
          <tbody>
            ${datos.clima_viento ? '<tr><td class="label-col">Zona de Viento</td><td class="value-col">Sí</td></tr>' : ''}
            ${datos.clima_nieve ? '<tr><td class="label-col">Nieve Frecuente</td><td class="value-col">Sí</td></tr>' : ''}
            ${datos.clima_salinidad ? '<tr><td class="label-col">Zona Salina</td><td class="value-col">Sí</td></tr>' : ''}
            ${datos.clima_polvo ? '<tr><td class="label-col">Polvo/Contaminación</td><td class="value-col">Sí</td></tr>' : ''}
          </tbody>
        </table>
      </div>

      <!-- ALMACENAMIENTO -->
      ${datos.incluir_baterias ? `
      <div class="section">
        <div class="section-title">🔋 Almacenamiento</div>
        <table class="technical-table">
          <tbody>
            <tr>
              <td class="label-col">Baterías</td>
              <td class="value-col">Sí - ${datos.capacidad_baterias} kWh</td>
            </tr>
          </tbody>
        </table>
      </div>
      ` : ''}

      <!-- ALERTAS -->
      ${datos.alertas && datos.alertas.length > 0 ? `
      <div class="alerts">
        <div class="alerts-title">Validaciones Técnicas Importantes</div>
        ${datos.alertas.map((alerta: string) => `<div class="alert-item">${alerta}</div>`).join('')}
      </div>
      ` : ''}

      <!-- FOOTER -->
      <div class="footer">
        <div class="footer-note">
          📋 Esta es una especificación técnica de GESMECO ENERGÍA. El instalador deberá realizar visita técnica previa para validar todas las condiciones in situ y elaborar presupuesto final según sus costos y márgenes comerciales.
        </div>
      </div>
    </body>
    </html>
  `;

  // Opciones de PDF
  const options: any = {
    margin: 10,
    filename: `Especificacion_${datos.cliente_nombre || 'proyecto'}_${new Date().toISOString().slice(0, 10)}.pdf`,
    image: { type: 'png' as any, quality: 0.98 },
    html2canvas: { scale: 2 },
    jsPDF: { orientation: 'portrait', unit: 'mm', format: 'a4' },
  };

  // Generar PDF
  html2pdf().set(options).from(htmlContent).save();
}
