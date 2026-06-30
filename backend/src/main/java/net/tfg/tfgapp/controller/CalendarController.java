package net.tfg.tfgapp.controller;

import net.tfg.tfgapp.DTOs.events.EventRequest;
import net.tfg.tfgapp.domains.AdminUser;
import net.tfg.tfgapp.domains.Event;
import net.tfg.tfgapp.domains.EventAssignment;
import net.tfg.tfgapp.domains.PersonalUser;
import net.tfg.tfgapp.domains.User;
import net.tfg.tfgapp.exception.ApiException;
import net.tfg.tfgapp.security.JwtUtil;
import net.tfg.tfgapp.service.EventService;
import net.tfg.tfgapp.service.UserService;
import net.tfg.tfgapp.validation.events.EventRequestValidator;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Optional;
import java.util.Set;

@RestController
@RequestMapping("events")
public class CalendarController {

    private final EventService eventService;
    private final JwtUtil jwtUtil;
    private final UserService userService;
    private final EventRequestValidator eventRequestValidator;

    public CalendarController(EventService eventService,
                              JwtUtil jwtUtil,
                              UserService userService,
                              EventRequestValidator eventRequestValidator) {
        this.eventService = eventService;
        this.jwtUtil = jwtUtil;
        this.userService = userService;
        this.eventRequestValidator = eventRequestValidator;
    }

    @GetMapping("/range")
    public ResponseEntity<List<Event>> getEventsBetween(
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime start,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime end,
            @RequestParam(required = false) Long targetUserId,
            @RequestHeader("Authorization") String token) {

        User currentUser = getCurrentUser(token);

        if (currentUser.isAdmin()) {
            if (targetUserId != null) {
                User target = userService.getUserById(targetUserId);
                if (!canAccessManagedUser(currentUser, target)) {
                    throw new SecurityException("No tienes permiso sobre ese usuario.");
                }
                return ResponseEntity.ok(eventService.findAssignedEventsForAdminAndUserInRange(currentUser.getId(), targetUserId, start, end));
            }

            return ResponseEntity.ok(eventService.findAssignedEventsForAdminInRange(currentUser.getId(), start, end));
        }

        return ResponseEntity.ok(eventService.findEventsByUserAndDateRange(currentUser.getUsername(), start, end));
    }

    @PostMapping
    public ResponseEntity<List<Event>> createEvent(@RequestBody EventRequest request,
                                         @RequestHeader("Authorization") String token) {
        User currentUser = getCurrentUser(token);

        eventRequestValidator.requireValidDates(request);
        Event event = new Event();
        eventService.applyEventDetails(event, request);
        List<PersonalUser> targets = resolveTargetUsers(currentUser, request);
        AdminUser audAdmin = currentUser.isAdmin() ? (AdminUser) currentUser : null;
        for (PersonalUser target : targets) {
            event.addAssignment(target, audAdmin);
        }

        return ResponseEntity.status(HttpStatus.CREATED).body(List.of(eventService.save(event)));
    }

