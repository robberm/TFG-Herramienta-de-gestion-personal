package net.tfg.tfgapp.components.ai;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;

import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Llamada real a los CLI instalados en este PC (gasta un poco de la suscripción). Solo corre
 * con GMO_CLI_IT=1: {@code GMO_CLI_IT=1 ./mvnw test -Dtest=LocalCliClientIT}.
 */
@EnabledIfEnvironmentVariable(named = "GMO_CLI_IT", matches = "1")
class LocalCliClientIT {
    private final ObjectMapper objectMapper = new ObjectMapper();
    private final LocalCliClient localCliClient = new LocalCliClient(objectMapper);
    private final AiProviderClient client = new AiProviderClient(objectMapper, localCliClient);

    @ParameterizedTest
    @EnumSource(value = AiCredentials.AiProvider.class, names = {"CLAUDE_CODE", "CODEX"})
    void answersInJsonUsingTheConversationHistory(AiCredentials.AiProvider provider) {
        LocalCliClient.CliStatus status = localCliClient.status(provider);
        assertTrue(status.installed() && status.loggedIn(), provider + " no está instalado o sin sesión: " + status);

        AiCredentials credentials = AiCredentials.fromHeaders(provider.name(), "", null).orElseThrow();
        JsonNode reply = client.completeJson(credentials,
                "You are a test assistant. Respond with a single JSON object {\"reply\": string, \"color\": string} "
                        + "and nothing else. \"color\" must be the favourite colour the user mentioned earlier, in lowercase English.",
                List.of(AiProviderClient.Message.user("Mi color favorito es el verde."),
                        AiProviderClient.Message.assistant("{\"reply\": \"¡Anotado!\", \"color\": \"green\"}"),
                        AiProviderClient.Message.user("¿Cuál era mi color favorito? Responde en español.")),
                500);

        assertEquals("green", reply.path("color").asText().trim().toLowerCase());
        assertFalse(reply.path("reply").asText().isBlank());
    }
}
