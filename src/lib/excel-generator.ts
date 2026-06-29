/**
 * Generador de Excel - PLANTILLA DE PEDRO
 * Idéntico al formato que Pedro proporcionó
 * 2 hojas: CLIENTE | FOTOVOLTAICA
 * Incluye campos dinámicos desde Supabase
 */

import ExcelJS from 'exceljs';

interface CampoMeta {
  campo_key: string;
  label: string;
  tipo: string;
  seccion: string;
  unidad: string;
  en_excel: boolean;
  opciones?: { value: string; label: string }[];
}

function agregarSeccionFotovoltaica(
  ws: ExcelJS.Worksheet,
  fila: number,
  titulo: string
): number {
  // Header de sección (merged A:F)
  const headerCell = ws.getCell(`A${fila}`);
  headerCell.value = titulo;
  headerCell.font = { bold: true, size: 18, color: { argb: 'FF000000' } };
  headerCell.alignment = { horizontal: 'center' as const, vertical: 'middle' as const };
  ws.mergeCells(`A${fila}:F${fila}`);
  ws.getRow(fila).height = 25;

  return fila + 1;
}

function agregarFilaDatos(
  ws: ExcelJS.Worksheet,
  fila: number,
  label1: string,
  valor1: any,
  label2: string,
  valor2: any,
  label3: string,
  valor3: any
): number {
  // Columna A - Label 1
  ws.getCell(`A${fila}`).value = label1;
  ws.getCell(`A${fila}`).font = { size: 18, color: { argb: 'FF000000' } };
  ws.getCell(`A${fila}`).alignment = { horizontal: 'center' as const, vertical: 'middle' as const };

  // Columna B - Valor 1
  ws.getCell(`B${fila}`).value = valor1 || '—';
  ws.getCell(`B${fila}`).font = { size: 18, color: { argb: 'FF000000' } };
  ws.getCell(`B${fila}`).alignment = { horizontal: 'center' as const, vertical: 'middle' as const };

  // Columna C - Label 2
  ws.getCell(`C${fila}`).value = label2;
  ws.getCell(`C${fila}`).font = { size: 18, color: { argb: 'FF000000' } };
  ws.getCell(`C${fila}`).alignment = { horizontal: 'center' as const, vertical: 'middle' as const };

  // Columna D - Valor 2
  ws.getCell(`D${fila}`).value = valor2 || '—';
  ws.getCell(`D${fila}`).font = { size: 18, color: { argb: 'FF000000' } };
  ws.getCell(`D${fila}`).alignment = { horizontal: 'center' as const, vertical: 'middle' as const };

  // Columna E - Label 3
  ws.getCell(`E${fila}`).value = label3;
  ws.getCell(`E${fila}`).font = { size: 18, color: { argb: 'FF000000' } };
  ws.getCell(`E${fila}`).alignment = { horizontal: 'center' as const, vertical: 'middle' as const };

  // Columna F - Valor 3
  ws.getCell(`F${fila}`).value = valor3 || '—';
  ws.getCell(`F${fila}`).font = { size: 18, color: { argb: 'FF000000' } };
  ws.getCell(`F${fila}`).alignment = { horizontal: 'center' as const, vertical: 'middle' as const };

  ws.getRow(fila).height = 28;
  return fila + 1;
}

function formatearValorCampo(valor: any, campo: CampoMeta): string {
  if (valor === undefined || valor === null || valor === '') return '—';
  if (campo.tipo === 'boolean') return valor ? 'Sí' : 'No';
  if (campo.opciones && campo.opciones.length > 0) {
    const op = campo.opciones.find((o) => o.value === String(valor));
    return op ? op.label : String(valor);
  }
  return campo.unidad ? `${valor} ${campo.unidad}` : String(valor);
}

