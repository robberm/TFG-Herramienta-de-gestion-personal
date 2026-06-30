package net.tfg.tfgapp.controller.objectives;

import net.tfg.tfgapp.DTOs.objectives.HabitCompletionRequest;
import net.tfg.tfgapp.DTOs.objectives.HabitRequest;
import net.tfg.tfgapp.domains.Habit;
import net.tfg.tfgapp.domains.ObjectiveLog;
import net.tfg.tfgapp.domains.PersonalUser;
import net.tfg.tfgapp.domains.User;
import net.tfg.tfgapp.xi18n.LanguageResolver;
import net.tfg.tfgapp.security.JwtUtil;
import net.tfg.tfgapp.service.interfaces.IHabitService;
import net.tfg.tfgapp.service.interfaces.IUserService;
import net.tfg.tfgapp.validation.objectives.HabitValidator;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/habits")
public class HabitController {

    private static final String HABIT_DELETED_KEY = "habit.deleted";

    private final IHabitService habitService;
    private final JwtUtil jwtUtil;
    private final IUserService userService;
    private final LanguageResolver languageResolver;
    private final HabitValidator habitValidator;

    public HabitController(IHabitService habitService,
                           JwtUtil jwtUtil,
                           IUserService userService,
                           LanguageResolver languageResolver,
                           HabitValidator habitValidator) {
        this.habitService = habitService;
        this.jwtUtil = jwtUtil;
        this.userService = userService;
        this.languageResolver = languageResolver;
        this.habitValidator = habitValidator;
    }

    @GetMapping
    public ResponseEntity<List<Habit>> getMyHabits(@RequestHeader("Authorization") String token) {
        String username = jwtUtil.extractUsernameFromAuthorizationHeader(token);
        return ResponseEntity.ok(habitService.getByUsername(username));
    }

    @GetMapping("/active")
    public ResponseEntity<List<Habit>> getMyActiveHabits(@RequestHeader("Authorization") String token) {
        String username = jwtUtil.extractUsernameFromAuthorizationHeader(token);
        return ResponseEntity.ok(habitService.getActiveHabitsByUsername(username));
    }

    @GetMapping("/{id}")
    public ResponseEntity<Habit> getHabitById(@RequestHeader("Authorization") String token,
                                              @RequestHeader(value = "Accept-Language", required = false) String language,
                                              @PathVariable Integer id) {
        String username = jwtUtil.extractUsernameFromAuthorizationHeader(token);
        Habit habit = getValidatedHabit(id, username, language);
        return ResponseEntity.ok(habit);
    }

    @PostMapping
    public ResponseEntity<Habit> createHabit(@RequestHeader("Authorization") String token,
                                             @RequestHeader(value = "Accept-Language", required = false) String language,
                                             @RequestBody HabitRequest request) {
        String username = jwtUtil.extractUsernameFromAuthorizationHeader(token);
        User user = userService.getUserByUsername(username);
        PersonalUser personalUser = habitValidator.requirePersonalUser(user, language);

        Habit createdHabit = habitService.createHabit(request, personalUser);
        return ResponseEntity.status(HttpStatus.CREATED).body(createdHabit);
    }

    @PutMapping("/{id}")
    public ResponseEntity<Habit> updateHabit(@RequestHeader("Authorization") String token,
                                             @RequestHeader(value = "Accept-Language", required = false) String language,
                                             @PathVariable Integer id,
                                             @RequestBody HabitRequest request) {
        String username = jwtUtil.extractUsernameFromAuthorizationHeader(token);
        Habit existingHabit = getValidatedHabit(id, username, language);
        return ResponseEntity.ok(habitService.updateHabit(existingHabit, request));
    }

    @PatchMapping("/{id}/completion")
    public ResponseEntity<ObjectiveLog> markHabitCompletion(@RequestHeader("Authorization") String token,
                                                            @RequestHeader(value = "Accept-Language", required = false) String language,
                                                            @PathVariable Integer id,
                                                            @RequestBody HabitCompletionRequest request) {
        String username = jwtUtil.extractUsernameFromAuthorizationHeader(token);
        Habit habit = getValidatedHabit(id, username, language);
        ObjectiveLog log = habitService.markHabitCompletion(habit, request);
        return ResponseEntity.ok(log);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<String> deleteHabit(@RequestHeader("Authorization") String token,
                                              @RequestHeader(value = "Accept-Language", required = false) String language,
                                              @PathVariable Integer id) {
        String username = jwtUtil.extractUsernameFromAuthorizationHeader(token);
        Habit habit = getValidatedHabit(id, username, language);
        habitService.deleteById(habit.getId());
        return ResponseEntity.ok(languageResolver.text(language, HABIT_DELETED_KEY));
    }

    private Habit getValidatedHabit(Integer id, String username, String language) {
        Habit habit = habitValidator.requireExistingHabit(habitService.findById(id), language);
        habitValidator.requireHabitOwner(habit, username, language);
        return habit;
    }
}
