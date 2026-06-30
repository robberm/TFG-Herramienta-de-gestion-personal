package net.tfg.tfgapp.service.implementations;

import net.tfg.tfgapp.DTOs.objectives.GoalProgressRequest;
import net.tfg.tfgapp.DTOs.objectives.GoalRequest;
import net.tfg.tfgapp.domains.AdminUser;
import net.tfg.tfgapp.domains.Goal;
import net.tfg.tfgapp.domains.ObjectiveAssignment;
import net.tfg.tfgapp.domains.ObjectiveLog;
import net.tfg.tfgapp.domains.PersonalUser;
import net.tfg.tfgapp.enumerates.GoalStatus;
import net.tfg.tfgapp.enumerates.ObjectivePriority;
import net.tfg.tfgapp.repos.GoalRepo;
import net.tfg.tfgapp.repos.ObjectiveLogRepo;
import net.tfg.tfgapp.service.interfaces.IGoalService;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.util.Iterator;
import java.util.List;

@Service
public class GoalServiceImpl extends ObjectiveServiceBase<Goal, GoalRepo> implements IGoalService {

    private final GoalRepo goalRepo;
    private final ObjectiveLogRepo objectiveLogRepo;

    public GoalServiceImpl(GoalRepo goalRepo, ObjectiveLogRepo objectiveLogRepo) {
        super(goalRepo);
        this.goalRepo = goalRepo;
        this.objectiveLogRepo = objectiveLogRepo;
    }

    @Override
    public List<Goal> getByUsername(String username) {
        List<Goal> goals = goalRepo.findByUserUsername(username);
        for (Goal goal : goals) {
            selectAssignmentByUsername(goal, username);
        }
        return goals;
    }

    @Override
    public Goal createGoal(GoalRequest request, PersonalUser user) {
        Goal goal = new Goal();
        applyGoalDetails(goal, request);
        goal.setUser(user);
        goal.addAssignment(user, null);

        Goal savedGoal = goalRepo.save(goal);

        if (savedGoal.isNumeric()) {
            ObjectiveLog initialLog = new ObjectiveLog();
            initialLog.setObjective(savedGoal);
            initialLog.setObjectiveAssignment(resolveAssignment(savedGoal));
            initialLog.setLogDate(LocalDate.now());
            initialLog.setProgressValue(savedGoal.getValorProgreso());
            objectiveLogRepo.save(initialLog);
        }

        return savedGoal;
    }

    @Override
    public Goal createAssignedGoal(GoalRequest request, List<PersonalUser> targets, AdminUser admin) {
        if (targets == null || targets.isEmpty()) {
            throw new IllegalArgumentException("Debes seleccionar al menos un usuario.");
        }

        Goal goal = new Goal();
        applyGoalDetails(goal, request);
        goal.setUser(targets.get(0));
        goal.setAudAdmin(admin);

        for (PersonalUser target : targets) {
            goal.addAssignment(target, admin);
        }

        Goal savedGoal = goalRepo.save(goal);
        createInitialLogsForNumericGoal(savedGoal);
        return savedGoal;
    }

    @Override
    public Goal updateGoal(Goal existingGoal, GoalRequest request) {
        applyGoalDetails(existingGoal, request);
        return goalRepo.save(existingGoal);
    }

    @Override
    public Goal updateAssignedGoal(Goal existingGoal, GoalRequest request, List<PersonalUser> targets, AdminUser admin) {
        if (targets == null || targets.isEmpty()) {
            throw new IllegalArgumentException("Debes seleccionar al menos un usuario.");
        }

        applyGoalDetails(existingGoal, request);
        existingGoal.setUser(targets.get(0));
        existingGoal.setAudAdmin(admin);
        reconcileAssignments(existingGoal, targets, admin);
        return goalRepo.save(existingGoal);
    }

    private void reconcileAssignments(Goal goal, List<PersonalUser> targets, AdminUser admin) {
        Iterator<ObjectiveAssignment> iterator = goal.getAssignments().iterator();
        while (iterator.hasNext()) {
            ObjectiveAssignment assignment = iterator.next();
            if (!containsUser(targets, assignment.getPersonalUser().getId())) {
                iterator.remove();
                continue;
            }
            syncAssignment(assignment, goal, admin);
        }

        for (PersonalUser target : targets) {
            if (findAssignmentForUser(goal, target.getId()) == null) {
                goal.addAssignment(target, admin);
            }
        }
    }

    private boolean containsUser(List<PersonalUser> targets, Long userId) {
        for (PersonalUser target : targets) {
            if (target.getId().equals(userId)) {
                return true;
            }
        }
        return false;
    }

