'use client';

import { useState, useCallback, useEffect, useRef, memo } from 'react';
import { supabase } from '@/lib/supabase';
import { generarPdfEspecificacion } from '@/lib/pdf-generator';
import { generarExcelEspecificacion } from '@/lib/excel-generator';

// ============================================
// CONSTANTES - SIN COSTOS
// ============================================
const IRRADIANCIA = 1280; // kWh/m²/año Comarca Litera
const FACTOR_PERDIDAS = 0.77;
const POTENCIA_PANEL = 450;
const AREA_PANEL = 2.2;

// INVERSORES (solo para especificar modelos)
const INVERSORES = {
  mono: [
    { potencia: 3.7, marca: 'Fronius', modelo: 'Symo 3.7' },
    { potencia: 5, marca: 'Growatt', modelo: 'MIC 3000TL-X' },
    { potencia: 5, marca: 'Fronius', modelo: 'Symo 5.0' },
    { potencia: 8.2, marca: 'Fronius', modelo: 'Symo 8.2' },
    { potencia: 10, marca: 'Growatt', modelo: 'MIC 8000TL-X' },
  ],
  tri: [
    { potencia: 10, marca: 'Fronius', modelo: 'Symo 10.0-3-M' },
    { potencia: 12, marca: 'Growatt', modelo: 'TL3-10' },
    { potencia: 15, marca: 'Fronius', modelo: 'Symo 15.0-3-M' },
    { potencia: 20, marca: 'Growatt', modelo: 'TL3-20' },
  ],
};

// PLANTILLAS
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
    clima_nieve: true,
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

  // Información instalador
  altura_edificio_pisos: number | '';
  distancia_cuadro_a_tejado_metros: number | '';
  dias_instalacion_estimado: number | '';
  necesita_grua: boolean;
  requiere_refuerzo_estructural: boolean;
  reparaciones_tejado_previas: boolean;

  // Baterías
  incluir_baterias: boolean;
  capacidad_baterias: number | '';
}

interface ResultadosTecnicos {
  num_paneles: number;
  potencia_real: number;
  espacio_requerido: number;
  produccion_anual: number;
  inversor: any;
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
  distancia_cuadro_a_tejado_metros: '',
  dias_instalacion_estimado: '',
  necesita_grua: false,
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
      <div className="md:col-span-2">
        <input
          type="text"
          value={formulario.cliente_direccion}
          onChange={(e) => handleInputChange('cliente_direccion', e.target.value)}
          placeholder="Dirección completa"
          className="w-full rounded-lg border border-border bg-card px-4 py-3 text-foreground text-sm"
        />
      </div>
      <div className="md:col-span-2">
        <input
          type="text"
          value={formulario.cliente_ubicacion_gps}
          onChange={(e) => handleInputChange('cliente_ubicacion_gps', e.target.value)}
          placeholder="Google Maps link (https://maps.app.goo.gl/...)"
          className="w-full rounded-lg border border-border bg-card px-4 py-3 text-foreground text-sm"
        />
      </div>
      <div className="md:col-span-2">
        <textarea
          value={formulario.cliente_descripcion}
          onChange={(e) => handleInputChange('cliente_descripcion', e.target.value)}
          rows={3}
          placeholder="Descripción general de la instalación"
          className="w-full rounded-lg border border-border bg-card px-4 py-3 text-foreground text-sm"
        />
      </div>
    </div>
  </div>
));

