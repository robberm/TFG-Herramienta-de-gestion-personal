package net.tfg.tfgapp.repos;

import net.tfg.tfgapp.domains.AiChatMessage;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface AiChatMessageRepo extends JpaRepository<AiChatMessage, Long> {
    /** Los N más recientes, del más nuevo al más antiguo (el servicio les da la vuelta). */
    List<AiChatMessage> findByOwnerIdOrderByCreatedAtDescIdDesc(Long ownerId, Pageable pageable);
    List<AiChatMessage> findByOwnerId(Long ownerId);
}
