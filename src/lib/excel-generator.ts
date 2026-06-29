/**
 * Generador de Excel para especificaciones técnicas
 * Exporta toda la información en múltiples hojas con diseño profesional
 */

import ExcelJS from 'exceljs';

const COLORES_CORPORATIVOS = {
  rojo: 'FFFF3333',
  cyan: 'FF00D4FF',
  gris_oscuro: 'FF2C3E50',
  gris_claro: 'FFF8F9FA',
  blanco: 'FFFFFFFF',
  verde: 'FF27AE60',
  naranja: 'FFFF9500',
};

const ESTILOS = {
  header: {
    font: { bold: true, size: 14, color: { argb: 'FFFFFFFF' } },
    fill: { type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb: COLORES_CORPORATIVOS.rojo } },
    alignment: { horizontal: 'center' as const, vertical: 'center' as const, wrapText: true },
    border: {
      top: { style: 'thin' as const, color: { argb: COLORES_CORPORATIVOS.rojo } },
      left: { style: 'thin' as const, color: { argb: COLORES_CORPORATIVOS.rojo } },
      bottom: { style: 'thin' as const, color: { argb: COLORES_CORPORATIVOS.rojo } },
      right: { style: 'thin' as const, color: { argb: COLORES_CORPORATIVOS.rojo } },
    },
  },
  subheader: {
    font: { bold: true, size: 12, color: { argb: COLORES_CORPORATIVOS.rojo } },
    fill: { type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb: COLORES_CORPORATIVOS.gris_claro } },
    alignment: { horizontal: 'left' as const, vertical: 'center' as const },
    border: {
      bottom: { style: 'thin' as const, color: { argb: COLORES_CORPORATIVOS.cyan } },
    },
  },
  label: {
    font: { bold: true, size: 11, color: { argb: COLORES_CORPORATIVOS.gris_oscuro } },
    fill: { type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb: COLORES_CORPORATIVOS.gris_claro } },
    alignment: { horizontal: 'left' as const, vertical: 'center' as const },
  },
  value: {
    font: { size: 11, color: { argb: COLORES_CORPORATIVOS.gris_oscuro } },
    alignment: { horizontal: 'left' as const, vertical: 'center' as const, wrapText: true },
  },
  numero: {
    font: { size: 11, color: { argb: COLORES_CORPORATIVOS.rojo }, bold: true },
    alignment: { horizontal: 'right' as const, vertical: 'center' as const },
  },
};

function agregarTitulo(sheet: any, titulo: string, fila: number) {
  const celda = sheet.getCell(`A${fila}`);
  celda.value = titulo;
  celda.font = { bold: true, size: 14, color: { argb: COLORES_CORPORATIVOS.rojo } };
  celda.fill = {
    type: 'pattern' as const,
    pattern: 'solid' as const,
    fgColor: { argb: COLORES_CORPORATIVOS.gris_claro },
  };
  sheet.mergeCells(`A${fila}:D${fila}`);
  sheet.getRow(fila).height = 25;
  return fila + 2;
}

function agregarFila(sheet: any, fila: number, label: string, valor: any) {
  const celdaLabel = sheet.getCell(`A${fila}`);
  celdaLabel.value = label;
  celdaLabel.font = { bold: true, size: 10, color: { argb: COLORES_CORPORATIVOS.gris_oscuro } };
  celdaLabel.fill = {
    type: 'pattern' as const,
    pattern: 'solid' as const,
    fgColor: { argb: COLORES_CORPORATIVOS.gris_claro },
  };
  celdaLabel.border = {
    left: { style: 'thin' as const, color: { argb: COLORES_CORPORATIVOS.cyan } },
  };

  const celdaValor = sheet.getCell(`B${fila}`);
  celdaValor.value = valor || '—';
  celdaValor.font = { size: 10, color: { argb: COLORES_CORPORATIVOS.gris_oscuro } };
  celdaValor.alignment = { wrapText: true };

  sheet.getRow(fila).height = 20;
  return fila + 1;
}

