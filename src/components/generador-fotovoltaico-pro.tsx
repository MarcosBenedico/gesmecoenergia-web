'use client';

import { useState, useCallback, useEffect, useRef, useMemo, memo } from 'react';
import { supabase } from '@/lib/supabase';

// ============================================
// CONSTANTES OPTIMIZADAS
// ============================================
const IRRADIANCIA = 1280;
const FACTOR_PERDIDAS = 0.77;
const POTENCIA_PANEL = 450;
const AREA_PANEL = 2.2;

// COSTOS BASE (ajustables según región)
const COSTOS_BASE = {
  // Precios unitarios
  panel_450w: 81, // 450W × 0.18€
  estructura_teja: 150,
  estructura_plano: 200,
  estructura_sandwich: 120, // Más fácil de montar
  cableado_por_kw: 250,
  protecciones_por_kw: 300,
  mano_obra_base_por_kw: 800,
  tramites_fijos: 500,

  // Batería
  precio_kwh_bateria: 600,
  bms_fijo: 400,
  cableado_dc_fijo: 200,
  sistema_seguridad_fijo: 300,

  // Costos por dificultad (se suman)
  acceso_interior: 0, // Fácil
  acceso_exterior: 200,
  acceso_escalera_port: 400,
  acceso_altura_dificil: 800,

  almacenamiento_cubierto: 0,
  almacenamiento_descubierto: 150,
  almacenamiento_diario: 300,

  andamiaje_minimo: 500,
  andamiaje_completo: 1500,

  sombreado_parcial: 300, // Optimizadores
  sombreado_significativo: 600, // Microinversores

  reparacion_menor: 800,
  reparacion_importante: 2500,

  amianto_probable: 1500,
  amianto_desconocido: 800,

  cambio_acometida: 1200,

  carga_tejado_baja: 1000, // Refuerzo

  clima_viento: 200,
  clima_nieve: 150,
  clima_salinidad: 300,
  clima_polvo: 100,

  tierra_parcial: 400,
  tierra_no: 1000,

  cuadro_dificil: 300,

  // Mano de obra
  dias_instalacion_base: 2, // Para hasta 10kW
  coste_por_dia: 500, // Por instalador
  num_instaladores: 2,

  // Desplazamiento
  desplazamiento_fijo: 200,
};

// INVERSORES
const INVERSORES = {
  mono: [
    { potencia: 3.7, marca: 'Fronius', modelo: 'Symo 3.7', precio: 1200 },
    { potencia: 5, marca: 'Growatt', modelo: 'MIC 3000TL-X', precio: 950 },
    { potencia: 5, marca: 'Fronius', modelo: 'Symo 5.0', precio: 1450 },
    { potencia: 8.2, marca: 'Fronius', modelo: 'Symo 8.2', precio: 1800 },
    { potencia: 10, marca: 'Growatt', modelo: 'MIC 8000TL-X', precio: 1400 },
  ],
  tri: [
    { potencia: 10, marca: 'Fronius', modelo: 'Symo 10.0-3-M', precio: 2200 },
    { potencia: 12, marca: 'Growatt', modelo: 'TL3-10', precio: 1600 },
    { potencia: 15, marca: 'Fronius', modelo: 'Symo 15.0-3-M', precio: 2800 },
    { potencia: 20, marca: 'Growatt', modelo: 'TL3-20', precio: 2200 },
  ],
};

