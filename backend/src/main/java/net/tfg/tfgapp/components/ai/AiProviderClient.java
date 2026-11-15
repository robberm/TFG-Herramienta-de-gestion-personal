package net.tfg.tfgapp.components.ai;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.List;
import java.util.Locale;

/**
 * Cliente mínimo para los proveedores con API que puede elegir el usuario (los de CLI local
 * se delegan en {@link LocalCliClient}). Se habla con sus
 * APIs REST directamente (sin SDKs) porque solo se necesita "prompt de sistema + mensajes
 * → texto", y así añadir un proveedor es añadir un método.
 *
 * Todas las respuestas se piden en JSON (ver {@link #completeJson}).
 */
@Component
public class AiProviderClient {
    private static final Duration CONNECT_TIMEOUT = Duration.ofSeconds(10);
    private static final Duration REQUEST_TIMEOUT = Duration.ofSeconds(90);
    private static final String ANTHROPIC_VERSION = "2026-10-21";
    private static final String ANTHROPIC_FALLBACK_BETA = "server-side-fallback-2026-07-01";

    private final ObjectMapper objectMapper;
    private final LocalCliClient localCliClient;
    private final HttpClient httpClient = HttpClient.newBuilder().connectTimeout(CONNECT_TIMEOUT).build();

    public AiProviderClient(ObjectMapper objectMapper, LocalCliClient localCliClient) {
        this.objectMapper = objectMapper;
        this.localCliClient = localCliClient;
    }

    public record Message(String role, String content) {
        public static Message user(String content) {
            return new Message("user", content);
        }

        public static Message assistant(String content) {
            return new Message("assistant", content);
        }
    }

    /**
     * Envía la conversación y devuelve la respuesta del modelo ya parseada como objeto JSON.
     * El prompt de sistema debe describir el JSON esperado.
     */
    public JsonNode completeJson(AiCredentials credentials, String system, List<Message> messages, int maxTokens) {
        String text = switch (credentials.provider()) {
            case OPENAI -> callOpenAi(credentials, system, messages, maxTokens);
            case ANTHROPIC -> callAnthropic(credentials, system, messages, maxTokens);
            case GEMINI -> callGemini(credentials, system, messages, maxTokens);
            // Los CLI no admiten un límite de tokens de salida; el prompt ya pide respuestas cortas.
            case CLAUDE_CODE, CODEX -> localCliClient.complete(credentials, system, messages);
        };
        return parseJsonObject(text);
    }

    private String callOpenAi(AiCredentials credentials, String system, List<Message> messages, int maxTokens) {
        ObjectNode body = objectMapper.createObjectNode();
        body.put("model", credentials.model());
        body.put("max_completion_tokens", maxTokens);
        body.putObject("response_format").put("type", "json_object");
        ArrayNode input = body.putArray("messages");
        input.addObject().put("role", "system").put("content", system);
        messages.forEach(message -> input.addObject().put("role", message.role()).put("content", message.content()));

        HttpRequest request = jsonPost("https://api.openai.com/v1/chat/completions", body)
                .header("Authorization", "Bearer " + credentials.apiKey())
                .build();
        JsonNode response = send(request);
        return requireText(response.at("/choices/0/message/content"));
    }

    private String callAnthropic(AiCredentials credentials, String system, List<Message> messages, int maxTokens) {
        ObjectNode body = objectMapper.createObjectNode();
        body.put("model", credentials.model());
        body.put("max_tokens", maxTokens);
        body.put("system", system);
        ArrayNode input = body.putArray("messages");
        messages.forEach(message -> input.addObject().put("role", message.role()).put("content", message.content()));

        boolean currentGeneration = isCurrentClaudeGeneration(credentials.model());
        if (currentGeneration) {
            // Preguntas cortas y chat: poco razonamiento basta y abarata cada llamada.
            body.putObject("output_config").put("effort", "low");
        }
        boolean supportsFallback = supportsServerSideFallback(credentials.model());
        if (supportsFallback) {
            // Si los clasificadores de seguridad rechazan la petición, Anthropic la reintenta
            // con el modelo recomendado en lugar de devolver el rechazo.
            body.put("fallbacks", "default");
        }

        HttpRequest.Builder builder = jsonPost("https://api.anthropic.com/v1/messages", body)
                .header("x-api-key", credentials.apiKey())
                .header("anthropic-version", ANTHROPIC_VERSION);
        if (supportsFallback) {
            builder.header("anthropic-beta", ANTHROPIC_FALLBACK_BETA);
        }
        JsonNode response = send(builder.build());

        if ("refusal".equals(response.path("stop_reason").asText())) {
            throw new AiProviderException(AiProviderException.Kind.BAD_RESPONSE, "El modelo rechazó la petición.");
        }
        // Con razonamiento activo el primer bloque puede ser "thinking": se buscan los de texto.
        StringBuilder text = new StringBuilder();
        for (JsonNode block : response.path("content")) {
            if ("text".equals(block.path("type").asText())) {
                text.append(block.path("text").asText());
            }
        }
        return requireText(objectMapper.getNodeFactory().textNode(text.toString()));
    }

