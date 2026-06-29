/**
 * Script para crear y verificar la tabla de Supabase
 * Uso: node scripts/setup-supabase.js
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Cargar variables de entorno
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('❌ Error: Variables de entorno SUPABASE no configuradas');
  console.error('Verifica que .env.local contiene:');
  console.error('  - NEXT_PUBLIC_SUPABASE_URL');
  console.error('  - NEXT_PUBLIC_SUPABASE_ANON_KEY');
  process.exit(1);
}

console.log('🔗 Conectando a Supabase...');
console.log(`📍 URL: ${SUPABASE_URL}`);

// Crear cliente de Supabase
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function setupDatabase() {
  try {
    // ============================================
    // 1. VERIFICAR CONEXIÓN
    // ============================================
    console.log('\n✅ Verificando conexión a Supabase...');

    const { data: testData, error: testError } = await supabase
      .from('proyectos_fotovoltaicos')
      .select('count(*)', { count: 'exact', head: true });

    if (testError) {
      console.log('⚠️  Tabla no existe aún, será creada en el siguiente paso');
    } else {
      console.log('✅ Tabla existe y es accesible');
      return;
    }

    // ============================================
    // 2. CREAR TABLA VÍA API (usando RPC si es necesario)
    // ============================================
    console.log('\n🔧 Creando tabla proyectos_fotovoltaicos...');

    // Para crear tablas, necesitamos usar el cliente con la clave de servicio
    // O crear un endpoint RPC en Supabase
    // Como no tenemos la clave de servicio aquí, crearemos la tabla manualmente

    console.log('\n📋 SQL a ejecutar en Supabase:');
    console.log('═'.repeat(60));

    const sqlPath = path.join(__dirname, '..', 'supabase_setup_fotovoltaica_completo.sql');
    const sqlContent = fs.readFileSync(sqlPath, 'utf-8');

    console.log(sqlContent);
    console.log('═'.repeat(60));

    console.log('\n⚠️  Para ejecutar el SQL:');
    console.log('1. Abre Supabase Dashboard: https://app.supabase.com/');
    console.log('2. Selecciona tu proyecto');
    console.log('3. Ve a SQL Editor → New Query');
    console.log('4. Copia y pega el SQL anterior');
    console.log('5. Haz click en "Run"');

    // ============================================
    // 3. VERIFICAR DESPUÉS DE CREAR LA TABLA
    // ============================================
    console.log('\n📝 Después de crear la tabla, ejecuta este script nuevamente');
    console.log('   para verificar que todo está correcto.\n');

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    process.exit(1);
  }
}

async function verifySetup() {
  try {
    console.log('\n✅ Verificando configuración de Supabase...\n');

    // 1. Verificar tabla
    const { data: tableData, error: tableError } = await supabase
      .from('proyectos_fotovoltaicos')
      .select('*')
      .limit(1);

    if (tableError) {
      console.log('❌ Tabla proyectos_fotovoltaicos no existe');
      console.log('   Error:', tableError.message);
      return false;
    }

    console.log('✅ Tabla proyectos_fotovoltaicos existe');

    // 2. Verificar inserción
    console.log('\n📝 Probando inserción de datos...');

    const { data, error } = await supabase
      .from('proyectos_fotovoltaicos')
      .insert([
        {
          cliente_nombre: 'TEST_' + Date.now(),
          cliente_ubicacion: 'Prueba',
          tipo_tejado: 'plano',
          estado: 'borrador',
        },
      ])
      .select();

    if (error) {
      console.log('❌ Error al insertar:', error.message);
      return false;
    }

    console.log('✅ Inserción correcta');
    const insertedId = data[0].id;

    // 3. Verificar lectura
    console.log('\n📖 Probando lectura de datos...');

    const { data: readData, error: readError } = await supabase
      .from('proyectos_fotovoltaicos')
      .select('*')
      .eq('id', insertedId);

    if (readError) {
      console.log('❌ Error al leer:', readError.message);
      return false;
    }

    console.log('✅ Lectura correcta');

    // 4. Verificar actualización
    console.log('\n✏️  Probando actualización de datos...');

    const { data: updateData, error: updateError } = await supabase
      .from('proyectos_fotovoltaicos')
      .update({ cliente_descripcion: 'Actualizado por script' })
      .eq('id', insertedId)
      .select();

    if (updateError) {
      console.log('❌ Error al actualizar:', updateError.message);
      return false;
    }

    console.log('✅ Actualización correcta');

    // 5. Verificar eliminación
    console.log('\n🗑️  Probando eliminación de datos...');

    const { error: deleteError } = await supabase
      .from('proyectos_fotovoltaicos')
      .delete()
      .eq('id', insertedId);

    if (deleteError) {
      console.log('❌ Error al eliminar:', deleteError.message);
      return false;
    }

    console.log('✅ Eliminación correcta');

    // 6. Verificar índices
    console.log('\n📊 Estado de la tabla:');
    const { data: countData } = await supabase
      .from('proyectos_fotovoltaicos')
      .select('*', { count: 'exact', head: true });

    console.log(`   Total registros: ${countData?.length || 0}`);

    return true;

  } catch (error) {
    console.error('\n❌ Error en verificación:', error.message);
    return false;
  }
}

async function main() {
  console.log('\n' + '═'.repeat(60));
  console.log('🚀 SETUP SUPABASE - GENERADOR FOTOVOLTAICO PRO');
  console.log('═'.repeat(60));

  // Primero intentar verificar si la tabla existe
  const verified = await verifySetup();

  if (!verified) {
    console.log('\n' + '═'.repeat(60));
    console.log('📋 TABLA NO ENCONTRADA');
    console.log('═'.repeat(60));
    await setupDatabase();
  } else {
    console.log('\n' + '═'.repeat(60));
    console.log('✅ SUPABASE CONFIGURADO CORRECTAMENTE');
    console.log('═'.repeat(60));
    console.log('\n¡Listo! La base de datos está operativa y verificada.');
    console.log('Puedes iniciar el servidor con: npm run dev\n');
  }
}

main().catch(console.error);
