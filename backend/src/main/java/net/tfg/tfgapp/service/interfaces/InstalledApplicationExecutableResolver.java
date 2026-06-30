package net.tfg.tfgapp.service.interfaces;



import net.tfg.tfgapp.DTOs.apprestrict.InstalledApplicationRegistryEntry;
import net.tfg.tfgapp.DTOs.apprestrict.ResolvedExecutableDTO;

public interface InstalledApplicationExecutableResolver {

    /**
     * Intenta deducir el ejecutable principal de una aplicación instalada.
     * La resolución se hace a partir de metadatos del registro y heurísticas sobre la carpeta de instalación.
     *
     * @param application entrada del registro de una aplicación instalada.
     * @return resultado con nombre, ruta y bandera de resolución.
     */
    ResolvedExecutableDTO resolveExecutable(InstalledApplicationRegistryEntry application);
}