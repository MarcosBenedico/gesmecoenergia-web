'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';

// CONSTANTES DE CÁLCULO
const IRRADIANCIA = 1280; // kWh/m²/año para Comarca Litera
const FACTOR_PERDIDAS = 0.77;
const POTENCIA_PANEL = 450;
const AREA_PANEL = 2.2;

// INVERSORES DISPONIBLES
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

// MAPEOS DE VALORES A DESCRIPCIONES
const MAPEOS = {
  acceso_tejado: {
    escalera_interior: 'Escalera interior (fácil)',
    escalera_exterior: 'Escalera exterior fija',
    escala_port: 'Escala portátil',
    altura_dificil: 'Acceso difícil (altura, complicado)',
  },
  distancia_cuadro: {
    '0_10': '0-10 metros',
    '10_25': '10-25 metros',
    '25_50': '25-50 metros',
    '50_mas': 'Más de 50 metros',
  },
  // ... más mapeos según necesario
};

// PLANTILLAS
const PLANTILLAS = {
  residencial_facil: {
    nombre: 'Residencial Fácil',
    cliente_descripcion: 'Instalación residencial en vivienda unifamiliar con acceso y condiciones favorables',
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
    consumo_critico: 'no',
    independencia_prioridad: 'reducir',
    ampliacion_futura: 'no',
    incluir_baterias: false,
  },
  residencial_dificil: {
    nombre: 'Residencial Difícil',
    cliente_descripcion: 'Instalación residencial con dificultades: acceso complicado, tejado antiguo',
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
    clima_viento: true,
    clima_salinidad: true,
    consumo_critico: 'no',
    independencia_prioridad: 'reducir',
    ampliacion_futura: 'no',
    incluir_baterias: false,
  },
  ganaderia_facil: {
    nombre: 'Ganadería Fácil',
    cliente_descripcion: 'Instalación ganadera moderna con consumo crítico (ordeño, refrigeración)',
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
    clima_viento: true,
    clima_polvo: true,
    consumo_critico: 'si',
    independencia_prioridad: 'parcial',
    ampliacion_futura: 'posible',
    incluir_baterias: true,
    capacidad_baterias: 12,
  },
  ganaderia_dificil: {
    nombre: 'Ganadería Difícil',
    cliente_descripcion: 'Instalación ganadera antigua con máxima independencia energética',
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
    clima_viento: true,
    clima_nieve: true,
    clima_polvo: true,
    consumo_critico: 'si',
    independencia_prioridad: 'maxima',
    ampliacion_futura: 'si',
    incluir_baterias: true,
    capacidad_baterias: 15,
  },
  empresa_facil: {
    nombre: 'Empresa Fácil',
    cliente_descripcion: 'Instalación comercial/hotelera moderna con tejado plano',
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
    consumo_critico: 'parcial',
    independencia_prioridad: 'parcial',
    ampliacion_futura: 'posible',
    incluir_baterias: true,
    capacidad_baterias: 8,
  },
  empresa_dificil: {
    nombre: 'Empresa Difícil',
    cliente_descripcion: 'Instalación comercial antigua con acceso limitado y obra civil necesaria',
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
    clima_nieve: true,
    consumo_critico: 'parcial',
    independencia_prioridad: 'parcial',
    ampliacion_futura: 'no',
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

  // Baterías
  incluir_baterias: boolean;
  capacidad_baterias: number | '';
}

interface Resultado {
  num_paneles: number;
  potencia_real: number;
  espacio_requerido: number;
  produccion_anual: number;
  inversor: any;
  costos_fase1: any[];
  costos_fase2: any[];
  costo_total: number;
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
  incluir_baterias: false,
  capacidad_baterias: '',
};

export function GeneradorFotovoltaicoV2() {
  const [formulario, setFormulario] = useState<FormData>(FORM_INICIAL);
  const [resultado, setResultado] = useState<Resultado | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [guardado, setGuardado] = useState(false);
  const [proyectoId, setProyectoId] = useState<number | null>(null);
  const autoSaveTimer = useRef<NodeJS.Timeout | null>(null);

  // Auto-guardar cuando cambia el formulario
  useEffect(() => {
    if (autoSaveTimer.current) {
      clearTimeout(autoSaveTimer.current);
    }

    autoSaveTimer.current = setTimeout(() => {
      if (formulario.cliente_nombre) {
        guardarProyecto();
      }
    }, 2000);

    return () => {
      if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    };
  }, [formulario]);

  const guardarProyecto = async () => {
    if (!formulario.cliente_nombre) return;

    setGuardando(true);
    try {
      const datosGuardar = {
        ...formulario,
        consumo_anual: formulario.consumo_anual || null,
        potencia_deseada: formulario.potencia_deseada || null,
        espacio_disponible: formulario.espacio_disponible || null,
        presupuesto_maximo: formulario.presupuesto_maximo || null,
        carga_tejado_maxima: formulario.carga_tejado_maxima || null,
        capacidad_baterias: formulario.capacidad_baterias || null,
        ...(resultado && {
          num_paneles: resultado.num_paneles,
          potencia_real: resultado.potencia_real,
          espacio_requerido: resultado.espacio_requerido,
          produccion_anual: resultado.produccion_anual,
          inversor_marca: resultado.inversor?.marca,
          inversor_modelo: resultado.inversor?.modelo,
          costos_fase1: resultado.costos_fase1,
          costos_fase2: resultado.costos_fase2,
          costo_total: resultado.costo_total,
          alertas: resultado.alertas,
        }),
      };

      if (proyectoId) {
        // Actualizar
        await supabase
          .from('proyectos_fotovoltaicos')
          .update(datosGuardar)
          .eq('id', proyectoId);
      } else {
        // Insertar
        const { data, error } = await supabase
          .from('proyectos_fotovoltaicos')
          .insert([datosGuardar])
          .select('id');

        if (error) throw error;
        if (data?.[0]) {
          setProyectoId(data[0].id);
        }
      }

      setGuardado(true);
      setTimeout(() => setGuardado(false), 2000);
    } catch (error) {
      console.error('Error guardando:', error);
    } finally {
      setGuardando(false);
    }
  };

  const handleInputChange = (field: keyof FormData, value: any) => {
    setFormulario((prev) => ({ ...prev, [field]: value }));
  };

  const cargarPlantilla = (tipoPlantilla: keyof typeof PLANTILLAS) => {
    const plantilla = PLANTILLAS[tipoPlantilla];
    setFormulario((prev) => ({
      ...prev,
      ...plantilla,
    }));
  };

  const calcular = () => {
    const c = formulario;

    // Validaciones básicas
    const consumo = Number(c.consumo_anual);
    const potencia = Number(c.potencia_deseada);
    const espacio = Number(c.espacio_disponible);

    if (!c.cliente_nombre) {
      alert('⚠️ Falta el nombre del cliente');
      return;
    }
    if (isNaN(consumo) || consumo <= 0) {
      alert('⚠️ Consumo anual inválido');
      return;
    }
    if (isNaN(potencia) || potencia <= 0) {
      alert('⚠️ Potencia deseada inválida');
      return;
    }
    if (!c.fase_sistema) {
      alert('⚠️ Selecciona el sistema eléctrico');
      return;
    }
    if (!c.tipo_tejado) {
      alert('⚠️ Selecciona el tipo de tejado');
      return;
    }
    if (isNaN(espacio) || espacio <= 0) {
      alert('⚠️ Espacio disponible inválido');
      return;
    }

    // CÁLCULOS
    const numPaneles = Math.ceil((potencia * 1000) / POTENCIA_PANEL);
    const potenciaReal = (numPaneles * POTENCIA_PANEL) / 1000;
    const espacioRequerido = numPaneles * AREA_PANEL;
    const produccionAnual = Math.round(espacioRequerido * IRRADIANCIA * FACTOR_PERDIDAS);

    // Seleccionar inversor
    const inversoresDisp = INVERSORES[c.fase_sistema as keyof typeof INVERSORES];
    let inv = inversoresDisp
      .filter((i) => i.potencia >= potenciaReal)
      .sort((a, b) => a.potencia - b.potencia);
    if (inv.length === 0) inv = inversoresDisp.sort((a, b) => b.potencia - a.potencia);
    const inversor = inv[0];

    // Costos Fase 1
    const costoEstructura = c.tipo_tejado === 'plano' ? 200 : 150;
    const costeCableadoTotal = potenciaReal * 250;
    const costeProteccionesTotal = potenciaReal * 300;
    const costeManoObraTotal = potenciaReal * 800;

    const costos_fase1 = [
      { concepto: 'Paneles Solares (450W)', cantidad: numPaneles, unitario: POTENCIA_PANEL * 0.18 },
      { concepto: 'Inversor', cantidad: 1, unitario: inversor.precio },
      { concepto: 'Estructura de Montaje', cantidad: numPaneles, unitario: costoEstructura },
      { concepto: 'Cableado y Conectores', cantidad: 1, unitario: costeCableadoTotal },
      { concepto: 'Protecciones (DC/AC)', cantidad: 1, unitario: costeProteccionesTotal },
      { concepto: 'Mano de Obra Instalación', cantidad: 1, unitario: costeManoObraTotal },
      { concepto: 'Trámites y Gestión', cantidad: 1, unitario: 500 },
    ];

    // Costos Fase 2 (Baterías)
    const costos_fase2 = [];
    if (c.incluir_baterias && c.capacidad_baterias) {
      const potBat = Number(c.capacidad_baterias);
      const precioPorKwh = 600;
      costos_fase2.push(
        { concepto: `Batería LiFePO4 (${potBat} kWh)`, cantidad: 1, unitario: potBat * precioPorKwh },
        { concepto: 'Sistema BMS', cantidad: 1, unitario: 400 },
        { concepto: 'Cableado DC', cantidad: 1, unitario: 200 },
        { concepto: 'Sistema Seguridad', cantidad: 1, unitario: 300 }
      );
    }

    // Calcular totales
    let costoTotal = 0;
    costos_fase1.forEach((c) => {
      costoTotal += c.cantidad * c.unitario;
    });
    costos_fase2.forEach((c) => {
      costoTotal += c.cantidad * c.unitario;
    });

    // VALIDACIONES INTELIGENTES
    const alertas: string[] = [];

    if (espacioRequerido > espacio) {
      alertas.push(`⚠️ ESPACIO INSUFICIENTE: Necesitas ${espacioRequerido.toFixed(1)} m² pero solo tienes ${espacio} m²`);
    }

    if (c.carga_tejado_maxima && Number(c.carga_tejado_maxima) < 50) {
      alertas.push(`⚠️ CARGA BAJA: El tejado soporta solo ${c.carga_tejado_maxima} kg/m². Necesita refuerzo`);
    }

    if (c.consumo_critico === 'si' && !c.incluir_baterias) {
      alertas.push(`⚠️ CONSUMO CRÍTICO SIN BATERÍAS: Hay consumo crítico pero sin almacenamiento`);
    }

    if (c.estado_tejado === 'reparacion_importante') {
      alertas.push(`⚠️ REPARACIÓN IMPORTANTE: El tejado necesita reparación ANTES de instalar`);
    }

    if (c.presencia_amianto === 'si_probable') {
      alertas.push(`⚠️ AMIANTO PROBABLE: Requiere análisis previo y eliminación especializada`);
    }

    if (c.acometida_cambio === 'si') {
      alertas.push(`ℹ️ CAMBIO DE ACOMETIDA: Necesita cambio eléctrico, coordinar con distribuidora`);
    }

    setResultado({
      num_paneles: numPaneles,
      potencia_real: potenciaReal,
      espacio_requerido: espacioRequerido,
      produccion_anual: produccionAnual,
      inversor,
      costos_fase1,
      costos_fase2,
      costo_total: costoTotal,
      alertas,
    });

    // Auto-guardar
    guardarProyecto();
  };

  const limpiar = () => {
    setFormulario(FORM_INICIAL);
    setResultado(null);
    setProyectoId(null);
  };

  return (
    <div className="space-y-6">
      {/* Estado de guardado */}
      {guardado && (
        <div className="fixed top-4 right-4 px-4 py-2 bg-green-500/20 text-green-300 rounded-lg border border-green-500/40">
          ✅ Guardado automáticamente
        </div>
      )}

      {/* Plantillas Rápidas */}
      <div className="card rounded-2xl p-6 md:p-8 bg-accent/5 border-2 border-accent/30">
        <h3 className="font-bold text-foreground text-lg mb-4">⚡ Cargar Plantilla Rápida</h3>
        <div className="grid gap-2 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
          {Object.entries(PLANTILLAS).map(([key, plantilla]) => (
            <button
              key={key}
              onClick={() => cargarPlantilla(key as keyof typeof PLANTILLAS)}
              className="px-4 py-3 rounded-lg bg-card/80 text-foreground border border-border/50 hover:border-accent hover:bg-accent/20 transition text-sm font-semibold"
            >
              {plantilla.nombre}
            </button>
          ))}
        </div>
      </div>

      {/* FORMULARIO */}
      <div className="space-y-6">
        {/* 👤 Datos del Cliente */}
        <div className="card rounded-2xl p-6 md:p-8 bg-surface/50">
          <h3 className="font-bold text-foreground text-lg mb-6">👤 Datos del Cliente</h3>
          <div className="grid gap-4 grid-cols-1 md:grid-cols-2">
            <div>
              <label className="block text-sm font-bold text-muted mb-2">Nombre Cliente *</label>
              <input
                type="text"
                value={formulario.cliente_nombre}
                onChange={(e) => handleInputChange('cliente_nombre', e.target.value)}
                placeholder="ej: Juan García"
                className="w-full rounded-lg border border-border bg-card px-4 py-3 text-foreground"
              />
            </div>
            <div>
              <label className="block text-sm font-bold text-muted mb-2">Email</label>
              <input
                type="email"
                value={formulario.cliente_email}
                onChange={(e) => handleInputChange('cliente_email', e.target.value)}
                className="w-full rounded-lg border border-border bg-card px-4 py-3 text-foreground"
              />
            </div>
            <div>
              <label className="block text-sm font-bold text-muted mb-2">Teléfono</label>
              <input
                type="tel"
                value={formulario.cliente_telefono}
                onChange={(e) => handleInputChange('cliente_telefono', e.target.value)}
                className="w-full rounded-lg border border-border bg-card px-4 py-3 text-foreground"
              />
            </div>
            <div>
              <label className="block text-sm font-bold text-muted mb-2">Ubicación/Localidad *</label>
              <input
                type="text"
                value={formulario.cliente_ubicacion}
                onChange={(e) => handleInputChange('cliente_ubicacion', e.target.value)}
                placeholder="ej: Binéfar"
                className="w-full rounded-lg border border-border bg-card px-4 py-3 text-foreground"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-bold text-muted mb-2">Dirección Completa</label>
              <input
                type="text"
                value={formulario.cliente_direccion}
                onChange={(e) => handleInputChange('cliente_direccion', e.target.value)}
                className="w-full rounded-lg border border-border bg-card px-4 py-3 text-foreground"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-bold text-muted mb-2">Ubicación GPS / Google Maps</label>
              <input
                type="text"
                value={formulario.cliente_ubicacion_gps}
                onChange={(e) => handleInputChange('cliente_ubicacion_gps', e.target.value)}
                placeholder="https://maps.app.goo.gl/..."
                className="w-full rounded-lg border border-border bg-card px-4 py-3 text-foreground"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-bold text-muted mb-2">Descripción de la Instalación</label>
              <textarea
                value={formulario.cliente_descripcion}
                onChange={(e) => handleInputChange('cliente_descripcion', e.target.value)}
                rows={3}
                placeholder="Detalles técnicos, acceso, obstáculos..."
                className="w-full rounded-lg border border-border bg-card px-4 py-3 text-foreground"
              />
            </div>
          </div>
        </div>

        {/* 📐 Especificaciones Técnicas */}
        <div className="card rounded-2xl p-6 md:p-8 bg-surface/50">
          <h3 className="font-bold text-foreground text-lg mb-6">📐 Especificaciones Técnicas</h3>
          <div className="bg-cyan/10 border-l-3 border-secondary p-4 rounded-lg mb-6 text-sm text-muted">
            📍 Comarca Litera: Irradiancia 1.280 kWh/m²/año · Inclinación óptima 37°
          </div>

          <div className="grid gap-4 grid-cols-1 md:grid-cols-2">
            <div>
              <label className="block text-sm font-bold text-muted mb-2">Consumo Anual (kWh/año) *</label>
              <input
                type="number"
                value={formulario.consumo_anual}
                onChange={(e) => handleInputChange('consumo_anual', e.target.value ? Number(e.target.value) : '')}
                placeholder="ej: 4000"
                min="100"
                step="100"
                className="w-full rounded-lg border border-border bg-card px-4 py-3 text-foreground"
              />
            </div>
            <div>
              <label className="block text-sm font-bold text-muted mb-2">Potencia Deseada (kW) *</label>
              <input
                type="number"
                value={formulario.potencia_deseada}
                onChange={(e) => handleInputChange('potencia_deseada', e.target.value ? Number(e.target.value) : '')}
                placeholder="ej: 5"
                min="1"
                max="30"
                step="0.5"
                className="w-full rounded-lg border border-border bg-card px-4 py-3 text-foreground"
              />
            </div>
            <div>
              <label className="block text-sm font-bold text-muted mb-2">Sistema Eléctrico *</label>
              <select
                value={formulario.fase_sistema}
                onChange={(e) => handleInputChange('fase_sistema', e.target.value)}
                className="w-full rounded-lg border border-border bg-card px-4 py-3 text-foreground"
              >
                <option value="">-- Selecciona --</option>
                <option value="mono">Monofásico (220V)</option>
                <option value="tri">Trifásico (400V)</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-bold text-muted mb-2">Tipo de Tejado *</label>
              <select
                value={formulario.tipo_tejado}
                onChange={(e) => handleInputChange('tipo_tejado', e.target.value)}
                className="w-full rounded-lg border border-border bg-card px-4 py-3 text-foreground"
              >
                <option value="">-- Selecciona --</option>
                <option value="teja">Teja (cerámica)</option>
                <option value="pizarra">Pizarra</option>
                <option value="chapa">Chapa metálica</option>
                <option value="plano">Plano/Hormigón</option>
                <option value="fibrocemento">Fibrocemento</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-bold text-muted mb-2">Espacio Disponible (m²) *</label>
              <input
                type="number"
                value={formulario.espacio_disponible}
                onChange={(e) => handleInputChange('espacio_disponible', e.target.value ? Number(e.target.value) : '')}
                placeholder="ej: 30"
                min="1"
                step="0.5"
                className="w-full rounded-lg border border-border bg-card px-4 py-3 text-foreground"
              />
            </div>
            <div>
              <label className="block text-sm font-bold text-muted mb-2">Presupuesto Máximo (€)</label>
              <input
                type="number"
                value={formulario.presupuesto_maximo}
                onChange={(e) => handleInputChange('presupuesto_maximo', e.target.value ? Number(e.target.value) : '')}
                placeholder="ej: 8000"
                min="0"
                step="100"
                className="w-full rounded-lg border border-border bg-card px-4 py-3 text-foreground"
              />
            </div>
          </div>
        </div>

        {/* 🏔️ Análisis Técnico Detallado - Accesibilidad */}
        <div className="card rounded-2xl p-6 md:p-8 bg-surface/50">
          <h3 className="font-bold text-foreground text-lg mb-6">🏠 Accesibilidad y Logística</h3>
          <div className="grid gap-4 grid-cols-1 md:grid-cols-2">
            <div>
              <label className="block text-sm font-bold text-muted mb-2">Tipo de acceso al tejado</label>
              <select
                value={formulario.acceso_tejado}
                onChange={(e) => handleInputChange('acceso_tejado', e.target.value)}
                className="w-full rounded-lg border border-border bg-card px-4 py-3 text-foreground"
              >
                <option value="">-- Selecciona --</option>
                <option value="escalera_interior">Escalera interior (fácil)</option>
                <option value="escalera_exterior">Escalera exterior fija</option>
                <option value="escala_port">Escala portátil</option>
                <option value="altura_dificil">Acceso difícil (altura, complicado)</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-bold text-muted mb-2">Distancia cuadro eléctrico a tejado</label>
              <select
                value={formulario.distancia_cuadro_electrico}
                onChange={(e) => handleInputChange('distancia_cuadro_electrico', e.target.value)}
                className="w-full rounded-lg border border-border bg-card px-4 py-3 text-foreground"
              >
                <option value="">-- Selecciona --</option>
                <option value="0_10">0-10 metros</option>
                <option value="10_25">10-25 metros</option>
                <option value="25_50">25-50 metros</option>
                <option value="50_mas">Más de 50 metros</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-bold text-muted mb-2">¿Hay espacio para almacenar materiales?</label>
              <select
                value={formulario.espacio_almacenamiento}
                onChange={(e) => handleInputChange('espacio_almacenamiento', e.target.value)}
                className="w-full rounded-lg border border-border bg-card px-4 py-3 text-foreground"
              >
                <option value="">-- Selecciona --</option>
                <option value="si_cubierto">Sí, cubierto (fácil)</option>
                <option value="si_descubierto">Sí, al aire libre</option>
                <option value="no_cercano">No, hay que traer diario</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-bold text-muted mb-2">¿Será necesario andamiaje?</label>
              <select
                value={formulario.andamiaje_necesario}
                onChange={(e) => handleInputChange('andamiaje_necesario', e.target.value)}
                className="w-full rounded-lg border border-border bg-card px-4 py-3 text-foreground"
              >
                <option value="">-- Selecciona --</option>
                <option value="no">No (estructura suficiente)</option>
                <option value="minimo">Mínimo (apoyo puntual)</option>
                <option value="completo">Sí, andamiaje completo</option>
              </select>
            </div>
          </div>
        </div>

        {/* 🏔️ Condiciones del Tejado */}
        <div className="card rounded-2xl p-6 md:p-8 bg-surface/50">
          <h3 className="font-bold text-foreground text-lg mb-6">🏔️ Condiciones del Tejado</h3>
          <div className="grid gap-4 grid-cols-1 md:grid-cols-2">
            <div>
              <label className="block text-sm font-bold text-muted mb-2">Orientación del tejado actual</label>
              <select
                value={formulario.orientacion_tejado}
                onChange={(e) => handleInputChange('orientacion_tejado', e.target.value)}
                className="w-full rounded-lg border border-border bg-card px-4 py-3 text-foreground"
              >
                <option value="">-- Selecciona --</option>
                <option value="norte">Norte (no ideal)</option>
                <option value="noreste">Noreste</option>
                <option value="este">Este (bueno)</option>
                <option value="sureste">Sureste (muy bueno)</option>
                <option value="sur">Sur (óptimo)</option>
                <option value="suroeste">Suroeste (muy bueno)</option>
                <option value="oeste">Oeste (bueno)</option>
                <option value="noroeste">Noroeste</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-bold text-muted mb-2">Inclinación aproximada</label>
              <select
                value={formulario.inclinacion_tejado}
                onChange={(e) => handleInputChange('inclinacion_tejado', e.target.value)}
                className="w-full rounded-lg border border-border bg-card px-4 py-3 text-foreground"
              >
                <option value="">-- Selecciona --</option>
                <option value="plano">Plano (0-10°)</option>
                <option value="bajo">Bajo (10-20°)</option>
                <option value="medio">Medio (20-35°, óptimo)</option>
                <option value="alto">Alto (35-50°)</option>
                <option value="muy_alto">Muy alto (&gt;50°)</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-bold text-muted mb-2">¿Hay sombreado? (árboles, edificios, etc.)</label>
              <select
                value={formulario.sombreado}
                onChange={(e) => handleInputChange('sombreado', e.target.value)}
                className="w-full rounded-lg border border-border bg-card px-4 py-3 text-foreground"
              >
                <option value="">-- Selecciona --</option>
                <option value="no">No, zona completamente despejada</option>
                <option value="parcial_mañana">Sombra parcial (mañana)</option>
                <option value="parcial_tarde">Sombra parcial (tarde)</option>
                <option value="significativo">Sombreado significativo</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-bold text-muted mb-2">¿Necesita reparación el tejado?</label>
              <select
                value={formulario.estado_tejado}
                onChange={(e) => handleInputChange('estado_tejado', e.target.value)}
                className="w-full rounded-lg border border-border bg-card px-4 py-3 text-foreground"
              >
                <option value="">-- Selecciona --</option>
                <option value="bueno">Bueno (menos de 10 años)</option>
                <option value="regular">Regular (necesita revisión)</option>
                <option value="reparaciones_menores">Necesita reparaciones menores</option>
                <option value="reparacion_importante">Necesita reparación importante</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-bold text-muted mb-2">Carga máxima permitida (kg/m²)</label>
              <input
                type="number"
                value={formulario.carga_tejado_maxima}
                onChange={(e) => handleInputChange('carga_tejado_maxima', e.target.value ? Number(e.target.value) : '')}
                placeholder="ej: 100"
                className="w-full rounded-lg border border-border bg-card px-4 py-3 text-foreground"
              />
            </div>
            <div>
              <label className="block text-sm font-bold text-muted mb-2">¿Hay presencia de amianto?</label>
              <select
                value={formulario.presencia_amianto}
                onChange={(e) => handleInputChange('presencia_amianto', e.target.value)}
                className="w-full rounded-lg border border-border bg-card px-4 py-3 text-foreground"
              >
                <option value="">-- Selecciona --</option>
                <option value="no_conocido">No (comprobado)</option>
                <option value="si_probable">Sí (probablemente, tejado antiguo)</option>
                <option value="desconocido">Desconocido (necesita análisis)</option>
              </select>
            </div>
          </div>
        </div>

        {/* ⚡ Instalación Eléctrica */}
        <div className="card rounded-2xl p-6 md:p-8 bg-surface/50">
          <h3 className="font-bold text-foreground text-lg mb-6">⚡ Instalación Eléctrica</h3>
          <div className="grid gap-4 grid-cols-1 md:grid-cols-2">
            <div>
              <label className="block text-sm font-bold text-muted mb-2">¿Cuadro general accesible?</label>
              <select
                value={formulario.cuadro_accesible}
                onChange={(e) => handleInputChange('cuadro_accesible', e.target.value)}
                className="w-full rounded-lg border border-border bg-card px-4 py-3 text-foreground"
              >
                <option value="">-- Selecciona --</option>
                <option value="si_facil">Sí, fácil acceso</option>
                <option value="si_dificil">Sí, pero difícil acceso</option>
                <option value="no">No (necesita reubicación)</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-bold text-muted mb-2">¿Tiene tierra adecuada?</label>
              <select
                value={formulario.tierra_adecuada}
                onChange={(e) => handleInputChange('tierra_adecuada', e.target.value)}
                className="w-full rounded-lg border border-border bg-card px-4 py-3 text-foreground"
              >
                <option value="">-- Selecciona --</option>
                <option value="si">Sí, tierra correcta</option>
                <option value="parcial">Parcial, necesita mejora</option>
                <option value="no">No, hay que instalar</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-bold text-muted mb-2">¿Necesita cambio de acometida?</label>
              <select
                value={formulario.acometida_cambio}
                onChange={(e) => handleInputChange('acometida_cambio', e.target.value)}
                className="w-full rounded-lg border border-border bg-card px-4 py-3 text-foreground"
              >
                <option value="">-- Selecciona --</option>
                <option value="no">No, es suficiente</option>
                <option value="posible">Posible pero sin cambio</option>
                <option value="si">Sí, necesita cambio</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-bold text-muted mb-2">Distancia cuadro a tejado</label>
              <select
                value={formulario.distancia_cableado}
                onChange={(e) => handleInputChange('distancia_cableado', e.target.value)}
                className="w-full rounded-lg border border-border bg-card px-4 py-3 text-foreground"
              >
                <option value="">-- Selecciona --</option>
                <option value="menos_20">Menos de 20 metros</option>
                <option value="20_50">20-50 metros</option>
                <option value="mas_50">Más de 50 metros (cableado importante)</option>
              </select>
            </div>
          </div>
        </div>

        {/* ⚠️ Condiciones Climáticas */}
        <div className="card rounded-2xl p-6 md:p-8 bg-surface/50">
          <h3 className="font-bold text-foreground text-lg mb-6">⚠️ Condiciones Climáticas</h3>
          <div className="grid gap-3 grid-cols-1 md:grid-cols-2 mb-6">
            <label className="flex items-center gap-3 p-3 rounded-lg border border-border bg-card/50 cursor-pointer hover:bg-card transition">
              <input
                type="checkbox"
                checked={formulario.clima_viento}
                onChange={(e) => handleInputChange('clima_viento', e.target.checked)}
                className="w-4 h-4 rounded"
              />
              <span className="text-sm font-medium text-foreground">💨 Zona de mucho viento</span>
            </label>
            <label className="flex items-center gap-3 p-3 rounded-lg border border-border bg-card/50 cursor-pointer hover:bg-card transition">
              <input
                type="checkbox"
                checked={formulario.clima_nieve}
                onChange={(e) => handleInputChange('clima_nieve', e.target.checked)}
                className="w-4 h-4 rounded"
              />
              <span className="text-sm font-medium text-foreground">❄️ Nieve frecuente</span>
            </label>
            <label className="flex items-center gap-3 p-3 rounded-lg border border-border bg-card/50 cursor-pointer hover:bg-card transition">
              <input
                type="checkbox"
                checked={formulario.clima_salinidad}
                onChange={(e) => handleInputChange('clima_salinidad', e.target.checked)}
                className="w-4 h-4 rounded"
              />
              <span className="text-sm font-medium text-foreground">🌊 Zona salina (costa)</span>
            </label>
            <label className="flex items-center gap-3 p-3 rounded-lg border border-border bg-card/50 cursor-pointer hover:bg-card transition">
              <input
                type="checkbox"
                checked={formulario.clima_polvo}
                onChange={(e) => handleInputChange('clima_polvo', e.target.checked)}
                className="w-4 h-4 rounded"
              />
              <span className="text-sm font-medium text-foreground">🌫️ Polvo/contaminación</span>
            </label>
          </div>
          <div>
            <label className="block text-sm font-bold text-muted mb-2">Otras dificultades especiales</label>
            <textarea
              value={formulario.dificultades_especiales}
              onChange={(e) => handleInputChange('dificultades_especiales', e.target.value)}
              rows={2}
              placeholder="ej: ganado agresivo, obra en progreso, acceso solo ciertos días..."
              className="w-full rounded-lg border border-border bg-card px-4 py-3 text-foreground"
            />
          </div>
        </div>

        {/* 🎯 Necesidades Especiales */}
        <div className="card rounded-2xl p-6 md:p-8 bg-surface/50">
          <h3 className="font-bold text-foreground text-lg mb-6">🎯 Necesidades Especiales</h3>
          <div className="grid gap-4 grid-cols-1 md:grid-cols-2">
            <div>
              <label className="block text-sm font-bold text-muted mb-2">¿Hay consumo crítico?</label>
              <select
                value={formulario.consumo_critico}
                onChange={(e) => handleInputChange('consumo_critico', e.target.value)}
                className="w-full rounded-lg border border-border bg-card px-4 py-3 text-foreground"
              >
                <option value="">-- Selecciona --</option>
                <option value="no">No, puede haber cortes</option>
                <option value="parcial">Parcial (algunas cargas críticas)</option>
                <option value="si">Sí (ganadería, invernadero, frío)</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-bold text-muted mb-2">Prioridad de independencia energética</label>
              <select
                value={formulario.independencia_prioridad}
                onChange={(e) => handleInputChange('independencia_prioridad', e.target.value)}
                className="w-full rounded-lg border border-border bg-card px-4 py-3 text-foreground"
              >
                <option value="">-- Selecciona --</option>
                <option value="reducir">Reducir factura (conexión a red)</option>
                <option value="parcial">Parcial (con almacenamiento)</option>
                <option value="maxima">Máxima (autosuficiencia)</option>
              </select>
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-bold text-muted mb-2">¿Previsión de ampliación futura?</label>
              <select
                value={formulario.ampliacion_futura}
                onChange={(e) => handleInputChange('ampliacion_futura', e.target.value)}
                className="w-full rounded-lg border border-border bg-card px-4 py-3 text-foreground"
              >
                <option value="">-- Selecciona --</option>
                <option value="no">No, instalación definitiva</option>
                <option value="posible">Posible en el futuro</option>
                <option value="si">Sí, se ampliará (dimensionar)</option>
              </select>
            </div>
          </div>
        </div>

        {/* 🔋 Almacenamiento (Baterías) */}
        <div className="card rounded-2xl p-6 md:p-8 bg-surface/50">
          <h3 className="font-bold text-foreground text-lg mb-6">🔋 Almacenamiento — Baterías</h3>
          <div className="grid gap-4 grid-cols-1 md:grid-cols-2">
            <div>
              <label className="block text-sm font-bold text-muted mb-2">¿Incluir Baterías?</label>
              <select
                value={formulario.incluir_baterias ? 'si' : 'no'}
                onChange={(e) => handleInputChange('incluir_baterias', e.target.value === 'si')}
                className="w-full rounded-lg border border-border bg-card px-4 py-3 text-foreground"
              >
                <option value="no">No (conexión a red)</option>
                <option value="si">Sí (con almacenamiento)</option>
              </select>
            </div>
            {formulario.incluir_baterias && (
              <div>
                <label className="block text-sm font-bold text-muted mb-2">Capacidad (kWh)</label>
                <input
                  type="number"
                  value={formulario.capacidad_baterias}
                  onChange={(e) => handleInputChange('capacidad_baterias', e.target.value ? Number(e.target.value) : '')}
                  placeholder="ej: 10"
                  min="5"
                  step="5"
                  className="w-full rounded-lg border border-border bg-card px-4 py-3 text-foreground"
                />
              </div>
            )}
          </div>
        </div>

        {/* BOTONES DE ACCIÓN */}
        <div className="flex gap-3">
          <button
            onClick={calcular}
            className="flex-1 px-6 py-4 rounded-lg bg-gradient-to-r from-accent to-accent/80 text-white font-bold hover:shadow-glow transition text-lg"
          >
            ⚡ CALCULAR ESPECIFICACIÓN
          </button>
          <button
            onClick={limpiar}
            className="px-6 py-4 rounded-lg border border-border bg-card/50 text-foreground font-semibold hover:bg-card transition"
          >
            🗑️ Limpiar
          </button>
        </div>
      </div>

      {/* RESULTADOS */}
      {resultado && (
        <div className="space-y-6">
          {/* Alertas */}
          {resultado.alertas.length > 0 && (
            <div className="card rounded-2xl p-6 bg-orange/10 border-2 border-orange/30">
              <h3 className="font-bold text-orange mb-4">🔔 Validaciones Técnicas</h3>
              <ul className="space-y-2">
                {resultado.alertas.map((alerta, i) => (
                  <li key={i} className="text-sm text-foreground">
                    {alerta}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Resumen de Cálculos */}
          <div className="card rounded-2xl p-6 md:p-8 bg-secondary/10 border border-secondary/30">
            <h3 className="font-bold text-foreground text-lg mb-6">📊 Especificación Calculada</h3>
            <div className="grid gap-4 grid-cols-1 md:grid-cols-3">
              <div className="bg-card/80 rounded-lg p-4 border border-border/50">
                <div className="text-xs font-bold text-muted mb-2">PANELES (450W)</div>
                <div className="text-2xl font-black text-secondary">{resultado.num_paneles}</div>
              </div>
              <div className="bg-card/80 rounded-lg p-4 border border-border/50">
                <div className="text-xs font-bold text-muted mb-2">POTENCIA REAL</div>
                <div className="text-2xl font-black text-secondary">{resultado.potencia_real.toFixed(2)} kW</div>
              </div>
              <div className="bg-card/80 rounded-lg p-4 border border-border/50">
                <div className="text-xs font-bold text-muted mb-2">ESPACIO REQUERIDO</div>
                <div className="text-2xl font-black text-secondary">{resultado.espacio_requerido.toFixed(1)} m²</div>
              </div>
              <div className="bg-card/80 rounded-lg p-4 border border-border/50">
                <div className="text-xs font-bold text-muted mb-2">PRODUCCIÓN ANUAL</div>
                <div className="text-2xl font-black text-secondary">{resultado.produccion_anual.toLocaleString()} kWh</div>
              </div>
              <div className="bg-card/80 rounded-lg p-4 border border-border/50 md:col-span-2">
                <div className="text-xs font-bold text-muted mb-2">INVERSOR RECOMENDADO</div>
                <div className="text-lg font-black text-secondary">
                  {resultado.inversor.marca} {resultado.inversor.modelo}
                </div>
              </div>
            </div>
          </div>

          {/* Costos Fase 1 */}
          <div className="card rounded-2xl p-6 md:p-8 bg-surface/50">
            <h3 className="font-bold text-foreground text-lg mb-4">Fase 1 — Sistema Fotovoltaico</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-2 px-3 font-bold text-muted">Concepto</th>
                    <th className="text-center py-2 px-3 font-bold text-muted">Cantidad</th>
                    <th className="text-right py-2 px-3 font-bold text-muted">Unitario (€)</th>
                    <th className="text-right py-2 px-3 font-bold text-muted">Subtotal (€)</th>
                  </tr>
                </thead>
                <tbody>
                  {resultado.costos_fase1.map((item, i) => (
                    <tr key={i} className="border-b border-border/50 hover:bg-card/30">
                      <td className="py-3 px-3 text-foreground">{item.concepto}</td>
                      <td className="py-3 px-3 text-center text-muted">{item.cantidad.toFixed(2)}</td>
                      <td className="py-3 px-3 text-right text-muted">{item.unitario.toFixed(2)}</td>
                      <td className="py-3 px-3 text-right text-foreground font-semibold">
                        {(item.cantidad * item.unitario).toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Costos Fase 2 (si hay) */}
          {resultado.costos_fase2.length > 0 && (
            <div className="card rounded-2xl p-6 md:p-8 bg-surface/50">
              <h3 className="font-bold text-foreground text-lg mb-4">Fase 2 — Almacenamiento (Baterías)</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left py-2 px-3 font-bold text-muted">Concepto</th>
                      <th className="text-center py-2 px-3 font-bold text-muted">Cantidad</th>
                      <th className="text-right py-2 px-3 font-bold text-muted">Unitario (€)</th>
                      <th className="text-right py-2 px-3 font-bold text-muted">Subtotal (€)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {resultado.costos_fase2.map((item, i) => (
                      <tr key={i} className="border-b border-border/50 hover:bg-card/30">
                        <td className="py-3 px-3 text-foreground">{item.concepto}</td>
                        <td className="py-3 px-3 text-center text-muted">{item.cantidad.toFixed(2)}</td>
                        <td className="py-3 px-3 text-right text-muted">{item.unitario.toFixed(2)}</td>
                        <td className="py-3 px-3 text-right text-foreground font-semibold">
                          {(item.cantidad * item.unitario).toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Total */}
          <div className="card rounded-2xl p-6 md:p-8 bg-accent/10 border-2 border-accent/30">
            <div className="flex justify-between items-center">
              <span className="text-lg font-bold text-foreground">PRESUPUESTO TOTAL</span>
              <span className="text-3xl font-black text-accent">{resultado.costo_total.toLocaleString('es-ES', { minimumFractionDigits: 2 })} €</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