export async function generarExcelEspecificacion(datos: any) {
  const workbook = new ExcelJS.Workbook();
  const fecha = new Date().toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric' });

  // ============================================
  // HOJA 1: RESUMEN
  // ============================================
  const resumen = workbook.addWorksheet('Resumen', { properties: { tabColor: { argb: COLORES_CORPORATIVOS.rojo } } });
  resumen.columns = [
    { width: 30 },
    { width: 35 },
    { width: 20 },
    { width: 20 },
  ];

  let fila = 1;
  const celdaTitulo = resumen.getCell('A1');
  celdaTitulo.value = '⚡ ESPECIFICACIÓN TÉCNICA FOTOVOLTAICA';
  celdaTitulo.font = { bold: true, size: 16, color: { argb: COLORES_CORPORATIVOS.blanco } };
  celdaTitulo.fill = {
    type: 'pattern' as const,
    pattern: 'solid' as const,
    fgColor: { argb: COLORES_CORPORATIVOS.rojo },
  };
  celdaTitulo.alignment = { horizontal: 'center' as const, vertical: 'middle' as const };
  resumen.mergeCells('A1:D1');
  resumen.getRow(1).height = 30;

  const celdaSubtitulo = resumen.getCell('A2');
  celdaSubtitulo.value = `GESMECO ENERGÍA · Comarca Litera, Aragón · ${fecha}`;
  celdaSubtitulo.font = { size: 10, italic: true, color: { argb: COLORES_CORPORATIVOS.gris_oscuro } };
  celdaSubtitulo.alignment = { horizontal: 'center' as const };
  resumen.mergeCells('A2:D2');
  resumen.getRow(2).height = 18;

  fila = 4;

  // Cliente
  fila = agregarTitulo(resumen, '👤 CLIENTE', fila);
  fila = agregarFila(resumen, fila, 'Nombre', datos.cliente_nombre);
  fila = agregarFila(resumen, fila, 'Email', datos.cliente_email);
  fila = agregarFila(resumen, fila, 'Teléfono', datos.cliente_telefono);
  fila = agregarFila(resumen, fila, 'Ubicación', datos.cliente_ubicacion);
  fila += 1;

  // Especificaciones principales
  fila = agregarTitulo(resumen, '📐 ESPECIFICACIONES PRINCIPALES', fila);
  fila = agregarFila(resumen, fila, 'Consumo Anual (kWh/año)', datos.consumo_anual ? `${datos.consumo_anual.toLocaleString('es-ES')}` : '—');
  fila = agregarFila(resumen, fila, 'Potencia Deseada (kW)', datos.potencia_deseada);
  fila = agregarFila(resumen, fila, 'Sistema Eléctrico', datos.fase_sistema === 'mono' ? 'Monofásico (220V)' : 'Trifásico (400V)');
  fila = agregarFila(resumen, fila, 'Tipo de Tejado', datos.tipo_tejado);
  fila = agregarFila(resumen, fila, 'Espacio Disponible (m²)', datos.espacio_disponible);
  fila += 1;

  // Resultados
  if (datos.num_paneles) {
    fila = agregarTitulo(resumen, '⚡ RESULTADOS CALCULADOS', fila);
    fila = agregarFila(resumen, fila, 'Paneles Necesarios (450W)', datos.num_paneles);
    fila = agregarFila(resumen, fila, 'Potencia Real Instalada (kW)', datos.potencia_real?.toFixed(2));
    fila = agregarFila(resumen, fila, 'Espacio Requerido (m²)', datos.espacio_requerido?.toFixed(1));
    fila = agregarFila(resumen, fila, 'Producción Anual (kWh/año)', datos.produccion_anual ? `${datos.produccion_anual.toLocaleString('es-ES')}` : '—');
    fila = agregarFila(resumen, fila, 'Inversor Recomendado', `${datos.inversor?.marca} ${datos.inversor?.modelo} (${datos.inversor?.potencia} kW)`);
  }

  // ============================================
  // HOJA 2: CLIENTE DETALLADO
  // ============================================
  const cliente = workbook.addWorksheet('Cliente', { properties: { tabColor: { argb: COLORES_CORPORATIVOS.cyan } } });
  cliente.columns = [{ width: 35 }, { width: 50 }];

  let fila2 = 1;
  const headerCliente = cliente.getCell('A1');
  headerCliente.value = '👤 DATOS DEL CLIENTE';
  Object.assign(headerCliente, ESTILOS.header);
  cliente.mergeCells('A1:B1');
  cliente.getRow(1).height = 25;

  fila2 = 3;
  fila2 = agregarFila(cliente, fila2, 'Nombre Completo', datos.cliente_nombre);
  fila2 = agregarFila(cliente, fila2, 'Email', datos.cliente_email);
  fila2 = agregarFila(cliente, fila2, 'Teléfono', datos.cliente_telefono);
  fila2 = agregarFila(cliente, fila2, 'Ubicación / Municipio', datos.cliente_ubicacion);
  fila2 = agregarFila(cliente, fila2, 'Dirección Completa', datos.cliente_direccion);
  fila2 = agregarFila(cliente, fila2, 'Google Maps Link', datos.cliente_ubicacion_gps);
  fila2 += 1;
  fila2 = agregarTitulo(cliente, 'NOTAS GENERALES', fila2);
  const notasCell = cliente.getCell(`A${fila2}`);
  notasCell.value = datos.cliente_descripcion || '—';
  notasCell.font = { size: 10, color: { argb: COLORES_CORPORATIVOS.gris_oscuro } };
  notasCell.alignment = { wrapText: true, vertical: 'top' as const };
  cliente.mergeCells(`A${fila2}:B${fila2}`);
  cliente.getRow(fila2).height = 60;

  // ============================================
  // HOJA 3: ESPECIFICACIONES TÉCNICAS
  // ============================================
  const especificaciones = workbook.addWorksheet('Especificaciones', { properties: { tabColor: { argb: COLORES_CORPORATIVOS.naranja } } });
  especificaciones.columns = [{ width: 35 }, { width: 50 }];

  let fila3 = 1;
  const headerEspec = especificaciones.getCell('A1');
  headerEspec.value = '📐 ESPECIFICACIONES TÉCNICAS';
  Object.assign(headerEspec, ESTILOS.header);
  especificaciones.mergeCells('A1:B1');
  especificaciones.getRow(1).height = 25;

  fila3 = 3;
  fila3 = agregarFila(especificaciones, fila3, 'Consumo Anual (kWh/año)', datos.consumo_anual ? `${datos.consumo_anual.toLocaleString('es-ES')}` : '—');
  fila3 = agregarFila(especificaciones, fila3, 'Potencia Deseada (kW)', datos.potencia_deseada);
  fila3 = agregarFila(especificaciones, fila3, 'Presupuesto Máximo (€)', datos.presupuesto_maximo);
  fila3 += 1;
  fila3 = agregarTitulo(especificaciones, 'SISTEMA ELÉCTRICO', fila3);
  fila3 = agregarFila(especificaciones, fila3, 'Tipo de Sistema', datos.fase_sistema === 'mono' ? 'Monofásico (220V)' : 'Trifásico (400V)');
  fila3 = agregarFila(especificaciones, fila3, 'Tipo de Tejado', datos.tipo_tejado);
  fila3 += 1;
  fila3 = agregarTitulo(especificaciones, 'INSTALACIÓN', fila3);
  fila3 = agregarFila(especificaciones, fila3, 'Espacio Disponible (m²)', datos.espacio_disponible);
  fila3 = agregarFila(especificaciones, fila3, 'Altura del Edificio (pisos)', datos.altura_edificio_pisos);

  // ============================================
  // HOJA 4: ANÁLISIS TÉCNICO
  // ============================================
  const analisis = workbook.addWorksheet('Análisis Técnico', { properties: { tabColor: { argb: COLORES_CORPORATIVOS.verde } } });
  analisis.columns = [{ width: 35 }, { width: 50 }];

  let fila4 = 1;
  const headerAnalisis = analisis.getCell('A1');
  headerAnalisis.value = '⚙️ ANÁLISIS TÉCNICO DETALLADO';
  Object.assign(headerAnalisis, ESTILOS.header);
  analisis.mergeCells('A1:B1');
  analisis.getRow(1).height = 25;

  fila4 = 3;
  fila4 = agregarTitulo(analisis, 'ACCESO Y LOGÍSTICA', fila4);
  fila4 = agregarFila(analisis, fila4, 'Acceso al Tejado', datos.acceso_tejado || '—');
  fila4 = agregarFila(analisis, fila4, 'Distancia Cuadro Eléctrico', datos.distancia_cuadro_electrico || '—');
  fila4 = agregarFila(analisis, fila4, 'Espacio Almacenamiento', datos.espacio_almacenamiento || '—');
  fila4 = agregarFila(analisis, fila4, 'Andamiaje Necesario', datos.andamiaje_necesario || '—');
  fila4 += 1;

  fila4 = agregarTitulo(analisis, 'CONDICIONES DEL TEJADO', fila4);
  fila4 = agregarFila(analisis, fila4, 'Orientación', datos.orientacion_tejado || '—');
  fila4 = agregarFila(analisis, fila4, 'Inclinación', datos.inclinacion_tejado || '—');
  fila4 = agregarFila(analisis, fila4, 'Sombreado', datos.sombreado || '—');
  fila4 = agregarFila(analisis, fila4, 'Estado del Tejado', datos.estado_tejado || '—');
  fila4 = agregarFila(analisis, fila4, 'Carga Máxima Permitida (kg/m²)', datos.carga_tejado_maxima || '—');
  fila4 = agregarFila(analisis, fila4, 'Presencia de Amianto', datos.presencia_amianto || '—');
  fila4 += 1;

  fila4 = agregarTitulo(analisis, 'INSTALACIÓN ELÉCTRICA', fila4);
  fila4 = agregarFila(analisis, fila4, 'Cuadro Accesible', datos.cuadro_accesible || '—');
  fila4 = agregarFila(analisis, fila4, 'Tierra Eléctrica', datos.tierra_adecuada || '—');
  fila4 = agregarFila(analisis, fila4, 'Acometida Cambio', datos.acometida_cambio || '—');
  fila4 = agregarFila(analisis, fila4, 'Distancia Cableado', datos.distancia_cableado || '—');

  // ============================================
  // HOJA 5: CLIMA Y CONDICIONES
  // ============================================
  const clima = workbook.addWorksheet('Clima', { properties: { tabColor: { argb: COLORES_CORPORATIVOS.cyan } } });
  clima.columns = [{ width: 35 }, { width: 50 }];

  let fila5 = 1;
  const headerClima = clima.getCell('A1');
  headerClima.value = '🌤️ CONDICIONES CLIMÁTICAS';
  Object.assign(headerClima, ESTILOS.header);
  clima.mergeCells('A1:B1');
  clima.getRow(1).height = 25;

  fila5 = 3;
  fila5 = agregarFila(clima, fila5, 'Zona de Mucho Viento', datos.clima_viento ? '✓ Sí' : '✗ No');
  fila5 = agregarFila(clima, fila5, 'Nieve Frecuente', datos.clima_nieve ? '✓ Sí' : '✗ No');
  fila5 = agregarFila(clima, fila5, 'Zona Salina (Costa)', datos.clima_salinidad ? '✓ Sí' : '✗ No');
  fila5 = agregarFila(clima, fila5, 'Polvo/Contaminación', datos.clima_polvo ? '✓ Sí' : '✗ No');
  fila5 += 1;
  fila5 = agregarTitulo(clima, 'DIFICULTADES ESPECIALES', fila5);
  const dificulCell = clima.getCell(`A${fila5}`);
  dificulCell.value = datos.dificultades_especiales || '—';
  dificulCell.font = { size: 10, color: { argb: COLORES_CORPORATIVOS.gris_oscuro } };
  dificulCell.alignment = { wrapText: true, vertical: 'top' as const };
  clima.mergeCells(`A${fila5}:B${fila5}`);
  clima.getRow(fila5).height = 40;

  // ============================================
  // HOJA 6: NECESIDADES ESPECIALES
  // ============================================
  const necesidades = workbook.addWorksheet('Necesidades', { properties: { tabColor: { argb: COLORES_CORPORATIVOS.rojo } } });
  necesidades.columns = [{ width: 35 }, { width: 50 }];

  let fila6 = 1;
  const headerNecesidades = necesidades.getCell('A1');
  headerNecesidades.value = '🎯 NECESIDADES ESPECIALES';
  Object.assign(headerNecesidades, ESTILOS.header);
  necesidades.mergeCells('A1:B1');
  necesidades.getRow(1).height = 25;

  fila6 = 3;
  fila6 = agregarFila(necesidades, fila6, 'Consumo Crítico', datos.consumo_critico || '—');
  fila6 = agregarFila(necesidades, fila6, 'Prioridad Independencia Energética', datos.independencia_prioridad || '—');
  fila6 = agregarFila(necesidades, fila6, 'Ampliación Futura Prevista', datos.ampliacion_futura || '—');
  fila6 += 1;
  fila6 = agregarTitulo(necesidades, 'INFORMACIÓN INSTALADOR', fila6);
  fila6 = agregarFila(necesidades, fila6, 'Distancia Cuadro a Tejado (metros)', datos.distancia_cuadro_a_tejado_metros);
  fila6 = agregarFila(necesidades, fila6, 'Días Instalación Estimados', datos.dias_instalacion_estimado);
  fila6 = agregarFila(necesidades, fila6, 'Necesita Grúa', datos.necesita_grua ? '✓ Sí' : '✗ No');
  fila6 = agregarFila(necesidades, fila6, 'Requiere Refuerzo Estructural', datos.requiere_refuerzo_estructural ? '✓ Sí' : '✗ No');
  fila6 = agregarFila(necesidades, fila6, 'Reparaciones Tejado Previas', datos.reparaciones_tejado_previas ? '✓ Sí' : '✗ No');

  // ============================================
  // HOJA 7: ALMACENAMIENTO
  // ============================================
  if (datos.incluir_baterias) {
    const almacenamiento = workbook.addWorksheet('Almacenamiento', { properties: { tabColor: { argb: COLORES_CORPORATIVOS.verde } } });
    almacenamiento.columns = [{ width: 35 }, { width: 50 }];

    let fila7 = 1;
    const headerAlmac = almacenamiento.getCell('A1');
    headerAlmac.value = '🔋 ALMACENAMIENTO';
    Object.assign(headerAlmac, ESTILOS.header);
    almacenamiento.mergeCells('A1:B1');
    almacenamiento.getRow(1).height = 25;

    fila7 = 3;
    fila7 = agregarFila(almacenamiento, fila7, 'Incluir Baterías', '✓ Sí');
    fila7 = agregarFila(almacenamiento, fila7, 'Capacidad (kWh)', datos.capacidad_baterias);
    fila7 = agregarFila(almacenamiento, fila7, 'Tipo Recomendado', 'LiFePO4 (Ión de Litio)');
  }

  // ============================================
  // HOJA 8: RESULTADOS CALCULADOS
  // ============================================
  if (datos.num_paneles) {
    const resultados = workbook.addWorksheet('Resultados', { properties: { tabColor: { argb: COLORES_CORPORATIVOS.naranja } } });
    resultados.columns = [{ width: 35 }, { width: 50 }];

    let fila8 = 1;
    const headerResult = resultados.getCell('A1');
    headerResult.value = '⚡ RESULTADOS CALCULADOS';
    Object.assign(headerResult, ESTILOS.header);
    resultados.mergeCells('A1:B1');
    resultados.getRow(1).height = 25;

    fila8 = 3;
    fila8 = agregarTitulo(resultados, 'CÁLCULOS DIMENSIONAMIENTO', fila8);
    fila8 = agregarFila(resultados, fila8, 'Número de Paneles (450W)', datos.num_paneles);
    fila8 = agregarFila(resultados, fila8, 'Potencia Real Instalada (kW)', datos.potencia_real?.toFixed(2));
    fila8 = agregarFila(resultados, fila8, 'Espacio Requerido (m²)', datos.espacio_requerido?.toFixed(1));
    fila8 = agregarFila(resultados, fila8, 'Producción Anual Estimada (kWh/año)', datos.produccion_anual ? `${datos.produccion_anual.toLocaleString('es-ES')}` : '—');
    fila8 += 1;
    fila8 = agregarTitulo(resultados, 'EQUIPO RECOMENDADO', fila8);
    fila8 = agregarFila(resultados, fila8, 'Marca Inversor', datos.inversor?.marca);
    fila8 = agregarFila(resultados, fila8, 'Modelo Inversor', datos.inversor?.modelo);
    fila8 = agregarFila(resultados, fila8, 'Potencia Inversor (kW)', datos.inversor?.potencia);
  }

  // ============================================
  // HOJA 9: ALERTAS
  // ============================================
  if (datos.alertas && datos.alertas.length > 0) {
    const alertas = workbook.addWorksheet('Alertas', { properties: { tabColor: { argb: 'FFFFCC00' } } });
    alertas.columns = [{ width: 100 }];

    let filaA = 1;
    const headerAlertas = alertas.getCell('A1');
    headerAlertas.value = '⚠️ VALIDACIONES TÉCNICAS IMPORTANTES';
    Object.assign(headerAlertas, ESTILOS.header);
    alertas.mergeCells('A1:A1');
    alertas.getRow(1).height = 25;

    filaA = 3;
    datos.alertas.forEach((alerta: string) => {
      const celdaAlerta = alertas.getCell(`A${filaA}`);
      celdaAlerta.value = alerta;
      celdaAlerta.font = { size: 11, color: { argb: COLORES_CORPORATIVOS.rojo }, bold: true };
      celdaAlerta.fill = {
        type: 'pattern' as const,
        pattern: 'solid' as const,
        fgColor: { argb: 'FFFFF3CD' },
      };
      celdaAlerta.alignment = { wrapText: true, vertical: 'top' as const };
      celdaAlerta.border = {
        left: { style: 'thin' as const, color: { argb: COLORES_CORPORATIVOS.rojo } },
      };
      alertas.getRow(filaA).height = 30;
      filaA += 1;
    });
  }

  // Generar archivo
  const fileName = `Especificacion_${datos.cliente_nombre || 'proyecto'}_${new Date().toISOString().slice(0, 10)}.xlsx`;
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
