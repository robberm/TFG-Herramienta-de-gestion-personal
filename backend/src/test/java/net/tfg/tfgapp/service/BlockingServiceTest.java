package net.tfg.tfgapp.service;

import net.tfg.tfgapp.components.ActiveEventScheduleCache;
import net.tfg.tfgapp.components.SessionStore;
import net.tfg.tfgapp.service.interfaces.IStorageService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.Mockito;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.messaging.simp.SimpMessageSendingOperations;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.atLeastOnce;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class BlockingServiceTest {
    private static final String FOCUS_EVENTS = "/topic/focus-events";

    @Mock
    private SimpMessageSendingOperations messagingTemplate;
    @Mock
    private ApplicationEventPublisher eventPublisher;
    @Mock
    private IStorageService storageService;
    @Mock
    private ActiveEventScheduleCache eventScheduleCache;
    @Mock
    private SessionStore sessionStore;

    private final IStorageService.Config config = new IStorageService.Config();
    private BlockingService service;

    @BeforeEach
    void setUp() {
        config.setFocusModeEnabled(true);
        config.setFocusAction("NOTIFICATION");
        config.setWorkDurationSeconds(1500);
        config.setBreakDurationSeconds(300);
        when(storageService.loadConfig()).thenReturn(config);
        service = new BlockingService(messagingTemplate, eventPublisher, storageService, eventScheduleCache, sessionStore);
    }

    @Test
    void restrictionsAreLiftedDuringBreakAndRestoredAfterIt() {
        assertThat(service.areRestrictionsEnforced()).isTrue();

        startBreak();
        assertThat(service.areRestrictionsEnforced()).isFalse();
        // El modo Focus sigue activo: solo se levanta el bloqueo.
        assertThat(service.isEffectiveFocusModeEnabled()).isTrue();

        endBreak();
        assertThat(service.areRestrictionsEnforced()).isTrue();
    }

    @Test
    void restrictionsAreNotEnforcedWhenFocusIsOff() {
        config.setFocusModeEnabled(false);

        assertThat(service.areRestrictionsEnforced()).isFalse();
    }

    @Test
    void breakNotificationCarriesPhaseAndDurationAndNoHardcodedSecondsText() {
        startBreak();

        Map<String, Object> payload = lastFocusNotification();
        assertThat(payload).containsEntry("phase", "BREAK_START").containsEntry("breakDurationSeconds", 300);
        assertThat(payload).doesNotContainKey("message");
    }

    @Test
    void endOfBreakIsNotified() {
        startBreak();
        endBreak();

        assertThat(lastFocusNotification()).containsEntry("phase", "BREAK_END");
    }

    @Test
    void endOfBreakIsNotNotifiedIfFocusIsNoLongerActive() {
        startBreak();
        config.setFocusModeEnabled(false);
        Mockito.clearInvocations(messagingTemplate);

        endBreak();

        verify(messagingTemplate, never()).convertAndSend(eq(FOCUS_EVENTS), any(Object.class));
    }

    private void startBreak() {
        ReflectionTestUtils.setField(service, "nextActionAtEpochMs", 1L);
        ReflectionTestUtils.invokeMethod(service, "checkForBlock");
    }

    private void endBreak() {
        ReflectionTestUtils.setField(service, "breakEndsAtEpochMs", 1L);
        ReflectionTestUtils.invokeMethod(service, "checkForBlock");
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> lastFocusNotification() {
        ArgumentCaptor<Object> captor = ArgumentCaptor.forClass(Object.class);
        verify(messagingTemplate, atLeastOnce()).convertAndSend(eq(FOCUS_EVENTS), captor.capture());
        return (Map<String, Object>) captor.getValue();
    }
}
