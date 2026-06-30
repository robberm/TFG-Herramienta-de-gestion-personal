package net.tfg.tfgapp.controller;

import net.tfg.tfgapp.components.SessionStore;
import net.tfg.tfgapp.domains.User;
import net.tfg.tfgapp.exception.ApiException;
import net.tfg.tfgapp.security.JwtUtil;
import net.tfg.tfgapp.service.BlockingService;
import net.tfg.tfgapp.service.UserService;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/session")
public class SessionController {

    private final JwtUtil jwtUtil;
    private final UserService userService;
    private final SessionStore sessionStore;
    private final BlockingService blockingService;

    public SessionController(JwtUtil jwtUtil,
                             UserService userService,
                             SessionStore sessionStore,
                             BlockingService blockingService) {
        this.jwtUtil = jwtUtil;
        this.userService = userService;
        this.sessionStore = sessionStore;
        this.blockingService = blockingService;
    }

    @PostMapping("/active-user")
    public ResponseEntity<Void> registerActiveUser(@RequestHeader("Authorization") String token) {
        String username = jwtUtil.extractUsernameFromAuthorizationHeader(token);

        User user = userService.getUserByUsername(username);
        if (user == null) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Usuario no encontrado.");
        }

        sessionStore.setLoggedUser(user.getId());
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/clear")
    public ResponseEntity<Void> clearActiveUser() {
        var focusState = blockingService.getFocusState();
        Integer workDurationSeconds = ((Number) focusState.getOrDefault("workDurationSeconds", 20 * 60)).intValue();
        Integer breakDurationSeconds = ((Number) focusState.getOrDefault("breakDurationSeconds", 20)).intValue();
        String focusAction = String.valueOf(focusState.getOrDefault("focusAction", "NOTIFICATION"));

        blockingService.updateFocusSettings(false, workDurationSeconds, breakDurationSeconds, focusAction);
        sessionStore.clearLoggedUser();
        return ResponseEntity.noContent().build();
    }
}
