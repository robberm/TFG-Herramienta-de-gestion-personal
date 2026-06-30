package net.tfg.tfgapp.validation.objectives;

import net.tfg.tfgapp.domains.Habit;
import net.tfg.tfgapp.domains.ObjectiveAssignment;
import net.tfg.tfgapp.domains.PersonalUser;
import net.tfg.tfgapp.domains.User;
import net.tfg.tfgapp.exception.ApiException;
import net.tfg.tfgapp.xi18n.LanguageResolver;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;

/**
 * Validaciones específicas de hábitos.
 *
 * Mantener estas reglas fuera del controller baja complejidad y evita repetir
 * literales de i18n en cada endpoint.
 */
@Component
public class HabitValidator {

    private static final String HABIT_NOT_FOUND_KEY = "habit.notFound";
    private static final String HABIT_NO_ACCESS_KEY = "habit.noAccess";
    private static final String USER_NOT_FOUND_KEY = "user.notFound";

    private final LanguageResolver languageResolver;

    public HabitValidator(LanguageResolver languageResolver) {
        this.languageResolver = languageResolver;
    }

    public Habit requireExistingHabit(Habit habit, String language) {
        if (habit == null) {
            throw new ApiException(HttpStatus.NOT_FOUND, languageResolver.text(language, HABIT_NOT_FOUND_KEY));
        }
        return habit;
    }

    public void requireHabitOwner(Habit habit, String username, String language) {
        for (ObjectiveAssignment assignment : habit.getAssignments()) {
            if (assignment.getPersonalUser() != null
                    && username.equals(assignment.getPersonalUser().getUsername())) {
                habit.setCurrentAssignment(assignment);
                return;
            }
        }

        throw new SecurityException(languageResolver.text(language, HABIT_NO_ACCESS_KEY));
    }

    public PersonalUser requirePersonalUser(User user, String language) {
        if (!(user instanceof PersonalUser personalUser)) {
            throw new ApiException(HttpStatus.BAD_REQUEST, languageResolver.text(language, USER_NOT_FOUND_KEY));
        }
        return personalUser;
    }
}
