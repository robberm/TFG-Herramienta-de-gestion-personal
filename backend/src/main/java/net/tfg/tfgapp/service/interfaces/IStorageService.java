package net.tfg.tfgapp.service.interfaces;


import org.springframework.web.multipart.MultipartFile;

import java.nio.file.Path;
import java.util.Set;

public interface IStorageService {

    Config loadConfig();

    void saveConfig(Config config);

    void cleanAndResetConfig();

    /**
     * Guarda o reemplaza la imagen de perfil de un usuario en disco.
     *
     * @param file fichero recibido desde frontend
     * @param userId identificador del usuario propietario
     * @param previousImagePath ruta relativa previa de la imagen, si existía
     * @return ruta relativa de la nueva imagen, lista para persistirse en base de datos
     */
    String saveProfileImage(MultipartFile file, Long userId, String previousImagePath);

    /**
     * Elimina la imagen de perfil asociada a la ruta relativa recibida.
     *
     * @param profileImagePath ruta relativa persistida en base de datos
     */
    void deleteProfileImage(String profileImagePath);

    /**
     * Resuelve una ruta relativa almacenada en base de datos a su ruta física.
     *
     * @param profileImagePath ruta relativa de la imagen
     * @return ruta física normalizada
     */
    Path resolveProfileImagePath(String profileImagePath);

    class Config {
        private Set<String> blockedApps;
        private Set<String> games;
        private boolean focusModeEnabled = false;
        private int workDurationSeconds = 20 * 60;
        private int breakDurationSeconds = 20;
        private String focusAction = "NOTIFICATION";

        public Set<String> getBlockedApps() {
            return blockedApps;
        }

        public void setBlockedApps(Set<String> blockedApps) {
            this.blockedApps = blockedApps;
        }

        public Set<String> getGames() {
            return games;
        }

        public void setGames(Set<String> games) {
            this.games = games;
        }

        public boolean isFocusModeEnabled() {
            return focusModeEnabled;
        }

        public void setFocusModeEnabled(boolean focusModeEnabled) {
            this.focusModeEnabled = focusModeEnabled;
        }

        public int getWorkDurationSeconds() {
            return workDurationSeconds;
        }

        public void setWorkDurationSeconds(int workDurationSeconds) {
            this.workDurationSeconds = workDurationSeconds;
        }

        public int getBreakDurationSeconds() {
            return breakDurationSeconds;
        }

        public void setBreakDurationSeconds(int breakDurationSeconds) {
            this.breakDurationSeconds = breakDurationSeconds;
        }

        public String getFocusAction() {
            return focusAction;
        }

        public void setFocusAction(String focusAction) {
            this.focusAction = focusAction;
        }
    }
}