package net.tfg.tfgapp.service;

import jakarta.annotation.PostConstruct;
import net.tfg.tfgapp.components.SessionStore;
import net.tfg.tfgapp.domains.Event;
import net.tfg.tfgapp.events.BlockingEvent;
import net.tfg.tfgapp.repos.EventRepo;
import net.tfg.tfgapp.service.interfaces.IStorageService;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.messaging.simp.SimpMessageSendingOperations;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.HashMap;
import java.util.Map;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;

@Service
public class BlockingService {
    private static final int DEFAULT_WORK_DURATION_SECONDS = 20 * 60;
    private static final int DEFAULT_BREAK_DURATION_SECONDS = 20;
    private static final int MIN_WORK_BREAK_GAP_SECONDS = 5;

    private final ScheduledExecutorService scheduler = Executors.newScheduledThreadPool(2);
    private final SimpMessageSendingOperations messagingTemplate;
    private final ApplicationEventPublisher eventPublisher;
    private final IStorageService storageService;
    private final EventRepo eventRepo;
    private final SessionStore sessionStore;

    private volatile boolean isBlocking = false;
    private volatile boolean isOnBreak = false;
    private volatile boolean pauseScheduledBlocks = false;
    private volatile long lastBlockTime = 0;
    private volatile long nextActionAtEpochMs = 0;
    private volatile long breakEndsAtEpochMs = 0;

    public BlockingService(SimpMessageSendingOperations messagingTemplate,
                           ApplicationEventPublisher eventPublisher,
                           IStorageService storageService,
                           EventRepo eventRepo,
                           SessionStore sessionStore) {
        this.messagingTemplate = messagingTemplate;
        this.eventPublisher = eventPublisher;
        this.storageService = storageService;
        this.eventRepo = eventRepo;
        this.sessionStore = sessionStore;
    }

    @PostConstruct
    public void init() {
        IStorageService.Config config = storageService.loadConfig();
        if (config.isFocusModeEnabled()) {
            nextActionAtEpochMs = System.currentTimeMillis() + toMillis(getWorkDurationSeconds(config));
        }

        scheduler.scheduleAtFixedRate(this::checkForBlock, 0, 1, TimeUnit.SECONDS);
    }

    private void checkForBlock() {
        long now = System.currentTimeMillis();

        if (isOnBreak) {
            if (now >= breakEndsAtEpochMs) {
                endBreak();
            }
            return;
        }

        if (!shouldStartWorkCycle()) {
            return;
        }

        // Si el ciclo acaba de activarse (por tag o toggle), programa el próximo descanso.
        if (nextActionAtEpochMs <= 0) {
            IStorageService.Config config = storageService.loadConfig();
            nextActionAtEpochMs = now + toMillis(getWorkDurationSeconds(config));
            publishFocusState();
            return;
        }

        if (now >= nextActionAtEpochMs) {
            executeFocusAction();
        }
    }


    private boolean shouldStartWorkCycle() {
        IStorageService.Config config = storageService.loadConfig();


        return !isOnBreak
                && !pauseScheduledBlocks
                && isEffectiveFocusEnabled(config);
    }

    private boolean isEffectiveFocusEnabled(IStorageService.Config config) {
        return config.isFocusModeEnabled() || isFocusModeLockedByTag();
    }


    private void executeFocusAction() {
        IStorageService.Config config = storageService.loadConfig();
        FocusAction action = FocusAction.from(config.getFocusAction());
        int breakDurationSeconds = getBreakDurationSeconds(config);

        isOnBreak = true;
        breakEndsAtEpochMs = System.currentTimeMillis() + toMillis(breakDurationSeconds);

        if (action == FocusAction.SCREEN_BLOCK) {
            startBlockingVisual(breakDurationSeconds);
        } else {
            notifyFocusBreak(breakDurationSeconds);
        }

        this.nextActionAtEpochMs = breakEndsAtEpochMs + toMillis(getWorkDurationSeconds(config));
        publishFocusState();
    }

    private void startBlockingVisual(int durationSeconds) {
        isBlocking = true;
        lastBlockTime = System.currentTimeMillis();

        eventPublisher.publishEvent(new BlockingEvent(true));
        Map<String, Object> payload = new HashMap<>();
        payload.put("type", "BLOCK_SCREEN");
        payload.put("durationSeconds", durationSeconds);
        payload.put("endsAtEpochMs", breakEndsAtEpochMs);
        messagingTemplate.convertAndSend("/topic/block", payload);

        publishFocusState();
    }

    private void notifyFocusBreak(int breakDurationSeconds) {
        Map<String, Object> payload = new HashMap<>();
        payload.put("type", "FOCUS_NOTIFICATION");
        payload.put("title", "Tiempo de descanso");
        payload.put("message", "Descansa " + breakDurationSeconds + "s y vuelve al foco.");
        payload.put("breakDurationSeconds", breakDurationSeconds);

        messagingTemplate.convertAndSend("/topic/focus-events", payload);
    }

    private void endBlocking() {
        eventPublisher.publishEvent(new BlockingEvent(false));
        isBlocking = false;
        publishFocusState();
    }

    private void endBreak() {
        isOnBreak = false;
        breakEndsAtEpochMs = 0;
        if (isBlocking) {
            endBlocking();
        } else {
            publishFocusState();
        }
    }

    public void pauseScheduledBlocks(boolean pause) {
        this.pauseScheduledBlocks = pause;
        publishFocusState();
    }

    public boolean isBlockingActive() {
        return isBlocking;
    }

    public boolean isPaused() {
        return pauseScheduledBlocks;
    }

