package net.tfg.tfgapp.components.ai;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import net.tfg.tfgapp.components.ai.AiCredentials.AiProvider;
import org.springframework.stereotype.Component;

import java.io.File;
import java.io.IOException;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Duration;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Optional;
import java.util.Set;
import java.util.concurrent.TimeUnit;

/**
 * Proveedores que usan la suscripción del usuario (Claude Pro/Max, ChatGPT) a través de su
 * CLI oficial en modo no interactivo: {@code claude -p} y {@code codex exec}. El backend corre
 * en el PC del usuario (lo lanza Electron), así que puede ejecutar el CLI con la sesión que el
 * usuario haya iniciado en él. No hay clave: la autenticación la gestiona el propio CLI.
 *
 * El CLI se lanza como un agente sin herramientas (Claude: {@code --tools ""}, Codex: sandbox
 * de solo lectura) y en un directorio temporal vacío, porque solo se le pide texto: el prompt
 * lleva notas y tareas del usuario y no debe poder leer ni ejecutar nada en el PC.
 */
@Component
public class LocalCliClient {
    private static final Duration COMPLETION_TIMEOUT = Duration.ofSeconds(150);
    private static final Duration STATUS_TIMEOUT = Duration.ofSeconds(20);
    private static final boolean WINDOWS = System.getProperty("os.name", "").toLowerCase(Locale.ROOT).contains("win");

    private final ObjectMapper objectMapper;

    public LocalCliClient(ObjectMapper objectMapper) {
        this.objectMapper = objectMapper;
    }

    /** Estado del CLI en este PC para la pantalla de ajustes. */
    public record CliStatus(boolean installed, boolean loggedIn, String detail) {
    }

    public CliStatus status(AiProvider provider) {
        Optional<Path> executable = findExecutable(provider);
        if (executable.isEmpty()) {
            return new CliStatus(false, false, null);
        }
        Path workDir = createWorkDir();
        try {
            List<String> args = provider == AiProvider.CLAUDE_CODE
                    ? List.of("auth", "status")
                    : List.of("login", "status");
            ProcessResult result = run(executable.get(), args, null, workDir, STATUS_TIMEOUT);
            String output = result.output().trim();
            if (provider == AiProvider.CLAUDE_CODE) {
                return new CliStatus(true, claudeLoggedIn(output), null);
            }
            // "codex login status" sale con 0 y "Logged in using ..." si hay sesión.
            boolean loggedIn = result.exitCode() == 0 && output.toLowerCase(Locale.ROOT).contains("logged in")
                    && !output.toLowerCase(Locale.ROOT).contains("not logged in");
            return new CliStatus(true, loggedIn, loggedIn ? firstLine(output) : null);
        } catch (AiProviderException e) {
            return new CliStatus(true, false, e.getMessage());
        } finally {
            deleteQuietly(workDir);
        }
    }

    /** Ejecuta la conversación con el CLI y devuelve el texto final del modelo. */
    public String complete(AiCredentials credentials, String system, List<AiProviderClient.Message> messages) {
        AiProvider provider = credentials.provider();
        Path executable = findExecutable(provider).orElseThrow(() -> new AiProviderException(
                AiProviderException.Kind.INVALID_CONFIGURATION, notInstalledMessage(provider)));
        Path workDir = createWorkDir();
        try {
            return provider == AiProvider.CLAUDE_CODE
                    ? completeWithClaude(executable, credentials.model(), system, messages, workDir)
                    : completeWithCodex(executable, credentials.model(), system, messages, workDir);
        } finally {
            deleteQuietly(workDir);
        }
    }

    private String completeWithClaude(Path executable, String model, String system,
                                      List<AiProviderClient.Message> messages, Path workDir) {
        Path systemFile = workDir.resolve("system.txt");
        writeFile(systemFile, system);
        List<String> args = new ArrayList<>(List.of(
                "-p", "--output-format", "json",
                // Sin CLAUDE.md, skills, hooks ni MCP del usuario; el login sí se mantiene.
                "--safe-mode", "--strict-mcp-config", "--disable-slash-commands",
                "--tools", "",
                "--no-session-persistence",
                "--system-prompt-file", systemFile.toString(),
                "--effort", "low"));
        if (!model.isBlank()) {
            args.add("--model");
            args.add(model);
        }
        ProcessResult result = run(executable, args, transcript(messages), workDir, COMPLETION_TIMEOUT);

        JsonNode response = parseClaudeResult(result.output());
        if (response == null) {
            throw failure(result.output(), AiProvider.CLAUDE_CODE);
        }
        String text = response.path("result").asText("");
        if (response.path("is_error").asBoolean(false) || result.exitCode() != 0) {
            throw failure(text.isBlank() ? result.output() : text, AiProvider.CLAUDE_CODE);
        }
        return text;
    }

