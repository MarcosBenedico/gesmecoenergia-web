import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function GET() {
  const { data, error } = await supabase
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
