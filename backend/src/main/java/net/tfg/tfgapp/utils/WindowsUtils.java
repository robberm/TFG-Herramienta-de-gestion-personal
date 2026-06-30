package net.tfg.tfgapp.utils;

import com.sun.jna.Pointer;
import com.sun.jna.platform.win32.Kernel32;
import com.sun.jna.platform.win32.User32;
import com.sun.jna.platform.win32.Version;
import com.sun.jna.platform.win32.WinDef;
import com.sun.jna.ptr.IntByReference;
import com.sun.jna.ptr.PointerByReference;
import org.springframework.stereotype.Component;

import javax.imageio.ImageIO;
import javax.swing.Icon;
import javax.swing.ImageIcon;
import javax.swing.filechooser.FileSystemView;
import java.awt.Dimension;
import java.awt.Graphics;
import java.awt.Image;
import java.awt.Toolkit;
import java.awt.image.BufferedImage;
import java.io.BufferedReader;
import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.IOException;
import java.io.InputStreamReader;
import java.util.ArrayList;
import java.util.Base64;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.TimeUnit;

/**
 * Utilidades para interactuar con el sistema Windows.
 * Obtiene información de procesos de forma dinámica (nombre, icono, ruta).
 */
@Component
public class WindowsUtils {

    // Cache para evitar consultas repetidas (ruta -> ProcessInfo)
    private static final Map<String, ProcessInfo> processCache = new ConcurrentHashMap<>();
    private static final long CACHE_EXPIRY_MS = 60000; // 1 minuto
    private static long lastCacheClean = System.currentTimeMillis();

    /**
     * Clase que representa la información de un proceso.
     */
    public static class ProcessInfo {
        private final String executableName;
        private final String executablePath;
        private final String displayName;
        private final String icon;
        private final long timestamp;

        public ProcessInfo(String executableName, String executablePath, String displayName, String iconBase64) {
            this.executableName = executableName;
            this.executablePath = executablePath;
            this.displayName = displayName;
            this.icon = iconBase64;
            this.timestamp = System.currentTimeMillis();
        }

        public String getExecutableName() { return executableName; }
        public String getExecutablePath() { return executablePath; }
        public String getDisplayName() { return displayName; }
        public String getIcon() { return icon; }
        public long getTimestamp() { return timestamp; }

        public Map<String, String> toMap() {
            Map<String, String> map = new HashMap<>();
            map.put("executableName", executableName);
            map.put("executablePath", executablePath);
            map.put("displayName", displayName);
            map.put("iconBase64", icon);
            return map;
        }
    }

    /**
     * Obtiene la lista de procesos en ejecución (solo nombres, método original).
     */
    public static List<String> getRunningProcesses() {
        List<String> processes = new ArrayList<>();
        try {
            Process process = Runtime.getRuntime().exec("tasklist.exe /fo csv /nh");
            try (BufferedReader reader = new BufferedReader(
                    new InputStreamReader(process.getInputStream()))) {
                String line;
                while ((line = reader.readLine()) != null) {
                    if (!line.trim().isEmpty()) {
                        String processName = line.split("\"")[1];
                        processes.add(processName.toLowerCase());
                    }
                }
            }
        } catch (IOException e) {
            e.printStackTrace();
        }
        return processes;
    }

    /**
     * Obtiene la lista de procesos con información completa (nombre, icono, ruta).
     * Filtra procesos del sistema y elimina duplicados.
     */
    public static List<Map<String, String>> getRunningProcessesDetailed() {
        cleanCacheIfNeeded();

        List<Map<String, String>> result = new ArrayList<>();
        Set<String> seenProcesses = new HashSet<>();

        // Obtener procesos con sus rutas usando WMIC
        Map<String, String> processPathMap = getProcessPaths();

        for (Map.Entry<String, String> entry : processPathMap.entrySet()) {
            String processName = entry.getKey().toLowerCase();
            String processPath = entry.getValue();

            // Evitar duplicados
            if (seenProcesses.contains(processName)) {
                continue;
            }
            seenProcesses.add(processName);

            // Filtrar procesos del sistema
            if (isSystemProcess(processName)) {
                continue;
            }

            // Obtener información del proceso (con cache)
            ProcessInfo info = getProcessInfo(processName, processPath);
            if (info != null) {
                result.add(info.toMap());
            }
        }

        // Ordenar por nombre
        result.sort((a, b) -> {
            String nameA = a.get("displayName") != null ? a.get("displayName") : "";
            String nameB = b.get("displayName") != null ? b.get("displayName") : "";
            return nameA.compareToIgnoreCase(nameB);
        });

        return result;
    }

