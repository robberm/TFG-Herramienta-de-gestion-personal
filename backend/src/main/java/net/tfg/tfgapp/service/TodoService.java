package net.tfg.tfgapp.service;

import net.tfg.tfgapp.DTOs.todos.TodoRequest;
import net.tfg.tfgapp.domains.TodoItem;
import net.tfg.tfgapp.domains.User;
import net.tfg.tfgapp.exception.ApiException;
import net.tfg.tfgapp.repos.TodoItemRepo;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;

@Service
public class TodoService {
    private static final int MAX_TITLE_LENGTH = 255;
    private final TodoItemRepo todoItemRepo;

    public TodoService(TodoItemRepo todoItemRepo) {
        this.todoItemRepo = todoItemRepo;
    }

    public List<TodoItem> findAll(User owner) {
        return todoItemRepo.findByOwnerIdOrderByPositionAscIdAsc(owner.getId());
    }

    public TodoItem create(User owner, TodoRequest request) {
        TodoItem todo = new TodoItem();
        todo.setOwner(owner);
        todo.setTitle(validTitle(request.getTitle()));
        todo.setPosition(todoItemRepo.findMaxPositionByOwnerId(owner.getId()) + 1);
        return todoItemRepo.save(todo);
    }

    /**
     * Actualización parcial: solo se modifican los campos que llegan informados.
     */
    public TodoItem update(User owner, Long id, TodoRequest request) {
        TodoItem todo = ownedTodo(owner, id);
        if (request.getTitle() != null) {
            todo.setTitle(validTitle(request.getTitle()));
        }
        if (request.getDone() != null && request.getDone() != todo.isDone()) {
            todo.setDone(request.getDone());
            todo.setCompletedAt(request.getDone() ? LocalDateTime.now() : null);
        }
        return todoItemRepo.save(todo);
    }

    public void delete(User owner, Long id) {
        todoItemRepo.delete(ownedTodo(owner, id));
    }

    @Transactional
    public void deleteCompleted(User owner) {
        todoItemRepo.deleteAll(todoItemRepo.findByOwnerIdAndDoneTrue(owner.getId()));
    }

    private TodoItem ownedTodo(User owner, Long id) {
        return todoItemRepo.findByIdAndOwnerId(id, owner.getId())
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Tarea no encontrada."));
    }

    private String validTitle(String rawTitle) {
        String title = rawTitle == null ? "" : rawTitle.trim();
        if (title.isEmpty()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "La tarea no puede estar vacía.");
        }
        if (title.length() > MAX_TITLE_LENGTH) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "La tarea supera el tamaño permitido.");
        }
        return title;
    }
}
