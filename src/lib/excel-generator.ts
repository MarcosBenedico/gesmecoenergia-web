/**
 * Generador de Excel para especificaciones fotovoltaicas
 * 2 hojas: CLIENTE | FOTOVOLTAICA
 * Optimizado para que el instalador presupueste
 */

import ExcelJS from 'exceljs';

const COLORES = {
  rojo: 'FFFF3333',
  cyan: 'FF00D4FF',
  gris_oscuro: 'FF2C3E50',
  gris_claro: 'FFF8F9FA',
  blanco: 'FFFFFFFF',
  verde: 'FF27AE60',
};

function aplicarHeader(cell: any, texto: string) {
  cell.value = texto;
  cell.font = { bold: true, size: 14, color: { argb: COLORES.blanco } };
  cell.fill = { type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb: COLORES.rojo } };
  cell.alignment = { horizontal: 'center' as const, vertical: 'middle' as const };
}

function aplicarSubheader(cell: any, texto: string) {
  cell.value = texto;
  cell.font = { bold: true, size: 11, color: { argb: COLORES.rojo } };
  cell.fill = { type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb: COLORES.gris_claro } };
  cell.alignment = { horizontal: 'left' as const, vertical: 'middle' as const };
  cell.border = { bottom: { style: 'thin' as const, color: { argb: COLORES.cyan } } };
}

function aplicarLabel(cell: any) {
  cell.font = { bold: true, size: 10, color: { argb: COLORES.gris_oscuro } };
  cell.fill = { type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb: COLORES.gris_claro } };
  cell.alignment = { horizontal: 'left' as const, vertical: 'middle' as const, wrapText: true };
  cell.border = { left: { style: 'thin' as const, color: { argb: COLORES.cyan } } };
}

function aplicarValor(cell: any) {
  cell.font = { size: 10, color: { argb: COLORES.gris_oscuro } };
  cell.alignment = { horizontal: 'left' as const, vertical: 'middle' as const, wrapText: true };
}