// PLANTILLAS OPTIMIZADAS
const PLANTILLAS = {
  residencial_facil: {
    nombre: '🏠 Residencial Fácil',
    consumo_anual: 4500,
    potencia_deseada: 4.5,
    fase_sistema: 'mono',
    tipo_tejado: 'teja',
    espacio_disponible: 30,
    acceso_tejado: 'escalera_interior',
    orientacion_tejado: 'sur',
    inclinacion_tejado: 'medio',
    sombreado: 'no',
    estado_tejado: 'bueno',
    cuadro_accesible: 'si_facil',
    tierra_adecuada: 'si',
    acometida_cambio: 'no',
    distancia_cableado: 'menos_20',
    altura_edificio_pisos: 1,
    dias_instalacion_estimado: 2,
    incluir_baterias: false,
  },
  residencial_dificil: {
    nombre: '🏠 Residencial Difícil',
    consumo_anual: 4500,
    potencia_deseada: 4.5,
    fase_sistema: 'mono',
    tipo_tejado: 'pizarra',
    espacio_disponible: 25,
    acceso_tejado: 'altura_dificil',
    orientacion_tejado: 'sureste',
    inclinacion_tejado: 'alto',
    sombreado: 'parcial_tarde',
    estado_tejado: 'regular',
    cuadro_accesible: 'si_dificil',
    tierra_adecuada: 'parcial',
    acometida_cambio: 'posible',
    distancia_cableado: '20_50',
    altura_edificio_pisos: 3,
    dias_instalacion_estimado: 4,
    clima_viento: true,
    incluir_baterias: false,
  },
  ganaderia_facil: {
    nombre: '🐄 Ganadería Fácil',
    consumo_anual: 40000,
    potencia_deseada: 18,
    fase_sistema: 'tri',
    tipo_tejado: 'chapa',
    espacio_disponible: 150,
    acceso_tejado: 'escalera_exterior',
    orientacion_tejado: 'sur',
    inclinacion_tejado: 'medio',
    sombreado: 'no',
    estado_tejado: 'bueno',
    cuadro_accesible: 'si_facil',
    tierra_adecuada: 'si',
    acometida_cambio: 'no',
    distancia_cableado: '20_50',
    altura_edificio_pisos: 1,
    dias_instalacion_estimado: 4,
    clima_viento: true,
    consumo_critico: 'si',
    incluir_baterias: true,
    capacidad_baterias: 12,
  },
  ganaderia_dificil: {
    nombre: '🐄 Ganadería Difícil',
    consumo_anual: 40000,
    potencia_deseada: 18,
    fase_sistema: 'tri',
    tipo_tejado: 'pizarra',
    espacio_disponible: 200,
    acceso_tejado: 'altura_dificil',
    orientacion_tejado: 'sur',
    inclinacion_tejado: 'bajo',
    sombreado: 'significativo',
    estado_tejado: 'reparacion_importante',
    cuadro_accesible: 'si_dificil',
    tierra_adecuada: 'no',
    acometida_cambio: 'si',
    distancia_cableado: 'mas_50',
    altura_edificio_pisos: 2,
    dias_instalacion_estimado: 6,
    clima_viento: true,
    clima_nieve: true,
    consumo_critico: 'si',
    incluir_baterias: true,
    capacidad_baterias: 15,
  },
  empresa_facil: {
    nombre: '🏢 Empresa Fácil',
    consumo_anual: 20000,
    potencia_deseada: 10,
    fase_sistema: 'tri',
    tipo_tejado: 'plano',
    espacio_disponible: 80,
    acceso_tejado: 'escalera_interior',
    orientacion_tejado: 'sur',
    inclinacion_tejado: 'bajo',
    sombreado: 'no',
    estado_tejado: 'bueno',
    cuadro_accesible: 'si_facil',
    tierra_adecuada: 'si',
    acometida_cambio: 'no',
    distancia_cableado: 'menos_20',
    altura_edificio_pisos: 2,
    dias_instalacion_estimado: 3,
    incluir_baterias: true,
    capacidad_baterias: 8,
  },
  empresa_dificil: {
    nombre: '🏢 Empresa Difícil',
    consumo_anual: 20000,
    potencia_deseada: 10,
    fase_sistema: 'tri',
    tipo_tejado: 'teja',
    espacio_disponible: 60,
    acceso_tejado: 'altura_dificil',
    orientacion_tejado: 'sureste',
    inclinacion_tejado: 'alto',
    sombreado: 'parcial_mañana',
    estado_tejado: 'reparaciones_menores',
    cuadro_accesible: 'si_dificil',
    tierra_adecuada: 'parcial',
    acometida_cambio: 'si',
    distancia_cableado: '20_50',
    altura_edificio_pisos: 4,
    dias_instalacion_estimado: 5,
    incluir_baterias: true,
    capacidad_baterias: 10,
  },
};

interface FormData {
  // Cliente
  cliente_nombre: string;
  cliente_email: string;
  cliente_telefono: string;
  cliente_ubicacion: string;
  cliente_direccion: string;
  cliente_ubicacion_gps: string;
  cliente_descripcion: string;

  // Especificaciones
  consumo_anual: number | '';
  potencia_deseada: number | '';
  fase_sistema: string;
  tipo_tejado: string;
  espacio_disponible: number | '';
  presupuesto_maximo: number | '';

  // Análisis técnico
  acceso_tejado: string;
  distancia_cuadro_electrico: string;
  espacio_almacenamiento: string;
  andamiaje_necesario: string;
  orientacion_tejado: string;
  inclinacion_tejado: string;
  sombreado: string;
  estado_tejado: string;
  carga_tejado_maxima: number | '';
  presencia_amianto: string;
  cuadro_accesible: string;
  tierra_adecuada: string;
  acometida_cambio: string;
  distancia_cableado: string;

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

  // NUEVA INFORMACIÓN DE VALOR
  altura_edificio_pisos: number | '';
  dias_instalacion_estimado: number | '';
  necesita_grua: boolean;
  distancia_cuadro_a_tejado_metros: number | '';
  requiere_refuerzo_estructural: boolean;
  reparaciones_tejado_previas: boolean;

  // Baterías
  incluir_baterias: boolean;
  capacidad_baterias: number | '';
}

interface ResultadosPro {
  num_paneles: number;
  potencia_real: number;
  espacio_requerido: number;
  produccion_anual: number;
  inversor: any;

  // Desglose de costos DETALLADO
  costos_materiales: { concepto: string; cantidad: number; precio_unitario: number; subtotal: number }[];
  costos_mano_obra: { concepto: string; dias: number; coste_diario: number; subtotal: number }[];
  costos_dificultad: { concepto: string; costo: number }[];
  costos_extra: { concepto: string; costo: number }[];

  costo_total: number;
  costo_total_materiales: number;
  costo_total_mano_obra: number;
  costo_total_dificultades: number;
  costo_total_extras: number;

  dias_totales_instalacion: number;
  margen_recomendado: number;
  precio_final_recomendado: number;

  alertas: string[];
}

