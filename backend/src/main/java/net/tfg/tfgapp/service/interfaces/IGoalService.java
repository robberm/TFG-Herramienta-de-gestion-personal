package net.tfg.tfgapp.service.interfaces;

import net.tfg.tfgapp.DTOs.objectives.GoalProgressRequest;
import net.tfg.tfgapp.DTOs.objectives.GoalRequest;
import net.tfg.tfgapp.domains.AdminUser;
import net.tfg.tfgapp.domains.Goal;
import net.tfg.tfgapp.domains.PersonalUser;

import java.util.List;

public interface IGoalService extends IObjectiveService<Goal> {

    Goal createGoal(GoalRequest request, PersonalUser user);

    Goal createAssignedGoal(GoalRequest request, List<PersonalUser> targets, AdminUser admin);

    Goal updateGoal(Goal existingGoal, GoalRequest request);

    Goal updateAssignedGoal(Goal existingGoal, GoalRequest request, List<PersonalUser> targets, AdminUser admin);

    Goal updateGoalProgress(Goal goal, GoalProgressRequest request);

    void applyGoalDetails(Goal goal, GoalRequest request);

    List<Goal> getAssignedGoalsForAdmin(Long adminId);

    List<Goal> getAssignedGoalsForAdminAndUser(Long adminId, Long userId);
}