    public void forceBlockNow(int durationSeconds) {
        if (!isOnBreak) {
            int safeDuration = Math.max(1, durationSeconds);
            isOnBreak = true;
            breakEndsAtEpochMs = System.currentTimeMillis() + toMillis(safeDuration);
            startBlockingVisual(safeDuration);
        }
    }

    public void cancelCurrentBlock() {
        if (isBlocking || isOnBreak) {
            isOnBreak = false;
            breakEndsAtEpochMs = 0;
            endBlocking();
        }
    }

    private boolean isFocusModeLockedByTag() {
        Long loggedUserId = sessionStore.getLoggedUserId();
        if (loggedUserId == null) {
            return false;
        }

        return eventRepo.existsActiveEventOfCategory(
                Event.EventCategory.FOCUS,
                Instant.now().atZone(java.time.ZoneId.systemDefault()).toLocalDateTime(),
                loggedUserId
        );
    }

    public boolean isEffectiveFocusModeEnabled() {
        IStorageService.Config config = storageService.loadConfig();
        return isEffectiveFocusEnabled(config);
    }

    public Map<String, Object> getFocusState() {
        IStorageService.Config config = storageService.loadConfig();
        boolean focusModeLockedByTag = isFocusModeLockedByTag();
        boolean effectiveFocusEnabled = config.isFocusModeEnabled() || focusModeLockedByTag;

        Map<String, Object> state = new HashMap<>();
        state.put("focusModeEnabled", effectiveFocusEnabled);
        state.put("focusModeLockedByTag", focusModeLockedByTag);
        state.put("isBlocking", isBlocking);
        state.put("isPaused", pauseScheduledBlocks);
        state.put("workDurationSeconds", getWorkDurationSeconds(config));
        state.put("breakDurationSeconds", getBreakDurationSeconds(config));
        state.put("focusAction", FocusAction.from(config.getFocusAction()).name());
        state.put("nextActionAtEpochMs", nextActionAtEpochMs);
        state.put("breakEndsAtEpochMs", breakEndsAtEpochMs);
        state.put("currentPhase", !effectiveFocusEnabled ? "OFF" : (isOnBreak ? "BREAK" : "WORK"));
        state.put("phaseEndsAtEpochMs", isOnBreak ? breakEndsAtEpochMs : nextActionAtEpochMs);
        state.put("serverTimeEpochMs", Instant.now().toEpochMilli());
        state.put("lastBlockTime", lastBlockTime);

        return state;
    }

    public void updateFocusSettings(boolean focusModeEnabled,
                                    Integer workDurationSeconds,
                                    Integer breakDurationSeconds,
                                    String action) {
        IStorageService.Config config = storageService.loadConfig();

        int sanitizedWorkDurationSeconds = sanitizeDuration(workDurationSeconds, DEFAULT_WORK_DURATION_SECONDS);
        int sanitizedBreakDurationSeconds = sanitizeDuration(breakDurationSeconds, DEFAULT_BREAK_DURATION_SECONDS);
        boolean focusModeLockedByTag = isFocusModeLockedByTag();

        if (sanitizedWorkDurationSeconds - sanitizedBreakDurationSeconds < MIN_WORK_BREAK_GAP_SECONDS) {
            sanitizedBreakDurationSeconds = Math.max(1, sanitizedWorkDurationSeconds - MIN_WORK_BREAK_GAP_SECONDS);
            if (sanitizedWorkDurationSeconds - sanitizedBreakDurationSeconds < MIN_WORK_BREAK_GAP_SECONDS) {
                sanitizedWorkDurationSeconds = sanitizedBreakDurationSeconds + MIN_WORK_BREAK_GAP_SECONDS;
            }
        }

        config.setFocusModeEnabled(focusModeEnabled);

        config.setWorkDurationSeconds(sanitizedWorkDurationSeconds);
        config.setBreakDurationSeconds(sanitizedBreakDurationSeconds);
        config.setFocusAction(FocusAction.from(action).name());

        storageService.saveConfig(config);
        boolean effectiveFocusEnabled = focusModeEnabled || focusModeLockedByTag;

        if (effectiveFocusEnabled) {
            this.nextActionAtEpochMs = System.currentTimeMillis() + toMillis(getWorkDurationSeconds(config));
        } else {
            this.nextActionAtEpochMs = 0;
            this.breakEndsAtEpochMs = 0;
            this.isOnBreak = false;
            cancelCurrentBlock();
        }

        publishFocusState();
    }

    private void publishFocusState() {
        messagingTemplate.convertAndSend("/topic/focus-state", getFocusState());
    }

    private int sanitizeDuration(Integer duration, int defaultValue) {
        if (duration == null || duration <= 0) {
            return defaultValue;
        }

        return duration;
    }

    private int getWorkDurationSeconds(IStorageService.Config config) {
        return sanitizeDuration(config.getWorkDurationSeconds(), DEFAULT_WORK_DURATION_SECONDS);
    }

    private int getBreakDurationSeconds(IStorageService.Config config) {
        return sanitizeDuration(config.getBreakDurationSeconds(), DEFAULT_BREAK_DURATION_SECONDS);
    }

    private long toMillis(int seconds) {
        return seconds * 1000L;
    }

    private enum FocusAction {
        SCREEN_BLOCK,
        NOTIFICATION;

        static FocusAction from(String value) {
            if (value == null) {
                return NOTIFICATION;
            }

            try {
                return FocusAction.valueOf(value.trim().toUpperCase());
            } catch (IllegalArgumentException ignored) {
                return NOTIFICATION;
            }
        }
    }
}
