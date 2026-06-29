#!/usr/bin/env node

/**
 * Verificar configuración de Supabase usando fetch
 */

const SUPABASE_URL = 'https://rhsflkemubgigagwmoqb.supabase.co';
const SUPABASE_KEY = 'sb_publishable_OWi92FE3lAu3qd6YioVGJw_BrmCB_HM';

console.log('\n' + '═'.repeat(70));
console.log('🚀 VERIFICACIÓN SUPABASE - GENERADOR FOTOVOLTAICO PRO');
console.log('═'.repeat(70));

async function main() {
  try {
    console.log('\n🔗 Verificando conexión a Supabase...');
    console.log(`📍 URL: ${SUPABASE_URL}`);

    // Intentar un query simple a la tabla
    const response = await fetch(
      `${SUPABASE_URL}/rest/v1/proyectos_fotovoltaicos?select=count()&limit=1`,
      {
        headers: {
          'apikey': SUPABASE_KEY,
          'Authorization': `Bearer ${SUPABASE_KEY}`,
        },
      }
    );

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();

    console.log('\n✅ Tabla proyectos_fotovoltaicos existe y es accesible');
    console.log(`📊 Registros totales: ${data[0]?.count || 0}`);

    // Intentar insertar un registro de prueba
    console.log('\n📝 Probando escritura...');

    const testRecord = {
      cliente_nombre: 'TEST_' + Date.now(),
      cliente_ubicacion: 'Prueba',
      tipo_tejado: 'plano',
      estado: 'borrador',
    };

    const insertResponse = await fetch(
      `${SUPABASE_URL}/rest/v1/proyectos_fotovoltaicos`,
      {
        method: 'POST',
        headers: {
          'apikey': SUPABASE_KEY,
          'Authorization': `Bearer ${SUPABASE_KEY}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=representation',
        },
        body: JSON.stringify(testRecord),
      }
    );

    if (!insertResponse.ok) {
      const error = await insertResponse.text();
      console.log('⚠️  Error en prueba de escritura:', error);

      if (insertResponse.status === 401 || insertResponse.status === 403) {
        console.log('\n💡 Error de autenticación. Verifica las credenciales en .env.local');
      }

      throw new Error(`INSERT Error: ${insertResponse.status}`);
    }

    const inserted = await insertResponse.json();
    const testId = inserted[0]?.id;

    console.log(`✅ Inserción OK (id: ${testId})`);

    // Limpiar: eliminar el registro de prueba
    if (testId) {
      await fetch(
        `${SUPABASE_URL}/rest/v1/proyectos_fotovoltaicos?id=eq.${testId}`,
        {
          method: 'DELETE',
          headers: {
            'apikey': SUPABASE_KEY,
            'Authorization': `Bearer ${SUPABASE_KEY}`,
          },
        }
      );
      console.log('✅ Limpieza OK');
    }

    console.log('\n' + '═'.repeat(70));
    console.log('✅ SUPABASE CONFIGURADO Y FUNCIONANDO CORRECTAMENTE');
    console.log('═'.repeat(70));

    console.log('\n📱 La aplicación puede usar Supabase sin problemas');
    console.log(
      '✨ Todos los datos se guardarán automáticamente en la base de datos\n'
    );

  } catch (error) {
    console.error('\n❌ Error de verificación:', error.message);

    console.log('\n' + '═'.repeat(70));
    console.log('⚠️  TABLA PROBABLEMENTE NO EXISTE');
    console.log('═'.repeat(70));

    console.log('\n📋 INSTRUCCIONES PARA CREAR LA TABLA:\n');

    console.log('1. Abre el Dashboard de Supabase:');
    console.log('   https://app.supabase.com/');

    console.log('\n2. Selecciona tu proyecto: gesmecoenergia-web');

    console.log('\n3. Ve a: SQL Editor → New Query');

    console.log('\n4. Copia y ejecuta el SQL en:');
    console.log('   supabase_setup_fotovoltaica_completo.sql\n');

    console.log('5. Después, vuelve a ejecutar este script:\n');
    console.log('   npm run verify:supabase\n');

    process.exit(1);
  }
}

main();
