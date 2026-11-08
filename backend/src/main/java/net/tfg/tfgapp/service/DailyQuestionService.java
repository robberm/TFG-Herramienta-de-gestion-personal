package net.tfg.tfgapp.service;

import com.fasterxml.jackson.databind.JsonNode;
import net.tfg.tfgapp.DTOs.ai.DailyQuestionStatus;
import net.tfg.tfgapp.DTOs.ai.DailyQuestionView;
import net.tfg.tfgapp.components.ai.AiCredentials;
import net.tfg.tfgapp.components.ai.AiProviderClient;
import net.tfg.tfgapp.components.ai.AiProviderClient.Message;
import net.tfg.tfgapp.components.ai.AiProviderException;
import net.tfg.tfgapp.domains.DailyQuestion;
import net.tfg.tfgapp.domains.LearningTopic;
import net.tfg.tfgapp.domains.User;
import net.tfg.tfgapp.exception.ApiException;
import net.tfg.tfgapp.repos.DailyQuestionRepo;
import net.tfg.tfgapp.repos.LearningTopicRepo;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.*;
import java.util.stream.Collectors;

/**
 * Pregunta diaria con repaso espaciado. Cada día se hace una sola pregunta:
 * <ol>
 *   <li>si hay una pregunta antigua cuyo repaso toca (curva del olvido), se repite esa;</li>
 *   <li>si no, se genera una nueva del tema que más tiempo lleva sin salir.</li>
 * </ol>
 * La IA corrige la respuesta con una nota de 0 a 5 y esa nota alimenta SM-2, que decide
 * cuándo volver a preguntarla: pronto si se falló, cada vez más espaciado si se acierta.
 */
@Service
public class DailyQuestionService {
    private static final Logger log = LoggerFactory.getLogger(DailyQuestionService.class);

    public static final List<String> DEFAULT_TOPICS = List.of("Culture", "Coding", "Technology", "History");
    private static final int MAX_TOPICS = 12;
    private static final int MAX_TOPIC_LENGTH = 60;
    private static final int MAX_ANSWER_LENGTH = 2000;
    private static final int RECENT_QUESTIONS_TO_AVOID = 25;
    private static final int TOPIC_ROTATION_WINDOW = 60;
    /** Con un intervalo mayor la pregunta se da por aprendida y deja de repasarse. */
    private static final int MASTERED_INTERVAL_DAYS = 180;
    private static final int MAX_TOKENS = 2000;

    private static final String GENERATE_PROMPT = """
            You write one daily self-study question for a learner who wants to keep educating
            themselves. Topic: %s.
            Requirements:
            - A factual question with a clear answer that can be written in one to three sentences.
            - No multiple choice, no yes/no, no opinions. Interesting rather than trivial; moderate difficulty.
            - Different from these recent questions: %s
            - Write the question and the answer in %s.
            Respond with a single JSON object and nothing else:
            {"question": "<question>", "answer": "<concise model answer>"}
            """;

    private static final String GRADE_PROMPT = """
            You grade a learner's answer to a self-study question. Be lenient about wording and
            spelling, strict about facts.
            Score from 0 to 5: 5 = fully correct; 4 = correct with a minor gap; 3 = mostly correct
            but missing something important; 2 = partly right; 1 = wrong but related; 0 = wrong or blank.
            Write the feedback in %s, at most three sentences, encouraging and specific: say what
            was right, what was missing and the key fact to remember.
            Respond with a single JSON object and nothing else:
            {"score": <0-5>, "feedback": "<feedback>"}
            """;

    private final DailyQuestionRepo questionRepo;
    private final LearningTopicRepo topicRepo;
    private final AiProviderClient aiProviderClient;

    public DailyQuestionService(DailyQuestionRepo questionRepo, LearningTopicRepo topicRepo,
                                AiProviderClient aiProviderClient) {
        this.questionRepo = questionRepo;
        this.topicRepo = topicRepo;
        this.aiProviderClient = aiProviderClient;
    }

