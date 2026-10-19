package net.tfg.tfgapp.controller;

import net.tfg.tfgapp.DTOs.todos.TodoRequest;
import net.tfg.tfgapp.domains.TodoItem;
import net.tfg.tfgapp.domains.User;
import net.tfg.tfgapp.exception.ApiException;
import net.tfg.tfgapp.security.JwtUtil;
import net.tfg.tfgapp.service.TodoService;
import net.tfg.tfgapp.service.UserService;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("todos")
public class TodoController {
    private final TodoService todoService;
    private final JwtUtil jwtUtil;
    private final UserService userService;

    public TodoController(TodoService todoService, JwtUtil jwtUtil, UserService userService) {
        this.todoService = todoService;
        this.jwtUtil = jwtUtil;
        this.userService = userService;
    }

    @GetMapping
    public List<TodoItem> findAll(@RequestHeader("Authorization") String authorization) {
        return todoService.findAll(currentUser(authorization));
    }

    @PostMapping
    public ResponseEntity<TodoItem> create(@RequestBody TodoRequest request,
                                           @RequestHeader("Authorization") String authorization) {
        return ResponseEntity.status(HttpStatus.CREATED).body(todoService.create(currentUser(authorization), request));
    }

    @PatchMapping("/{id}")
    public TodoItem update(@PathVariable Long id, @RequestBody TodoRequest request,
                           @RequestHeader("Authorization") String authorization) {
        return todoService.update(currentUser(authorization), id, request);
    }

    @DeleteMapping("/completed")
    public ResponseEntity<Void> deleteCompleted(@RequestHeader("Authorization") String authorization) {
        todoService.deleteCompleted(currentUser(authorization));
        return ResponseEntity.noContent().build();
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable Long id,
                                       @RequestHeader("Authorization") String authorization) {
        todoService.delete(currentUser(authorization), id);
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
