package net.tfg.tfgapp.controller;

import net.tfg.tfgapp.DTOs.ai.*;
import net.tfg.tfgapp.components.ai.AiCredentials;
import net.tfg.tfgapp.components.ai.AiProviderClient;
import net.tfg.tfgapp.domains.AiChatMessage;
import net.tfg.tfgapp.domains.AiMemory;
import net.tfg.tfgapp.domains.User;
import net.tfg.tfgapp.exception.ApiException;
import net.tfg.tfgapp.security.JwtUtil;
import net.tfg.tfgapp.service.AiAssistantService;
import net.tfg.tfgapp.service.DailyQuestionService;
import net.tfg.tfgapp.service.UserService;
import net.tfg.tfgapp.xi18n.LanguageResolver;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.Optional;

/**
 * Asistente de IA y pregunta diaria. Las credenciales del proveedor llegan por las
 * cabeceras X-AI-* en cada petición (ver {@link AiCredentials}).
 */
@RestController
@RequestMapping("ai")
public class AiController {
    private static final int QUESTION_HISTORY_SIZE = 30;

    private final AiAssistantService assistantService;
    private final DailyQuestionService dailyQuestionService;
    private final AiProviderClient aiProviderClient;
    private final LanguageResolver languageResolver;
    private final JwtUtil jwtUtil;
    private final UserService userService;

    public AiController(AiAssistantService assistantService, DailyQuestionService dailyQuestionService,
                        AiProviderClient aiProviderClient, LanguageResolver languageResolver, JwtUtil jwtUtil,
                        UserService userService) {
        this.assistantService = assistantService;
        this.dailyQuestionService = dailyQuestionService;
        this.aiProviderClient = aiProviderClient;
        this.languageResolver = languageResolver;
        this.jwtUtil = jwtUtil;
        this.userService = userService;
    }

    /** Comprueba que la clave y el modelo funcionan con una llamada mínima. */
    @PostMapping("/test")
    public Map<String, Object> test(@RequestHeader("Authorization") String authorization,
                                    @RequestHeader(value = AiCredentials.PROVIDER_HEADER, required = false) String provider,
                                    @RequestHeader(value = AiCredentials.MODEL_HEADER, required = false) String model,
                                    @RequestHeader(value = AiCredentials.KEY_HEADER, required = false) String apiKey) {
        currentUser(authorization);
        AiCredentials credentials = requireCredentials(provider, model, apiKey);
        aiProviderClient.completeJson(credentials, "Respond with the JSON object {\"ok\": true} and nothing else.",
                List.of(AiProviderClient.Message.user("ping")), 1000);
        return Map.of("ok", true, "provider", credentials.provider(), "model", credentials.model());
    }

    // ---------- Pregunta diaria ----------

    @GetMapping("/daily-question")
    public DailyQuestionStatus todayQuestion(@RequestHeader("Authorization") String authorization,
                                             @RequestHeader(value = "Accept-Language", required = false) String language,
                                             @RequestHeader(value = AiCredentials.PROVIDER_HEADER, required = false) String provider,
                                             @RequestHeader(value = AiCredentials.MODEL_HEADER, required = false) String model,
                                             @RequestHeader(value = AiCredentials.KEY_HEADER, required = false) String apiKey) {
        return dailyQuestionService.today(currentUser(authorization),
                AiCredentials.fromHeaders(provider, model, apiKey), languageResolver.resolveLanguage(language));
    }

    @PostMapping("/daily-question/{id}/answer")
    public DailyQuestionView answer(@PathVariable Long id, @RequestBody AiTextRequest request,
                                    @RequestHeader("Authorization") String authorization,
                                    @RequestHeader(value = "Accept-Language", required = false) String language,
                                    @RequestHeader(value = AiCredentials.PROVIDER_HEADER, required = false) String provider,
                                    @RequestHeader(value = AiCredentials.MODEL_HEADER, required = false) String model,
                                    @RequestHeader(value = AiCredentials.KEY_HEADER, required = false) String apiKey) {
        return dailyQuestionService.answer(currentUser(authorization), AiCredentials.fromHeaders(provider, model, apiKey),
                id, request.getText(), languageResolver.resolveLanguage(language));
    }

    @GetMapping("/daily-question/history")
    public List<DailyQuestionView> questionHistory(@RequestHeader("Authorization") String authorization) {
        return dailyQuestionService.history(currentUser(authorization), QUESTION_HISTORY_SIZE);
    }

    @GetMapping("/topics")
    public List<String> topics(@RequestHeader("Authorization") String authorization) {
        return dailyQuestionService.topics(currentUser(authorization));
    }

    @PutMapping("/topics")
    public List<String> replaceTopics(@RequestBody TopicsRequest request,
                                      @RequestHeader("Authorization") String authorization) {
        return dailyQuestionService.replaceTopics(currentUser(authorization), request.getTopics());
    }

    // ---------- Chat ----------

    @GetMapping("/chat")
    public List<AiChatMessage> chatHistory(@RequestHeader("Authorization") String authorization) {
        return assistantService.history(currentUser(authorization));
    }

    @PostMapping("/chat")
    public ChatReply chat(@RequestBody AiTextRequest request,
                          @RequestHeader("Authorization") String authorization,
                          @RequestHeader(value = AiCredentials.PROVIDER_HEADER, required = false) String provider,
                          @RequestHeader(value = AiCredentials.MODEL_HEADER, required = false) String model,
                          @RequestHeader(value = AiCredentials.KEY_HEADER, required = false) String apiKey) {
        return assistantService.chat(currentUser(authorization), requireCredentials(provider, model, apiKey),
                request.getText());
    }

    @DeleteMapping("/chat")
    public ResponseEntity<Void> clearChat(@RequestHeader("Authorization") String authorization) {
        assistantService.clearHistory(currentUser(authorization));
        return ResponseEntity.noContent().build();
    }

    // ---------- Memoria ----------

    @GetMapping("/memories")
    public List<AiMemory> memories(@RequestHeader("Authorization") String authorization) {
        return assistantService.memories(currentUser(authorization));
    }

    @DeleteMapping("/memories/{id}")
    public ResponseEntity<Void> deleteMemory(@PathVariable Long id, @RequestHeader("Authorization") String authorization) {
        assistantService.deleteMemory(currentUser(authorization), id);
        return ResponseEntity.noContent().build();
    }

    @DeleteMapping("/memories")
    public ResponseEntity<Void> clearMemories(@RequestHeader("Authorization") String authorization) {
        assistantService.clearMemories(currentUser(authorization));
        return ResponseEntity.noContent().build();
    }

    private static AiCredentials requireCredentials(String provider, String model, String apiKey) {
        Optional<AiCredentials> credentials = AiCredentials.fromHeaders(provider, model, apiKey);
        return credentials.orElseThrow(() -> new ApiException(HttpStatus.PRECONDITION_REQUIRED, "ai.notConfigured"));
    }

    private User currentUser(String authorization) {
        String username = jwtUtil.extractUsernameFromAuthorizationHeader(authorization);
        User user = userService.getUserByUsername(username);
        if (user == null) {
            throw new ApiException(HttpStatus.UNAUTHORIZED, "Usuario no encontrado.");
        }
        return user;
    }
}
