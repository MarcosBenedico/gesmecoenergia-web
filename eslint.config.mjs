import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Motor de ffmpeg (WebAssembly). Es código generado de terceros que copia
    // scripts/copiar-ffmpeg.mjs en cada build: analizarlo añadía más de cien
    // avisos que nadie puede arreglar y que tapaban los nuestros.
    "public/ffmpeg/**",
  ]),
]);

export default eslintConfig;