    private String callGemini(AiCredentials credentials, String system, List<Message> messages, int maxTokens) {
        ObjectNode body = objectMapper.createObjectNode();
        body.putObject("systemInstruction").putArray("parts").addObject().put("text", system);
        ArrayNode contents = body.putArray("contents");
        messages.forEach(message -> {
            ObjectNode content = contents.addObject();
            content.put("role", "assistant".equals(message.role()) ? "model" : "user");
            content.putArray("parts").addObject().put("text", message.content());
        });
        ObjectNode config = body.putObject("generationConfig");
        config.put("responseMimeType", "application/json");
        config.put("maxOutputTokens", maxTokens);

        String model = URLEncoder.encode(credentials.model(), StandardCharsets.UTF_8);
        HttpRequest request = jsonPost(
                "https://generativelanguage.googleapis.com/v1beta/models/" + model + ":generateContent", body)
                .header("x-goog-api-key", credentials.apiKey())
                .build();
        JsonNode response = send(request);
        return requireText(response.at("/candidates/0/content/parts/0/text"));
    }

    /** Claude 5.x: admite output_config.effort (los 4.x antiguos, p. ej. Haiku 4.5, lo rechazan). */
    private static boolean isCurrentClaudeGeneration(String model) {
        String normalized = model.toLowerCase(Locale.ROOT);
        return normalized.matches("claude-(opus|sonnet|haiku|fable)-5.*");
    }

    /** Modelos que aceptan fallbacks: "default" en la API de Anthropic. */
    private static boolean supportsServerSideFallback(String model) {
        String normalized = model.toLowerCase(Locale.ROOT);
        return normalized.startsWith("claude-opus-5") || normalized.startsWith("claude-fable-5")
                || normalized.startsWith("claude-sonnet-5-5");
    }

    private HttpRequest.Builder jsonPost(String url, JsonNode body) {
        try {
            return HttpRequest.newBuilder(URI.create(url))
                    .timeout(REQUEST_TIMEOUT)
                    .header("Content-Type", "application/json")
                    .POST(HttpRequest.BodyPublishers.ofString(objectMapper.writeValueAsString(body)));
        } catch (IOException e) {
            throw new IllegalStateException("No se pudo serializar la petición a la IA.", e);
        }
    }

    private JsonNode send(HttpRequest request) {
        HttpResponse<String> response;
        try {
            response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
        } catch (IOException e) {
            throw new AiProviderException(AiProviderException.Kind.UNAVAILABLE,
                    "No se pudo conectar con el proveedor de IA.", e);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new AiProviderException(AiProviderException.Kind.UNAVAILABLE, "Petición a la IA interrumpida.", e);
        }

        int status = response.statusCode();
        if (status == 401 || status == 403 || status == 404) {
            throw new AiProviderException(AiProviderException.Kind.INVALID_CONFIGURATION,
                    "El proveedor rechazó la clave o el modelo (HTTP " + status + "): " + errorDetail(response.body()));
        }
        if (status == 400) {
            throw new AiProviderException(AiProviderException.Kind.INVALID_CONFIGURATION,
                    "El proveedor rechazó la petición (HTTP 400): " + errorDetail(response.body()));
        }
        if (status / 100 != 2) {
            throw new AiProviderException(AiProviderException.Kind.UNAVAILABLE,
                    "El proveedor de IA no está disponible (HTTP " + status + ").");
        }
        try {
            return objectMapper.readTree(response.body());
        } catch (IOException e) {
            throw new AiProviderException(AiProviderException.Kind.BAD_RESPONSE, "Respuesta no válida del proveedor.", e);
        }
    }

    /** Mensaje de error del proveedor (los tres usan {"error": {"message": ...}}). */
    private String errorDetail(String body) {
        try {
            JsonNode message = objectMapper.readTree(body).at("/error/message");
            if (message.isTextual()) {
                return message.asText();
            }
        } catch (IOException | RuntimeException ignored) {
            // Cuerpo no JSON: se devuelve un trozo tal cual.
        }
        return body == null ? "" : body.substring(0, Math.min(body.length(), 300));
    }

    private static String requireText(JsonNode node) {
        if (node == null || !node.isTextual() || node.asText().isBlank()) {
            throw new AiProviderException(AiProviderException.Kind.BAD_RESPONSE, "El proveedor devolvió una respuesta vacía.");
        }
        return node.asText();
    }

    /**
     * Extrae el objeto JSON de la respuesta. Claude no tiene modo JSON estricto aquí y a veces
     * lo envuelve en ```json ... ```, así que se toma del primer '{' al último '}'.
     */
    private JsonNode parseJsonObject(String text) {
        int start = text.indexOf('{');
        int end = text.lastIndexOf('}');
        if (start < 0 || end <= start) {
            throw new AiProviderException(AiProviderException.Kind.BAD_RESPONSE, "La IA no respondió en JSON.");
        }
        try {
            JsonNode node = objectMapper.readTree(text.substring(start, end + 1));
            if (!node.isObject()) {
                throw new AiProviderException(AiProviderException.Kind.BAD_RESPONSE, "La IA no respondió con un objeto JSON.");
            }
            return node;
        } catch (IOException e) {
            throw new AiProviderException(AiProviderException.Kind.BAD_RESPONSE, "La IA devolvió un JSON no válido.", e);
        }
    }
}
