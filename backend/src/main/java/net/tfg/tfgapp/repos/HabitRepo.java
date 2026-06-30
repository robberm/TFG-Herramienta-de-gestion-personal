package net.tfg.tfgapp.repos;

import net.tfg.tfgapp.domains.Habit;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface HabitRepo extends JpaRepository<Habit, Integer> {
    @Query("SELECT DISTINCT h FROM Habit h JOIN h.assignments a WHERE a.personalUser.username = :username")
    List<Habit> findByUserUsername(@Param("username") String username);
    @Query("SELECT DISTINCT h FROM Habit h JOIN h.assignments a WHERE a.personalUser.username = :username AND a.active = true")
    List<Habit> findByUserUsernameAndActiveTrue(@Param("username") String username);
}
