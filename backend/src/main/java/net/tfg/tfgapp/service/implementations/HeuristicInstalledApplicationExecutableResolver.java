package net.tfg.tfgapp.service.implementations;

import net.tfg.tfgapp.DTOs.apprestrict.InstalledApplicationRegistryEntry;
import net.tfg.tfgapp.DTOs.apprestrict.ResolvedExecutableDTO;
import net.tfg.tfgapp.service.interfaces.InstalledApplicationExecutableResolver;
import org.springframework.stereotype.Service;

import java.io.File;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Stream;

@Service
public class HeuristicInstalledApplicationExecutableResolver implements InstalledApplicationExecutableResolver {

    private static final Set<String> EXCLUDED_EXECUTABLE_NAMES = Set.of(
            "uninstall.exe",
            "unins000.exe",
            "unins001.exe",
            "setup.exe",
            "update.exe",
            "updater.exe",
            "crashhandler.exe",
            "crashpad_handler.exe",
            "helper.exe",
            "repair.exe"
    );

    private static final Pattern EXECUTABLE_PATTERN = Pattern.compile("(?i)([a-z]:\\\\[^\"\\n\\r]*?\\.exe)");

    @Override
    public ResolvedExecutableDTO resolveExecutable(InstalledApplicationRegistryEntry application) {
        String resolvedFromKnownRules = null;
        try {
            resolvedFromKnownRules = resolveFromKnownRules(application);
        } catch (Exception ignored) {
            resolvedFromKnownRules = null;
        }

        if (isUsableExecutable(resolvedFromKnownRules)) {
            File executableFile = new File(resolvedFromKnownRules);
            return new ResolvedExecutableDTO(
                    executableFile.getName().toLowerCase(),
                    executableFile.getAbsolutePath(),
                    true
            );
        }

        String executableFromIcon = extractExecutablePathFromDisplayIcon(application.getDisplayIcon());

        if (isUsableExecutable(executableFromIcon)) {
            File executableFile = new File(executableFromIcon);
            return new ResolvedExecutableDTO(
                    executableFile.getName().toLowerCase(),
                    executableFile.getAbsolutePath(),
                    true
            );
        }

        String executableFromUninstall = extractExecutablePathFromUninstallString(application.getUninstallString());
        if (isUsableExecutable(executableFromUninstall)) {
            File executableFile = new File(executableFromUninstall);
            return new ResolvedExecutableDTO(
                    executableFile.getName().toLowerCase(),
                    executableFile.getAbsolutePath(),
                    true
            );
        }

        String resolvedFromInstallLocation = resolveFromInstallLocation(
                application.getInstallLocation(),
                application.getDisplayName()
        );

        if (isUsableExecutable(resolvedFromInstallLocation)) {
            File executableFile = new File(resolvedFromInstallLocation);
            return new ResolvedExecutableDTO(
                    executableFile.getName().toLowerCase(),
                    executableFile.getAbsolutePath(),
                    true
            );
        }

        return new ResolvedExecutableDTO(null, null, false);
    }

    private String resolveFromKnownRules(InstalledApplicationRegistryEntry application) {
        String displayName = normalize(application.getDisplayName());
        String installLocation = sanitizePath(expandEnvironmentVariables(application.getInstallLocation()));
        String uninstallString = application.getUninstallString() == null ? "" : application.getUninstallString().toLowerCase();

        if (uninstallString.contains("steam://")) {
            return null;
        }

        if (displayName.contains("steam") && installLocation != null && !installLocation.isBlank()) {
            return buildPathSafely(installLocation, "steam.exe");
        }

        if (displayName.contains("leagueoflegends") && installLocation != null && !installLocation.isBlank()) {
            return buildPathSafely(installLocation, "LeagueClient.exe");
        }

        if (displayName.contains("riotclient") && installLocation != null && !installLocation.isBlank()) {
            return buildPathSafely(installLocation, "RiotClientServices.exe");
        }

        return null;
    }

    private String extractExecutablePathFromDisplayIcon(String displayIcon) {
        return extractExecutablePath(displayIcon);
    }

    private String extractExecutablePathFromUninstallString(String uninstallString) {
        if (uninstallString != null && uninstallString.toLowerCase().contains("steam://")) {
            return null;
        }
        return extractExecutablePath(uninstallString);
    }