const FORM_INICIAL: FormData = {
  cliente_nombre: '',
  cliente_email: '',
  cliente_telefono: '',
  cliente_ubicacion: '',
  cliente_direccion: '',
  cliente_ubicacion_gps: '',
  cliente_descripcion: '',
  consumo_anual: '',
  potencia_deseada: '',
  fase_sistema: '',
  tipo_tejado: '',
  espacio_disponible: '',
  presupuesto_maximo: '',
  acceso_tejado: '',
  distancia_cuadro_electrico: '',
  espacio_almacenamiento: '',
  andamiaje_necesario: '',
  orientacion_tejado: '',
  inclinacion_tejado: '',
  sombreado: '',
  estado_tejado: '',
  carga_tejado_maxima: '',
  presencia_amianto: '',
  cuadro_accesible: '',
  tierra_adecuada: '',
  acometida_cambio: '',
  distancia_cableado: '',
  clima_viento: false,
  clima_nieve: false,
  clima_salinidad: false,
  clima_polvo: false,
  dificultades_especiales: '',
  consumo_critico: '',
  independencia_prioridad: '',
  ampliacion_futura: '',
  altura_edificio_pisos: '',
  dias_instalacion_estimado: '',
  necesita_grua: false,
  distancia_cuadro_a_tejado_metros: '',
  requiere_refuerzo_estructural: false,
  reparaciones_tejado_previas: false,
  incluir_baterias: false,
  capacidad_baterias: '',
};

// ============================================
// COMPONENTES MEMOIZADOS
// ============================================

const SeccionCliente = memo(({ formulario, handleInputChange }: any) => (
  <div className="card rounded-2xl p-6 md:p-8 bg-surface/50">
    <h3 className="font-bold text-foreground text-lg mb-6">👤 Datos del Cliente</h3>
    <div className="grid gap-4 grid-cols-1 md:grid-cols-2">
      <input
        type="text"
        value={formulario.cliente_nombre}
        onChange={(e) => handleInputChange('cliente_nombre', e.target.value)}
        placeholder="Nombre cliente *"
        className="rounded-lg border border-border bg-card px-4 py-3 text-foreground text-sm"
      />
      <input
        type="email"
        value={formulario.cliente_email}
        onChange={(e) => handleInputChange('cliente_email', e.target.value)}
        placeholder="Email"
        className="rounded-lg border border-border bg-card px-4 py-3 text-foreground text-sm"
      />
      <input
        type="tel"
        value={formulario.cliente_telefono}
        onChange={(e) => handleInputChange('cliente_telefono', e.target.value)}
        placeholder="Teléfono"
        className="rounded-lg border border-border bg-card px-4 py-3 text-foreground text-sm"
      />
      <input
        type="text"
        value={formulario.cliente_ubicacion}
        onChange={(e) => handleInputChange('cliente_ubicacion', e.target.value)}
        placeholder="Ubicación *"
        className="rounded-lg border border-border bg-card px-4 py-3 text-foreground text-sm"
      />
    </div>
  </div>
));

const SeccionEspecificaciones = memo(({ formulario, handleInputChange }: any) => (
  <div className="card rounded-2xl p-6 md:p-8 bg-surface/50">
    <h3 className="font-bold text-foreground text-lg mb-6">📐 Especificaciones Técnicas</h3>
    <div className="grid gap-4 grid-cols-1 md:grid-cols-2">
      <input
        type="number"
        value={formulario.consumo_anual}
        onChange={(e) => handleInputChange('consumo_anual', e.target.value ? Number(e.target.value) : '')}
        placeholder="Consumo anual (kWh) *"
        className="rounded-lg border border-border bg-card px-4 py-3 text-foreground text-sm"
      />
      <input
        type="number"
        value={formulario.potencia_deseada}
        onChange={(e) => handleInputChange('potencia_deseada', e.target.value ? Number(e.target.value) : '')}
        placeholder="Potencia deseada (kW) *"
        className="rounded-lg border border-border bg-card px-4 py-3 text-foreground text-sm"
      />
      <select
        value={formulario.fase_sistema}
        onChange={(e) => handleInputChange('fase_sistema', e.target.value)}
        className="rounded-lg border border-border bg-card px-4 py-3 text-foreground text-sm"
      >
        <option value="">Sistema eléctrico *</option>
        <option value="mono">Monofásico (220V)</option>
        <option value="tri">Trifásico (400V)</option>
      </select>
      <select
        value={formulario.tipo_tejado}
        onChange={(e) => handleInputChange('tipo_tejado', e.target.value)}
        className="rounded-lg border border-border bg-card px-4 py-3 text-foreground text-sm"
      >
        <option value="">Tipo de tejado *</option>
        <option value="teja">Teja (cerámica)</option>
        <option value="pizarra">Pizarra</option>
        <option value="chapa">Chapa metálica</option>
        <option value="plano">Plano/Hormigón</option>
        <option value="fibrocemento">Fibrocemento</option>
        <option value="sandwich">Panel Sándwich</option>
      </select>
      <input
        type="number"
        value={formulario.espacio_disponible}
        onChange={(e) => handleInputChange('espacio_disponible', e.target.value ? Number(e.target.value) : '')}
        placeholder="Espacio disponible (m²) *"
        className="rounded-lg border border-border bg-card px-4 py-3 text-foreground text-sm"
      />
      <input
        type="number"
        value={formulario.presupuesto_maximo}
        onChange={(e) => handleInputChange('presupuesto_maximo', e.target.value ? Number(e.target.value) : '')}
        placeholder="Presupuesto máximo (€)"
        className="rounded-lg border border-border bg-card px-4 py-3 text-foreground text-sm"
      />
    </div>
  </div>
));

