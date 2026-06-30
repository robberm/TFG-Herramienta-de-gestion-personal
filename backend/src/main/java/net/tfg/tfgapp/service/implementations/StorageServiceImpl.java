package net.tfg.tfgapp.service.implementations;

import com.fasterxml.jackson.databind.ObjectMapper;
import net.tfg.tfgapp.service.interfaces.IStorageService;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.File;
import java.io.IOException;
import java.nio.file.*;
import java.util.Collections;
import java.util.HashSet;
import java.util.Set;

@Service
public class StorageServiceImpl implements IStorageService {

    private static final ObjectMapper MAPPER = new ObjectMapper();

    private static final String STORAGE_FILE = "./productivity_config.json";
    private static final String UPLOADS_DIRECTORY = "./uploads";
    private static final String PROFILE_IMAGES_DIRECTORY = "profile-images";
    private static final long MAX_PROFILE_IMAGE_SIZE_BYTES = 5 * 1024 * 1024;

    @Override
    public Config loadConfig() {
        try {
            File file = new File(STORAGE_FILE);
            if (!file.exists()) {
                Config defaultConfig = new Config();
                defaultConfig.setBlockedApps(new HashSet<>(Set.of(
                        "valorant.exe",
                        "leagueoflegends.exe",
                        "riotclientservices.exe",
                        "steam.exe"
                )));
                defaultConfig.setGames(Set.of(
                        "valorant.exe",
                        "leagueoflegends.exe",
                        "riotclientservices.exe",
                        "steam.exe"
                ));
                return defaultConfig;
            }

            Config config = MAPPER.readValue(file, Config.class);

            if (config.getBlockedApps() == null) {
                config.setBlockedApps(Collections.emptySet());
            }

            if (config.getGames() == null) {
                config.setGames(Collections.emptySet());
            }

            if (config.getWorkDurationSeconds() <= 0) {
                config.setWorkDurationSeconds(20 * 60);
            }

            if (config.getBreakDurationSeconds() <= 0) {
                config.setBreakDurationSeconds(20);
            }

            if (config.getFocusAction() == null || config.getFocusAction().isBlank()) {
                config.setFocusAction("NOTIFICATION");
            }

            return config;

        } catch (IOException e) {
            throw new RuntimeException("Error loading config", e);
        }
    }

    @Override
    public void saveConfig(Config config) {
        try {
            MAPPER.writeValue(new File(STORAGE_FILE), config);
        } catch (IOException e) {
            throw new RuntimeException("Error saving config", e);
        }
    }

    @Override
    public void cleanAndResetConfig() {
        try {
            Config cleanConfig = new Config();
            cleanConfig.setBlockedApps(new HashSet<>());
            cleanConfig.setGames(Set.of(
                    "valorant.exe",
                    "leagueoflegends.exe",
                    "riotclientservices.exe",
                    "steam.exe"
            ));
            cleanConfig.setFocusModeEnabled(false);
            cleanConfig.setWorkDurationSeconds(20 * 60);
            cleanConfig.setBreakDurationSeconds(20);
            cleanConfig.setFocusAction("NOTIFICATION");
            MAPPER.writeValue(new File(STORAGE_FILE), cleanConfig);
        } catch (IOException e) {
            throw new RuntimeException("Error resetting config", e);
        }
    }

    /**
     * Guarda o reemplaza la imagen de perfil de un usuario dentro del sistema de archivos.
     * Si existe una imagen previa, se elimina antes de almacenar la nueva.
     *
     * @param file fichero recibido desde el frontend
     * @param userId identificador del usuario propietario de la imagen
     * @param previousImagePath ruta relativa previamente almacenada para el usuario
     * @return ruta relativa de la nueva imagen, lista para persistirse en base de datos
     */
    @Override
    public String saveProfileImage(MultipartFile file, Long userId, String previousImagePath) {
        validateProfileImage(file);

        try {
            Path profileImagesDirectory = ensureProfileImagesDirectoryExists();

            if (previousImagePath != null && !previousImagePath.isBlank()) {
                deleteProfileImage(previousImagePath);
            }

            String extension = extractAndValidateExtension(file.getOriginalFilename());
            String generatedFilename = buildProfileImageFilename(userId, extension);
            Path destinationPath = profileImagesDirectory.resolve(generatedFilename);

            Files.copy(file.getInputStream(), destinationPath, StandardCopyOption.REPLACE_EXISTING);

            return PROFILE_IMAGES_DIRECTORY + "/" + generatedFilename;

        } catch (IOException e) {
            throw new RuntimeException("Error al guardar la imagen de perfil.", e);
        }
    }

    /**
     * Elimina una imagen de perfil almacenada en disco a partir de su ruta relativa.
     * Si el fichero no existe, la operación termina sin error.
     *
     * @param profileImagePath ruta relativa persistida en base de datos
     */
    @Override
    public void deleteProfileImage(String profileImagePath) {
        if (profileImagePath == null || profileImagePath.isBlank()) {
            return;
        }

        try {
            Path imagePath = resolveProfileImagePath(profileImagePath);
            Files.deleteIfExists(imagePath);
        } catch (IOException e) {
            throw new RuntimeException("Error al eliminar la imagen de perfil.", e);
        }
    }

    /**
     * Resuelve la ruta física de una imagen de perfil a partir de la ruta relativa
     * almacenada en base de datos.
     *
     * @param profileImagePath ruta relativa persistida en el usuario
     * @return ruta física normalizada dentro del sistema de archivos de la aplicación
     */
    @Override
    public Path resolveProfileImagePath(String profileImagePath) {
        return Paths.get(UPLOADS_DIRECTORY, profileImagePath).normalize();
    }

    private Path ensureProfileImagesDirectoryExists() throws IOException {
        Path directory = Paths.get(UPLOADS_DIRECTORY, PROFILE_IMAGES_DIRECTORY);
        if (Files.notExists(directory)) {
            Files.createDirectories(directory);
        }
        return directory;
    }

    private void validateProfileImage(MultipartFile file) {
        if (file == null) {
            throw new IllegalArgumentException("No se ha recibido ningún fichero.");
        }

        if (file.isEmpty()) {
            throw new IllegalArgumentException("La imagen de perfil está vacía.");
        }

        if (file.getSize() > MAX_PROFILE_IMAGE_SIZE_BYTES) {
            throw new IllegalArgumentException("La imagen de perfil no puede superar los 5 MB.");
        }

        String contentType = file.getContentType();
        if (contentType == null || !contentType.startsWith("image/")) {
            throw new IllegalArgumentException("El fichero enviado no es una imagen válida.");
        }
    }

    private String extractAndValidateExtension(String originalFilename) {
        if (originalFilename == null || !originalFilename.contains(".")) {
            throw new IllegalArgumentException("La imagen no tiene una extensión válida.");
        }

        String extension = originalFilename.substring(originalFilename.lastIndexOf(".")).toLowerCase();

        if (!extension.equals(".png")
                && !extension.equals(".jpg")
                && !extension.equals(".jpeg")
                && !extension.equals(".webp")
                && !extension.equals(".gif")){
            throw new IllegalArgumentException("Formato de imagen no soportado. Usa png, jpg, jpeg o webp.");
        }

        return extension;
    }

    private String buildProfileImageFilename(Long userId, String extension) {
        return "user_" + userId + "_" + System.currentTimeMillis() + extension;
    }
}