package net.tfg.tfgapp.controller.objectives;

import net.tfg.tfgapp.DTOs.objectives.GoalProgressRequest;
import net.tfg.tfgapp.DTOs.objectives.GoalRequest;
import net.tfg.tfgapp.domains.Goal;
import net.tfg.tfgapp.domains.AdminUser;
import net.tfg.tfgapp.domains.ObjectiveAssignment;
import net.tfg.tfgapp.domains.PersonalUser;
import net.tfg.tfgapp.domains.User;
import net.tfg.tfgapp.exception.ApiException;
import net.tfg.tfgapp.xi18n.LanguageResolver;
import net.tfg.tfgapp.security.JwtUtil;
import net.tfg.tfgapp.service.interfaces.IGoalService;
import net.tfg.tfgapp.service.interfaces.IUserService;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

@RestController
@RequestMapping("/goals")
public class GoalController {

    private final IGoalService goalService;
    private final JwtUtil jwtUtil;
    private final IUserService userService;
    private final LanguageResolver languageResolver;

    public GoalController(IGoalService goalService, JwtUtil jwtUtil, IUserService userService, LanguageResolver languageResolver) {
        this.goalService = goalService;
        this.jwtUtil = jwtUtil;
        this.userService = userService;
        this.languageResolver = languageResolver;
    }

    @GetMapping
    public ResponseEntity<List<Goal>> getMyGoals(@RequestHeader("Authorization") String token,
                                        @RequestHeader(value = "Accept-Language", required = false) String language,
                                        @RequestParam(required = false) Long targetUserId) {
        User currentUser = getCurrentUser(token, language);

        if (currentUser.isAdmin()) {
            if (targetUserId != null) {
                User managedUser = userService.getUserById(targetUserId);
                if (!canAccessManagedUser(currentUser, managedUser)) {
                    throw new SecurityException("No tienes permiso sobre ese usuario.");
                }
                return ResponseEntity.ok(goalService.getAssignedGoalsForAdminAndUser(currentUser.getId(), managedUser.getId()));
            }
            return ResponseEntity.ok(goalService.getAssignedGoalsForAdmin(currentUser.getId()));
        }

        return ResponseEntity.ok(goalService.getByUsername(currentUser.getUsername()));
    }

    @GetMapping("/{id}")
    public ResponseEntity<Goal> getGoalById(@RequestHeader("Authorization") String token,
                                       @RequestHeader(value = "Accept-Language", required = false) String language,
                                       @PathVariable Integer id) {
        User currentUser = getCurrentUser(token, language);
        Goal goal = goalService.findById(id);

        if (goal == null) {
            throw new ApiException(HttpStatus.NOT_FOUND, languageResolver.text(language, "goal.notFound"));
        }

        if (!canAccessGoal(currentUser, goal)) {
            throw new SecurityException(languageResolver.text(language, "goal.noAccess"));
        }

        return ResponseEntity.ok(goal);
    }

    @PostMapping
    public ResponseEntity<List<Goal>> createGoal(@RequestHeader("Authorization") String token,
                                        @RequestHeader(value = "Accept-Language", required = false) String language,
                                        @RequestBody GoalRequest request) {
        User currentUser = getCurrentUser(token, language);

        List<PersonalUser> targets = resolveTargetUsers(currentUser, request);
        Goal createdGoal;
        if (currentUser.isAdmin()) {
            createdGoal = goalService.createAssignedGoal(request, targets, (AdminUser) currentUser);
        } else {
            createdGoal = goalService.createGoal(request, targets.get(0));
        }
        return ResponseEntity.status(HttpStatus.CREATED).body(List.of(createdGoal));
    }

    @PutMapping("/{id}")
    public ResponseEntity<Goal> updateGoal(@RequestHeader("Authorization") String token,
                                        @RequestHeader(value = "Accept-Language", required = false) String language,
                                        @PathVariable Integer id,
                                        @RequestBody GoalRequest request) {
        User currentUser = getCurrentUser(token, language);
        Goal existingGoal = goalService.findById(id);

        if (existingGoal == null) {
            throw new ApiException(HttpStatus.NOT_FOUND, languageResolver.text(language, "goal.notFound"));
        }

        if (!canAccessGoal(currentUser, existingGoal)) {
            throw new SecurityException(languageResolver.text(language, "goal.noAccess"));
        }

        if (!currentUser.isAdmin() && existingGoal.isAssignedByAdmin()) {
            GoalRequest restrictedRequest = new GoalRequest();
            restrictedRequest.setTitulo(existingGoal.getTitulo());
            restrictedRequest.setDescription(existingGoal.getDescription());
            restrictedRequest.setPriority(existingGoal.getPriority());
            restrictedRequest.setActive(existingGoal.getActive());
            restrictedRequest.setNumeric(existingGoal.isNumeric());
            restrictedRequest.setValorObjetivo(existingGoal.getValorObjetivo());
            restrictedRequest.setStatus(request.getStatus() != null ? request.getStatus() : existingGoal.getStatus());
            restrictedRequest.setValorProgreso(
                    existingGoal.isNumeric()
                            ? (request.getValorProgreso() != null ? request.getValorProgreso() : existingGoal.getValorProgreso())
                            : null
            );

            return ResponseEntity.ok(goalService.updateGoal(existingGoal, restrictedRequest));
        }

        if (currentUser.isAdmin() && existingGoal.getEffectiveAssignedByAdmin() != null) {
            List<PersonalUser> targets = resolveTargetUsers(currentUser, request);
            if (targets.isEmpty()) {
                throw new IllegalArgumentException("Debes seleccionar al menos un usuario.");
            }

            return ResponseEntity.ok(goalService.updateAssignedGoal(existingGoal, request, targets, (AdminUser) currentUser));
        }

        return ResponseEntity.ok(goalService.updateGoal(existingGoal, request));
    }

