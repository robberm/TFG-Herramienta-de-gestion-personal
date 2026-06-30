package net.tfg.tfgapp.repos;

import net.tfg.tfgapp.domains.ObjectiveAssignment;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface ObjectiveAssignmentRepo extends JpaRepository<ObjectiveAssignment, Integer> {
    List<ObjectiveAssignment> findByObjectiveId(Integer objectiveId);

    Optional<ObjectiveAssignment> findByObjectiveIdAndPersonalUserId(Integer objectiveId, Long personalUserId);
}
