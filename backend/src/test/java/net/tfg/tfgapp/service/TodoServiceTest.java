package net.tfg.tfgapp.service;

import net.tfg.tfgapp.DTOs.todos.TodoRequest;
import net.tfg.tfgapp.domains.PersonalUser;
import net.tfg.tfgapp.domains.TodoItem;
import net.tfg.tfgapp.exception.ApiException;
import net.tfg.tfgapp.repos.TodoItemRepo;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class TodoServiceTest {
    @Mock
    private TodoItemRepo todoItemRepo;

    @InjectMocks
    private TodoService todoService;

    private PersonalUser owner;

    @BeforeEach
    void setUp() {
        owner = new PersonalUser("rob", "password");
        owner.setId(7L);
    }

    @Test
    void createTrimsTitleAndAppendsAtTheEnd() {
        when(todoItemRepo.findMaxPositionByOwnerId(7L)).thenReturn(2);
        when(todoItemRepo.save(any(TodoItem.class))).thenAnswer(invocation -> invocation.getArgument(0));

        TodoItem created = todoService.create(owner, request("  Comprar café  ", null));

        assertThat(created.getTitle()).isEqualTo("Comprar café");
        assertThat(created.getPosition()).isEqualTo(3);
        assertThat(created.isDone()).isFalse();
        assertThat(created.getOwner()).isSameAs(owner);
    }

    @Test
    void createRejectsBlankTitle() {
        assertThatThrownBy(() -> todoService.create(owner, request("   ", null)))
                .isInstanceOf(ApiException.class);
        verify(todoItemRepo, never()).save(any());
    }

    @Test
    void togglingDoneSetsAndClearsCompletedAt() {
        TodoItem todo = existingTodo();
        when(todoItemRepo.findByIdAndOwnerId(1L, 7L)).thenReturn(Optional.of(todo));
        when(todoItemRepo.save(any(TodoItem.class))).thenAnswer(invocation -> invocation.getArgument(0));

        todoService.update(owner, 1L, request(null, true));
        assertThat(todo.isDone()).isTrue();
        assertThat(todo.getCompletedAt()).isNotNull();
        assertThat(todo.getTitle()).isEqualTo("Llamar al tutor");

        todoService.update(owner, 1L, request(null, false));
        assertThat(todo.isDone()).isFalse();
        assertThat(todo.getCompletedAt()).isNull();
    }

    @Test
    void updatingTodoOfAnotherUserFailsWithNotFound() {
        when(todoItemRepo.findByIdAndOwnerId(99L, 7L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> todoService.update(owner, 99L, request("x", null)))
                .isInstanceOf(ApiException.class);
    }

    private TodoItem existingTodo() {
        TodoItem todo = new TodoItem();
        todo.setId(1L);
        todo.setTitle("Llamar al tutor");
        todo.setOwner(owner);
        return todo;
    }

    private TodoRequest request(String title, Boolean done) {
        TodoRequest request = new TodoRequest();
        request.setTitle(title);
        request.setDone(done);
        return request;
    }
}