    @PutMapping("/{id}")
    public ResponseEntity<Event> updateEvent(@PathVariable Long id,
                                         @RequestBody EventRequest eventDetails,
                                         @RequestHeader("Authorization") String token) {
        User currentUser = getCurrentUser(token);
        Optional<Event> existingEvent = eventService.getEventById(id);

        if (existingEvent.isEmpty()) {
            throw new ApiException(HttpStatus.NOT_FOUND, "Evento no encontrado.");
        }

        Event event = existingEvent.get();
        if (!canAccessEvent(currentUser, event)) {
            throw new SecurityException("No tienes permiso para actualizar este evento.");
        }

        if (!currentUser.isAdmin() && event.getAudAdmin() != null) {
            throw new SecurityException("No puedes modificar eventos asignados por administrador.");
        }

        eventRequestValidator.requireValidDates(eventDetails);

        if (currentUser.isAdmin() && event.getAudAdmin() != null) {
            List<PersonalUser> targets = resolveTargetUsers(currentUser, eventDetails);
            if (targets.isEmpty()) {
                throw new IllegalArgumentException("Debes seleccionar al menos un usuario.");
            }

            event.replaceAssignments(targets, (AdminUser) currentUser);
            eventService.applyEventDetails(event, eventDetails);
            return ResponseEntity.ok(eventService.save(event));
        }

        Optional<Event> updatedEvent = eventService.updateEventById(id, eventDetails);
        if (updatedEvent.isPresent()) {
            return ResponseEntity.ok(updatedEvent.get());
        }
        throw new ApiException(HttpStatus.NOT_FOUND, "Evento no encontrado.");
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteEvent(@PathVariable Long id,
                                         @RequestHeader("Authorization") String token) {
        User currentUser = getCurrentUser(token);
        Optional<Event> existingEvent = eventService.getEventById(id);

        if (existingEvent.isEmpty()) {
            throw new ApiException(HttpStatus.NOT_FOUND, "Evento no encontrado.");
        }

        Event event = existingEvent.get();
        if (!canAccessEvent(currentUser, event)) {
            throw new SecurityException("No tienes permiso para eliminar este evento.");
        }

        if (!currentUser.isAdmin() && event.getAudAdmin() != null) {
            throw new SecurityException("No puedes eliminar eventos asignados por administrador.");
        }

        if (currentUser.isAdmin()) {
            eventService.deleteAdminAssignedEventCascade(currentUser.getId(), event);
        } else {
            eventService.deleteEventById(id);
        }
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/categories")
    public ResponseEntity<List<String>> getCategories() {
        return ResponseEntity.ok(eventService.getCategories());
    }

    private User getCurrentUser(String authorizationHeader) {
        String username = jwtUtil.extractUsernameFromAuthorizationHeader(authorizationHeader);
        User currentUser = userService.getUserByUsername(username);
        if (currentUser == null) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Usuario no encontrado.");
        }
        return currentUser;
    }

    private List<PersonalUser> resolveTargetUsers(User currentUser, EventRequest request) {
        if (!currentUser.isAdmin()) {
            return personalTargetForCurrentUser(currentUser);
        }

        if (Boolean.TRUE.equals(request.getAssignToAllUsers())) {
            return allManagedPersonalUsers(currentUser);
        }

        if (request.getTargetUserIds() != null && !request.getTargetUserIds().isEmpty()) {
            return selectedManagedPersonalUsers(currentUser, request.getTargetUserIds());
        }

        if (request.getTargetUserId() != null) {
            return selectedManagedPersonalUser(currentUser, request.getTargetUserId());
        }

        throw new SecurityException("Debes seleccionar al menos un usuario.");
    }

    private List<PersonalUser> personalTargetForCurrentUser(User currentUser) {
        if (currentUser instanceof PersonalUser personalUser) {
            return List.of(personalUser);
        }
        return List.of();
    }

    private List<PersonalUser> allManagedPersonalUsers(User currentUser) {
        List<PersonalUser> allUsers = new ArrayList<>();
        for (User scopedUser : userService.getUsersInAdminScope(currentUser)) {
            if (scopedUser instanceof PersonalUser personalUser) {
                allUsers.add(personalUser);
            }
        }
        if (allUsers.isEmpty()) {
            throw new SecurityException("No hay usuarios subordinados para asignar.");
        }
        return allUsers;
    }

    private List<PersonalUser> selectedManagedPersonalUsers(User currentUser, List<Long> targetUserIds) {
        List<PersonalUser> targets = new ArrayList<>();
        Set<Long> uniqueTargetIds = new HashSet<>();
        for (Long targetUserId : targetUserIds) {
            User user = userService.getUserById(targetUserId);
            if (!(user instanceof PersonalUser personalUser)) {
                continue;
            }
            if (!canAccessManagedUser(currentUser, personalUser)) {
                throw new SecurityException("No tienes permiso para operar sobre uno de los usuarios seleccionados.");
            }
            if (uniqueTargetIds.add(personalUser.getId())) {
                targets.add(personalUser);
            }
        }
        return targets;
    }

    private List<PersonalUser> selectedManagedPersonalUser(User currentUser, Long targetUserId) {
        User managedUser = userService.getUserById(targetUserId);
        if (!canAccessManagedUser(currentUser, managedUser)) {
            throw new SecurityException("No tienes permiso para operar sobre ese usuario.");
        }
        if (managedUser instanceof PersonalUser personalUser) {
            return List.of(personalUser);
        }
        return List.of();
    }

    private boolean canAccessManagedUser(User currentUser, User target) {
        if (target == null || currentUser == null || !currentUser.isAdmin()) {
            return false;
        }

        for (User scopedUser : userService.getUsersInAdminScope(currentUser)) {
            if (scopedUser.getId().equals(target.getId())) {
                return true;
            }
        }
        return false;
    }

    private boolean canAccessEvent(User currentUser, Event event) {
        for (EventAssignment assignment : event.getAssignments()) {
            if (assignment.getPersonalUser().getId().equals(currentUser.getId())) {
                return true;
            }
        }

        if (!currentUser.isAdmin()) {
            return false;
        }

        for (EventAssignment assignment : event.getAssignments()) {
            if (assignment.getAudAdmin() != null
                    && assignment.getAudAdmin().getId().equals(currentUser.getId())
                    && canAccessManagedUser(currentUser, assignment.getPersonalUser())) {
                return true;
            }
        }
        return false;
    }
}