    /**
     * Obtiene las rutas de todos los procesos en ejecución usando WMIC.
     */
    private static Map<String, String> getProcessPaths() {
        Map<String, String> paths = new HashMap<>();

        try {
            // WMIC obtiene nombre del proceso y ruta del ejecutable
            Process process = Runtime.getRuntime().exec(
                    "wmic process get name,executablepath /format:csv"
            );

            try (BufferedReader reader = new BufferedReader(
                    new InputStreamReader(process.getInputStream()))) {
                String line;
                boolean headerSkipped = false;

                while ((line = reader.readLine()) != null) {
                    line = line.trim();
                    if (line.isEmpty()) continue;

                    // Saltar header
                    if (!headerSkipped) {
                        if (line.contains("ExecutablePath") || line.contains("Name")) {
                            headerSkipped = true;
                        }
                        continue;
                    }

                    // Formato CSV: Node,ExecutablePath,Name
                    String[] parts = line.split(",");
                    if (parts.length >= 3) {
                        String execPath = parts[1].trim();
                        String name = parts[2].trim();

                        if (!name.isEmpty() && !execPath.isEmpty()) {
                            paths.put(name.toLowerCase(), execPath);
                        } else if (!name.isEmpty()) {
                            // Si no tiene ruta, guardar solo el nombre
                            paths.put(name.toLowerCase(), "");
                        }
                    }
                }
            }
            process.waitFor(5, TimeUnit.SECONDS);
        } catch (IOException | InterruptedException e) {
            e.printStackTrace();
        }

        return paths;
    }

    /**
     * Obtiene información completa de un proceso (usa cache).
     */
    private static ProcessInfo getProcessInfo(String processName, String processPath) {
        // Verificar cache
        String cacheKey = processPath.isEmpty() ? processName : processPath;
        if (processCache.containsKey(cacheKey)) {
            ProcessInfo cached = processCache.get(cacheKey);
            if (System.currentTimeMillis() - cached.getTimestamp() < CACHE_EXPIRY_MS) {
                return cached;
            }
        }

        String displayName = null;
        String iconBase64 = null;

        if (!processPath.isEmpty()) {
            File exeFile = new File(processPath);
            if (exeFile.exists()) {
                // Obtener nombre del producto desde las propiedades del exe
                displayName = getProductNameFromExe(processPath);

                // Obtener icono (SIN WinAPI de iconos, solo FileSystemView)
                iconBase64 = getIconFromFile(exeFile);
            }
        }

        // Si no se pudo obtener el nombre, formatear el nombre del exe
        if (displayName == null || displayName.isEmpty()) {
            displayName = formatProcessName(processName);
        }

        ProcessInfo info = new ProcessInfo(processName, processPath, displayName, iconBase64);
        processCache.put(cacheKey, info);

        return info;
    }

    /**
     * Obtiene el nombre del producto desde las propiedades del archivo .exe
     * usando la API de Windows (Version.dll).
     */
    private static String getProductNameFromExe(String exePath) {
        try {
            IntByReference dwHandle = new IntByReference();
            int size = Version.INSTANCE.GetFileVersionInfoSize(exePath, dwHandle);

            if (size > 0) {
                Pointer buffer = Kernel32.INSTANCE.LocalAlloc(Kernel32.LMEM_ZEROINIT, size);

                try {
                    if (Version.INSTANCE.GetFileVersionInfo(exePath, 0, size, buffer)) {
                        String[] queries = {
                                "\\StringFileInfo\\040904B0\\ProductName",
                                "\\StringFileInfo\\040904E4\\ProductName",
                                "\\StringFileInfo\\000004B0\\ProductName",
                                "\\StringFileInfo\\040904B0\\FileDescription",
                                "\\StringFileInfo\\040904E4\\FileDescription"
                        };

                        for (String query : queries) {
                            PointerByReference lplpBuffer = new PointerByReference();
                            IntByReference puLen = new IntByReference();

                            if (Version.INSTANCE.VerQueryValue(buffer, query, lplpBuffer, puLen)) {
                                if (puLen.getValue() > 0) {
                                    String value = lplpBuffer.getValue().getWideString(0);
                                    if (value != null && !value.trim().isEmpty()) {
                                        return value.trim();
                                    }
                                }
                            }
                        }
                    }
                } finally {
                    Kernel32.INSTANCE.LocalFree(buffer);
                }
            }
        } catch (Exception e) {
            // fallback abajo
        }

        // Método alternativo: usar FileSystemView para obtener la descripción
        try {
            File file = new File(exePath);
            if (file.exists()) {
                String desc = FileSystemView.getFileSystemView().getSystemTypeDescription(file);
                if (desc != null && !desc.isEmpty() && !desc.equals("Application")) {
                    return desc;
                }
            }
        } catch (Exception e) {
            // Ignorar
        }

        return null;
    }

