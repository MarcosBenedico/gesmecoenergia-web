#!/usr/bin/env node

/**
 * Genera iconos PNG desde SVG
 * Uso: node generate-icons.mjs
 */

import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

const iconSizes = [
  { size: 180, name: 'icon-180.png' },
  { size: 192, name: 'icon-192.png' },
  { size: 512, name: 'icon-512.png' },
];

const svgPath = './public/icon.svg';
const publicDir = './public';

async function generateIcons() {
  try {
    if (!fs.existsSync(svgPath)) {
      console.error('❌ No encontrado: public/icon.svg');
      process.exit(1);
    }

    for (const { size, name } of iconSizes) {
      const outputPath = path.join(publicDir, name);

      await sharp(svgPath)
        .resize(size, size, { fit: 'contain', background: { r: 99, g: 102, b: 241, alpha: 1 } })
        .png()
        .toFile(outputPath);

      console.log(`✅ Generado: ${name} (${size}x${size})`);
    }

    console.log('\n✨ Todos los iconos generados exitosamente');
  } catch (error) {
    console.error('❌ Error generando iconos:', error.message);
    process.exit(1);
  }
}

generateIcons();
