package net.tfg.tfgapp.service;

import net.tfg.tfgapp.DTOs.ai.DailyQuestionStatus;
import net.tfg.tfgapp.components.ai.AiCredentials;
import net.tfg.tfgapp.components.ai.AiProviderClient;
import net.tfg.tfgapp.components.ai.AiProviderException;
import net.tfg.tfgapp.domains.DailyQuestion;
import net.tfg.tfgapp.domains.PersonalUser;
import net.tfg.tfgapp.repos.DailyQuestionRepo;
import net.tfg.tfgapp.repos.LearningTopicRepo;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class DailyQuestionServiceTest {
    private static final LocalDate TODAY = LocalDate.of(2026, 11, 1);

    @Mock
    private DailyQuestionRepo questionRepo;
    @Mock
    private LearningTopicRepo topicRepo;
    @Mock
    private AiProviderClient aiProviderClient;

    private DailyQuestionService service;
    private PersonalUser user;

    @BeforeEach
    void setUp() {
        service = new DailyQuestionService(questionRepo, topicRepo, aiProviderClient);
        user = new PersonalUser();
        user.setId(7L);
        user.setUsername("rob");
    }

    @Test
    void correctAnswersSpaceReviewsOutFollowingSm2() {
        DailyQuestion question = new DailyQuestion();

        DailyQuestionService.applySpacedRepetition(question, 5, TODAY);
        assertThat(question.getIntervalDays()).isEqualTo(1);
        assertThat(question.getNextReviewOn()).isEqualTo(TODAY.plusDays(1));

        DailyQuestionService.applySpacedRepetition(question, 5, TODAY);
        assertThat(question.getIntervalDays()).isEqualTo(6);

        DailyQuestionService.applySpacedRepetition(question, 5, TODAY);
        // 6 días × facilidad 2.7 (2.5 + 0.1 por cada uno de los dos aciertos perfectos previos) = 16.2 → 16
        assertThat(question.getIntervalDays()).isEqualTo(16);
        assertThat(question.getRepetitions()).isEqualTo(3);
    }

    @Test
    void wrongAnswerRestartsTheScheduleAndLowersEase() {
        DailyQuestion question = new DailyQuestion();
        question.setRepetitions(3);
        question.setIntervalDays(17);

        DailyQuestionService.applySpacedRepetition(question, 1, TODAY);

        assertThat(question.getRepetitions()).isZero();
        assertThat(question.getIntervalDays()).isEqualTo(1);
        assertThat(question.getNextReviewOn()).isEqualTo(TODAY.plusDays(1));
        assertThat(question.getEaseFactor()).isLessThan(DailyQuestion.INITIAL_EASE);
    }

    @Test
    void easeNeverDropsBelowMinimum() {
        DailyQuestion question = new DailyQuestion();
        for (int i = 0; i < 10; i++) {
            DailyQuestionService.applySpacedRepetition(question, 0, TODAY);
        }
        assertThat(question.getEaseFactor()).isEqualTo(1.3);
    }

    @Test
    void ungradedAnswerIsRepeatedTomorrowWithoutTouchingProgress() {
        DailyQuestion question = new DailyQuestion();
        question.setRepetitions(2);
        question.setIntervalDays(6);

        DailyQuestionService.applySpacedRepetition(question, null, TODAY);

        assertThat(question.getRepetitions()).isEqualTo(2);
        assertThat(question.getEaseFactor()).isEqualTo(DailyQuestion.INITIAL_EASE);
        assertThat(question.getNextReviewOn()).isEqualTo(TODAY.plusDays(1));
    }

    @Test
    void masteredQuestionStopsBeingReviewed() {
        DailyQuestion question = new DailyQuestion();
        question.setRepetitions(5);
        question.setIntervalDays(100);

        DailyQuestionService.applySpacedRepetition(question, 5, TODAY);

        assertThat(question.getIntervalDays()).isGreaterThan(180);
        assertThat(question.getNextReviewOn()).isNull();
    }

    @Test
    void withoutAiConfiguredTheAppIsNotLocked() {
        when(questionRepo.findByOwnerIdAndAskedOn(anyLong(), any())).thenReturn(Optional.empty());
        when(questionRepo.findFirstByOwnerIdAndAnsweredAtIsNullOrderByAskedOnDesc(anyLong())).thenReturn(Optional.empty());

        DailyQuestionStatus status = service.today(user, Optional.empty(), "en");

        assertThat(status.state()).isEqualTo(DailyQuestionStatus.State.NOT_CONFIGURED);
        verify(aiProviderClient, never()).completeJson(any(), anyString(), anyList(), anyInt());
    }

    @Test
    void providerFailureDoesNotLockTheApp() {
        when(questionRepo.findByOwnerIdAndAskedOn(anyLong(), any())).thenReturn(Optional.empty());
        when(questionRepo.findFirstByOwnerIdAndAnsweredAtIsNullOrderByAskedOnDesc(anyLong())).thenReturn(Optional.empty());
        when(questionRepo.findByOwnerIdAndNextReviewOnLessThanEqualOrderByNextReviewOnAsc(anyLong(), any(), any()))
                .thenReturn(List.of());
        lenient().when(questionRepo.findByOwnerIdOrderByAskedOnDesc(anyLong(), any())).thenReturn(List.of());
        lenient().when(questionRepo.findByOwnerIdAndTopicOrderByAskedOnDesc(anyLong(), anyString(), any())).thenReturn(List.of());
        when(topicRepo.findByOwnerIdOrderByIdAsc(anyLong())).thenReturn(List.of());
        when(aiProviderClient.completeJson(any(), anyString(), anyList(), anyInt()))
                .thenThrow(new AiProviderException(AiProviderException.Kind.UNAVAILABLE, "offline"));

        AiCredentials credentials = new AiCredentials(AiCredentials.AiProvider.OPENAI, "gpt-4.1-mini", "sk-test");
        DailyQuestionStatus status = service.today(user, Optional.of(credentials), "en");

        assertThat(status.state()).isEqualTo(DailyQuestionStatus.State.UNAVAILABLE);
    }
}