    /**
     * Obtiene el icono de un archivo y lo convierte a Base64 (data URL).
     * Usa FileSystemView (sin SHFILEINFO/DrawIconEx/GetDIBits).
     */
    private static String getIconFromFile(File file) {
        try {
            Icon icon = FileSystemView.getFileSystemView().getSystemIcon(file);
            if (icon == null) return null;

            BufferedImage image = iconToBufferedImage(icon);
            return bufferedImageToBase64(image);
        } catch (Exception e) {
            return null;
        }
    }

    /**
     * Convierte un Icon de Swing a BufferedImage.
     */
    private static BufferedImage iconToBufferedImage(Icon icon) {
        if (icon instanceof ImageIcon) {
            Image img = ((ImageIcon) icon).getImage();
            BufferedImage bi = new BufferedImage(
                    icon.getIconWidth(),
                    icon.getIconHeight(),
                    BufferedImage.TYPE_INT_ARGB
            );
            Graphics g = bi.createGraphics();
            g.drawImage(img, 0, 0, null);
            g.dispose();
            return bi;
        }

        BufferedImage bi = new BufferedImage(
                icon.getIconWidth(),
                icon.getIconHeight(),
                BufferedImage.TYPE_INT_ARGB
        );
        Graphics g = bi.createGraphics();
        icon.paintIcon(null, g, 0, 0);
        g.dispose();
        return bi;
    }

    /**
     * Convierte BufferedImage a String Base64 (data:image/png;base64,...).
     */
    private static String bufferedImageToBase64(BufferedImage image) {
        try {
            ByteArrayOutputStream baos = new ByteArrayOutputStream();
            ImageIO.write(image, "png", baos);
            byte[] bytes = baos.toByteArray();
            return "data:image/png;base64," + Base64.getEncoder().encodeToString(bytes);
        } catch (IOException e) {
            return null;
        }
    }

    /**
     * Formatea el nombre del proceso para mostrarlo de forma legible.
     * Ej: "chrome.exe" -> "Chrome"
     */
    private static String formatProcessName(String processName) {
        if (processName == null || processName.isEmpty()) {
            return "Unknown";
        }

        String name = processName.toLowerCase().replace(".exe", "");
        if (name.length() > 0) {
            name = Character.toUpperCase(name.charAt(0)) + name.substring(1);
        }
        return name;
    }

    /**
     * Determina si es un proceso del sistema que no debería mostrarse.
     */
    private static boolean isSystemProcess(String processName) {
        String[] systemProcesses = {
                "system", "smss.exe", "csrss.exe", "wininit.exe", "services.exe",
                "lsass.exe", "svchost.exe", "dwm.exe", "conhost.exe", "ctfmon.exe",
                "sihost.exe", "taskhostw.exe", "runtimebroker.exe", "searchhost.exe",
                "startmenuexperiencehost.exe", "shellexperiencehost.exe", "textinputhost.exe",
                "applicationframehost.exe", "systemsettings.exe", "lockapp.exe",
                "securityhealthservice.exe", "securityhealthsystray.exe", "registry",
                "memory compression", "ntoskrnl.exe", "audiodg.exe", "fontdrvhost.exe",
                "dllhost.exe", "wmiprvse.exe", "searchindexer.exe", "searchprotocolhost.exe",
                "searchfilterhost.exe", "spoolsv.exe", "msiexec.exe", "trustedinstaller.exe",
                "wudfhost.exe", "dashost.exe", "smartscreen.exe", "sgrmbroker.exe",
                "gameinputsvc.exe", "gamebarpresencewriter.exe", "backgroundtaskhost.exe",
                "windowsinternal.composableshell.experiences.textinput.inputapp.exe",
                "crashpad_handler.exe", "ngen.exe", "ngentask.exe", "mscorsvw.exe",
                "wpnservice.exe", "uhssvc.exe", "lsaiso.exe", "registry", "idle",
                "[system process]", "system idle process", "wmiapsrv.exe"
        };

        String lower = processName.toLowerCase();
        for (String sysProcess : systemProcesses) {
            if (lower.equals(sysProcess) || lower.equals(sysProcess.replace(".exe", ""))) {
                return true;
            }
        }

        String[] prefixes = {"windows", "microsoft", "svc", "wmi"};
        for (String prefix : prefixes) {
            if (lower.startsWith(prefix) && !lower.equals("winword.exe")) {
                return true;
            }
        }

        return false;
    }

