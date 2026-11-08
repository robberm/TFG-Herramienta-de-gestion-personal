package net.tfg.tfgapp.components.ai;

import java.util.Locale;
import java.util.Optional;

/**
 * Proveedor, modelo y clave de API elegidos por el usuario. La clave se guarda cifrada
 * en su PC (Electron safeStorage) y llega en cada petición por cabecera: el backend
 * nunca la persiste ni la registra en logs.
 */
public record AiCredentials(AiProvider provider, String model, String apiKey) {
    public static final String PROVIDER_HEADER = "X-AI-Provider";
    public static final String MODEL_HEADER = "X-AI-Model";
    public static final String KEY_HEADER = "X-AI-Key";

    public enum AiProvider {
        OPENAI("gpt-4.1-mini"),
        ANTHROPIC("claude-opus-5-5"),
        GEMINI("gemini-2.5-flash");

        private final String defaultModel;

        AiProvider(String defaultModel) {
            this.defaultModel = defaultModel;
        }

        public String defaultModel() {
            return defaultModel;
        }
    }

    /**
     * Vacío si el usuario no ha configurado la IA en este PC (faltan cabeceras).
     */
    public static Optional<AiCredentials> fromHeaders(String provider, String model, String apiKey) {
        if (provider == null || provider.isBlank() || apiKey == null || apiKey.isBlank()) {
            return Optional.empty();
        }
        AiProvider parsed;
        try {
            parsed = AiProvider.valueOf(provider.trim().toUpperCase(Locale.ROOT));
        } catch (IllegalArgumentException e) {
            return Optional.empty();
        }
        String resolvedModel = model == null || model.isBlank() ? parsed.defaultModel() : model.trim();
        return Optional.of(new AiCredentials(parsed, resolvedModel, apiKey.trim()));
    }

    @Override
    public String toString() {
        // Que la clave no acabe nunca en un log por un toString implícito.
        return "AiCredentials[provider=" + provider + ", model=" + model + "]";
    }
}