    private String extractExecutablePath(String rawValue) {
        if (rawValue == null || rawValue.isBlank()) {
            return null;
        }

        String cleaned = expandEnvironmentVariables(rawValue.trim());

        if (cleaned.startsWith("\"")) {
            int closingQuoteIndex = cleaned.indexOf("\"", 1);
            if (closingQuoteIndex > 1) {
                cleaned = cleaned.substring(1, closingQuoteIndex);
            }
        } else {
            int commaIndex = cleaned.indexOf(",");
            if (commaIndex > 0) {
                cleaned = cleaned.substring(0, commaIndex);
            }
        }

        cleaned = cleaned.trim();

        if (cleaned.toLowerCase().endsWith(".exe")) {
            return cleaned;
        }

        Matcher matcher = EXECUTABLE_PATTERN.matcher(cleaned);
        if (matcher.find()) {
            return matcher.group(1);
        }

        return null;
    }

    private String expandEnvironmentVariables(String value) {
        if (value == null) {
            return null;
        }

        String expanded = value;

        for (String envVar : System.getenv().keySet()) {
            String marker = "%" + envVar + "%";
            if (expanded.contains(marker)) {
                expanded = expanded.replace(marker, System.getenv(envVar));
            }
        }

        return expanded;
    }

    private String sanitizePath(String path) {
        if (path == null) {
            return null;
        }

        String trimmed = path.trim();
        if (trimmed.startsWith("\"") && trimmed.endsWith("\"") && trimmed.length() > 1) {
            return trimmed.substring(1, trimmed.length() - 1).trim();
        }

        return trimmed;
    }

    private String buildPathSafely(String directory, String executableName) {
        try {
            return new File(directory, executableName).getAbsolutePath();
        } catch (Exception ignored) {
            return null;
        }
    }

    private String resolveFromInstallLocation(String installLocation, String displayName) {
        if (installLocation == null || installLocation.isBlank()) {
            return null;
        }

        File installDir = new File(installLocation);
        if (!installDir.exists() || !installDir.isDirectory()) {
            return null;
        }

        try (Stream<Path> pathStream = Files.walk(installDir.toPath(), 2)) {
            File bestCandidate = null;
            int bestScore = Integer.MIN_VALUE;

            java.util.Iterator<Path> candidates = pathStream.iterator();
            while (candidates.hasNext()) {
                Path candidatePath = candidates.next();
                if (!Files.isRegularFile(candidatePath)) {
                    continue;
                }

                File candidateFile = candidatePath.toFile();
                if (!candidateFile.getName().toLowerCase().endsWith(".exe")) {
                    continue;
                }
                if (isExcludedExecutable(candidateFile.getName())) {
                    continue;
                }

                int candidateScore = scoreExecutableCandidate(candidateFile, displayName, installDir);
                if (candidateScore > bestScore) {
                    bestScore = candidateScore;
                    bestCandidate = candidateFile;
                }
            }

            return bestCandidate != null ? bestCandidate.getAbsolutePath() : null;
        } catch (Exception e) {
            return null;
        }
    }

    private boolean isUsableExecutable(String executablePath) {
        if (executablePath == null || executablePath.isBlank()) {
            return false;
        }

        File file = new File(executablePath);
        return file.exists()
                && file.isFile()
                && file.getName().toLowerCase().endsWith(".exe")
                && !isExcludedExecutable(file.getName());
    }

    private int scoreExecutableCandidate(File file, String displayName, File installDir) {
        int score = 0;

        String executableBaseName = normalize(file.getName().replace(".exe", ""));
        String normalizedDisplayName = normalize(displayName);

        if (executableBaseName.equals(normalizedDisplayName)) {
            score += 100;
        }

        if (executableBaseName.contains(normalizedDisplayName) || normalizedDisplayName.contains(executableBaseName)) {
            score += 60;
        }

        if (file.getParentFile() != null && file.getParentFile().equals(installDir)) {
            score += 15;
        }

        long size = file.length();
        if (size > 0) {
            score += Math.min((int) (size / (1024 * 1024)), 20);
        }

        return score;
    }

    private boolean isExcludedExecutable(String fileName) {
        return EXCLUDED_EXECUTABLE_NAMES.contains(fileName.toLowerCase());
    }

    private String normalize(String value) {
        if (value == null) {
            return "";
        }

        return value.toLowerCase()
                .replace(" ", "")
                .replace("-", "")
                .replace("_", "");
    }
}