export async function generarExcelEspecificacion(datos: any) {
  const workbook = new ExcelJS.Workbook();
  const fecha = new Date().toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric' });

  // ============================================
  // HOJA 1: CLIENTE
  // ============================================
  const cliente = workbook.addWorksheet('Cliente', { properties: { tabColor: { argb: COLORES.rojo } } });
  cliente.columns = [{ width: 30 }, { width: 45 }];

  let fila = 1;

  // Header
  const headerCliente = cliente.getCell('A1');
  aplicarHeader(headerCliente, '👤 DATOS DEL CLIENTE');
  cliente.mergeCells('A1:B1');
  cliente.getRow(1).height = 30;

  const subtituloCliente = cliente.getCell('A2');
  subtituloCliente.value = `Solicitud de Presupuesto - ${fecha}`;
  subtituloCliente.font = { size: 10, italic: true, color: { argb: COLORES.gris_oscuro } };
  subtituloCliente.alignment = { horizontal: 'center' as const };
  cliente.mergeCells('A2:B2');
  cliente.getRow(2).height = 18;

  fila = 4;

  // Datos cliente
  const datos_cliente = [
    ['Nombre Completo', datos.cliente_nombre || '—'],
    ['Email', datos.cliente_email || '—'],
    ['Teléfono', datos.cliente_telefono || '—'],
    ['Ubicación / Municipio', datos.cliente_ubicacion || '—'],
    ['Dirección', datos.cliente_direccion || '—'],
    ['Google Maps Link', datos.cliente_ubicacion_gps || '—'],
  ];

  datos_cliente.forEach(([label, valor]) => {
    const labelCell = cliente.getCell(`A${fila}`);
    labelCell.value = label;
    aplicarLabel(labelCell);

    const valorCell = cliente.getCell(`B${fila}`);
    valorCell.value = valor;
    aplicarValor(valorCell);

    cliente.getRow(fila).height = 20;
    fila++;
  });

  fila += 1;

  // Notas
  const notasHeader = cliente.getCell(`A${fila}`);
  notasHeader.value = 'Notas / Descripción';
  notasHeader.font = { bold: true, size: 11, color: { argb: COLORES.rojo } };
  cliente.mergeCells(`A${fila}:B${fila}`);
  cliente.getRow(fila).height = 20;
  fila++;

  const notasCell = cliente.getCell(`A${fila}`);
  notasCell.value = datos.cliente_descripcion || '—';
  notasCell.alignment = { wrapText: true, vertical: 'top' as const };
  cliente.mergeCells(`A${fila}:B${fila}`);
  cliente.getRow(fila).height = 60;

  // ============================================
  // HOJA 2: FOTOVOLTAICA
  // ============================================
  const fotovoltaica = workbook.addWorksheet('Fotovoltaica', { properties: { tabColor: { argb: COLORES.verde } } });

  // Layout: Columnas para información
  fotovoltaica.columns = [
    { width: 20 }, // A: Etiqueta 1
    { width: 18 }, // B: Valor 1
    { width: 20 }, // C: Etiqueta 2
    { width: 18 }, // D: Valor 2
    { width: 20 }, // E: Etiqueta 3
    { width: 18 }, // F: Valor 3
  ];

  let filaPV = 1;

  // Header
  const headerPV = fotovoltaica.getCell('A1');
  aplicarHeader(headerPV, '⚡ ESPECIFICACIÓN TÉCNICA FOTOVOLTAICA');
  fotovoltaica.mergeCells('A1:F1');
  fotovoltaica.getRow(1).height = 30;

  const subtituloPV = fotovoltaica.getCell('A2');
  subtituloPV.value = `Cliente: ${datos.cliente_nombre || '—'} | ${fecha} | GESMECO ENERGÍA`;
  subtituloPV.font = { size: 9, italic: true, color: { argb: COLORES.gris_oscuro } };
  fotovoltaica.mergeCells('A2:F2');
  fotovoltaica.getRow(2).height = 16;

  filaPV = 4;

  // FUNCIÓN AUXILIAR para agregar fila de datos (2 columnas)
  function agregarFila2Col(
    fila: number,
    label1: string,
    valor1: any,
    label2: string,
    valor2: any,
    label3?: string,
    valor3?: any
  ) {
    // Columna 1
    const l1 = fotovoltaica.getCell(`A${fila}`);
    l1.value = label1;
    aplicarLabel(l1);

    const v1 = fotovoltaica.getCell(`B${fila}`);
    v1.value = valor1 || '—';
    aplicarValor(v1);

    // Columna 2
    const l2 = fotovoltaica.getCell(`C${fila}`);
    l2.value = label2;
    aplicarLabel(l2);

    const v2 = fotovoltaica.getCell(`D${fila}`);
    v2.value = valor2 || '—';
    aplicarValor(v2);

    // Columna 3 (opcional)
    if (label3) {
      const l3 = fotovoltaica.getCell(`E${fila}`);
      l3.value = label3;
      aplicarLabel(l3);

      const v3 = fotovoltaica.getCell(`F${fila}`);
      v3.value = valor3 || '—';
      aplicarValor(v3);
    }

    fotovoltaica.getRow(fila).height = 22;
    return fila + 1;
  }

  // SECCIÓN 1: CONSUMO Y POTENCIA
  const sec1Header = fotovoltaica.getCell(`A${filaPV}`);
  aplicarSubheader(sec1Header, '📊 CONSUMO Y DEMANDA');
  fotovoltaica.mergeCells(`A${filaPV}:F${filaPV}`);
  fotovoltaica.getRow(filaPV).height = 22;
  filaPV++;

  filaPV = agregarFila2Col(
    filaPV,
    'Consumo Anual',
    datos.consumo_anual ? `${datos.consumo_anual.toLocaleString('es-ES')} kWh` : '—',
    'Potencia Deseada',
    datos.potencia_deseada ? `${datos.potencia_deseada} kW` : '—',
    'Presupuesto Máximo',
    datos.presupuesto_maximo ? `${datos.presupuesto_maximo}€` : '—'
  );

  filaPV = agregarFila2Col(
    filaPV,
    'Sistema Eléctrico',
    datos.fase_sistema === 'mono' ? 'Monofásico (220V)' : 'Trifásico (400V)',
    'Tipo Tejado',
    datos.tipo_tejado || '—',
    'Espacio Disponible',
    datos.espacio_disponible ? `${datos.espacio_disponible} m²` : '—'
  );

  filaPV++;

  // SECCIÓN 2: GEOMETRÍA Y ACCESO
  const sec2Header = fotovoltaica.getCell(`A${filaPV}`);
  aplicarSubheader(sec2Header, '🏠 GEOMETRÍA DEL LUGAR');
  fotovoltaica.mergeCells(`A${filaPV}:F${filaPV}`);
  fotovoltaica.getRow(filaPV).height = 22;
  filaPV++;

  filaPV = agregarFila2Col(
    filaPV,
    'Orientación Tejado',
    datos.orientacion_tejado || '—',
    'Inclinación',
    datos.inclinacion_tejado || '—',
    'Altura (pisos)',
    datos.altura_edificio_pisos || '—'
  );

  filaPV = agregarFila2Col(
    filaPV,
    'Acceso al Tejado',
    datos.acceso_tejado || '—',
    'Sombreado',
    datos.sombreado || '—',
    'Estado Tejado',
    datos.estado_tejado || '—'
  );

  filaPV++;

  // SECCIÓN 3: INSTALACIÓN TÉCNICA
  const sec3Header = fotovoltaica.getCell(`A${filaPV}`);
  aplicarSubheader(sec3Header, '⚙️ INSTALACIÓN TÉCNICA');
  fotovoltaica.mergeCells(`A${filaPV}:F${filaPV}`);
  fotovoltaica.getRow(filaPV).height = 22;
  filaPV++;

  filaPV = agregarFila2Col(
    filaPV,
    'Distancia Cuadro a Tejado',
    datos.distancia_cuadro_a_tejado_metros ? `${datos.distancia_cuadro_a_tejado_metros} m` : '—',
    'Cuadro Accesible',
    datos.cuadro_accesible || '—',
    'Tierra Eléctrica',
    datos.tierra_adecuada || '—'
  );

  filaPV = agregarFila2Col(
    filaPV,
    'Acometida Cambio',
    datos.acometida_cambio || '—',
    'Distancia Cableado',
    datos.distancia_cableado || '—',
    'Espacio Almacén',
    datos.espacio_almacenamiento || '—'
  );

  filaPV = agregarFila2Col(
    filaPV,
    'Andamiaje Necesario',
    datos.andamiaje_necesario || '—',
    'Necesita Grúa',
    datos.necesita_grua ? 'Sí ✓' : 'No',
    'Refuerzo Estructural',
    datos.requiere_refuerzo_estructural ? 'Sí ✓' : 'No'
  );

  filaPV++;

  // SECCIÓN 4: CONDICIONES ESPECIALES
  const sec4Header = fotovoltaica.getCell(`A${filaPV}`);
  aplicarSubheader(sec4Header, '⚠️ CONDICIONES ESPECIALES');
  fotovoltaica.mergeCells(`A${filaPV}:F${filaPV}`);
  fotovoltaica.getRow(filaPV).height = 22;
  filaPV++;

  const condicionesEspeciales = [];
  if (datos.clima_viento) condicionesEspeciales.push('Viento');
  if (datos.clima_nieve) condicionesEspeciales.push('Nieve');
  if (datos.clima_salinidad) condicionesEspeciales.push('Salinidad');
  if (datos.clima_polvo) condicionesEspeciales.push('Polvo');
  if (datos.presencia_amianto) condicionesEspeciales.push('Amianto probable');
  if (datos.reparaciones_tejado_previas) condicionesEspeciales.push('Reparaciones previas');

  filaPV = agregarFila2Col(
    filaPV,
    'Clima/Dificultades',
    condicionesEspeciales.length > 0 ? condicionesEspeciales.join(', ') : 'Ninguna',
    'Consumo Crítico',
    datos.consumo_critico || 'No',
    'Carga Tejado Máx',
    datos.carga_tejado_maxima ? `${datos.carga_tejado_maxima} kg/m²` : '—'
  );

  filaPV++;

  // SECCIÓN 5: ESPECIFICACIONES CALCULADAS
  if (datos.num_paneles) {
    const sec5Header = fotovoltaica.getCell(`A${filaPV}`);
    aplicarSubheader(sec5Header, '📋 ESPECIFICACIONES CALCULADAS');
    fotovoltaica.mergeCells(`A${filaPV}:F${filaPV}`);
    fotovoltaica.getRow(filaPV).height = 22;
    filaPV++;

    filaPV = agregarFila2Col(
      filaPV,
      'Paneles Necesarios',
      `${datos.num_paneles} × 450W`,
      'Potencia Real',
      `${datos.potencia_real?.toFixed(2)} kW`,
      'Espacio Requerido',
      `${datos.espacio_requerido?.toFixed(1)} m²`
    );

    filaPV = agregarFila2Col(
      filaPV,
      'Producción Anual',
      datos.produccion_anual ? `${datos.produccion_anual.toLocaleString('es-ES')} kWh/año` : '—',
      'Inversor Marca',
      datos.inversor?.marca || '—',
      'Inversor Modelo',
      datos.inversor?.modelo || '—'
    );

    filaPV += 1;
  }

  // SECCIÓN 6: ALMACENAMIENTO (si aplica)
  if (datos.incluir_baterias) {
    const sec6Header = fotovoltaica.getCell(`A${filaPV}`);
    aplicarSubheader(sec6Header, '🔋 ALMACENAMIENTO');
    fotovoltaica.mergeCells(`A${filaPV}:F${filaPV}`);
    fotovoltaica.getRow(filaPV).height = 22;
    filaPV++;

    filaPV = agregarFila2Col(
      filaPV,
      'Incluir Baterías',
      'Sí ✓',
      'Capacidad',
      `${datos.capacidad_baterias} kWh`,
      'Tipo',
      'LiFePO4'
    );

    filaPV++;
  }

  // SECCIÓN 7: ALERTAS (si hay)
  if (datos.alertas && datos.alertas.length > 0) {
    const sec7Header = fotovoltaica.getCell(`A${filaPV}`);
    aplicarSubheader(sec7Header, '🚨 VALIDACIONES TÉCNICAS IMPORTANTES');
    fotovoltaica.mergeCells(`A${filaPV}:F${filaPV}`);
    fotovoltaica.getRow(filaPV).height = 22;
    filaPV++;

    datos.alertas.forEach((alerta: string) => {
      const alertaCell = fotovoltaica.getCell(`A${filaPV}`);
      alertaCell.value = '⚠️ ' + alerta;
      alertaCell.font = { size: 10, color: { argb: 'FFFF6B00' }, bold: true };
      alertaCell.fill = { type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb: 'FFFFF3CD' } };
      alertaCell.alignment = { wrapText: true, vertical: 'top' as const };
      fotovoltaica.mergeCells(`A${filaPV}:F${filaPV}`);
      fotovoltaica.getRow(filaPV).height = 24;
      filaPV++;
    });

    filaPV++;
  }

  // SECCIÓN 8: NOTA FINAL
  const notaFinal = fotovoltaica.getCell(`A${filaPV}`);
  notaFinal.value = '📌 IMPORTANTE: Esta es una especificación técnica de GESMECO ENERGÍA basada en los datos proporcionados. El instalador debe realizar una visita técnica previa para validar todas las condiciones in situ, las medidas exactas, accesos, y cualquier complicación adicional antes de elaborar el presupuesto profesional final.';
  notaFinal.font = { size: 9, italic: true, color: { argb: COLORES.gris_oscuro } };
  notaFinal.fill = { type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb: 'FFF0F0F0' } };
  notaFinal.alignment = { wrapText: true, vertical: 'top' as const };
  fotovoltaica.mergeCells(`A${filaPV}:F${filaPV}`);
  fotovoltaica.getRow(filaPV).height = 50;

  // Generar archivo
  const fileName = `Presupuesto_FV_${datos.cliente_nombre || 'proyecto'}_${new Date().toISOString().slice(0, 10)}.xlsx`;
  const buffer = await workbook.xlsx.writeBuffer();

  // Crear descarga
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(url);
}
