package net.tfg.tfgapp.service.interfaces;





import net.tfg.tfgapp.DTOs.apprestrict.InstalledApplicationRegistryEntry;

import java.util.List;

public interface InstalledApplicationProvider {

    /**
     * Obtiene la lista de aplicaciones instaladas desde la fuente configurada.
     * En Windows, la implementación principal leerá el registro del sistema.
     *
     * @return lista de entradas de aplicaciones instaladas sin procesar.
     */
    List<InstalledApplicationRegistryEntry> getInstalledApplications();
}