export async function generarExcelEspecificacion(datos: any, camposPersonalizados: CampoMeta[] = []) {
  const workbook = new ExcelJS.Workbook();
  const fecha = new Date().toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric' });

  // ============================================
  // HOJA 1: CLIENTE
  // ============================================
  const cliente = workbook.addWorksheet('Cliente');
  cliente.columns = [{ width: 30 }, { width: 45 }];

  let fila = 1;

  // Header
  const headerCliente = cliente.getCell('A1');
  headerCliente.value = '👤 DATOS DEL CLIENTE';
  headerCliente.font = { bold: true, size: 14, color: { argb: 'FF000000' } };
  headerCliente.alignment = { horizontal: 'center' as const, vertical: 'middle' as const };
  cliente.mergeCells('A1:B1');
  cliente.getRow(1).height = 25;

  // Subtítulo
  const subtitulo = cliente.getCell('A2');
  subtitulo.value = `Solicitud de Presupuesto - ${fecha}`;
  subtitulo.font = { size: 10, italic: true, color: { argb: 'FF666666' } };
  subtitulo.alignment = { horizontal: 'center' as const };
  cliente.mergeCells('A2:B2');
  cliente.getRow(2).height = 16;

  fila = 4;

  // Datos
  const campos = [
    ['Nombre Completo', datos.cliente_nombre || '—'],
    ['Email', datos.cliente_email || '—'],
    ['Teléfono', datos.cliente_telefono || '—'],
    ['Ubicación / Municipio', datos.cliente_ubicacion || '—'],
    ['Dirección', datos.cliente_direccion || '—'],
    ['Google Maps Link', datos.cliente_ubicacion_gps || '—'],
  ];

  campos.forEach(([label, valor]) => {
    cliente.getCell(`A${fila}`).value = label;
    cliente.getCell(`A${fila}`).font = { bold: true, size: 10 };
    cliente.getCell(`A${fila}`).alignment = { horizontal: 'left' as const, vertical: 'middle' as const };

    cliente.getCell(`B${fila}`).value = valor;
    cliente.getCell(`B${fila}`).font = { size: 10 };
    cliente.getCell(`B${fila}`).alignment = { horizontal: 'left' as const, vertical: 'middle' as const, wrapText: true };

    cliente.getRow(fila).height = 20;
    fila++;
  });

  fila++;

  // Notas
  const notasHeader = cliente.getCell(`A${fila}`);
  notasHeader.value = 'Notas / Descripción';
  notasHeader.font = { bold: true, size: 11 };
  cliente.mergeCells(`A${fila}:B${fila}`);
  cliente.getRow(fila).height = 18;
  fila++;

  const notasCell = cliente.getCell(`A${fila}`);
  notasCell.value = datos.cliente_descripcion || '—';
  notasCell.alignment = { wrapText: true, vertical: 'top' as const };
  cliente.mergeCells(`A${fila}:B${fila}`);
  cliente.getRow(fila).height = 50;

  // ============================================
  // HOJA 2: FOTOVOLTAICA
  // ============================================
  const fotovoltaica = workbook.addWorksheet('Fotovoltaica');
  fotovoltaica.columns = [
    { width: 20 },
    { width: 20 },
    { width: 20 },
    { width: 20 },
    { width: 20 },
    { width: 20 },
  ];

  let filaFV = 1;

  // Header MERGED
  const headerFV = fotovoltaica.getCell('A1');
  headerFV.value = `Cliente: ${datos.cliente_nombre || '—'} | ${fecha} | GESMECO ENERGÍA`;
  headerFV.font = { size: 18, color: { argb: 'FF000000' } };
  headerFV.alignment = { horizontal: 'center' as const, vertical: 'middle' as const };
  fotovoltaica.mergeCells('A1:F1');
  fotovoltaica.getRow(1).height = 30;

  filaFV = 3;

  // SECCIÓN 1: CONSUMO Y DEMANDA
  filaFV = agregarSeccionFotovoltaica(fotovoltaica, filaFV, 'CONSUMO Y DEMANDA');
  filaFV = agregarFilaDatos(
    fotovoltaica,
    filaFV,
    'Consumo Anual',
    datos.consumo_anual ? `${datos.consumo_anual.toLocaleString('es-ES')} kWh` : '—',
    'Potencia Deseada',
    datos.potencia_deseada ? `${datos.potencia_deseada} kW` : '—',
    'Presupuesto Máximo',
    datos.presupuesto_maximo ? `${datos.presupuesto_maximo}€` : '—'
  );
  filaFV = agregarFilaDatos(
    fotovoltaica,
    filaFV,
    'Sistema Eléctrico',
    datos.fase_sistema === 'mono' ? 'Monofásico (220V)' : 'Trifásico (400V)',
    'Tipo Tejado',
    datos.tipo_tejado || '—',
    'Espacio Disponible',
    datos.espacio_disponible ? `${datos.espacio_disponible} m²` : '—'
  );

  filaFV++;

  // SECCIÓN 2: GEOMETRÍA DEL LUGAR
  filaFV = agregarSeccionFotovoltaica(fotovoltaica, filaFV, 'GEOMETRÍA DEL LUGAR');
  filaFV = agregarFilaDatos(
    fotovoltaica,
    filaFV,
    'Orientación Tejado',
    datos.orientacion_tejado || '—',
    'Inclinación',
    datos.inclinacion_tejado || '—',
    'Altura (pisos)',
    datos.altura_edificio_pisos || '—'
  );
  filaFV = agregarFilaDatos(
    fotovoltaica,
    filaFV,
    'Acceso al Tejado',
    datos.acceso_tejado || '—',
    'Sombreado',
    datos.sombreado || '—',
    'Estado Tejado',
    datos.estado_tejado || '—'
  );

  filaFV++;

  // SECCIÓN 3: INSTALACIÓN TÉCNICA
  filaFV = agregarSeccionFotovoltaica(fotovoltaica, filaFV, 'INSTALACIÓN TÉCNICA');
  filaFV = agregarFilaDatos(
    fotovoltaica,
    filaFV,
    'Distancia Cuadro a Tejado',
    datos.distancia_cuadro_a_tejado_metros ? `${datos.distancia_cuadro_a_tejado_metros} m` : '—',
    'Cuadro Accesible',
    datos.cuadro_accesible || '—',
    'Tierra Eléctrica',
    datos.tierra_adecuada || '—'
  );
  filaFV = agregarFilaDatos(
    fotovoltaica,
    filaFV,
    'Acometida Cambio',
    datos.acometida_cambio || '—',
    'Distancia Cableado',
    datos.distancia_cableado || '—',
    'Espacio Almacén',
    datos.espacio_almacenamiento || '—'
  );
  filaFV = agregarFilaDatos(
    fotovoltaica,
    filaFV,
    'Andamiaje Necesario',
    datos.andamiaje_necesario || '—',
    'Necesita Grúa',
    datos.necesita_grua ? 'Sí' : 'No',
    'Refuerzo Estructural',
    datos.requiere_refuerzo_estructural ? 'Sí' : 'No'
  );

  filaFV++;

  // SECCIÓN 4: CONDICIONES ESPECIALES
  filaFV = agregarSeccionFotovoltaica(fotovoltaica, filaFV, 'CONDICIONES ESPECIALES');

  const condiciones = [];
  if (datos.clima_viento) condiciones.push('Viento');
  if (datos.clima_nieve) condiciones.push('Nieve');
  if (datos.clima_salinidad) condiciones.push('Salinidad');
  if (datos.clima_polvo) condiciones.push('Polvo');
  if (datos.presencia_amianto) condiciones.push('Amianto');
  if (datos.reparaciones_tejado_previas) condiciones.push('Reparaciones');

  filaFV = agregarFilaDatos(
    fotovoltaica,
    filaFV,
    'Clima/Dificultades',
    condiciones.length > 0 ? condiciones.join(', ') : 'Ninguna',
    'Consumo Crítico',
    datos.consumo_critico || 'No',
    'Carga Tejado Máx',
    datos.carga_tejado_maxima ? `${datos.carga_tejado_maxima} kg/m²` : '—'
  );

  filaFV++;

  // SECCIÓN 5: ESPECIFICACIONES CALCULADAS
  if (datos.num_paneles) {
    filaFV = agregarSeccionFotovoltaica(fotovoltaica, filaFV, 'ESPECIFICACIONES CALCULADAS');
    filaFV = agregarFilaDatos(
      fotovoltaica,
      filaFV,
      'Paneles Necesarios',
      `${datos.num_paneles} × 450W`,
      'Potencia Real',
      `${datos.potencia_real?.toFixed(2)} kW`,
      'Espacio Requerido',
      `${datos.espacio_requerido?.toFixed(1)} m²`
    );
    filaFV = agregarFilaDatos(
      fotovoltaica,
      filaFV,
      'Producción Anual',
      datos.produccion_anual ? `${datos.produccion_anual.toLocaleString('es-ES')} kWh/año` : '—',
      'Inversor Marca',
      datos.inversor?.marca || '—',
      'Inversor Modelo',
      datos.inversor?.modelo || '—'
    );
  }

  // SECCIÓN DINÁMICA: Campos personalizados desde Supabase
  const camposExcel = camposPersonalizados.filter((c) => c.en_excel !== false);
  const datosExtras: Record<string, any> = datos.datos_extras ?? {};

  if (camposExcel.length > 0) {
    filaFV++;
    filaFV = agregarSeccionFotovoltaica(fotovoltaica, filaFV, 'CAMPOS PERSONALIZADOS');

    // Agrupar en filas de 3
    for (let i = 0; i < camposExcel.length; i += 3) {
      const [c1, c2, c3] = [camposExcel[i], camposExcel[i + 1], camposExcel[i + 2]];
      filaFV = agregarFilaDatos(
        fotovoltaica,
        filaFV,
        c1?.label ?? '',
        c1 ? formatearValorCampo(datosExtras[c1.campo_key], c1) : '',
        c2?.label ?? '',
        c2 ? formatearValorCampo(datosExtras[c2.campo_key], c2) : '',
        c3?.label ?? '',
        c3 ? formatearValorCampo(datosExtras[c3.campo_key], c3) : ''
      );
    }
  }

  // Generar archivo
  const fileName = `Presupuesto_FV_${datos.cliente_nombre || 'proyecto'}_${new Date().toISOString().slice(0, 10)}.xlsx`;
  const buffer = await workbook.xlsx.writeBuffer();

  // Descargar
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
