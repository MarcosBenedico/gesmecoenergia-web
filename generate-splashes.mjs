#!/usr/bin/env node

import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

// Tamaños de splash screens para diferentes dispositivos iOS
const splashSizes = [
  { width: 1170, height: 2532, name: 'splash-1170x2532.png' }, // iPhone 14 Pro
  { width: 1284, height: 2778, name: 'splash-1284x2778.png' }, // iPhone 15 Pro Max
  { width: 1125, height: 2436, name: 'splash-1125x2436.png' }, // iPhone X
  { width: 828, height: 1792, name: 'splash-828x1792.png' },   // iPhone 11
];

const svgPath = './public/splash.svg';
const publicDir = './public';

async function generateSplashes() {
  try {
    if (!fs.existsSync(svgPath)) {
      console.error('❌ No encontrado: public/splash.svg');
      process.exit(1);
    }

    for (const { width, height, name } of splashSizes) {
      const outputPath = path.join(publicDir, name);

      await sharp(svgPath)
        .resize(width, height, { fit: 'fill' })
        .png()
        .toFile(outputPath);

      console.log(`✅ Generado: ${name} (${width}x${height})`);
    }

    console.log('\n✨ Todos los splash screens generados exitosamente');
  } catch (error) {
    console.error('❌ Error generando splashes:', error.message);
    process.exit(1);
  }
}

generateSplashes();
