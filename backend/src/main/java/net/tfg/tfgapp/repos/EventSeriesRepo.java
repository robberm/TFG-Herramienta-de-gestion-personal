package net.tfg.tfgapp.repos;

import net.tfg.tfgapp.domains.Event;
import net.tfg.tfgapp.domains.EventSeries;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.Collection;
import java.util.List;

/**
 * Las consultas por rango solo descartan series que empiezan después o terminan antes;
 * las ocurrencias concretas se calculan en memoria con {@link EventSeries#occurrencesBetween}.
 */
@Repository
public interface EventSeriesRepo extends JpaRepository<EventSeries, Long> {

    @Query("""
            SELECT DISTINCT s FROM EventSeries s JOIN s.assignments a
            WHERE a.personalUser.username = :username
            """)
    List<EventSeries> findByUsername(@Param("username") String username);

    @Query("""
            SELECT DISTINCT s FROM EventSeries s JOIN s.assignments a
            WHERE a.audAdmin.id = :adminId
            """)
    List<EventSeries> findForAdmin(@Param("adminId") Long adminId);

    @Query("""
            SELECT DISTINCT s FROM EventSeries s JOIN s.assignments a
            WHERE a.audAdmin.id = :adminId AND a.personalUser.id = :userId
            """)
    List<EventSeries> findForAdminAndUser(@Param("adminId") Long adminId, @Param("userId") Long userId);

    @Query("""
            SELECT DISTINCT s FROM EventSeries s JOIN s.assignments a
            WHERE a.personalUser.username = :username
              AND s.startTime < :end
              AND (s.recurrenceEndDate IS NULL OR s.recurrenceEndDate >= :startDate)
            """)
    List<EventSeries> findByUsernameInRange(@Param("username") String username,
                                            @Param("startDate") LocalDate startDate,
                                            @Param("end") LocalDateTime end);

    @Query("""
            SELECT DISTINCT s FROM EventSeries s JOIN s.assignments a
            WHERE a.audAdmin.id = :adminId
              AND s.startTime < :end
              AND (s.recurrenceEndDate IS NULL OR s.recurrenceEndDate >= :startDate)
            """)
    List<EventSeries> findForAdminInRange(@Param("adminId") Long adminId,
                                          @Param("startDate") LocalDate startDate,
                                          @Param("end") LocalDateTime end);

    @Query("""
            SELECT DISTINCT s FROM EventSeries s JOIN s.assignments a
            WHERE a.audAdmin.id = :adminId AND a.personalUser.id = :userId
              AND s.startTime < :end
              AND (s.recurrenceEndDate IS NULL OR s.recurrenceEndDate >= :startDate)
            """)
    List<EventSeries> findForAdminAndUserInRange(@Param("adminId") Long adminId,
                                                 @Param("userId") Long userId,
                                                 @Param("startDate") LocalDate startDate,
                                                 @Param("end") LocalDateTime end);

    @Query("""
            SELECT DISTINCT s FROM EventSeries s JOIN s.assignments a
            WHERE a.personalUser.id = :userId
              AND s.category IN :categories
              AND s.startTime < :end
              AND (s.recurrenceEndDate IS NULL OR s.recurrenceEndDate >= :startDate)
            """)
    List<EventSeries> findUserSeriesOfCategoriesInRange(@Param("userId") Long userId,
                                                        @Param("categories") Collection<Event.EventCategory> categories,
                                                        @Param("startDate") LocalDate startDate,
                                                        @Param("end") LocalDateTime end);

    @Query("""
            SELECT DISTINCT s FROM EventSeries s LEFT JOIN FETCH s.assignments
            WHERE SIZE(s.reminderMinutesBeforeList) > 0
              AND (s.recurrenceEndDate IS NULL OR s.recurrenceEndDate >= :startDate)
            """)
    List<EventSeries> findWithPendingReminders(@Param("startDate") LocalDate startDate);
}
