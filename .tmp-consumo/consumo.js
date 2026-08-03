export function leerConsumo(bruto) {
    if (typeof bruto === 'number')
        return revisarConsumo(bruto, null);
    const s = String(bruto ?? '').trim().replace(/\s|kwh|kw\/h|kw·h/gi, '');
    if (!s)
        return { kwh: 0, sospechoso: false, motivo: null };
    const negativo = s.startsWith('-');
    const cuerpo = s.replace(/^[+-]/, '').replace(/[^\d.,]/g, '');
    if (!cuerpo)
        return { kwh: 0, sospechoso: false, motivo: null };
    let texto = cuerpo;
    let motivo = null;
    if (cuerpo.includes(',')) {
        // Con coma no hay duda: la coma decide los decimales y el punto es de miles.
        texto = cuerpo.replace(/\./g, '').replace(',', '.');
    }
    else if (cuerpo.includes('.')) {
        const grupos = cuerpo.split('.');
        const detras = grupos.slice(1);
        if (detras.every((g) => g.length === 3)) {
            // 53.558 y 1.234.567: separador de miles, se recupera sin riesgo.
            texto = grupos.join('');
        }
        else if (detras.length === 1 && detras[0].length <= 2) {
            // 3.42 puede ser 3,42 o 3.420. No se puede saber: se deja y se avisa.
            motivo = `No se sabe si «${cuerpo}» son ${cuerpo.replace('.', ',')} o ${grupos.join('')}0. Míralo en la factura.`;
        }
        else {
            motivo = `«${cuerpo}» no es un número reconocible. Compruébalo en la factura.`;
        }
    }
    const n = Number(texto);
    if (!Number.isFinite(n))
        return { kwh: 0, sospechoso: true, motivo: motivo ?? 'No es un número.' };
    return revisarConsumo(negativo ? -n : n, motivo);
}
// Un suministro real no baja de aquí ni siendo un garaje o un pozo de riego.
export const CONSUMO_MINIMO_CREIBLE = 500;
function revisarConsumo(kwh, motivo) {
    const redondeado = Math.round(kwh);
    if (motivo)
        return { kwh: redondeado, sospechoso: true, motivo };
    if (redondeado < 0)
        return { kwh: 0, sospechoso: true, motivo: 'El consumo no puede ser negativo.' };
    if (redondeado > 0 && redondeado < CONSUMO_MINIMO_CREIBLE) {
        return {
            kwh: redondeado,
            sospechoso: true,
            motivo: `${redondeado} kWh al año es demasiado poco para un suministro. Si lo has escrito con punto de miles, quítalo.`,
        };
    }
    return { kwh: redondeado, sospechoso: false, motivo: null };
}