    private String completeWithCodex(Path executable, String model, String system,
                                     List<AiProviderClient.Message> messages, Path workDir) {
        Path answerFile = workDir.resolve("answer.txt");
        List<String> args = new ArrayList<>(List.of(
                "exec", "--skip-git-repo-check", "--sandbox", "read-only", "--ephemeral",
                "--color", "never", "-o", answerFile.toString()));
        if (!model.isBlank()) {
            args.add("-m");
            args.add(model);
        }
        args.add("-");
        // Codex exec no admite un prompt de sistema propio: va delante de la conversación.
        String prompt = "<instructions>\n" + system + "\n</instructions>\n\n" + transcript(messages);
        ProcessResult result = run(executable, args, prompt, workDir, COMPLETION_TIMEOUT);

        String answer = readFile(answerFile);
        if (result.exitCode() != 0 || answer.isBlank()) {
            throw failure(result.output(), AiProvider.CODEX);
        }
        return answer;
    }

    /**
     * El CLI recibe un único prompt: con un solo mensaje se manda tal cual; con historial se
     * transcribe la conversación y se pide responder al último mensaje del usuario.
     */
    static String transcript(List<AiProviderClient.Message> messages) {
        if (messages.size() == 1) {
            return messages.get(0).content();
        }
        StringBuilder text = new StringBuilder("<conversation>\n");
        for (AiProviderClient.Message message : messages) {
            String tag = "assistant".equals(message.role()) ? "assistant" : "user";
            text.append('<').append(tag).append(">\n").append(message.content()).append("\n</").append(tag).append(">\n");
        }
        text.append("</conversation>\n\nReply to the last user message, following the instructions.");
        return text.toString();
    }

    /** La salida JSON de Claude puede ir precedida de avisos: se toma la última línea JSON. */
    private JsonNode parseClaudeResult(String output) {
        String[] lines = output.split("\\R");
        for (int i = lines.length - 1; i >= 0; i--) {
            String line = lines[i].trim();
            if (line.startsWith("{")) {
                try {
                    JsonNode node = objectMapper.readTree(line);
                    if (node.has("result") || node.has("is_error")) {
                        return node;
                    }
                } catch (IOException ignored) {
                    // No era el resultado; se sigue buscando.
                }
            }
        }
        return null;
    }

    private boolean claudeLoggedIn(String output) {
        int start = output.indexOf('{');
        if (start >= 0) {
            try {
                return objectMapper.readTree(output.substring(start)).path("loggedIn").asBoolean(false);
            } catch (IOException ignored) {
                // Formato antiguo en texto plano.
            }
        }
        String lower = output.toLowerCase(Locale.ROOT);
        return lower.contains("logged in") && !lower.contains("not logged in");
    }

    /** Traduce la salida de error del CLI al tipo de fallo que entiende la UI. */
    private static AiProviderException failure(String output, AiProvider provider) {
        String detail = output == null ? "" : output.trim();
        String lower = detail.toLowerCase(Locale.ROOT);
        if (lower.contains("login") || lower.contains("log in") || lower.contains("logged in")
                || lower.contains("not authenticated") || lower.contains("unauthorized") || lower.contains("401")
                || lower.contains("oauth") || lower.contains("token expired")) {
            return new AiProviderException(AiProviderException.Kind.INVALID_CONFIGURATION,
                    "El CLI no tiene una sesión iniciada. Ejecuta \"" + loginCommand(provider)
                            + "\" (o usa el botón Iniciar sesión) y vuelve a probar.");
        }
        if (lower.contains("model") && (lower.contains("not found") || lower.contains("invalid")
                || lower.contains("not supported") || lower.contains("does not exist"))) {
            return new AiProviderException(AiProviderException.Kind.INVALID_CONFIGURATION, truncate(detail));
        }
        if (lower.contains("limit") || lower.contains("quota") || lower.contains("429") || lower.contains("overloaded")) {
            return new AiProviderException(AiProviderException.Kind.UNAVAILABLE,
                    "Se ha alcanzado el límite de uso de la suscripción: " + truncate(detail));
        }
        return new AiProviderException(AiProviderException.Kind.UNAVAILABLE,
                "El CLI falló: " + truncate(detail));
    }

    public static String loginCommand(AiProvider provider) {
        return provider == AiProvider.CLAUDE_CODE ? "claude auth login" : "codex login";
    }

    private static String notInstalledMessage(AiProvider provider) {
        return provider == AiProvider.CLAUDE_CODE
                ? "Claude Code no está instalado en este PC (npm install -g @anthropic-ai/claude-code)."
                : "Codex CLI no está instalado en este PC (npm install -g @openai/codex).";
    }

    // ---------- Procesos ----------

    private record ProcessResult(int exitCode, String output) {
    }

