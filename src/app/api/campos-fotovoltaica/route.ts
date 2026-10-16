import { supabaseAnon } from '@/lib/supabase-servidor';
import { NextResponse } from 'next/server';


export async function GET() {
  const { data, error } = await supabaseAnon()
    .from('campos_fotovoltaica')
    .select('*')
    .eq('activo', true)
    .order('seccion')
    .order('orden', { ascending: true });

  if (error) {
    return NextResponse.json([], { status: 200 }); // silently return empty if table doesn't exist yet
  }

  return NextResponse.json(data ?? []);
}
