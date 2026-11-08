package net.tfg.tfgapp.DTOs.ai;

import net.tfg.tfgapp.domains.DailyQuestion;

import java.time.LocalDate;

/**
 * Lo que ve el frontend de una pregunta diaria. La respuesta de referencia solo se
 * incluye cuando el usuario ya ha contestado.
 */
public record DailyQuestionView(
        Long id,
        LocalDate askedOn,
        String topic,
        String question,
        boolean review,
        boolean answered,
        String userAnswer,
        Integer score,
        String feedback,
        String referenceAnswer,
        LocalDate nextReviewOn
) {
    public static DailyQuestionView of(DailyQuestion question) {
        boolean answered = question.isAnswered();
        return new DailyQuestionView(
                question.getId(),
                question.getAskedOn(),
                question.getTopic(),
                question.getQuestion(),
                question.isReview(),
                answered,
                question.getUserAnswer(),
                question.getScore(),
                question.getFeedback(),
                answered ? question.getReferenceAnswer() : null,
                question.getNextReviewOn());
    }
}
