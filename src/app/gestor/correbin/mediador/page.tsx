'use client';

import { SeccionMovimientos } from '../movimientos-seccion';

export default function CambiosMediadorPage() {
  return (
    <SeccionMovimientos
      titulo="Cambios de mediador"
      descripcion="Control de pólizas que entran o salen de la cartera por cambio de mediador (a Correbin o desde Correbin)."
      tipos={['cambio_mediador']}
      tipoPorDefecto="cambio_mediador"
      conMediadores
    />
  );
}