    @PatchMapping("/{id}/progress")
    public ResponseEntity<Goal> updateGoalProgress(@RequestHeader("Authorization") String token,
                                                @RequestHeader(value = "Accept-Language", required = false) String language,
                                                @PathVariable Integer id,
                                                @RequestBody GoalProgressRequest request) {
        User currentUser = getCurrentUser(token, language);
        Goal goal = goalService.findById(id);

        if (goal == null) {
            throw new ApiException(HttpStatus.NOT_FOUND, languageResolver.text(language, "goal.notFound"));
        }

        if (!canAccessGoal(currentUser, goal)) {
            throw new SecurityException(languageResolver.text(language, "goal.noAccess"));
        }

        return ResponseEntity.ok(goalService.updateGoalProgress(goal, request));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<String> deleteGoal(@RequestHeader("Authorization") String token,
                                        @RequestHeader(value = "Accept-Language", required = false) String language,
                                        @PathVariable Integer id) {
        User currentUser = getCurrentUser(token, language);
        Goal goal = goalService.findById(id);

        if (goal == null) {
            throw new ApiException(HttpStatus.NOT_FOUND, languageResolver.text(language, "goal.notFound"));
        }

        if (!canAccessGoal(currentUser, goal)) {
            throw new SecurityException(languageResolver.text(language, "goal.noAccess"));
        }

        if (!currentUser.isAdmin() && goal.isAssignedByAdmin()) {
            throw new SecurityException("No puedes eliminar objetivos asignados por administrador.");
        }

        goalService.deleteById(id);
        return ResponseEntity.ok(languageResolver.text(language, "goal.deleted"));
    }

    private User getCurrentUser(String token, String language) {
        String username = jwtUtil.extractUsernameFromAuthorizationHeader(token);
        User currentUser = userService.getUserByUsername(username);
        if (currentUser == null) {
            throw new ApiException(HttpStatus.BAD_REQUEST, languageResolver.text(language, "user.notFound"));
        }
        return currentUser;
    }

    private List<PersonalUser> resolveTargetUsers(User currentUser, GoalRequest request) {
        if (!currentUser.isAdmin()) {
            return currentUser instanceof PersonalUser personalUser ? List.of(personalUser) : List.of();
        }

        if (Boolean.TRUE.equals(request.getAssignToAllUsers())) {
            List<PersonalUser> users = new ArrayList<>();
            for (User user : userService.getUsersInAdminScope(currentUser)) {
                if (user instanceof PersonalUser personalUser) {
                    users.add(personalUser);
                }
            }
            if (users.isEmpty()) {
                throw new SecurityException("No hay usuarios subordinados para asignar.");
            }
            return users;
        }

        if (request.getTargetUserIds() != null && !request.getTargetUserIds().isEmpty()) {
            List<PersonalUser> targets = new ArrayList<>();
            Set<Long> targetIds = new HashSet<>();

            for (Long targetUserId : request.getTargetUserIds()) {
                User user = userService.getUserById(targetUserId);
                if (!(user instanceof PersonalUser personalUser)) {
                    continue;
                }
                if (!canAccessManagedUser(currentUser, personalUser)) {
                    throw new SecurityException("No tienes permiso para operar sobre uno de los usuarios seleccionados.");
                }
                if (targetIds.add(personalUser.getId())) {
                    targets.add(personalUser);
                }
            }

            return targets;
        }

        if (request.getTargetUserId() != null) {
            User managedUser = userService.getUserById(request.getTargetUserId());
            if (!canAccessManagedUser(currentUser, managedUser)) {
                throw new SecurityException("No tienes permiso para operar sobre ese usuario.");
            }
            return managedUser instanceof PersonalUser personalUser ? List.of(personalUser) : List.of();
        }

        throw new SecurityException("Debes seleccionar al menos un usuario.");
    }

    private boolean canAccessManagedUser(User currentUser, User target) {
        if (currentUser == null || !currentUser.isAdmin() || target == null) {
            return false;
        }

        for (User managedUser : userService.getUsersInAdminScope(currentUser)) {
            if (managedUser.getId().equals(target.getId())) {
                return true;
            }
        }

        return false;
    }

    private boolean canAccessGoal(User currentUser, Goal goal) {
        for (ObjectiveAssignment assignment : goal.getAssignments()) {
            if (assignment.getPersonalUser().getId().equals(currentUser.getId())) {
                return true;
            }
        }

        if (!currentUser.isAdmin()) {
            return false;
        }

        for (ObjectiveAssignment assignment : goal.getAssignments()) {
            if (assignment.getAudAdmin() != null
                    && assignment.getAudAdmin().getId().equals(currentUser.getId())
                    && canAccessManagedUser(currentUser, assignment.getPersonalUser())) {
                return true;
            }
        }

        return false;
    }
}
