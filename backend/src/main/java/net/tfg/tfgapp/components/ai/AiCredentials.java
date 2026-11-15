package net.tfg.tfgapp.components.ai;

import java.util.Locale;
import java.util.Optional;

/**
 * Proveedor, modelo y clave de API elegidos por el usuario. La clave se guarda cifrada
 * en su PC (Electron safeStorage) y llega en cada petición por cabecera: el backend
 * nunca la persiste ni la registra en logs.
 *
 * Los proveedores de CLI local (Claude Code, Codex) no llevan clave: usan la suscripción
 * con la que el usuario haya iniciado sesión en el CLI (ver {@link LocalCliClient}).
 */
public record AiCredentials(AiProvider provider, String model, String apiKey) {
    public static final String PROVIDER_HEADER = "X-AI-Provider";
    public static final String MODEL_HEADER = "X-AI-Model";
    public static final String KEY_HEADER = "X-AI-Key";

    public enum AiProvider {
        OPENAI("gpt-4.1-mini"),
        ANTHROPIC("claude-opus-5-5"),
        GEMINI("gemini-2.5-flash"),
        /** Suscripción de Claude a través de "claude -p". Modelo vacío = el que use el CLI. */
        CLAUDE_CODE(""),
        /** Suscripción de ChatGPT a través de "codex exec". Modelo vacío = el que use el CLI. */
        CODEX("");

        private final String defaultModel;

        AiProvider(String defaultModel) {
            this.defaultModel = defaultModel;
        }

        public String defaultModel() {
            return defaultModel;
        }

        /** true si habla con un CLI instalado en el PC en lugar de con una API con clave. */
        public boolean usesLocalCli() {
            return this == CLAUDE_CODE || this == CODEX;
        }
    }

    /**
     * Vacío si el usuario no ha configurado la IA en este PC (faltan cabeceras).
     */
    public static Optional<AiCredentials> fromHeaders(String provider, String model, String apiKey) {
        Optional<AiProvider> parsed = parseProvider(provider);
        if (parsed.isEmpty()) {
            return Optional.empty();
        }
        boolean hasKey = apiKey != null && !apiKey.isBlank();
        if (!parsed.get().usesLocalCli() && !hasKey) {
            return Optional.empty();
        }
        String resolvedModel = model == null || model.isBlank() ? parsed.get().defaultModel() : model.trim();
        return Optional.of(new AiCredentials(parsed.get(), resolvedModel, hasKey ? apiKey.trim() : ""));
    }

    public static Optional<AiProvider> parseProvider(String provider) {
        if (provider == null || provider.isBlank()) {
            return Optional.empty();
        }
        try {
            return Optional.of(AiProvider.valueOf(provider.trim().toUpperCase(Locale.ROOT)));
        } catch (IllegalArgumentException e) {
            return Optional.empty();
        }
    }

    @Override
    public String toString() {
        // Que la clave no acabe nunca en un log por un toString implícito.
        return "AiCredentials[provider=" + provider + ", model=" + model + "]";
    }
}
