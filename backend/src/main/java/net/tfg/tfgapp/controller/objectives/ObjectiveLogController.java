package net.tfg.tfgapp.controller.objectives;

import net.tfg.tfgapp.domains.ObjectiveLog;
import net.tfg.tfgapp.security.JwtUtil;
import net.tfg.tfgapp.service.interfaces.IObjectiveLogService;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDate;
import java.util.List;

@RestController
@RequestMapping("/objective-logs")
public class ObjectiveLogController {

    private final IObjectiveLogService objectiveLogService;
    private final JwtUtil jwtUtil;

    public ObjectiveLogController(IObjectiveLogService objectiveLogService, JwtUtil jwtUtil) {
        this.objectiveLogService = objectiveLogService;
        this.jwtUtil = jwtUtil;
    }

    @GetMapping("/objective/{objectiveId}")
    public ResponseEntity<List<ObjectiveLog>> getLogsByObjective(@RequestHeader("Authorization") String token,
                                                @PathVariable Integer objectiveId) {
        String username = jwtUtil.extractUsernameFromAuthorizationHeader(token);
        List<ObjectiveLog> logs = objectiveLogService.getObjectiveLogs(objectiveId);

        if (logs.isEmpty()) {
            return ResponseEntity.ok(logs);
        }

        ObjectiveLog firstLog = logs.get(0);
        String ownerUsername = firstLog.getObjectiveAssignment() != null
                ? firstLog.getObjectiveAssignment().getPersonalUser().getUsername()
                : firstLog.getObjective().getEffectiveUser().getUsername();

        if (!ownerUsername.equals(username)) {
            throw new SecurityException("No tienes permiso para acceder a este histórico.");
        }

        return ResponseEntity.ok(logs);
    }

    @GetMapping("/range")
    public ResponseEntity<List<ObjectiveLog>> getLogsByRange(@RequestHeader("Authorization") String token,
                                            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate startDate,
                                            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate endDate) {
        String username = jwtUtil.extractUsernameFromAuthorizationHeader(token);
        return ResponseEntity.ok(objectiveLogService.getUserLogsBetweenDates(username, startDate, endDate));
    }
}