const SeccionValorInstalador = memo(({ formulario, handleInputChange }: any) => (
  <div className="card rounded-2xl p-6 md:p-8 bg-orange/5 border-2 border-orange/30">
    <h3 className="font-bold text-orange text-lg mb-6">💡 Información de VALOR para Cotización</h3>
    <div className="grid gap-4 grid-cols-1 md:grid-cols-2">
      <div>
        <label className="block text-xs font-bold text-muted mb-2">Altura del edificio (pisos)</label>
        <input
          type="number"
          value={formulario.altura_edificio_pisos}
          onChange={(e) => handleInputChange('altura_edificio_pisos', e.target.value ? Number(e.target.value) : '')}
          placeholder="ej: 2"
          min="1"
          className="w-full rounded-lg border border-border bg-card px-4 py-3 text-foreground text-sm"
        />
      </div>
      <div>
        <label className="block text-xs font-bold text-muted mb-2">Distancia cuadro a tejado (metros)</label>
        <input
          type="number"
          value={formulario.distancia_cuadro_a_tejado_metros}
          onChange={(e) => handleInputChange('distancia_cuadro_a_tejado_metros', e.target.value ? Number(e.target.value) : '')}
          placeholder="ej: 15"
          className="w-full rounded-lg border border-border bg-card px-4 py-3 text-foreground text-sm"
        />
      </div>
      <div>
        <label className="block text-xs font-bold text-muted mb-2">Días instalación estimados</label>
        <input
          type="number"
          value={formulario.dias_instalacion_estimado}
          onChange={(e) => handleInputChange('dias_instalacion_estimado', e.target.value ? Number(e.target.value) : '')}
          placeholder="ej: 3"
          min="1"
          className="w-full rounded-lg border border-border bg-card px-4 py-3 text-foreground text-sm"
        />
      </div>
      <label className="flex items-center gap-3 p-3 rounded-lg border border-border bg-card/50 cursor-pointer">
        <input
          type="checkbox"
          checked={formulario.necesita_grua}
          onChange={(e) => handleInputChange('necesita_grua', e.target.checked)}
          className="w-4 h-4 rounded"
        />
        <span className="text-sm font-medium text-foreground">¿Necesita grúa?</span>
      </label>
      <label className="flex items-center gap-3 p-3 rounded-lg border border-border bg-card/50 cursor-pointer">
        <input
          type="checkbox"
          checked={formulario.requiere_refuerzo_estructural}
          onChange={(e) => handleInputChange('requiere_refuerzo_estructural', e.target.checked)}
          className="w-4 h-4 rounded"
        />
        <span className="text-sm font-medium text-foreground">¿Refuerzo estructural?</span>
      </label>
      <label className="flex items-center gap-3 p-3 rounded-lg border border-border bg-card/50 cursor-pointer">
        <input
          type="checkbox"
          checked={formulario.reparaciones_tejado_previas}
          onChange={(e) => handleInputChange('reparaciones_tejado_previas', e.target.checked)}
          className="w-4 h-4 rounded"
        />
        <span className="text-sm font-medium text-foreground">¿Reparaciones tejado previas?</span>
      </label>
    </div>
  </div>
));

// ============================================
// COMPONENTE PRINCIPAL
// ============================================