    private ObjectiveAssignment findAssignmentForUser(Goal goal, Long userId) {
        for (ObjectiveAssignment assignment : goal.getAssignments()) {
            if (assignment.getPersonalUser().getId().equals(userId)) {
                return assignment;
            }
        }
        return null;
    }

    private void syncAssignment(ObjectiveAssignment assignment, Goal goal, AdminUser admin) {
        assignment.setAudAdmin(admin);
        assignment.setActive(goal.getActive() == null || goal.getActive());
        assignment.setStatus(goal.getStatus());
        assignment.setProgressValue(goal.getValorProgreso());
        assignment.setTargetValue(goal.getValorObjetivo());
    }

    private void createInitialLogsForNumericGoal(Goal goal) {
        if (!goal.isNumeric()) {
            return;
        }

        for (ObjectiveAssignment assignment : goal.getAssignments()) {
            ObjectiveLog initialLog = new ObjectiveLog();
            initialLog.setObjective(goal);
            initialLog.setObjectiveAssignment(assignment);
            initialLog.setLogDate(LocalDate.now());
            initialLog.setProgressValue(assignment.getProgressValue());
            objectiveLogRepo.save(initialLog);
        }
    }

    @Override
    public void applyGoalDetails(Goal goal, GoalRequest request) {
        goal.setTitulo(request.getTitulo());
        goal.setDescription(request.getDescription());
        goal.setPriority(request.getPriority() != null ? request.getPriority() : ObjectivePriority.Media);
        goal.setStatus(request.getStatus() != null ? request.getStatus() : GoalStatus.NotStarted);
        goal.setNumeric(request.isNumeric());
        goal.setActive(request.getActive() == null || request.getActive());

        if (request.isNumeric()) {
            goal.setValorObjetivo(request.getValorObjetivo());
            goal.setValorProgreso(request.getValorProgreso() != null ? request.getValorProgreso() : 0.0);
        } else {
            goal.setValorObjetivo(null);
            goal.setValorProgreso(null);
        }
    }

    @Override
    public Goal updateGoalProgress(Goal goal, GoalProgressRequest request) {
        goal.setValorProgreso(request.getValorProgreso());
        ObjectiveAssignment currentAssignment = resolveAssignment(goal);
        currentAssignment.setProgressValue(request.getValorProgreso());

        LocalDate today = LocalDate.now();
        List<ObjectiveLog> matchingLogs = objectiveLogRepo.findLogsForAssignmentOrObjectiveOnDate(resolveAssignmentId(goal), goal.getId(), today);
        ObjectiveLog log;
        if (matchingLogs.isEmpty()) {
            log = new ObjectiveLog();
            log.setLogDate(today);
        } else {
            log = matchingLogs.get(0);
        }

        // Reutilizamos logs legacy si existen para evitar duplicados por fecha y
        // los dejamos ya enlazados a la asignación normalizada.
        log.setObjective(goal); // legacy/trazabilidad
        log.setObjectiveAssignment(currentAssignment);

        log.setProgressValue(request.getValorProgreso());

        objectiveLogRepo.save(log);

        return goalRepo.save(goal);
    }

    @Override
    public List<Goal> getAssignedGoalsForAdmin(Long adminId) {
        return goalRepo.findByAssignedByAdmin_Id(adminId);
    }

    @Override
    public List<Goal> getAssignedGoalsForAdminAndUser(Long adminId, Long userId) {
        List<Goal> goals = goalRepo.findByAssignedByAdmin_IdAndUser_Id(adminId, userId);
        for (Goal goal : goals) {
            selectAssignmentByUserId(goal, userId);
        }
        return goals;
    }

    private void selectAssignmentByUsername(Goal goal, String username) {
        for (ObjectiveAssignment assignment : goal.getAssignments()) {
            if (assignment.getPersonalUser().getUsername().equals(username)) {
                goal.setCurrentAssignment(assignment);
                return;
            }
        }
    }

    private void selectAssignmentByUserId(Goal goal, Long userId) {
        for (ObjectiveAssignment assignment : goal.getAssignments()) {
            if (assignment.getPersonalUser().getId().equals(userId)) {
                goal.setCurrentAssignment(assignment);
                return;
            }
        }
    }

    private Integer resolveAssignmentId(Goal goal) {
        return resolveAssignment(goal).getId();
    }

    private ObjectiveAssignment resolveAssignment(Goal goal) {
        if (goal.getCurrentAssignment() != null) {
            return goal.getCurrentAssignment();
        }
        if (goal.getAssignments().isEmpty()) {
            throw new IllegalStateException("La meta no tiene asignación asociada.");
        }
        return goal.getAssignments().get(0);
    }
}
