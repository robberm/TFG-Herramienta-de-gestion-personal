package net.tfg.tfgapp.service;

import com.fasterxml.jackson.databind.JsonNode;
import net.tfg.tfgapp.DTOs.ai.ChatReply;
import net.tfg.tfgapp.components.ai.AiCredentials;
import net.tfg.tfgapp.components.ai.AiProviderClient;
import net.tfg.tfgapp.components.ai.AiProviderClient.Message;
import net.tfg.tfgapp.components.ai.AiProviderException;
import net.tfg.tfgapp.domains.AiChatMessage;
import net.tfg.tfgapp.domains.AiMemory;
import net.tfg.tfgapp.domains.User;
import net.tfg.tfgapp.exception.ApiException;
import net.tfg.tfgapp.repos.AiChatMessageRepo;
import net.tfg.tfgapp.repos.AiMemoryRepo;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

/**
 * Chat con el asistente personal. Cada mensaje lleva el contexto del usuario
 * ({@link AiContextService}) y el modelo decide qué recordar u olvidar: la memoria
 * se guarda en la BD, ligada a la cuenta.
 */
@Service
public class AiAssistantService {
    private static final int MAX_MESSAGE_LENGTH = 4000;
    private static final int HISTORY_SIZE = 20;
    private static final int MAX_MEMORIES = 100;
    private static final int MAX_MEMORY_LENGTH = 500;
    private static final int MAX_REPLY_TOKENS = 4000;

    private static final String SYSTEM_PROMPT = """
            You are the personal assistant inside GMO, a desktop productivity app. You help one
            specific user with their own habits, goals, calendar, to-dos and notes, which are
            listed below. Ground your answers in that data; when the user asks about something
            that is not there, say so instead of inventing it. Keep replies short and practical,
            in plain text (no markdown headings). Reply in the language the user writes in.

            You have a long-term memory. Add a memory only for durable facts or preferences the
            user tells you about themselves (goals, routines, interests, constraints), never for
            one-off requests or anything already visible in their data. Remove a memory when the
            user corrects it or asks you to forget it.

            Respond with a single JSON object and nothing else:
            {"reply": "<your answer>", "remember": ["<new fact>", ...], "forget": [<memory id>, ...]}
            Use empty arrays when there is nothing to remember or forget.

            # User data
            """;

    private final AiProviderClient aiProviderClient;
    private final AiContextService aiContextService;
    private final AiChatMessageRepo chatMessageRepo;
    private final AiMemoryRepo memoryRepo;

    public AiAssistantService(AiProviderClient aiProviderClient, AiContextService aiContextService,
                              AiChatMessageRepo chatMessageRepo, AiMemoryRepo memoryRepo) {
        this.aiProviderClient = aiProviderClient;
        this.aiContextService = aiContextService;
        this.chatMessageRepo = chatMessageRepo;
        this.memoryRepo = memoryRepo;
    }

    public List<AiChatMessage> history(User user) {
        List<AiChatMessage> recent = new ArrayList<>(
                chatMessageRepo.findByOwnerIdOrderByCreatedAtDescIdDesc(user.getId(), PageRequest.of(0, HISTORY_SIZE * 2)));
        Collections.reverse(recent);
        return recent;
    }

    /**
     * Si el proveedor falla no se guarda nada, para que el usuario pueda reintentar el mismo mensaje.
     * Sin @Transactional a propósito: no se retiene una conexión del pool (3) durante la llamada a la IA.
     */
    public ChatReply chat(User user, AiCredentials credentials, String rawMessage) {
        String message = rawMessage == null ? "" : rawMessage.trim();
        if (message.isEmpty()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "ai.messageEmpty");
        }
        if (message.length() > MAX_MESSAGE_LENGTH) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "ai.messageTooLong");
        }

        List<Message> conversation = new ArrayList<>();
        List<AiChatMessage> previous = new ArrayList<>(
                chatMessageRepo.findByOwnerIdOrderByCreatedAtDescIdDesc(user.getId(), PageRequest.of(0, HISTORY_SIZE)));
        Collections.reverse(previous);
        previous.forEach(item -> conversation.add(new Message(item.getRole().name(), item.getContent())));
        conversation.add(Message.user(message));

        JsonNode response = aiProviderClient.completeJson(
                credentials, SYSTEM_PROMPT + aiContextService.describe(user), firstTurnFromUser(conversation),
                MAX_REPLY_TOKENS);

        String reply = response.path("reply").asText("").trim();
        if (reply.isEmpty()) {
            throw new AiProviderException(AiProviderException.Kind.BAD_RESPONSE, "Respuesta sin texto.");
        }

        save(user, AiChatMessage.Role.user, message);
        AiChatMessage saved = save(user, AiChatMessage.Role.assistant, reply);
        forgetMemories(user, response.path("forget"));
        List<AiMemory> remembered = rememberFacts(user, response.path("remember"));
        return new ChatReply(saved, remembered);
    }

    @Transactional
    public void clearHistory(User user) {
        chatMessageRepo.deleteAll(chatMessageRepo.findByOwnerId(user.getId()));
    }

    public List<AiMemory> memories(User user) {
        return memoryRepo.findByOwnerIdOrderByCreatedAtAsc(user.getId());
    }

    public void deleteMemory(User user, Long id) {
        AiMemory memory = memoryRepo.findByIdAndOwnerId(id, user.getId())
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "ai.memoryNotFound"));
        memoryRepo.delete(memory);
    }

    @Transactional
    public void clearMemories(User user) {
        memoryRepo.deleteAll(memoryRepo.findByOwnerIdOrderByCreatedAtAsc(user.getId()));
    }

    /** Gemini y Claude exigen que la conversación empiece por un mensaje del usuario. */
    private static List<Message> firstTurnFromUser(List<Message> conversation) {
        int start = 0;
        while (start < conversation.size() && !"user".equals(conversation.get(start).role())) {
            start++;
        }
        return conversation.subList(start, conversation.size());
    }

    private AiChatMessage save(User user, AiChatMessage.Role role, String content) {
        AiChatMessage chatMessage = new AiChatMessage();
        chatMessage.setOwner(user);
        chatMessage.setRole(role);
        chatMessage.setContent(content);
        return chatMessageRepo.save(chatMessage);
    }

    private void forgetMemories(User user, JsonNode ids) {
        if (!ids.isArray()) {
            return;
        }
        for (JsonNode id : ids) {
            if (id.canConvertToLong()) {
                memoryRepo.findByIdAndOwnerId(id.asLong(), user.getId()).ifPresent(memoryRepo::delete);
            }
        }
    }

    private List<AiMemory> rememberFacts(User user, JsonNode facts) {
        List<AiMemory> remembered = new ArrayList<>();
        if (!facts.isArray()) {
            return remembered;
        }
        long stored = memoryRepo.countByOwnerId(user.getId());
        for (JsonNode fact : facts) {
            String content = fact.asText("").trim();
            if (content.isEmpty() || stored >= MAX_MEMORIES) {
                continue;
            }
            AiMemory memory = new AiMemory();
            memory.setOwner(user);
            memory.setContent(content.length() > MAX_MEMORY_LENGTH ? content.substring(0, MAX_MEMORY_LENGTH) : content);
            remembered.add(memoryRepo.save(memory));
            stored++;
        }
        return remembered;
    }
}