    /**
     * Devuelve (y si hace falta crea) la pregunta de hoy. synchronized: al abrir la app varias
     * pantallas pueden pedirla a la vez y no se debe llamar a la IA dos veces.
     */
    public synchronized DailyQuestionStatus today(User user, Optional<AiCredentials> credentials, String language) {
        LocalDate today = LocalDate.now();
        Optional<DailyQuestion> existing = questionRepo.findByOwnerIdAndAskedOn(user.getId(), today);
        if (existing.isPresent()) {
            return DailyQuestionStatus.of(DailyQuestionView.of(existing.get()));
        }

        // Una pregunta de otro día que se quedó sin contestar (se cerró la app) pasa a ser la de hoy.
        Optional<DailyQuestion> leftover = questionRepo.findFirstByOwnerIdAndAnsweredAtIsNullOrderByAskedOnDesc(user.getId());
        if (leftover.isPresent()) {
            DailyQuestion carried = leftover.get();
            carried.setAskedOn(today);
            return DailyQuestionStatus.of(DailyQuestionView.of(questionRepo.save(carried)));
        }

        if (credentials.isEmpty()) {
            return DailyQuestionStatus.notConfigured();
        }

        Optional<DailyQuestion> due = questionRepo
                .findByOwnerIdAndNextReviewOnLessThanEqualOrderByNextReviewOnAsc(user.getId(), today, PageRequest.of(0, 1))
                .stream().findFirst();
        if (due.isPresent()) {
            return DailyQuestionStatus.of(DailyQuestionView.of(scheduleReview(due.get(), today)));
        }

        try {
            return DailyQuestionStatus.of(DailyQuestionView.of(generate(user, credentials.get(), today, language)));
        } catch (AiProviderException e) {
            log.warn("No se pudo generar la pregunta diaria ({}): {}", e.getKind(), e.getMessage());
            return DailyQuestionStatus.unavailable(e.getMessage());
        }
    }

