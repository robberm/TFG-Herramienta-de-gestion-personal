package net.tfg.tfgapp.controller;

import net.tfg.tfgapp.DTOs.notes.NoteRequest;
import net.tfg.tfgapp.domains.Note;
import net.tfg.tfgapp.domains.User;
import net.tfg.tfgapp.exception.ApiException;
import net.tfg.tfgapp.security.JwtUtil;
import net.tfg.tfgapp.service.NoteService;
import net.tfg.tfgapp.service.UserService;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("notes")
public class NoteController {
    private final NoteService noteService;
    private final JwtUtil jwtUtil;
    private final UserService userService;

    public NoteController(NoteService noteService, JwtUtil jwtUtil, UserService userService) {
        this.noteService = noteService;
        this.jwtUtil = jwtUtil;
        this.userService = userService;
    }

    @GetMapping
    public List<Note> findAll(@RequestHeader("Authorization") String authorization) {
        return noteService.findAll(currentUser(authorization));
    }

    @PostMapping
    public ResponseEntity<Note> create(@RequestBody NoteRequest request,
                                       @RequestHeader("Authorization") String authorization) {
        return ResponseEntity.status(HttpStatus.CREATED).body(noteService.create(currentUser(authorization), request));
    }

    @PutMapping("/{id}")
    public Note update(@PathVariable Long id, @RequestBody NoteRequest request,
                       @RequestHeader("Authorization") String authorization) {
        return noteService.update(currentUser(authorization), id, request);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable Long id,
                                       @RequestHeader("Authorization") String authorization) {
        noteService.delete(currentUser(authorization), id);
        return ResponseEntity.noContent().build();
    }

    private User currentUser(String authorization) {
        String username = jwtUtil.extractUsernameFromAuthorizationHeader(authorization);
        User user = userService.getUserByUsername(username);
        if (user == null) {
            throw new ApiException(HttpStatus.UNAUTHORIZED, "Usuario no encontrado.");
        }
        return user;
    }
}
