package net.tfg.tfgapp.service;

import net.tfg.tfgapp.DTOs.events.CalendarEventView;
import net.tfg.tfgapp.domains.*;
import net.tfg.tfgapp.repos.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.Comparator;
import java.util.List;

/**
 * Resume en texto los datos del usuario que el asistente necesita para responder sobre
 * él en concreto: hábitos, objetivos, próximos eventos, tareas, notas recientes y lo que
 * ha ido recordando. Se manda como parte del prompt de sistema en cada mensaje.
 */
@Service
public class AiContextService {
    private static final int UPCOMING_EVENT_DAYS = 7;
    private static final int MAX_NOTES = 15;
    private static final int MAX_NOTE_CHARS = 400;
    private static final int MAX_PENDING_TODOS = 30;
    private static final DateTimeFormatter DATE_TIME = DateTimeFormatter.ofPattern("EEE yyyy-MM-dd HH:mm");

    private final HabitRepo habitRepo;
    private final GoalRepo goalRepo;
    private final TodoItemRepo todoItemRepo;
    private final NoteRepo noteRepo;
    private final AiMemoryRepo aiMemoryRepo;
    private final EventSeriesService eventSeriesService;

    public AiContextService(HabitRepo habitRepo, GoalRepo goalRepo, TodoItemRepo todoItemRepo, NoteRepo noteRepo,
                            AiMemoryRepo aiMemoryRepo, EventSeriesService eventSeriesService) {
        this.habitRepo = habitRepo;
        this.goalRepo = goalRepo;
        this.todoItemRepo = todoItemRepo;
        this.noteRepo = noteRepo;
        this.aiMemoryRepo = aiMemoryRepo;
        this.eventSeriesService = eventSeriesService;
    }

    @Transactional(readOnly = true)
    public String describe(User user) {
        StringBuilder out = new StringBuilder();
        out.append("Username: ").append(user.getUsername()).append('\n');
        out.append("Now: ").append(LocalDateTime.now().format(DATE_TIME)).append("\n\n");

        appendHabits(out, user);
        appendGoals(out, user);
        appendEvents(out, user);
        appendTodos(out, user);
        appendNotes(out, user);
        appendMemories(out, user);
        return out.toString();
    }

    private void appendHabits(StringBuilder out, User user) {
        List<Habit> habits = habitRepo.findByUserUsernameAndActiveTrue(user.getUsername());
        out.append("## Habits\n");
        if (habits.isEmpty()) {
            out.append("(none)\n");
        }
        for (Habit habit : habits) {
            out.append("- ").append(habit.getTitulo())
                    .append(" (current streak ").append(habit.getCurrentStreak())
                    .append(" days, best ").append(habit.getBestStreak()).append(')');
            appendDescription(out, habit.getDescription());
            out.append('\n');
        }
        out.append('\n');
    }

    private void appendGoals(StringBuilder out, User user) {
        List<Goal> goals = goalRepo.findByUserUsername(user.getUsername()).stream()
                .filter(goal -> !Boolean.FALSE.equals(goal.getActive()))
                .toList();
        out.append("## Goals\n");
        if (goals.isEmpty()) {
            out.append("(none)\n");
        }
        for (Goal goal : goals) {
            out.append("- ").append(goal.getTitulo())
                    .append(" [status ").append(goal.getStatus())
                    .append(", priority ").append(goal.getPriority());
            if (goal.isNumeric() && goal.getValorObjetivo() != null) {
                out.append(", progress ").append(formatNumber(goal.getValorProgreso()))
                        .append('/').append(formatNumber(goal.getValorObjetivo()));
            }
            out.append(']');
            appendDescription(out, goal.getDescription());
            out.append('\n');
        }
        out.append('\n');
    }

    private void appendEvents(StringBuilder out, User user) {
        LocalDateTime from = LocalDate.now().atStartOfDay();
        LocalDateTime to = from.plusDays(UPCOMING_EVENT_DAYS);
        List<EventSeries> series = eventSeriesService.findByUsernameInRange(user.getUsername(), from, to);
        List<CalendarEventView> events = eventSeriesService.occurrencesInRange(series, from, to, user.getId()).stream()
                .sorted(Comparator.comparing(CalendarEventView::startTime))
                .toList();

        out.append("## Calendar (next ").append(UPCOMING_EVENT_DAYS).append(" days)\n");
        if (events.isEmpty()) {
            out.append("(nothing scheduled)\n");
        }
        for (CalendarEventView event : events) {
            out.append("- ").append(event.startTime().format(DATE_TIME));
            if (Boolean.TRUE.equals(event.isAllDay())) {
                out.append(" (all day)");
            }
            out.append(": ").append(event.title());
            if (event.category() != null) {
                out.append(" [").append(event.category()).append(']');
            }
            if (event.location() != null && !event.location().isBlank()) {
                out.append(" @ ").append(event.location());
            }
            appendDescription(out, event.description());
            out.append('\n');
        }
        out.append('\n');
    }

    private void appendTodos(StringBuilder out, User user) {
        List<TodoItem> pending = todoItemRepo.findByOwnerIdOrderByPositionAscIdAsc(user.getId()).stream()
                .filter(todo -> !todo.isDone())
                .limit(MAX_PENDING_TODOS)
                .toList();
        out.append("## Pending to-dos\n");
        if (pending.isEmpty()) {
            out.append("(none)\n");
        }
        pending.forEach(todo -> out.append("- ").append(todo.getTitle()).append('\n'));
        out.append('\n');
    }

    private void appendNotes(StringBuilder out, User user) {
        List<Note> notes = noteRepo.findByOwnerIdOrderByPinnedDescUpdatedAtDesc(user.getId()).stream()
                .limit(MAX_NOTES)
                .toList();
        out.append("## Notes (most recent ").append(MAX_NOTES).append(", pinned first; long ones shortened)\n");
        if (notes.isEmpty()) {
            out.append("(none)\n");
        }
        for (Note note : notes) {
            out.append("- ").append(note.getTitle().isBlank() ? "(untitled)" : note.getTitle());
            if (note.isPinned()) {
                out.append(" [pinned]");
            }
            out.append(": ").append(shorten(note.getContent(), MAX_NOTE_CHARS)).append('\n');
        }
        out.append('\n');
    }

    private void appendMemories(StringBuilder out, User user) {
        List<AiMemory> memories = aiMemoryRepo.findByOwnerIdOrderByCreatedAtAsc(user.getId());
        out.append("## Things you remember about the user (id: fact)\n");
        if (memories.isEmpty()) {
            out.append("(nothing yet)\n");
        }
        memories.forEach(memory -> out.append("- ").append(memory.getId()).append(": ").append(memory.getContent()).append('\n'));
    }

    private static void appendDescription(StringBuilder out, String description) {
        if (description != null && !description.isBlank()) {
            out.append(" — ").append(shorten(description, 200));
        }
    }

    private static String shorten(String text, int maxChars) {
        String flat = text == null ? "" : text.replaceAll("\\s+", " ").trim();
        return flat.length() <= maxChars ? flat : flat.substring(0, maxChars) + "…";
    }

    private static String formatNumber(Double value) {
        if (value == null) {
            return "0";
        }
        return value == Math.rint(value) ? String.valueOf(value.longValue()) : String.valueOf(value);
    }
}
