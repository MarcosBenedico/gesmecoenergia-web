'use client';

import { SeccionMovimientos } from '../movimientos-seccion';

export default function ProduccionPage() {
  return (
    <SeccionMovimientos
      titulo="Producción nueva"
      descripcion="Altas de negocio nuevo: cada póliza que entra, con su prima y su responsable."
      tipos={['produccion']}
      tipoPorDefecto="produccion"
    />
  );
}
