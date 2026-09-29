package net.tfg.tfgapp.repos;

import net.tfg.tfgapp.domains.Note;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface NoteRepo extends JpaRepository<Note, Long> {
    List<Note> findByOwnerIdOrderByPinnedDescUpdatedAtDesc(Long ownerId);
    Optional<Note> findByIdAndOwnerId(Long id, Long ownerId);
}
