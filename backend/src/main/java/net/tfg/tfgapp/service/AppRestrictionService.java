package net.tfg.tfgapp.service;

import jakarta.annotation.PostConstruct;
import net.tfg.tfgapp.service.interfaces.IStorageService;
import net.tfg.tfgapp.utils.WindowsUtils;
import org.springframework.stereotype.Service;

import java.util.Collections;
import java.util.HashMap;
import java.util.HashSet;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;

@Service
public class AppRestrictionService {
    private static final Map<String, Set<String>> EXECUTABLE_ALIASES = buildExecutableAliases();

    private final IStorageService storageService;
    private final BlockingService blockingService;

    public AppRestrictionService(IStorageService storageService, BlockingService blockingService) {
        this.storageService = storageService;
        this.blockingService = blockingService;
    }

    @PostConstruct
    public void init() {
        ScheduledExecutorService scheduler = Executors.newScheduledThreadPool(1);
        scheduler.scheduleAtFixedRate(this::checkSystemState, 0, 5, TimeUnit.SECONDS);
    }

    private void checkSystemState() {
        if (shouldEnforceRestrictions()) {
            enforceRestrictions();
        }
    }

    private boolean shouldEnforceRestrictions() {
        return blockingService.isEffectiveFocusModeEnabled();
    }

    private void enforceRestrictions() {
        IStorageService.Config config = storageService.loadConfig();
        Set<String> blockedExecutables = normalizeBlockedExecutables(config.getBlockedApps());

        for (String runningProcess : WindowsUtils.getRunningProcesses()) {
            String normalizedProcess = normalizeExecutableNameSafely(runningProcess);
            if (blockedExecutables.contains(normalizedProcess)) {
                WindowsUtils.killProcess(normalizedProcess);
            }
        }
    }

    public void addBlockedApp(String executableName) {
        String cleanExecutableName = normalizeExecutableName(executableName);

        IStorageService.Config config = storageService.loadConfig();

        if (config.getBlockedApps().contains(cleanExecutableName)) {
            throw new IllegalStateException("La aplicación ya está en la lista bloqueada");
        }

        Set<String> updatedBlockedApps = new HashSet<>(config.getBlockedApps());
        updatedBlockedApps.add(cleanExecutableName);

        config.setBlockedApps(updatedBlockedApps);
        storageService.saveConfig(config);
    }

    public void removeBlockedApp(String executableName) {
        String cleanExecutableName = normalizeExecutableName(executableName);

        IStorageService.Config config = storageService.loadConfig();
        Set<String> updatedBlockedApps = new HashSet<>(config.getBlockedApps());

        if (!updatedBlockedApps.remove(cleanExecutableName)) {
            throw new IllegalArgumentException("La aplicación no estaba en la lista");
        }

        config.setBlockedApps(updatedBlockedApps);
        storageService.saveConfig(config);
    }

    public void resetBlockedApps() {
        IStorageService.Config config = storageService.loadConfig();
        config.setBlockedApps(new HashSet<>(Set.of(
                "valorant.exe",
                "leagueoflegends.exe",
                "riotclientservices.exe",
                "steam.exe"
        )));
        config.setGames(Set.of(
                "valorant.exe",
                "leagueoflegends.exe",
                "riotclientservices.exe",
                "steam.exe"
        ));
        storageService.saveConfig(config);
    }

    public Set<String> getBlockedApps() {
        return Collections.unmodifiableSet(storageService.loadConfig().getBlockedApps());
    }

    /**
     * Se mantiene por compatibilidad retroactiva con endpoints existentes.
     */
    public boolean isGameModeActive() {
        return blockingService.isEffectiveFocusModeEnabled();
    }

    private String normalizeExecutableName(String executableName) {
        if (executableName == null || executableName.trim().isEmpty()) {
            throw new IllegalArgumentException("El nombre de la aplicación no puede estar vacío");
        }

        String cleanExecutableName = executableName.trim().toLowerCase();

        if (!cleanExecutableName.matches("^[a-z0-9_.-]+\\.exe$")) {
            throw new IllegalArgumentException("Formato de nombre de aplicación inválido: " + executableName);
        }

        return cleanExecutableName;
    }

    private String normalizeExecutableNameSafely(String executableName) {
        try {
            return normalizeExecutableName(executableName);
        } catch (Exception ex) {
            return "";
        }
    }

    private Set<String> normalizeBlockedExecutables(Set<String> blockedApps) {
        if (blockedApps == null || blockedApps.isEmpty()) {
            return Collections.emptySet();
        }

        Set<String> normalized = new HashSet<>();

        for (String blockedApp : blockedApps) {
            String normalizedExecutable = normalizeExecutableNameSafely(blockedApp);
            if (normalizedExecutable.isEmpty()) {
                continue;
            }

            normalized.add(normalizedExecutable);
            normalized.addAll(EXECUTABLE_ALIASES.getOrDefault(normalizedExecutable, Collections.emptySet()));
        }

        return normalized;
    }

    private static Map<String, Set<String>> buildExecutableAliases() {
        Map<String, Set<String>> aliases = new HashMap<>();
        aliases.put("leagueoflegends.exe", Set.of("leagueclient.exe", "leagueclientux.exe", "leagueclientuxrender.exe"));
        aliases.put("riotclientservices.exe", Set.of("riotclientux.exe", "riotclientuxrender.exe"));
        aliases.put("steam.exe", Set.of("steamwebhelper.exe"));
        return aliases;
    }
}