export function GeneradorFotovoltaicoFinal() {
  const [formulario, setFormulario] = useState<FormData>(FORM_INICIAL);
  const [resultado, setResultado] = useState<ResultadosTecnicos | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [guardado, setGuardado] = useState(false);
  const [proyectoId, setProyectoId] = useState<number | null>(null);
  const autoSaveTimer = useRef<NodeJS.Timeout | null>(null);

  const guardarProyecto = useCallback(async () => {
    if (!formulario.cliente_nombre) return;
    setGuardando(true);
    try {
      const datosGuardar = {
        cliente_nombre: formulario.cliente_nombre,
        cliente_email: formulario.cliente_email,
        cliente_telefono: formulario.cliente_telefono,
        cliente_ubicacion: formulario.cliente_ubicacion,
        cliente_direccion: formulario.cliente_direccion,
        cliente_ubicacion_gps: formulario.cliente_ubicacion_gps,
        cliente_descripcion: formulario.cliente_descripcion,
        consumo_anual: formulario.consumo_anual || null,
        potencia_deseada: formulario.potencia_deseada || null,
        fase_sistema: formulario.fase_sistema,
        tipo_tejado: formulario.tipo_tejado,
        espacio_disponible: formulario.espacio_disponible || null,
        presupuesto_maximo: formulario.presupuesto_maximo || null,
        acceso_tejado: formulario.acceso_tejado,
        distancia_cuadro_electrico: formulario.distancia_cuadro_electrico,
        espacio_almacenamiento: formulario.espacio_almacenamiento,
        andamiaje_necesario: formulario.andamiaje_necesario,
        orientacion_tejado: formulario.orientacion_tejado,
        inclinacion_tejado: formulario.inclinacion_tejado,
        sombreado: formulario.sombreado,
        estado_tejado: formulario.estado_tejado,
        carga_tejado_maxima: formulario.carga_tejado_maxima || null,
        presencia_amianto: formulario.presencia_amianto,
        cuadro_accesible: formulario.cuadro_accesible,
        tierra_adecuada: formulario.tierra_adecuada,
        acometida_cambio: formulario.acometida_cambio,
        distancia_cableado: formulario.distancia_cableado,
        clima_viento: formulario.clima_viento,
        clima_nieve: formulario.clima_nieve,
        clima_salinidad: formulario.clima_salinidad,
        clima_polvo: formulario.clima_polvo,
        dificultades_especiales: formulario.dificultades_especiales,
        consumo_critico: formulario.consumo_critico,
        independencia_prioridad: formulario.independencia_prioridad,
        ampliacion_futura: formulario.ampliacion_futura,
        altura_edificio_pisos: formulario.altura_edificio_pisos || null,
        distancia_cuadro_a_tejado_metros: formulario.distancia_cuadro_a_tejado_metros || null,
        dias_instalacion_estimado: formulario.dias_instalacion_estimado || null,
        necesita_grua: formulario.necesita_grua,
        requiere_refuerzo_estructural: formulario.requiere_refuerzo_estructural,
        reparaciones_tejado_previas: formulario.reparaciones_tejado_previas,
        incluir_baterias: formulario.incluir_baterias,
        capacidad_baterias: formulario.capacidad_baterias || null,
        ...(resultado && {
          num_paneles: resultado.num_paneles,
          potencia_real: resultado.potencia_real,
          espacio_requerido: resultado.espacio_requerido,
          produccion_anual: resultado.produccion_anual,
          inversor_marca: resultado.inversor?.marca,
          inversor_modelo: resultado.inversor?.modelo,
          alertas: resultado.alertas.length > 0 ? resultado.alertas : null,
        }),
      };

      if (proyectoId) {
        const { error } = await supabase
          .from('proyectos_fotovoltaicos')
          .update(datosGuardar)
          .eq('id', proyectoId);

        if (error) {
          console.error('❌ Error actualizando proyecto:', error);
        } else {
          console.log('✅ Proyecto actualizado:', proyectoId);
          setGuardado(true);
          setTimeout(() => setGuardado(false), 2000);
        }
      } else {
        const { data, error } = await supabase
          .from('proyectos_fotovoltaicos')
          .insert([datosGuardar])
          .select('id');

        if (error) {
          console.error('❌ Error insertando proyecto:', error);
        } else if (data?.[0]) {
          console.log('✅ Proyecto guardado con ID:', data[0].id);
          setProyectoId(data[0].id);
          setGuardado(true);
          setTimeout(() => setGuardado(false), 2000);
        }
      }
    } catch (error) {
      console.error('❌ Error guardando proyecto:', error);
    } finally {
      setGuardando(false);
    }
  }, [formulario, resultado, proyectoId]);

  // Auto-guardar optimizado - Guardar cada 2 segundos
  useEffect(() => {
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);

    if (!formulario.cliente_nombre || !formulario.cliente_ubicacion) {
      return;
    }

    autoSaveTimer.current = setTimeout(() => {
      guardarProyecto();
    }, 2000);

    return () => {
      if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    };
  }, [formulario, guardarProyecto]);

  const handleInputChange = useCallback((field: keyof FormData, value: any) => {
    setFormulario((prev) => ({ ...prev, [field]: value }));
  }, []);

  const cargarPlantilla = useCallback((tipoPlantilla: keyof typeof PLANTILLAS) => {
    const plantilla = PLANTILLAS[tipoPlantilla];
    setFormulario((prev) => ({ ...prev, ...plantilla }));
  }, []);

  const calcular = useCallback(() => {
    const c = formulario;
    const consumo = Number(c.consumo_anual);
    const potencia = Number(c.potencia_deseada);
    const espacio = Number(c.espacio_disponible);

    if (!c.cliente_nombre || isNaN(consumo) || consumo <= 0 || isNaN(potencia) || potencia <= 0 ||
        !c.fase_sistema || !c.tipo_tejado || isNaN(espacio) || espacio <= 0) {
      alert('⚠️ Completa los campos obligatorios');
      return;
    }

    // CÁLCULOS TÉCNICOS (sin costos)
    const numPaneles = Math.ceil((potencia * 1000) / POTENCIA_PANEL);
    const potenciaReal = (numPaneles * POTENCIA_PANEL) / 1000;
    const espacioRequerido = numPaneles * AREA_PANEL;
    const produccionAnual = Math.round(espacioRequerido * IRRADIANCIA * FACTOR_PERDIDAS);

    // Seleccionar inversor
    const inversoresDisp = INVERSORES[c.fase_sistema as keyof typeof INVERSORES];
    let inv = inversoresDisp.filter((i) => i.potencia >= potenciaReal).sort((a, b) => a.potencia - b.potencia);
    if (inv.length === 0) inv = inversoresDisp.sort((a, b) => b.potencia - a.potencia);
    const inversor = inv[0];

    // VALIDACIONES TÉCNICAS
    const alertas: string[] = [];

    if (espacioRequerido > espacio) {
      alertas.push(`⚠️ ESPACIO INSUFICIENTE: Necesitas ${espacioRequerido.toFixed(1)} m² pero tienes ${espacio} m²`);
    }
    if (c.estado_tejado === 'reparacion_importante') {
      alertas.push(`⚠️ REPARACIÓN PREVIA: El tejado necesita reparación ANTES de instalar`);
    }
    if (c.presencia_amianto === 'si_probable' || c.presencia_amianto === 'desconocido') {
      alertas.push(`⚠️ AMIANTO: Requiere análisis previo y eliminación especializada`);
    }
    if (c.consumo_critico === 'si' && !c.incluir_baterias) {
      alertas.push(`⚠️ CONSUMO CRÍTICO: Sin almacenamiento, no hay continuidad`);
    }

    setResultado({
      num_paneles: numPaneles,
      potencia_real: potenciaReal,
      espacio_requerido: espacioRequerido,
      produccion_anual: produccionAnual,
      inversor,
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
        <h3 className="font-bold text-foreground text-lg mb-4">⚡ Cargar Plantilla Rápida</h3>
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

      {/* Especificaciones */}
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
            value={formulario.altura_edificio_pisos}
            onChange={(e) => handleInputChange('altura_edificio_pisos', e.target.value ? Number(e.target.value) : '')}
            placeholder="Altura (pisos)"
            className="rounded-lg border border-border bg-card px-4 py-3 text-foreground text-sm"
          />
        </div>
      </div>

      {/* Accesibilidad */}
      <div className="card rounded-2xl p-6 md:p-8 bg-surface/50">
        <h3 className="font-bold text-foreground text-lg mb-6">🏠 Accesibilidad y Logística</h3>
        <div className="grid gap-4 grid-cols-1 md:grid-cols-2">
          <select
            value={formulario.acceso_tejado}
            onChange={(e) => handleInputChange('acceso_tejado', e.target.value)}
            className="rounded-lg border border-border bg-card px-4 py-3 text-foreground text-sm"
          >
            <option value="">Tipo de acceso al tejado</option>
            <option value="escalera_interior">Escalera interior (fácil)</option>
            <option value="escalera_exterior">Escalera exterior fija</option>
            <option value="escala_port">Escala portátil</option>
            <option value="altura_dificil">Acceso difícil (altura, complicado)</option>
          </select>
          <select
            value={formulario.distancia_cuadro_electrico}
            onChange={(e) => handleInputChange('distancia_cuadro_electrico', e.target.value)}
            className="rounded-lg border border-border bg-card px-4 py-3 text-foreground text-sm"
          >
            <option value="">Distancia cuadro eléctrico a tejado</option>
            <option value="0_10">0-10 metros</option>
            <option value="10_25">10-25 metros</option>
            <option value="25_50">25-50 metros</option>
            <option value="50_mas">Más de 50 metros</option>
          </select>
          <select
            value={formulario.espacio_almacenamiento}
            onChange={(e) => handleInputChange('espacio_almacenamiento', e.target.value)}
            className="rounded-lg border border-border bg-card px-4 py-3 text-foreground text-sm"
          >
            <option value="">Espacio para almacenar materiales</option>
            <option value="si_cubierto">Sí, cubierto (fácil)</option>
            <option value="si_descubierto">Sí, al aire libre</option>
            <option value="no_cercano">No, hay que traer diario</option>
          </select>
          <select
            value={formulario.andamiaje_necesario}
            onChange={(e) => handleInputChange('andamiaje_necesario', e.target.value)}
            className="rounded-lg border border-border bg-card px-4 py-3 text-foreground text-sm"
          >
            <option value="">¿Andamiaje necesario?</option>
            <option value="no">No (estructura suficiente)</option>
            <option value="minimo">Mínimo (apoyo puntual)</option>
            <option value="completo">Sí, andamiaje completo</option>
          </select>
        </div>
      </div>

      {/* Condiciones Tejado */}
      <div className="card rounded-2xl p-6 md:p-8 bg-surface/50">
        <h3 className="font-bold text-foreground text-lg mb-6">🏔️ Condiciones del Tejado</h3>
        <div className="grid gap-4 grid-cols-1 md:grid-cols-2">
          <select
            value={formulario.orientacion_tejado}
            onChange={(e) => handleInputChange('orientacion_tejado', e.target.value)}
            className="rounded-lg border border-border bg-card px-4 py-3 text-foreground text-sm"
          >
            <option value="">Orientación actual</option>
            <option value="norte">Norte (no ideal)</option>
            <option value="noreste">Noreste</option>
            <option value="este">Este (bueno)</option>
            <option value="sureste">Sureste (muy bueno)</option>
            <option value="sur">Sur (óptimo)</option>
            <option value="suroeste">Suroeste (muy bueno)</option>
            <option value="oeste">Oeste (bueno)</option>
            <option value="noroeste">Noroeste</option>
          </select>
          <select
            value={formulario.inclinacion_tejado}
            onChange={(e) => handleInputChange('inclinacion_tejado', e.target.value)}
            className="rounded-lg border border-border bg-card px-4 py-3 text-foreground text-sm"
          >
            <option value="">Inclinación aproximada</option>
            <option value="plano">Plano (0-10°)</option>
            <option value="bajo">Bajo (10-20°)</option>
            <option value="medio">Medio (20-35°, óptimo)</option>
            <option value="alto">Alto (35-50°)</option>
            <option value="muy_alto">Muy alto (&gt;50°)</option>
          </select>
          <select
            value={formulario.sombreado}
            onChange={(e) => handleInputChange('sombreado', e.target.value)}
            className="rounded-lg border border-border bg-card px-4 py-3 text-foreground text-sm"
          >
            <option value="">¿Sombreado? (árboles, edificios, etc.)</option>
            <option value="no">No, zona completamente despejada</option>
            <option value="parcial_mañana">Sombra parcial (mañana)</option>
            <option value="parcial_tarde">Sombra parcial (tarde)</option>
            <option value="significativo">Sombreado significativo</option>
          </select>
          <select
            value={formulario.estado_tejado}
            onChange={(e) => handleInputChange('estado_tejado', e.target.value)}
            className="rounded-lg border border-border bg-card px-4 py-3 text-foreground text-sm"
          >
            <option value="">Estado del tejado</option>
            <option value="bueno">Bueno (menos de 10 años)</option>
            <option value="regular">Regular (necesita revisión)</option>
            <option value="reparaciones_menores">Necesita reparaciones menores</option>
            <option value="reparacion_importante">Necesita reparación importante</option>
          </select>
          <input
            type="number"
            value={formulario.carga_tejado_maxima}
            onChange={(e) => handleInputChange('carga_tejado_maxima', e.target.value ? Number(e.target.value) : '')}
            placeholder="Carga máxima permitida (kg/m²)"
            className="rounded-lg border border-border bg-card px-4 py-3 text-foreground text-sm"
          />
          <select
            value={formulario.presencia_amianto}
            onChange={(e) => handleInputChange('presencia_amianto', e.target.value)}
            className="rounded-lg border border-border bg-card px-4 py-3 text-foreground text-sm"
          >
            <option value="">¿Presencia de amianto?</option>
            <option value="no_conocido">No (comprobado)</option>
            <option value="si_probable">Sí (probablemente, tejado antiguo)</option>
            <option value="desconocido">Desconocido (necesita análisis)</option>
          </select>
        </div>
      </div>

      {/* Instalación Eléctrica */}
      <div className="card rounded-2xl p-6 md:p-8 bg-surface/50">
        <h3 className="font-bold text-foreground text-lg mb-6">⚡ Instalación Eléctrica</h3>
        <div className="grid gap-4 grid-cols-1 md:grid-cols-2">
          <select
            value={formulario.cuadro_accesible}
            onChange={(e) => handleInputChange('cuadro_accesible', e.target.value)}
            className="rounded-lg border border-border bg-card px-4 py-3 text-foreground text-sm"
          >
            <option value="">¿Cuadro general accesible?</option>
            <option value="si_facil">Sí, fácil acceso</option>
            <option value="si_dificil">Sí, pero difícil acceso</option>
            <option value="no">No (necesita reubicación)</option>
          </select>
          <select
            value={formulario.tierra_adecuada}
            onChange={(e) => handleInputChange('tierra_adecuada', e.target.value)}
            className="rounded-lg border border-border bg-card px-4 py-3 text-foreground text-sm"
          >
            <option value="">¿Tiene tierra adecuada?</option>
            <option value="si">Sí, tierra correcta</option>
            <option value="parcial">Parcial, necesita mejora</option>
            <option value="no">No, hay que instalar</option>
          </select>
          <select
            value={formulario.acometida_cambio}
            onChange={(e) => handleInputChange('acometida_cambio', e.target.value)}
            className="rounded-lg border border-border bg-card px-4 py-3 text-foreground text-sm"
          >
            <option value="">¿Necesita cambio de acometida?</option>
            <option value="no">No, es suficiente</option>
            <option value="posible">Posible pero sin cambio</option>
            <option value="si">Sí, necesita cambio</option>
          </select>
          <select
            value={formulario.distancia_cableado}
            onChange={(e) => handleInputChange('distancia_cableado', e.target.value)}
            className="rounded-lg border border-border bg-card px-4 py-3 text-foreground text-sm"
          >
            <option value="">Distancia cuadro a tejado</option>
            <option value="menos_20">Menos de 20 metros</option>
            <option value="20_50">20-50 metros</option>
            <option value="mas_50">Más de 50 metros</option>
          </select>
        </div>
      </div>

      {/* Clima */}
      <div className="card rounded-2xl p-6 md:p-8 bg-surface/50">
        <h3 className="font-bold text-foreground text-lg mb-6">⚠️ Condiciones Climáticas</h3>
        <div className="grid gap-3 grid-cols-1 md:grid-cols-2 mb-6">
          <label className="flex items-center gap-3 p-3 rounded-lg border border-border bg-card/50 cursor-pointer">
            <input
              type="checkbox"
              checked={formulario.clima_viento}
              onChange={(e) => handleInputChange('clima_viento', e.target.checked)}
              className="w-4 h-4 rounded"
            />
            <span className="text-sm font-medium text-foreground">💨 Zona de mucho viento</span>
          </label>
          <label className="flex items-center gap-3 p-3 rounded-lg border border-border bg-card/50 cursor-pointer">
            <input
              type="checkbox"
              checked={formulario.clima_nieve}
              onChange={(e) => handleInputChange('clima_nieve', e.target.checked)}
              className="w-4 h-4 rounded"
            />
            <span className="text-sm font-medium text-foreground">❄️ Nieve frecuente</span>
          </label>
          <label className="flex items-center gap-3 p-3 rounded-lg border border-border bg-card/50 cursor-pointer">
            <input
              type="checkbox"
              checked={formulario.clima_salinidad}
              onChange={(e) => handleInputChange('clima_salinidad', e.target.checked)}
              className="w-4 h-4 rounded"
            />
            <span className="text-sm font-medium text-foreground">🌊 Zona salina (costa)</span>
          </label>
          <label className="flex items-center gap-3 p-3 rounded-lg border border-border bg-card/50 cursor-pointer">
            <input
              type="checkbox"
              checked={formulario.clima_polvo}
              onChange={(e) => handleInputChange('clima_polvo', e.target.checked)}
              className="w-4 h-4 rounded"
            />
            <span className="text-sm font-medium text-foreground">🌫️ Polvo/contaminación</span>
          </label>
        </div>
        <textarea
          value={formulario.dificultades_especiales}
          onChange={(e) => handleInputChange('dificultades_especiales', e.target.value)}
          rows={2}
          placeholder="Otras dificultades especiales"
          className="w-full rounded-lg border border-border bg-card px-4 py-3 text-foreground text-sm"
        />
      </div>

      {/* Necesidades */}
      <div className="card rounded-2xl p-6 md:p-8 bg-surface/50">
        <h3 className="font-bold text-foreground text-lg mb-6">🎯 Necesidades Especiales</h3>
        <div className="grid gap-4 grid-cols-1 md:grid-cols-2">
          <select
            value={formulario.consumo_critico}
            onChange={(e) => handleInputChange('consumo_critico', e.target.value)}
            className="rounded-lg border border-border bg-card px-4 py-3 text-foreground text-sm"
          >
            <option value="">¿Hay consumo crítico?</option>
            <option value="no">No, puede haber cortes</option>
            <option value="parcial">Parcial (algunas cargas críticas)</option>
            <option value="si">Sí (ganadería, invernadero, frío)</option>
          </select>
          <select
            value={formulario.independencia_prioridad}
            onChange={(e) => handleInputChange('independencia_prioridad', e.target.value)}
            className="rounded-lg border border-border bg-card px-4 py-3 text-foreground text-sm"
          >
            <option value="">Prioridad de independencia energética</option>
            <option value="reducir">Reducir factura (conexión a red)</option>
            <option value="parcial">Parcial (con almacenamiento)</option>
            <option value="maxima">Máxima (autosuficiencia)</option>
          </select>
          <select
            value={formulario.ampliacion_futura}
            onChange={(e) => handleInputChange('ampliacion_futura', e.target.value)}
            className="rounded-lg border border-border bg-card px-4 py-3 text-foreground text-sm"
          >
            <option value="">¿Previsión de ampliación futura?</option>
            <option value="no">No, instalación definitiva</option>
            <option value="posible">Posible en el futuro</option>
            <option value="si">Sí, se ampliará (dimensionar)</option>
          </select>
          <select
            value={formulario.incluir_baterias ? 'si' : 'no'}
            onChange={(e) => handleInputChange('incluir_baterias', e.target.value === 'si')}
            className="rounded-lg border border-border bg-card px-4 py-3 text-foreground text-sm"
          >
            <option value="no">¿Almacenamiento? No</option>
            <option value="si">¿Almacenamiento? Sí (con baterías)</option>
          </select>
          {formulario.incluir_baterias && (
            <input
              type="number"
              value={formulario.capacidad_baterias}
              onChange={(e) => handleInputChange('capacidad_baterias', e.target.value ? Number(e.target.value) : '')}
              placeholder="Capacidad (kWh)"
              className="rounded-lg border border-border bg-card px-4 py-3 text-foreground text-sm"
            />
          )}
        </div>
      </div>

      {/* Botones */}
      <div className="flex gap-3">
        <button
          onClick={calcular}
          className="flex-1 px-6 py-4 rounded-lg bg-gradient-to-r from-accent to-accent/80 text-white font-bold hover:shadow-glow transition"
        >
          📋 GENERAR ESPECIFICACIÓN TÉCNICA
        </button>
        <button
          onClick={limpiar}
          className="px-6 py-4 rounded-lg border border-border bg-card/50 text-foreground font-semibold hover:bg-card transition"
        >
          🗑️ Limpiar
        </button>
      </div>

      {/* RESULTADO - DOCUMENTO TÉCNICO */}
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

          {/* Especificación Técnica */}
          <div className="card rounded-2xl p-6 md:p-8 bg-secondary/10 border border-secondary/30">
            <h3 className="font-bold text-foreground text-lg mb-6">📋 ESPECIFICACIÓN TÉCNICA PARA INSTALADOR</h3>
            <div className="space-y-6">
              <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
                <div className="bg-card/80 rounded-lg p-4 border border-border/50">
                  <div className="text-xs font-bold text-muted">PANELES SOLARES (450W)</div>
                  <div className="text-3xl font-black text-secondary">{resultado.num_paneles}</div>
                </div>
                <div className="bg-card/80 rounded-lg p-4 border border-border/50">
                  <div className="text-xs font-bold text-muted">POTENCIA INSTALADA</div>
                  <div className="text-3xl font-black text-secondary">{resultado.potencia_real.toFixed(2)} kW</div>
                </div>
                <div className="bg-card/80 rounded-lg p-4 border border-border/50">
                  <div className="text-xs font-bold text-muted">ESPACIO REQUERIDO</div>
                  <div className="text-3xl font-black text-secondary">{resultado.espacio_requerido.toFixed(1)} m²</div>
                </div>
                <div className="bg-card/80 rounded-lg p-4 border border-border/50">
                  <div className="text-xs font-bold text-muted">PRODUCCIÓN ANUAL</div>
                  <div className="text-3xl font-black text-secondary">{resultado.produccion_anual.toLocaleString()} kWh</div>
                </div>
                <div className="bg-card/80 rounded-lg p-4 border border-border/50 md:col-span-2 lg:col-span-1">
                  <div className="text-xs font-bold text-muted">INVERSOR RECOMENDADO</div>
                  <div className="text-sm font-black text-secondary mt-2">
                    {resultado.inversor.marca} {resultado.inversor.modelo}
                  </div>
                  <div className="text-xs text-muted mt-1">{resultado.inversor.potencia} kW</div>
                </div>
              </div>

              <div className="border-t border-border pt-6">
                <h4 className="font-bold text-foreground mb-4">📝 Resumen Técnico</h4>
                <div className="space-y-3 text-sm">
                  <p><span className="font-semibold text-muted">Consumo anual solicitado:</span> <span className="text-foreground">{formulario.consumo_anual?.toLocaleString()} kWh/año</span></p>
                  <p><span className="font-semibold text-muted">Potencia solicitada:</span> <span className="text-foreground">{formulario.potencia_deseada} kW</span></p>
                  <p><span className="font-semibold text-muted">Sistema eléctrico:</span> <span className="text-foreground">{formulario.fase_sistema === 'mono' ? 'Monofásico (220V)' : 'Trifásico (400V)'}</span></p>
                  <p><span className="font-semibold text-muted">Tipo de tejado:</span> <span className="text-foreground">{formulario.tipo_tejado}</span></p>
                  <p><span className="font-semibold text-muted">Espacio disponible:</span> <span className="text-foreground">{formulario.espacio_disponible} m²</span></p>
                  {formulario.incluir_baterias && (
                    <p><span className="font-semibold text-muted">Almacenamiento:</span> <span className="text-foreground">{formulario.capacidad_baterias} kWh (LiFePO4)</span></p>
                  )}
                </div>
              </div>

              <div className="bg-accent/10 border border-accent/30 rounded-lg p-4">
                <p className="text-sm text-foreground">
                  <span className="font-bold text-accent">📌 Nota importante:</span> Esta es una especificación técnica proporcionada por GESMECO ENERGAI. El instalador deberá:
                </p>
                <ul className="text-sm text-foreground mt-3 space-y-1 ml-4">
                  <li>✓ Realizar visita técnica previa en sitio</li>
                  <li>✓ Validar todas las medidas y condiciones</li>
                  <li>✓ Presupuestar según sus costos y márgenes comerciales</li>
                  <li>✓ Considerar dificultades técnicas adicionales encontradas</li>
                  <li>✓ Incluir tramitología local y conexión con distribuidora</li>
                </ul>
              </div>

              <div className="grid gap-3 grid-cols-1 md:grid-cols-2">
                <button
                  onClick={() => generarPdfEspecificacion({ ...formulario, ...resultado })}
                  className="px-6 py-4 rounded-lg bg-gradient-to-r from-secondary to-secondary/80 text-white font-bold hover:shadow-glow transition flex items-center justify-center gap-2"
                >
                  📄 Descargar PDF
                </button>
                <button
                  onClick={() => generarExcelEspecificacion({ ...formulario, ...resultado })}
                  className="px-6 py-4 rounded-lg bg-gradient-to-r from-green-600 to-green-700 text-white font-bold hover:shadow-glow transition flex items-center justify-center gap-2"
                >
                  📊 Descargar Excel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
