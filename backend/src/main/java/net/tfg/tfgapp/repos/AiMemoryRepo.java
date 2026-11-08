package net.tfg.tfgapp.repos;

import net.tfg.tfgapp.domains.AiMemory;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface AiMemoryRepo extends JpaRepository<AiMemory, Long> {
    List<AiMemory> findByOwnerIdOrderByCreatedAtAsc(Long ownerId);
    Optional<AiMemory> findByIdAndOwnerId(Long id, Long ownerId);
    long countByOwnerId(Long ownerId);
}
