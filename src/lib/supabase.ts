import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Supabase credentials are missing');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export interface Analisis {
  nombre: string;
  telefono?: string;
  tarifa: '2.0' | '3.0' | '6.1';
  costeActual: number;
  costePotencia: number;
  costeEnergia: number;
  ahorroTotal: number;
  reduccionPorcentaje: string;
  consumoAnual: number;
  datos: Record<string, any>;
}

export async function guardarAnalisis(data: Analisis) {
  const { error } = await supabase.from('analisis').insert([
    {
      nombre: data.nombre,
      telefono: data.telefono || null,
      tarifa: data.tarifa,
      coste_actual: data.costeActual,
      coste_potencia: data.costePotencia,
      coste_energia: data.costeEnergia,
      ahorro_total: data.ahorroTotal,
      reduccion_porcentaje: parseFloat(data.reduccionPorcentaje),
      consumo_anual: data.consumoAnual,
      datos_json: JSON.stringify(data.datos),
      fecha: new Date().toISOString(),
    },
  ]);

  if (error) {
    console.error('Error guardando análisis:', error);
    throw error;
  }

  return true;
}
