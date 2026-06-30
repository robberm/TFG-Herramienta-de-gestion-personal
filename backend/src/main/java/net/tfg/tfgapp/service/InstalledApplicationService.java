package net.tfg.tfgapp.service;




import net.tfg.tfgapp.DTOs.apprestrict.*;

import net.tfg.tfgapp.service.interfaces.InstalledApplicationExecutableResolver;
import net.tfg.tfgapp.service.interfaces.InstalledApplicationProvider;
import org.springframework.stereotype.Service;

import javax.imageio.ImageIO;
import javax.swing.Icon;
import javax.swing.ImageIcon;
import javax.swing.filechooser.FileSystemView;
import java.awt.Graphics;
import java.awt.Image;
import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;
import java.io.File;
import java.util.ArrayList;
import java.util.Base64;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Service
public class InstalledApplicationService {

    private final InstalledApplicationProvider installedApplicationProvider;
    private final InstalledApplicationExecutableResolver executableResolver;

    public InstalledApplicationService(InstalledApplicationProvider installedApplicationProvider,
                                       InstalledApplicationExecutableResolver executableResolver) {
        this.installedApplicationProvider = installedApplicationProvider;
        this.executableResolver = executableResolver;
    }

    /**
     * Construye el catálogo final de aplicaciones instaladas que consumirá el frontend.
     * Cada elemento incluye nombre visible y, cuando se puede deducir, su ejecutable principal.
     *
     * @return lista ordenada y sin duplicados de aplicaciones instaladas.
     */
    public List<InstalledApplicationDTO> getInstalledApplicationsDetailed() {
        List<InstalledApplicationRegistryEntry> rawApplications = installedApplicationProvider.getInstalledApplications();
        Map<String, InstalledApplicationDTO> deduplicated = new LinkedHashMap<>();

        for (InstalledApplicationRegistryEntry rawApplication : rawApplications) {
            InstalledApplicationDTO dto = mapToDto(rawApplication);

            String deduplicationKey = buildDeduplicationKey(dto);
            if (!deduplicated.containsKey(deduplicationKey)) {
                deduplicated.put(deduplicationKey, dto);
            }
        }

        List<InstalledApplicationDTO> applications = new ArrayList<>(deduplicated.values());
        applications.sort(Comparator.comparing(InstalledApplicationDTO::getDisplayName, String.CASE_INSENSITIVE_ORDER));

        return applications;
    }

    /**
     * Convierte una entrada del registro en el DTO final que utilizará el frontend.
     *
     * @param registryEntry entrada cruda del registro.
     * @return dto ya enriquecido con datos resolubles.
     */
    private InstalledApplicationDTO mapToDto(InstalledApplicationRegistryEntry registryEntry) {
        ResolvedExecutableDTO resolvedExecutable = executableResolver.resolveExecutable(registryEntry);

        String iconBase64 = null;
        if (resolvedExecutable.isResolved()) {
            iconBase64 = extractIconBase64(resolvedExecutable.getExecutablePath());
        }

        return new InstalledApplicationDTO(
                registryEntry.getDisplayName(),
                resolvedExecutable.getExecutableName(),
                resolvedExecutable.getExecutablePath(),
                registryEntry.getInstallLocation(),
                iconBase64,
                resolvedExecutable.isResolved()
        );
    }

    /**
     * Construye una clave para eliminar duplicados.
     * Si el ejecutable está resuelto, es la mejor referencia. Si no, se usa el nombre visible.
     *
     * @param dto aplicación final.
     * @return clave estable para deduplicar resultados.
     */
    private String buildDeduplicationKey(InstalledApplicationDTO dto) {
        if (dto.getExecutablePath() != null && !dto.getExecutablePath().isBlank()) {
            return dto.getExecutablePath().toLowerCase();
        }

        return dto.getDisplayName().trim().toLowerCase();
    }

    /**
     * Extrae el icono del ejecutable y lo transforma a Base64 para que el frontend
     * pueda pintarlo directamente sin una segunda llamada.
     *
     * @param executablePath ruta al ejecutable principal.
     * @return data URL en Base64 o null si no se puede generar.
     */
    private String extractIconBase64(String executablePath) {
        if (executablePath == null || executablePath.isBlank()) {
            return null;
        }

        try {
            File file = new File(executablePath);
            if (!file.exists()) {
                return null;
            }

            Icon icon = FileSystemView.getFileSystemView().getSystemIcon(file);
            if (icon == null) {
                return null;
            }

            BufferedImage image = iconToBufferedImage(icon);
            ByteArrayOutputStream baos = new ByteArrayOutputStream();
            ImageIO.write(image, "png", baos);

            return "data:image/png;base64," + Base64.getEncoder().encodeToString(baos.toByteArray());
        } catch (Exception e) {
            return null;
        }
    }

    /**
     * Convierte un icono Swing en BufferedImage para poder serializarlo.
     *
     * @param icon icono origen.
     * @return imagen rasterizada del icono.
     */
    private BufferedImage iconToBufferedImage(Icon icon) {
        BufferedImage bufferedImage = new BufferedImage(
                icon.getIconWidth(),
                icon.getIconHeight(),
                BufferedImage.TYPE_INT_ARGB
        );

        Graphics graphics = bufferedImage.createGraphics();

        if (icon instanceof ImageIcon imageIcon) {
            Image image = imageIcon.getImage();
            graphics.drawImage(image, 0, 0, null);
        } else {
            icon.paintIcon(null, graphics, 0, 0);
        }

        graphics.dispose();
        return bufferedImage;
    }
}
