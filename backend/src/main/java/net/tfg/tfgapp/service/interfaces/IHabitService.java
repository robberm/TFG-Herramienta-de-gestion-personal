package net.tfg.tfgapp.service.interfaces;

import net.tfg.tfgapp.DTOs.objectives.HabitCompletionRequest;
import net.tfg.tfgapp.DTOs.objectives.HabitRequest;
import net.tfg.tfgapp.domains.Habit;
import net.tfg.tfgapp.domains.ObjectiveLog;
import net.tfg.tfgapp.domains.PersonalUser;

import java.util.List;

public interface IHabitService extends IObjectiveService<Habit> {

    Habit createHabit(HabitRequest request, PersonalUser user);

    Habit updateHabit(Habit habit, HabitRequest request);

    ObjectiveLog markHabitCompletion(Habit habit, HabitCompletionRequest request);

    List<Habit> getActiveHabitsByUsername(String username);
}