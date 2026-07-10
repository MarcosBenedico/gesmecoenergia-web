#!/usr/bin/env node

/**
 * Test directo de Supabase - Verificar inserción
 */

const SUPABASE_URL = "https://rhsflkemubgigagwmoqb.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_OWi92FE3lAu3qd6YioVGJw_BrmCB_HM";

async function testSupabase() {
  console.log("\n╔════════════════════════════════════════════════════════════╗");
  console.log("║  🧪 TEST DIRECTO DE SUPABASE                            ║");
  console.log("╚════════════════════════════════════════════════════════════╝\n");

  try {
    // 1. Verificar que la tabla existe
    console.log("1️⃣  Verificando tabla...");
    const tableCheckResponse = await fetch(
      `${SUPABASE_URL}/rest/v1/proyectos_fotovoltaicos?limit=1`,
      {
        method: "GET",
        headers: {
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
          "Content-Type": "application/json",
        },
      }
    );

    if (tableCheckResponse.ok) {
      console.log("✅ Tabla EXISTE y es accesible\n");
    } else {
      console.log(
        `❌ Error: ${tableCheckResponse.status} - ${tableCheckResponse.statusText}\n`
      );
      return;
    }

    // 2. Insertar registro de prueba
    console.log("2️⃣  Insertando registro de prueba...");
    const testData = {
      cliente_nombre: "TEST - " + new Date().toISOString(),
      cliente_email: "test@example.com",
      cliente_ubicacion: "Prueba",
      consumo_anual: 5000,
      potencia_deseada: 5,
      fase_sistema: "mono",
      tipo_tejado: "teja",
      espacio_disponible: 30,
    };

    const insertResponse = await fetch(
      `${SUPABASE_URL}/rest/v1/proyectos_fotovoltaicos`,
      {
        method: "POST",
        headers: {
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
          "Content-Type": "application/json",
          Prefer: "return=representation",
        },
        body: JSON.stringify(testData),
      }
    );

    const insertResult = await insertResponse.json();

    if (insertResponse.ok && insertResult.length > 0) {
      console.log(`✅ Registro insertado con ID: ${insertResult[0].id}\n`);
      const id = insertResult[0].id;

      // 3. Verificar que se guardó
      console.log("3️⃣  Verificando que se guardó...");
      const verifyResponse = await fetch(
        `${SUPABASE_URL}/rest/v1/proyectos_fotovoltaicos?id=eq.${id}`,
        {
          method: "GET",
          headers: {
            apikey: SUPABASE_ANON_KEY,
            Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
          },
        }
      );

      const verifyResult = await verifyResponse.json();

      if (verifyResult.length > 0) {
        console.log("✅ Registro verificado en base de datos\n");
        console.log(JSON.stringify(verifyResult[0], null, 2));

        // 4. Limpiar: Eliminar registro de prueba
        console.log("\n4️⃣  Limpiando registro de prueba...");
        const deleteResponse = await fetch(
          `${SUPABASE_URL}/rest/v1/proyectos_fotovoltaicos?id=eq.${id}`,
          {
            method: "DELETE",
            headers: {
              apikey: SUPABASE_ANON_KEY,
              Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
            },
          }
        );

        if (deleteResponse.ok) {
          console.log("✅ Registro de prueba eliminado\n");
        }
      } else {
        console.log("❌ No se pudo verificar el registro\n");
      }
    } else {
      console.log(`❌ Error insertando: ${insertResponse.status}\n`);
      console.log("Respuesta:", JSON.stringify(insertResult, null, 2));
      console.log("\n🔍 Detalles del error:");
      console.log(
        "- ¿La tabla existe?",
        insertResult[0]?.message || "Check logs"
      );
      console.log("- ¿RLS está habilitado?", "Posible causa");
      console.log(
        "- ¿Los campos coinciden?",
        "Revisar nombres de columnas"
      );
    }

    console.log("╔════════════════════════════════════════════════════════════╗");
    console.log("║  ✅ TEST COMPLETADO                                       ║");
    console.log("╚════════════════════════════════════════════════════════════╝\n");
  } catch (error) {
    console.error("❌ Error en test:", error.message);
  }
}

testSupabase();
