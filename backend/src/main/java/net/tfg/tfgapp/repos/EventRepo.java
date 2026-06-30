package net.tfg.tfgapp.repos;

import net.tfg.tfgapp.domains.Event;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;

@Repository
public interface EventRepo extends JpaRepository<Event, Long> {

    @Query("SELECT e FROM Event e WHERE e.startTime >= :start AND e.endTime <= :end")
    List<Event> findEventsBetween(@Param("start") LocalDateTime start, @Param("end") LocalDateTime end);

    @Query("""
            SELECT DISTINCT e FROM Event e JOIN e.assignments a
            WHERE a.personalUser.username = :username
              AND e.startTime < :end AND e.endTime > :start
            """)
    List<Event> findEventsByUserAndDateRange(@Param("username") String username, @Param("start") LocalDateTime start, @Param("end") LocalDateTime end);

    @Query("""
            SELECT DISTINCT e FROM Event e JOIN e.assignments a
            WHERE a.personalUser.username = :username
            """)
    List<Event> findEventsByUser(@Param("username") String username);

    @Query("""
            SELECT DISTINCT e FROM Event e JOIN e.assignments a
            WHERE a.audAdmin.id = :adminId AND a.personalUser.id = :userId AND e.startTime < :end AND e.endTime > :start
            """)
    List<Event> findAssignedEventsForAdminAndUserInRange(@Param("adminId") Long adminId, @Param("userId") Long userId, @Param("start") LocalDateTime start, @Param("end") LocalDateTime end);

    @Query("""
            SELECT DISTINCT e FROM Event e JOIN e.assignments a
            WHERE a.audAdmin.id = :adminId AND e.startTime < :end AND e.endTime > :start
            """)
    List<Event> findAssignedEventsForAdminInRange(@Param("adminId") Long adminId, @Param("start") LocalDateTime start, @Param("end") LocalDateTime end);

    @Query("SELECT DISTINCT e FROM Event e JOIN e.assignments a WHERE a.audAdmin.id = :adminId AND a.personalUser.id = :userId")
    List<Event> findAssignedEventsForAdminAndUser(@Param("adminId") Long adminId, @Param("userId") Long userId);

    @Query("SELECT e FROM Event e WHERE FUNCTION('DATE', e.startTime) = FUNCTION('DATE', :date)")
    List<Event> findByStartDate(@Param("date") LocalDateTime date);

    List<Event> findByStartTimeGreaterThanEqual(LocalDateTime now);

    @Query("""
            SELECT CASE WHEN COUNT(e) > 0 THEN true ELSE false END FROM Event e JOIN e.assignments a
            WHERE e.category = :category
              AND e.startTime <= :now
              AND e.endTime >= :now
              AND a.personalUser.id = :userId
            """)
    boolean existsActiveEventOfCategory(@Param("category") Event.EventCategory category, @Param("now") LocalDateTime now, @Param("userId") Long userId);

    @Query("""
        SELECT e FROM Event e
        WHERE SIZE(e.reminderMinutesBeforeList) > 0 AND e.endTime > :now
        ORDER BY e.startTime ASC
        """)
    List<Event> findPendingReminders(@Param("now") LocalDateTime now);
}