export function GeneradorFotovoltaicoPro() {
  const [formulario, setFormulario] = useState<FormData>(FORM_INICIAL);
  const [resultado, setResultado] = useState<ResultadosPro | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [guardado, setGuardado] = useState(false);
  const [proyectoId, setProyectoId] = useState<number | null>(null);
  const autoSaveTimer = useRef<NodeJS.Timeout | null>(null);
  const [seccionAbierta, setSeccionAbierta] = useState<string>('especificaciones');

  // Auto-guardar optimizado
  useEffect(() => {
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    if (!formulario.cliente_nombre) return;

    autoSaveTimer.current = setTimeout(() => {
      guardarProyecto();
    }, 2000);

    return () => {
      if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    };
  }, [formulario]);

  const guardarProyecto = useCallback(async () => {
    if (!formulario.cliente_nombre) return;
    setGuardando(true);
    try {
      const datosGuardar = {
        ...formulario,
        consumo_anual: formulario.consumo_anual || null,
        potencia_deseada: formulario.potencia_deseada || null,
        ...(resultado && resultado.costo_total > 0 && {
          num_paneles: resultado.num_paneles,
          potencia_real: resultado.potencia_real,
          costo_total: resultado.costo_total,
          alertas: resultado.alertas,
        }),
      };

      if (proyectoId) {
        await supabase.from('proyectos_fotovoltaicos').update(datosGuardar).eq('id', proyectoId);
      } else {
        const { data, error } = await supabase
          .from('proyectos_fotovoltaicos')
          .insert([datosGuardar])
          .select('id');
        if (data?.[0]) setProyectoId(data[0].id);
      }

      setGuardado(true);
      setTimeout(() => setGuardado(false), 2000);
    } catch (error) {
      console.error('Error guardando:', error);
    } finally {
      setGuardando(false);
    }
  }, [formulario, resultado, proyectoId]);

  const handleInputChange = useCallback((field: keyof FormData, value: any) => {
    setFormulario((prev) => ({ ...prev, [field]: value }));
  }, []);

  const cargarPlantilla = useCallback((tipoPlantilla: keyof typeof PLANTILLAS) => {
    const plantilla = PLANTILLAS[tipoPlantilla];
    setFormulario((prev) => ({ ...prev, ...plantilla }));
  }, []);

  // CÁLCULOS OPTIMIZADOS CON USEMEMO
  const calcular = useCallback(() => {
    const c = formulario;
    const consumo = Number(c.consumo_anual);
    const potencia = Number(c.potencia_deseada);
    const espacio = Number(c.espacio_disponible);

    // Validaciones
    if (!c.cliente_nombre || isNaN(consumo) || consumo <= 0 || isNaN(potencia) || potencia <= 0 ||
        !c.fase_sistema || !c.tipo_tejado || isNaN(espacio) || espacio <= 0) {
      alert('⚠️ Completa los campos obligatorios');
      return;
    }

    // CÁLCULOS
    const numPaneles = Math.ceil((potencia * 1000) / POTENCIA_PANEL);
    const potenciaReal = (numPaneles * POTENCIA_PANEL) / 1000;
    const espacioRequerido = numPaneles * AREA_PANEL;
    const produccionAnual = Math.round(espacioRequerido * IRRADIANCIA * FACTOR_PERDIDAS);

    // Seleccionar inversor
    const inversoresDisp = INVERSORES[c.fase_sistema as keyof typeof INVERSORES];
    let inv = inversoresDisp.filter((i) => i.potencia >= potenciaReal).sort((a, b) => a.potencia - b.potencia);
    if (inv.length === 0) inv = inversoresDisp.sort((a, b) => b.potencia - a.potencia);
    const inversor = inv[0];

    // ============================================
    // CÁLCULOS DE COSTOS DETALLADOS PARA INSTALADOR
    // ============================================

    // 1. COSTOS DE MATERIALES
    const costos_materiales = [
      {
        concepto: `Paneles Solares (450W × ${numPaneles})`,
        cantidad: numPaneles,
        precio_unitario: COSTOS_BASE.panel_450w,
        subtotal: numPaneles * COSTOS_BASE.panel_450w,
      },
      {
        concepto: inversor.marca + ' ' + inversor.modelo,
        cantidad: 1,
        precio_unitario: inversor.precio,
        subtotal: inversor.precio,
      },
    ];

    // Estructura según tipo de tejado
    const costoEstructura =
      c.tipo_tejado === 'plano' ? COSTOS_BASE.estructura_plano :
      c.tipo_tejado === 'sandwich' ? COSTOS_BASE.estructura_sandwich :
      COSTOS_BASE.estructura_teja;

    costos_materiales.push({
      concepto: `Estructura de Montaje (${c.tipo_tejado})`,
      cantidad: numPaneles,
      precio_unitario: costoEstructura,
      subtotal: numPaneles * costoEstructura,
    });

    // Cableado: depende de distancia
    const distanciaMetros = Number(c.distancia_cuadro_a_tejado_metros) || 15;
    const costeCableadoAjustado = Math.max(
      COSTOS_BASE.cableado_por_kw * potenciaReal,
      distanciaMetros * 10 // 10€ por metro de cableado
    );

    costos_materiales.push({
      concepto: `Cableado y Conectores (${distanciaMetros}m)`,
      cantidad: 1,
      precio_unitario: costeCableadoAjustado,
      subtotal: costeCableadoAjustado,
    });

    costos_materiales.push({
      concepto: 'Protecciones (DC/AC)',
      cantidad: 1,
      precio_unitario: COSTOS_BASE.protecciones_por_kw * potenciaReal,
      subtotal: COSTOS_BASE.protecciones_por_kw * potenciaReal,
    });

    costos_materiales.push({
      concepto: 'Trámites y Gestión',
      cantidad: 1,
      precio_unitario: COSTOS_BASE.tramites_fijos,
      subtotal: COSTOS_BASE.tramites_fijos,
    });

    // Baterías (si las hay)
    if (c.incluir_baterias && c.capacidad_baterias) {
      const potBat = Number(c.capacidad_baterias);
      costos_materiales.push({
        concepto: `Batería LiFePO4 (${potBat} kWh)`,
        cantidad: 1,
        precio_unitario: potBat * COSTOS_BASE.precio_kwh_bateria,
        subtotal: potBat * COSTOS_BASE.precio_kwh_bateria,
      });
      costos_materiales.push({
        concepto: 'Sistema BMS + Cableado DC + Seguridad',
        cantidad: 1,
        precio_unitario: COSTOS_BASE.bms_fijo + COSTOS_BASE.cableado_dc_fijo + COSTOS_BASE.sistema_seguridad_fijo,
        subtotal: COSTOS_BASE.bms_fijo + COSTOS_BASE.cableado_dc_fijo + COSTOS_BASE.sistema_seguridad_fijo,
      });
    }

    const costoTotalMateriales = costos_materiales.reduce((sum, c) => sum + c.subtotal, 0);

    // 2. COSTOS DE MANO DE OBRA
    const diasEstimados = Number(c.dias_instalacion_estimado) || Math.max(2, Math.ceil(potenciaReal / 5));
    const costeManoObraInstalacion = diasEstimados * COSTOS_BASE.coste_por_dia * COSTOS_BASE.num_instaladores;

    const costos_mano_obra = [
      {
        concepto: 'Instalación (montaje, cableado, pruebas)',
        dias: diasEstimados,
        coste_diario: COSTOS_BASE.coste_por_dia * COSTOS_BASE.num_instaladores,
        subtotal: costeManoObraInstalacion,
      },
    ];

    // Grúa si es necesario
    if (c.necesita_grua) {
      costos_mano_obra.push({
        concepto: 'Alquiler de grúa (1 día)',
        dias: 1,
        coste_diario: 800,
        subtotal: 800,
      });
    }

    const costoTotalManoObra = costos_mano_obra.reduce((sum, c) => sum + c.subtotal, 0) + COSTOS_BASE.desplazamiento_fijo;

    // 3. COSTOS POR DIFICULTADES
    const costos_dificultad: { concepto: string; costo: number }[] = [];

    // Acceso
    if (c.acceso_tejado === 'escalera_exterior') costos_dificultad.push({
      concepto: 'Acceso complicado (escalera exterior)',
      costo: COSTOS_BASE.acceso_exterior,
    });
    if (c.acceso_tejado === 'escala_port') costos_dificultad.push({
      concepto: 'Acceso muy complicado (escala portátil)',
      costo: COSTOS_BASE.acceso_escalera_port,
    });
    if (c.acceso_tejado === 'altura_dificil') costos_dificultad.push({
      concepto: 'Acceso muy difícil (altura, altura)',
      costo: COSTOS_BASE.acceso_altura_dificil,
    });

    // Almacenamiento
    if (c.espacio_almacenamiento === 'si_descubierto') costos_dificultad.push({
      concepto: 'Almacenamiento al aire libre',
      costo: COSTOS_BASE.almacenamiento_descubierto,
    });
    if (c.espacio_almacenamiento === 'no_cercano') costos_dificultad.push({
      concepto: 'Sin espacio (traer diario)',
      costo: COSTOS_BASE.almacenamiento_diario,
    });

    // Andamiaje
    if (c.andamiaje_necesario === 'minimo') costos_dificultad.push({
      concepto: 'Andamiaje mínimo',
      costo: COSTOS_BASE.andamiaje_minimo,
    });
    if (c.andamiaje_necesario === 'completo') costos_dificultad.push({
      concepto: 'Andamiaje completo',
      costo: COSTOS_BASE.andamiaje_completo,
    });

    // Sombreado
    if (c.sombreado === 'parcial_mañana' || c.sombreado === 'parcial_tarde') {
      costos_dificultad.push({
        concepto: 'Optimizadores de potencia (sombreado parcial)',
        costo: COSTOS_BASE.sombreado_parcial,
      });
    }
    if (c.sombreado === 'significativo') {
      costos_dificultad.push({
        concepto: 'Microinversores (sombreado significativo)',
        costo: COSTOS_BASE.sombreado_significativo,
      });
    }

    // Estado tejado
    if (c.estado_tejado === 'reparaciones_menores') costos_dificultad.push({
      concepto: 'Reparaciones menores tejado',
      costo: COSTOS_BASE.reparacion_menor,
    });
    if (c.estado_tejado === 'reparacion_importante') costos_dificultad.push({
      concepto: 'Reparación importante tejado (ANTES de instalar)',
      costo: COSTOS_BASE.reparacion_importante,
    });

    // Amianto
    if (c.presencia_amianto === 'si_probable') costos_dificultad.push({
      concepto: 'Análisis y retirada de amianto probable',
      costo: COSTOS_BASE.amianto_probable,
    });
    if (c.presencia_amianto === 'desconocido') costos_dificultad.push({
      concepto: 'Análisis de amianto (desconocido)',
      costo: COSTOS_BASE.amianto_desconocido,
    });

    // Acometida
    if (c.acometida_cambio === 'si') costos_dificultad.push({
      concepto: 'Cambio de acometida eléctrica',
      costo: COSTOS_BASE.cambio_acometida,
    });

    // Carga tejado
    if (c.carga_tejado_maxima && Number(c.carga_tejado_maxima) < 50) {
      costos_dificultad.push({
        concepto: 'Refuerzo estructural (carga baja)',
        costo: COSTOS_BASE.carga_tejado_baja,
      });
    }

    // Clima
    if (c.clima_viento) costos_dificultad.push({
      concepto: 'Estructura reforzada (viento)',
      costo: COSTOS_BASE.clima_viento,
    });
    if (c.clima_nieve) costos_dificultad.push({
      concepto: 'Sistema anti-nieve',
      costo: COSTOS_BASE.clima_nieve,
    });
    if (c.clima_salinidad) costos_dificultad.push({
      concepto: 'Materiales anticorrosión (salinidad)',
      costo: COSTOS_BASE.clima_salinidad,
    });
    if (c.clima_polvo) costos_dificultad.push({
      concepto: 'Mantenimiento especial (polvo)',
      costo: COSTOS_BASE.clima_polvo,
    });

    // Tierra
    if (c.tierra_adecuada === 'parcial') costos_dificultad.push({
      concepto: 'Mejora de tierra existente',
      costo: COSTOS_BASE.tierra_parcial,
    });
    if (c.tierra_adecuada === 'no') costos_dificultad.push({
      concepto: 'Instalación de tierra completa',
      costo: COSTOS_BASE.tierra_no,
    });

    // Cuadro difícil
    if (c.cuadro_accesible === 'si_dificil') costos_dificultad.push({
      concepto: 'Acceso complicado a cuadro',
      costo: COSTOS_BASE.cuadro_dificil,
    });

    const costoTotalDificultades = costos_dificultad.reduce((sum, c) => sum + c.costo, 0);

    // 4. COSTOS EXTRA
    const costos_extra: { concepto: string; costo: number }[] = [];

    if (c.requiere_refuerzo_estructural) {
      costos_extra.push({
        concepto: 'Refuerzo estructural completo',
        costo: 2000,
      });
    }

    if (c.reparaciones_tejado_previas) {
      costos_extra.push({
        concepto: 'Reparaciones tejado previas (variable)',
        costo: 1500,
      });
    }

    const costoTotalExtras = costos_extra.reduce((sum, c) => sum + c.costo, 0);

    // TOTAL
    const costoTotalSinMargen = costoTotalMateriales + costoTotalManoObra + costoTotalDificultades + costoTotalExtras;
    const margenRecomendado = Math.round(costoTotalSinMargen * 0.25); // 25% margen
    const precioFinalRecomendado = costoTotalSinMargen + margenRecomendado;

    // ALERTAS
    const alertas: string[] = [];

    if (espacioRequerido > espacio) {
      alertas.push(`⚠️ ESPACIO: Necesitas ${espacioRequerido.toFixed(1)} m² pero tienes ${espacio} m²`);
    }
    if (c.estado_tejado === 'reparacion_importante') {
      alertas.push(`⚠️ REPARACIÓN IMPORTANTE PREVIA: El tejado necesita reparación ANTES de instalar`);
    }
    if (c.presencia_amianto === 'si_probable' || c.presencia_amianto === 'desconocido') {
      alertas.push(`⚠️ AMIANTO: Requiere análisis previo y eliminación especializada`);
    }
    if (c.consumo_critico === 'si' && !c.incluir_baterias) {
      alertas.push(`⚠️ CONSUMO CRÍTICO: Sin almacenamiento, el sistema no es continuo`);
    }

    setResultado({
      num_paneles: numPaneles,
      potencia_real: potenciaReal,
      espacio_requerido: espacioRequerido,
      produccion_anual: produccionAnual,
      inversor,
      costos_materiales,
      costos_mano_obra,
      costos_dificultad,
      costos_extra,
      costo_total: costoTotalSinMargen,
      costo_total_materiales: costoTotalMateriales,
      costo_total_mano_obra: costoTotalManoObra,
      costo_total_dificultades: costoTotalDificultades,
      costo_total_extras: costoTotalExtras,
      dias_totales_instalacion: diasEstimados,
      margen_recomendado: margenRecomendado,
      precio_final_recomendado: precioFinalRecomendado,
      alertas,
    });

    guardarProyecto();
  }, [formulario, guardarProyecto]);

  const limpiar = useCallback(() => {
    setFormulario(FORM_INICIAL);
    setResultado(null);
    setProyectoId(null);
  }, []);

  return (
    <div className="space-y-6">
      {guardado && (
        <div className="fixed top-4 right-4 px-4 py-2 bg-green-500/20 text-green-300 rounded-lg border border-green-500/40 text-sm">
          ✅ Guardado automáticamente
        </div>
      )}

      {/* Plantillas */}
      <div className="card rounded-2xl p-6 md:p-8 bg-accent/5 border-2 border-accent/30">
        <h3 className="font-bold text-foreground text-lg mb-4">⚡ Plantillas Rápidas</h3>
        <div className="grid gap-2 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
          {Object.entries(PLANTILLAS).map(([key, p]) => (
            <button
              key={key}
              onClick={() => cargarPlantilla(key as keyof typeof PLANTILLAS)}
              className="px-4 py-2 rounded-lg bg-card/80 text-foreground border border-border/50 hover:border-accent hover:bg-accent/20 transition text-sm font-semibold"
            >
              {p.nombre}
            </button>
          ))}
        </div>
      </div>

      {/* Formulario */}
      <SeccionCliente formulario={formulario} handleInputChange={handleInputChange} />
      <SeccionEspecificaciones formulario={formulario} handleInputChange={handleInputChange} />
      <SeccionValorInstalador formulario={formulario} handleInputChange={handleInputChange} />

      {/* Más secciones... (omitidas para brevedad, igual que antes) */}

      {/* BOTONES */}
      <div className="flex gap-3">
        <button
          onClick={calcular}
          className="flex-1 px-6 py-4 rounded-lg bg-gradient-to-r from-accent to-accent/80 text-white font-bold hover:shadow-glow transition"
        >
          ⚡ CALCULAR PRESUPUESTO COMPLETO
        </button>
        <button
          onClick={limpiar}
          className="px-6 py-4 rounded-lg border border-border bg-card/50 text-foreground font-semibold hover:bg-card transition"
        >
          🗑️ Limpiar
        </button>
      </div>

      {/* RESULTADOS PROFESIONALES */}
      {resultado && (
        <div className="space-y-6">
          {resultado.alertas.length > 0 && (
            <div className="card rounded-2xl p-6 bg-orange/10 border-2 border-orange/30">
              <h3 className="font-bold text-orange mb-4">🔔 Alertas Técnicas</h3>
              <ul className="space-y-2">
                {resultado.alertas.map((a, i) => (
                  <li key={i} className="text-sm text-foreground">{a}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Resumen técnico */}
          <div className="card rounded-2xl p-6 bg-secondary/10 border border-secondary/30">
            <h3 className="font-bold text-foreground text-lg mb-6">📊 Especificación Técnica</h3>
            <div className="grid gap-4 grid-cols-2 md:grid-cols-5">
              <div className="bg-card/80 rounded-lg p-3 border border-border/50">
                <div className="text-xs font-bold text-muted">PANELES</div>
                <div className="text-xl font-black text-secondary">{resultado.num_paneles}</div>
              </div>
              <div className="bg-card/80 rounded-lg p-3 border border-border/50">
                <div className="text-xs font-bold text-muted">POTENCIA</div>
                <div className="text-xl font-black text-secondary">{resultado.potencia_real.toFixed(2)} kW</div>
              </div>
              <div className="bg-card/80 rounded-lg p-3 border border-border/50">
                <div className="text-xs font-bold text-muted">ESPACIO</div>
                <div className="text-xl font-black text-secondary">{resultado.espacio_requerido.toFixed(1)} m²</div>
              </div>
              <div className="bg-card/80 rounded-lg p-3 border border-border/50">
                <div className="text-xs font-bold text-muted">PRODUCCIÓN</div>
                <div className="text-xl font-black text-secondary">{resultado.produccion_anual.toLocaleString()} kWh</div>
              </div>
              <div className="bg-card/80 rounded-lg p-3 border border-border/50">
                <div className="text-xs font-bold text-muted">DÍAS OBRA</div>
                <div className="text-xl font-black text-secondary">{resultado.dias_totales_instalacion}</div>
              </div>
            </div>
          </div>

          {/* DESGLOSE DE COSTOS PARA INSTALADOR */}
          <div className="card rounded-2xl p-6 bg-surface/50">
            <h3 className="font-bold text-foreground text-lg mb-6">📋 DESGLOSE DE COSTOS (para presupuestar)</h3>

            {/* Materiales */}
            <div className="mb-8">
              <div className="text-sm font-bold text-accent mb-3">MATERIALES</div>
              <div className="space-y-2 mb-4">
                {resultado.costos_materiales.map((c, i) => (
                  <div key={i} className="flex justify-between text-sm border-b border-border/30 pb-2">
                    <span className="text-foreground">{c.concepto}</span>
                    <span className="text-muted">{c.subtotal.toLocaleString('es-ES', { maximumFractionDigits: 2 })} €</span>
                  </div>
                ))}
              </div>
              <div className="flex justify-between font-bold bg-accent/10 p-3 rounded-lg border border-accent/30">
                <span className="text-foreground">SUBTOTAL MATERIALES</span>
                <span className="text-accent">{resultado.costo_total_materiales.toLocaleString('es-ES', { maximumFractionDigits: 2 })} €</span>
              </div>
            </div>

            {/* Mano de obra */}
            <div className="mb-8">
              <div className="text-sm font-bold text-cyan mb-3">MANO DE OBRA</div>
              <div className="space-y-2 mb-4">
                {resultado.costos_mano_obra.map((c, i) => (
                  <div key={i} className="flex justify-between text-sm border-b border-border/30 pb-2">
                    <span className="text-foreground">{c.concepto}</span>
                    <span className="text-muted">{c.subtotal.toLocaleString('es-ES', { maximumFractionDigits: 2 })} €</span>
                  </div>
                ))}
              </div>
              <div className="flex justify-between font-bold bg-secondary/10 p-3 rounded-lg border border-secondary/30">
                <span className="text-foreground">SUBTOTAL MANO DE OBRA</span>
                <span className="text-secondary">{resultado.costo_total_mano_obra.toLocaleString('es-ES', { maximumFractionDigits: 2 })} €</span>
              </div>
            </div>

            {/* Dificultades */}
            {resultado.costos_dificultad.length > 0 && (
              <div className="mb-8">
                <div className="text-sm font-bold text-orange mb-3">COSTOS POR DIFICULTADES</div>
                <div className="space-y-2 mb-4">
                  {resultado.costos_dificultad.map((c, i) => (
                    <div key={i} className="flex justify-between text-sm border-b border-border/30 pb-2">
                      <span className="text-foreground">{c.concepto}</span>
                      <span className="text-muted">{c.costo.toLocaleString('es-ES', { maximumFractionDigits: 2 })} €</span>
                    </div>
                  ))}
                </div>
                <div className="flex justify-between font-bold bg-orange/10 p-3 rounded-lg border border-orange/30">
                  <span className="text-foreground">SUBTOTAL DIFICULTADES</span>
                  <span className="text-orange">{resultado.costo_total_dificultades.toLocaleString('es-ES', { maximumFractionDigits: 2 })} €</span>
                </div>
              </div>
            )}

            {/* Extras */}
            {resultado.costos_extra.length > 0 && (
              <div className="mb-8">
                <div className="text-sm font-bold text-red-400 mb-3">COSTOS EXTRA</div>
                <div className="space-y-2 mb-4">
                  {resultado.costos_extra.map((c, i) => (
                    <div key={i} className="flex justify-between text-sm border-b border-border/30 pb-2">
                      <span className="text-foreground">{c.concepto}</span>
                      <span className="text-muted">{c.costo.toLocaleString('es-ES', { maximumFractionDigits: 2 })} €</span>
                    </div>
                  ))}
                </div>
                <div className="flex justify-between font-bold bg-red-500/10 p-3 rounded-lg border border-red-500/30">
                  <span className="text-foreground">SUBTOTAL EXTRAS</span>
                  <span className="text-red-400">{resultado.costo_total_extras.toLocaleString('es-ES', { maximumFractionDigits: 2 })} €</span>
                </div>
              </div>
            )}
          </div>

          {/* PRESUPUESTO FINAL */}
          <div className="card rounded-2xl p-8 bg-gradient-to-r from-accent/20 to-accent/5 border-2 border-accent/50">
            <div className="space-y-4">
              <div className="flex justify-between items-center pb-4 border-b border-accent/30">
                <span className="text-lg font-bold text-foreground">COSTO TOTAL (sin margen)</span>
                <span className="text-2xl font-black text-accent">
                  {resultado.costo_total.toLocaleString('es-ES', { maximumFractionDigits: 2 })} €
                </span>
              </div>
              <div className="flex justify-between items-center pb-4 border-b border-accent/30">
                <span className="text-lg font-bold text-foreground">+ Margen recomendado (25%)</span>
                <span className="text-xl font-black text-secondary">
                  {resultado.margen_recomendado.toLocaleString('es-ES', { maximumFractionDigits: 2 })} €
                </span>
              </div>
              <div className="flex justify-between items-center pt-4">
                <span className="text-2xl font-black text-foreground">PRECIO FINAL RECOMENDADO</span>
                <span className="text-4xl font-black text-accent">
                  {resultado.precio_final_recomendado.toLocaleString('es-ES', { maximumFractionDigits: 2 })} €
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
