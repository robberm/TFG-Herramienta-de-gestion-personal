package net.tfg.tfgapp.repos;

import net.tfg.tfgapp.domains.LearningTopic;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface LearningTopicRepo extends JpaRepository<LearningTopic, Long> {
    List<LearningTopic> findByOwnerIdOrderByIdAsc(Long ownerId);
}
