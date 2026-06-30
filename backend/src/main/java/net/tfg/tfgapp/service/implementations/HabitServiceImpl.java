package net.tfg.tfgapp.service.implementations;

import net.tfg.tfgapp.DTOs.objectives.HabitCompletionRequest;
import net.tfg.tfgapp.DTOs.objectives.HabitRequest;
import net.tfg.tfgapp.domains.Habit;
import net.tfg.tfgapp.domains.ObjectiveAssignment;
import net.tfg.tfgapp.domains.ObjectiveLog;
import net.tfg.tfgapp.domains.PersonalUser;
import net.tfg.tfgapp.repos.HabitRepo;
import net.tfg.tfgapp.repos.ObjectiveLogRepo;
import net.tfg.tfgapp.service.interfaces.IHabitService;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.List;

@Service
public class HabitServiceImpl extends ObjectiveServiceBase<Habit, HabitRepo> implements IHabitService {

    private final HabitRepo habitRepo;
    private final ObjectiveLogRepo objectiveLogRepo;

    public HabitServiceImpl(HabitRepo habitRepo, ObjectiveLogRepo objectiveLogRepo) {
        super(habitRepo);
        this.habitRepo = habitRepo;
        this.objectiveLogRepo = objectiveLogRepo;
    }

    /**
     * Obtiene todos los hábitos de un usuario.
     */
    @Override
    public List<Habit> getByUsername(String username) {
        List<Habit> habits = habitRepo.findByUserUsername(username);
        for (Habit habit : habits) {
            selectAssignmentByUsername(habit, username);
        }
        return habits;
    }

    /**
     * Obtiene únicamente los hábitos activos de un usuario.
     */
    @Override
    public List<Habit> getActiveHabitsByUsername(String username) {
        List<Habit> habits = habitRepo.findByUserUsernameAndActiveTrue(username);
        for (Habit habit : habits) {
            selectAssignmentByUsername(habit, username);
        }
        return habits;
    }

    /**
     * Crea un nuevo hábito asociado al usuario autenticado.
     */
    @Override
    public Habit createHabit(HabitRequest request, PersonalUser user) {
        Habit habit = new Habit();
        habit.setTitulo(request.getTitulo());
        habit.setDescription(request.getDescription());
        habit.setActive(request.getActive() == null || request.getActive());
        habit.setUser(user);
        habit.addAssignment(user, null);

        return habitRepo.save(habit);
    }

    /**
     * Actualiza los campos editables de un hábito.
     */
    @Override
    public Habit updateHabit(Habit habit, HabitRequest request) {
        habit.setTitulo(request.getTitulo());
        habit.setDescription(request.getDescription());
        habit.setActive(request.getActive() == null || request.getActive());

        return habitRepo.save(habit);
    }

    /**
     * Registra o actualiza el estado de cumplimiento de un hábito en una fecha concreta.
     */
    @Override
    public ObjectiveLog markHabitCompletion(Habit habit, HabitCompletionRequest request) {
        LocalDate targetDate = request.getDate() != null ? request.getDate() : LocalDate.now();

        ObjectiveAssignment assignment = resolveAssignment(habit);
        List<ObjectiveLog> matchingLogs = objectiveLogRepo.findLogsForAssignmentOrObjectiveOnDate(assignment.getId(), habit.getId(), targetDate);
        ObjectiveLog log;
        if (matchingLogs.isEmpty()) {
            log = new ObjectiveLog();
            log.setLogDate(targetDate);
        } else {
            log = matchingLogs.get(0);
        }

        // Si el log venía del modelo legacy (objective_id + fecha), lo enlazamos
        // a la asignación normalizada en vez de intentar insertar otro y chocar
        // contra una unique antigua que aún pueda existir en la BBDD.
        log.setObjective(habit); // legacy/trazabilidad
        log.setObjectiveAssignment(assignment);

        log.setCompleted(request.getCompleted());

        ObjectiveLog savedLog = objectiveLogRepo.save(log);
        recalculateHabitStreaks(habit);

        return savedLog;
    }

    /**
     * Recalcula las rachas de un hábito a partir de su histórico.
     */
    private void recalculateHabitStreaks(Habit habit) {
        ObjectiveAssignment assignment = resolveAssignment(habit);
        List<ObjectiveLog> logs = objectiveLogRepo.findByObjectiveAssignmentIdOrderByLogDateAsc(assignment.getId());

        if (logs.isEmpty()) {
            habit.setCurrentStreak(0);
            habit.setBestStreak(0);
            habitRepo.save(habit);
            return;
        }

        int runningStreak = 0;
        int bestStreak = 0;
        LocalDate previousDate = null;

        for (ObjectiveLog log : logs) {
            LocalDate logDate = log.getLogDate();
            boolean isCompleted = Boolean.TRUE.equals(log.getCompleted());

            if (previousDate != null && ChronoUnit.DAYS.between(previousDate, logDate) > 1) {
                runningStreak = 0;
            }

            if (isCompleted) {
                runningStreak++;
                bestStreak = Math.max(bestStreak, runningStreak);
            } else {
                runningStreak = 0;
            }

            previousDate = logDate;
        }

        int currentStreak = calculateCurrentStreakEndingToday(logs);

        habit.setCurrentStreak(currentStreak);
        habit.setBestStreak(bestStreak);
        habitRepo.save(habit);
    }

    /**
     * Calcula la racha vigente de días consecutivos completados hasta hoy.
     */
    private int calculateCurrentStreakEndingToday(List<ObjectiveLog> logs) {
        boolean hasCompletedToday = false;
        for (ObjectiveLog log : logs) {
            if (LocalDate.now().isEqual(log.getLogDate()) && Boolean.TRUE.equals(log.getCompleted())) {
                hasCompletedToday = true;
                break;
            }
        }

        int streak = 0;
        LocalDate expectedDate = hasCompletedToday ? LocalDate.now() : LocalDate.now().minusDays(1);

        for (int i = logs.size() - 1; i >= 0; i--) {
            ObjectiveLog log = logs.get(i);

            if (log.getLogDate().isAfter(expectedDate)) {
                continue;
            }

            if (!log.getLogDate().isEqual(expectedDate) || !Boolean.TRUE.equals(log.getCompleted())) {
                return streak;
            }

            streak++;
            expectedDate = expectedDate.minusDays(1);
        }

        return streak;
    }

    private void selectAssignmentByUsername(Habit habit, String username) {
        for (ObjectiveAssignment assignment : habit.getAssignments()) {
            if (assignment.getPersonalUser() != null
                    && username.equals(assignment.getPersonalUser().getUsername())) {
                habit.setCurrentAssignment(assignment);
                return;
            }
        }
    }

    private ObjectiveAssignment resolveAssignment(Habit habit) {
        if (habit.getCurrentAssignment() != null) {
            return habit.getCurrentAssignment();
        }
        if (habit.getAssignments().isEmpty()) {
            throw new IllegalStateException("El hábito no tiene asignación asociada.");
        }
        return habit.getAssignments().get(0);
    }
}