    private ProcessResult run(Path executable, List<String> args, String stdin, Path workDir, Duration timeout) {
        List<String> command = new ArrayList<>();
        String name = executable.getFileName().toString().toLowerCase(Locale.ROOT);
        if (WINDOWS && (name.endsWith(".cmd") || name.endsWith(".bat"))) {
            // Los shims de npm (.cmd) solo se pueden lanzar a través de cmd.exe.
            command.add("cmd.exe");
            command.add("/c");
        }
        command.add(executable.toString());
        command.addAll(args);

        Path outputFile = workDir.resolve("output.log");
        ProcessBuilder builder = new ProcessBuilder(command)
                .directory(workDir.toFile())
                .redirectErrorStream(true)
                .redirectOutput(outputFile.toFile());
        builder.environment().put("NO_COLOR", "1");

        Process process;
        try {
            process = builder.start();
        } catch (IOException e) {
            throw new AiProviderException(AiProviderException.Kind.UNAVAILABLE, "No se pudo ejecutar el CLI.", e);
        }
        try (OutputStream input = process.getOutputStream()) {
            if (stdin != null) {
                input.write(stdin.getBytes(StandardCharsets.UTF_8));
            }
        } catch (IOException e) {
            // El proceso puede haber terminado antes de leer stdin; su salida dirá por qué.
        }
        try {
            if (!process.waitFor(timeout.toSeconds(), TimeUnit.SECONDS)) {
                process.descendants().forEach(ProcessHandle::destroyForcibly);
                process.destroyForcibly();
                throw new AiProviderException(AiProviderException.Kind.UNAVAILABLE, "El CLI tardó demasiado en responder.");
            }
        } catch (InterruptedException e) {
            process.destroyForcibly();
            Thread.currentThread().interrupt();
            throw new AiProviderException(AiProviderException.Kind.UNAVAILABLE, "Petición al CLI interrumpida.", e);
        }
        return new ProcessResult(process.exitValue(), readFile(outputFile));
    }

    /**
     * Busca el ejecutable en el PATH y en las rutas habituales de instalación: Electron puede
     * arrancar con un PATH más corto que el de la terminal del usuario.
     */
    Optional<Path> findExecutable(AiProvider provider) {
        String baseName = provider == AiProvider.CLAUDE_CODE ? "claude" : "codex";
        String home = System.getProperty("user.home", "");
        Set<String> dirs = new LinkedHashSet<>();
        String path = System.getenv("PATH");
        if (path != null) {
            dirs.addAll(List.of(path.split(File.pathSeparator)));
        }
        dirs.add(Path.of(home, ".local", "bin").toString());
        dirs.add(Path.of(home, ".claude", "local").toString());
        dirs.add(Path.of(home, ".npm-global", "bin").toString());
        if (WINDOWS) {
            String appData = System.getenv("APPDATA");
            if (appData != null) {
                dirs.add(Path.of(appData, "npm").toString());
            }
        } else {
            dirs.add("/usr/local/bin");
            dirs.add("/opt/homebrew/bin");
        }

        List<String> extensions = WINDOWS ? List.of(".exe", ".cmd", ".bat") : List.of("");
        for (String dir : dirs) {
            if (dir.isBlank()) {
                continue;
            }
            for (String extension : extensions) {
                try {
                    Path candidate = Path.of(dir.replace("\"", ""), baseName + extension);
                    if (Files.isRegularFile(candidate) && (WINDOWS || Files.isExecutable(candidate))) {
                        return Optional.of(candidate);
                    }
                } catch (RuntimeException ignored) {
                    // Entrada del PATH mal formada.
                }
            }
        }
        return Optional.empty();
    }

    private static Path createWorkDir() {
        try {
            return Files.createTempDirectory("gmo-ai-cli-");
        } catch (IOException e) {
            throw new AiProviderException(AiProviderException.Kind.UNAVAILABLE, "No se pudo preparar el CLI.", e);
        }
    }

    private static void writeFile(Path file, String content) {
        try {
            Files.writeString(file, content, StandardCharsets.UTF_8);
        } catch (IOException e) {
            throw new AiProviderException(AiProviderException.Kind.UNAVAILABLE, "No se pudo preparar el CLI.", e);
        }
    }

    private static String readFile(Path file) {
        try {
            return Files.exists(file) ? Files.readString(file, StandardCharsets.UTF_8) : "";
        } catch (IOException e) {
            return "";
        }
    }

    private static void deleteQuietly(Path dir) {
        try (var files = Files.walk(dir)) {
            files.sorted((a, b) -> b.getNameCount() - a.getNameCount()).forEach(file -> file.toFile().delete());
        } catch (IOException ignored) {
            // Se queda en la carpeta temporal del sistema.
        }
    }

    private static String firstLine(String text) {
        int newline = text.indexOf('\n');
        return (newline < 0 ? text : text.substring(0, newline)).trim();
    }

    private static String truncate(String text) {
        return text.length() > 300 ? text.substring(0, 300) + "…" : text;
    }
}
