package net.tfg.tfgapp.repos;

import net.tfg.tfgapp.domains.TodoItem;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface TodoItemRepo extends JpaRepository<TodoItem, Long> {
    List<TodoItem> findByOwnerIdOrderByPositionAscIdAsc(Long ownerId);
    Optional<TodoItem> findByIdAndOwnerId(Long id, Long ownerId);
    List<TodoItem> findByOwnerIdAndDoneTrue(Long ownerId);

    @Query("select coalesce(max(t.position), -1) from TodoItem t where t.owner.id = :ownerId")
    int findMaxPositionByOwnerId(@Param("ownerId") Long ownerId);
}
