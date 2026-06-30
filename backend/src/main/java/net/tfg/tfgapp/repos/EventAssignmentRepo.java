package net.tfg.tfgapp.repos;

import net.tfg.tfgapp.domains.EventAssignment;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface EventAssignmentRepo extends JpaRepository<EventAssignment, Long> {
    List<EventAssignment> findByEventId(Long eventId);

    Optional<EventAssignment> findByEventIdAndPersonalUserId(Long eventId, Long personalUserId);

    void deleteByEventIdAndPersonalUserId(Long eventId, Long personalUserId);
}
