'use client';

import { SeccionMovimientos } from '../movimientos-seccion';

export default function AnulacionesPage() {
  return (
    <SeccionMovimientos
      titulo="Anulaciones"
      descripcion="Distingue bien: anulación real (cliente perdido), sustitución (misma cartera, otra póliza) y cambio de compañía (mismo cliente, otra aseguradora)."
      tipos={['anulacion', 'sustitucion', 'cambio_compania']}
      tipoPorDefecto="anulacion"
      conCompanias
    />
  );
}