    /**
     * Guarda la respuesta. Si la IA no puede corregirla, la respuesta se acepta igualmente
     * (no se bloquea al usuario) y la pregunta se repite mañana. Sin @Transactional para no
     * retener una conexión mientras corrige la IA.
     */
    public DailyQuestionView answer(User user, Optional<AiCredentials> credentials, Long id, String rawAnswer,
                                    String language) {
        DailyQuestion question = questionRepo.findByIdAndOwnerId(id, user.getId())
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "ai.questionNotFound"));
        if (question.isAnswered()) {
            throw new ApiException(HttpStatus.CONFLICT, "ai.questionAnswered");
        }
        String answer = rawAnswer == null ? "" : rawAnswer.trim();
        if (answer.isEmpty()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "ai.answerEmpty");
        }
        if (answer.length() > MAX_ANSWER_LENGTH) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "ai.answerTooLong");
        }

        question.setUserAnswer(answer);
        question.setAnsweredAt(LocalDateTime.now());
        Integer score = credentials.flatMap(value -> grade(value, question, answer, language)).orElse(null);
        question.setScore(score);
        applySpacedRepetition(question, score, LocalDate.now());
        return DailyQuestionView.of(questionRepo.save(question));
    }

    public List<DailyQuestionView> history(User user, int limit) {
        return questionRepo.findByOwnerIdOrderByAskedOnDesc(user.getId(), PageRequest.of(0, limit)).stream()
                .map(DailyQuestionView::of)
                .toList();
    }

    public List<String> topics(User user) {
        List<String> stored = topicRepo.findByOwnerIdOrderByIdAsc(user.getId()).stream()
                .map(LearningTopic::getName)
                .toList();
        return stored.isEmpty() ? DEFAULT_TOPICS : stored;
    }

    @Transactional
    public List<String> replaceTopics(User user, List<String> rawTopics) {
        LinkedHashSet<String> topics = new LinkedHashSet<>();
        for (String raw : rawTopics == null ? List.<String>of() : rawTopics) {
            String topic = raw == null ? "" : raw.trim().replaceAll("\\s+", " ");
            if (topic.isEmpty()) {
                continue;
            }
            if (topic.length() > MAX_TOPIC_LENGTH) {
                throw new ApiException(HttpStatus.BAD_REQUEST, "ai.topicTooLong");
            }
            topics.add(topic);
        }
        if (topics.isEmpty()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "ai.topicsEmpty");
        }
        if (topics.size() > MAX_TOPICS) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "ai.topicsTooMany");
        }

        topicRepo.deleteAll(topicRepo.findByOwnerIdOrderByIdAsc(user.getId()));
        topicRepo.flush();
        for (String name : topics) {
            LearningTopic topic = new LearningTopic();
            topic.setOwner(user);
            topic.setName(name);
            topicRepo.save(topic);
        }
        return List.copyOf(topics);
    }

    private DailyQuestion scheduleReview(DailyQuestion due, LocalDate today) {
        DailyQuestion review = new DailyQuestion();
        review.setOwner(due.getOwner());
        review.setAskedOn(today);
        review.setTopic(due.getTopic());
        review.setQuestion(due.getQuestion());
        review.setReferenceAnswer(due.getReferenceAnswer());
        review.setRepetitions(due.getRepetitions());
        review.setIntervalDays(due.getIntervalDays());
        review.setEaseFactor(due.getEaseFactor());
        review.setReviewOf(due.getReviewOf() != null ? due.getReviewOf() : due);
        DailyQuestion saved = questionRepo.save(review);

        // La fila nueva pasa a ser la "viva" de la cadena.
        due.setNextReviewOn(null);
        questionRepo.save(due);
        return saved;
    }

    private DailyQuestion generate(User user, AiCredentials credentials, LocalDate today, String language) {
        String topic = nextTopic(user);
        List<String> recent = questionRepo.findByOwnerIdAndTopicOrderByAskedOnDesc(
                        user.getId(), topic, PageRequest.of(0, RECENT_QUESTIONS_TO_AVOID)).stream()
                .map(DailyQuestion::getQuestion)
                .toList();
        String avoid = recent.isEmpty() ? "(none)" : recent.stream().map(q -> "\"" + q + "\"").collect(Collectors.joining("; "));

        JsonNode response = aiProviderClient.completeJson(credentials,
                GENERATE_PROMPT.formatted(topic, avoid, languageName(language)),
                List.of(Message.user("Write today's question.")), MAX_TOKENS);
        String questionText = limit(response.path("question").asText("").trim(), 1000);
        String answer = limit(response.path("answer").asText("").trim(), 2000);
        if (questionText.isEmpty() || answer.isEmpty()) {
            throw new AiProviderException(AiProviderException.Kind.BAD_RESPONSE, "La IA no devolvió pregunta y respuesta.");
        }

        DailyQuestion question = new DailyQuestion();
        question.setOwner(user);
        question.setAskedOn(today);
        question.setTopic(topic);
        question.setQuestion(questionText);
        question.setReferenceAnswer(answer);
        return questionRepo.save(question);
    }

    /** El tema que más tiempo lleva sin preguntarse (los que nunca han salido, primero). */
    private String nextTopic(User user) {
        List<String> topics = topics(user);
        Map<String, LocalDate> lastAsked = new HashMap<>();
        for (DailyQuestion question : questionRepo.findByOwnerIdOrderByAskedOnDesc(
                user.getId(), PageRequest.of(0, TOPIC_ROTATION_WINDOW))) {
            lastAsked.putIfAbsent(question.getTopic(), question.getAskedOn());
        }
        return topics.stream()
                .min(Comparator.comparing((String topic) -> lastAsked.getOrDefault(topic, LocalDate.MIN)))
                .orElse(DEFAULT_TOPICS.get(0));
    }

    private Optional<Integer> grade(AiCredentials credentials, DailyQuestion question, String answer, String language) {
        String exchange = "Question: " + question.getQuestion()
                + "\nModel answer: " + question.getReferenceAnswer()
                + "\nLearner's answer: " + answer;
        try {
            JsonNode response = aiProviderClient.completeJson(credentials,
                    GRADE_PROMPT.formatted(languageName(language)), List.of(Message.user(exchange)), MAX_TOKENS);
            JsonNode score = response.path("score");
            if (!score.isNumber()) {
                throw new AiProviderException(AiProviderException.Kind.BAD_RESPONSE, "La corrección no trae nota.");
            }
            question.setFeedback(limit(response.path("feedback").asText("").trim(), 2000));
            return Optional.of(Math.max(0, Math.min(5, score.asInt())));
        } catch (AiProviderException e) {
            log.warn("No se pudo corregir la pregunta diaria ({}): {}", e.getKind(), e.getMessage());
            return Optional.empty();
        }
    }

    /**
     * SM-2 (SuperMemo 2). Con nota >= 3 el intervalo crece (1 día, 6 días y luego
     * intervalo × facilidad); con nota < 3 se vuelve a empezar desde mañana. La
     * facilidad sube o baja según lo fácil que resultó.
     */
    static void applySpacedRepetition(DailyQuestion question, Integer score, LocalDate today) {
        if (score == null) {
            // Sin corrección no se sabe si se acertó: se repite mañana sin tocar el progreso.
            question.setIntervalDays(1);
            question.setNextReviewOn(today.plusDays(1));
            return;
        }

        if (score >= 3) {
            int interval = switch (question.getRepetitions()) {
                case 0 -> 1;
                case 1 -> 6;
                default -> (int) Math.round(question.getIntervalDays() * question.getEaseFactor());
            };
            question.setRepetitions(question.getRepetitions() + 1);
            question.setIntervalDays(interval);
        } else {
            question.setRepetitions(0);
            question.setIntervalDays(1);
        }

        int distance = 5 - score;
        double ease = question.getEaseFactor() + (0.1 - distance * (0.08 + distance * 0.02));
        question.setEaseFactor(Math.max(1.3, ease));
        question.setNextReviewOn(question.getIntervalDays() > MASTERED_INTERVAL_DAYS
                ? null
                : today.plusDays(question.getIntervalDays()));
    }

    private static String languageName(String language) {
        return "es".equals(language) ? "Spanish" : "English";
    }

    private static String limit(String text, int max) {
        return text.length() <= max ? text : text.substring(0, max);
    }
}