    /**
     * Limpia el cache si ha pasado suficiente tiempo.
     */
    private static void cleanCacheIfNeeded() {
        long now = System.currentTimeMillis();
        if (now - lastCacheClean > CACHE_EXPIRY_MS) {
            processCache.entrySet().removeIf(entry ->
                    now - entry.getValue().getTimestamp() > CACHE_EXPIRY_MS
            );
            lastCacheClean = now;
        }
    }

    // ========== MÉTODOS ORIGINALES (sin cambios) ==========

    /**
     * Termina un proceso por su nombre.
     */
    public static boolean killProcess(String processName) {
        String normalizedProcessName = normalizeProcessName(processName);

        if (normalizedProcessName == null) {
            return false;
        }

        try {
            Process killByImageName = Runtime.getRuntime().exec(
                    "taskkill /im \"" + normalizedProcessName + "\" /f"
            );
            killByImageName.waitFor(3, TimeUnit.SECONDS);

            if (killByImageName.exitValue() == 0) {
                return true;
            }

            Process process = Runtime.getRuntime().exec(
                    "tasklist /fi \"imagename eq " + normalizedProcessName + "\" /fo csv /nh");

            BufferedReader reader = new BufferedReader(new InputStreamReader(process.getInputStream()));
            String line;
            List<Integer> pids = new ArrayList<>();

            while ((line = reader.readLine()) != null) {
                if (!line.trim().isEmpty() && !line.startsWith("INFO:")) {
                    String[] columns = line.split("\",\"");
                    if (columns.length >= 2) {
                        String pidStr = columns[1].replace("\"", "").trim();
                        try {
                            pids.add(Integer.parseInt(pidStr));
                        } catch (NumberFormatException ignored) {
                        }
                    }
                }
            }

            boolean success = true;
            for (int pid : pids) {
                Process kill = Runtime.getRuntime().exec("taskkill /pid " + pid + " /f");
                kill.waitFor();
                if (kill.exitValue() != 0) {
                    success = false;
                }
            }

            return success && !pids.isEmpty();
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            return false;
        } catch (IOException e) {
            e.printStackTrace();
            return false;
        }
    }

    private static String normalizeProcessName(String processName) {
        if (processName == null) {
            return null;
        }

        String normalized = processName.trim().toLowerCase();
        if (normalized.isEmpty()) {
            return null;
        }

        if (!normalized.endsWith(".exe")) {
            normalized = normalized + ".exe";
        }

        if (!normalized.matches("^[a-z0-9_.-]+\\.exe$")) {
            return null;
        }

        return normalized;
    }

    /**
     * Verifica si la aplicación en primer plano está en pantalla completa.
     */
    public static boolean isAppFullscreen() {
        WinDef.HWND hwnd = User32.INSTANCE.GetForegroundWindow();
        if (hwnd == null) return false;

        WinDef.RECT windowRect = new WinDef.RECT();
        User32.INSTANCE.GetWindowRect(hwnd, windowRect);

        Dimension screenSize = Toolkit.getDefaultToolkit().getScreenSize();
        return windowRect.right - windowRect.left >= screenSize.width &&
                windowRect.bottom - windowRect.top >= screenSize.height;
    }

    /**
     * Obtiene el título de la ventana activa.
     */
    public static String getActiveWindowTitle() {
        char[] buffer = new char[1024];
        WinDef.HWND hwnd = User32.INSTANCE.GetForegroundWindow();
        User32.INSTANCE.GetWindowText(hwnd, buffer, buffer.length);
        return new String(buffer).trim();
    }

    /**
     * Apaga el sistema.
     */
    public static void shutdownSystem() {
        try {
            Runtime.getRuntime().exec("shutdown -s -t 0");
        } catch (IOException e) {
            e.printStackTrace();
        }
    }
}
