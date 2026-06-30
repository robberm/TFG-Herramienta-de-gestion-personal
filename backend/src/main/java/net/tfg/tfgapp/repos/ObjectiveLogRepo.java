package net.tfg.tfgapp.repos;

import net.tfg.tfgapp.domains.ObjectiveLog;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.util.List;

@Repository
public interface ObjectiveLogRepo extends JpaRepository<ObjectiveLog, Integer> {
    @Query("""
            SELECT l FROM ObjectiveLog l
            LEFT JOIN FETCH l.objective
            LEFT JOIN FETCH l.objectiveAssignment a
            LEFT JOIN FETCH a.objective
            WHERE l.objective.id = :objectiveId
               OR a.objective.id = :objectiveId
            ORDER BY l.logDate ASC
            """)
    List<ObjectiveLog> findByObjectiveIdOrderByLogDateAsc(@Param("objectiveId") Integer objectiveId);
    @Query("""
            SELECT l FROM ObjectiveLog l
            LEFT JOIN l.objectiveAssignment a
            LEFT JOIN l.objective o
            WHERE (a.id = :assignmentId OR o.id = :objectiveId)
              AND l.logDate = :logDate
            ORDER BY CASE WHEN a.id = :assignmentId THEN 0 ELSE 1 END
            """)
    List<ObjectiveLog> findLogsForAssignmentOrObjectiveOnDate(
            @Param("assignmentId") Integer assignmentId,
            @Param("objectiveId") Integer objectiveId,
            @Param("logDate") LocalDate logDate
    );
    @Query("""
            SELECT l FROM ObjectiveLog l
            WHERE l.objectiveAssignment.id = :assignmentId
            ORDER BY l.logDate ASC
            """)
    List<ObjectiveLog> findByObjectiveAssignmentIdOrderByLogDateAsc(@Param("assignmentId") Integer assignmentId);
    @Query("""
            SELECT l FROM ObjectiveLog l
            LEFT JOIN FETCH l.objective
            LEFT JOIN FETCH l.objectiveAssignment a
            LEFT JOIN FETCH a.objective
            WHERE a.personalUser.username = :username
              AND l.logDate BETWEEN :startDate AND :endDate
            ORDER BY l.logDate ASC
            """)
    List<ObjectiveLog> findLogsForUsernameBetweenDates(
            @Param("username") String username,
            @Param("startDate") LocalDate startDate,
            @Param("endDate") LocalDate endDate
    );
}
