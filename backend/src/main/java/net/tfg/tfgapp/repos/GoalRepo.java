package net.tfg.tfgapp.repos;

import net.tfg.tfgapp.domains.Goal;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface GoalRepo extends JpaRepository<Goal, Integer> {

    @Query("SELECT DISTINCT g FROM Goal g JOIN g.assignments a WHERE a.personalUser.username = :username")
    List<Goal> findByUserUsername(@Param("username") String username);

    @Query("SELECT DISTINCT g FROM Goal g JOIN g.assignments a WHERE a.audAdmin.id = :adminId")
    List<Goal> findByAssignedByAdmin_Id(@Param("adminId") Long adminId);

    @Query("SELECT DISTINCT g FROM Goal g JOIN g.assignments a WHERE a.audAdmin.id = :adminId AND a.personalUser.id = :userId")
    List<Goal> findByAssignedByAdmin_IdAndUser_Id(@Param("adminId") Long adminId, @Param("userId") Long userId);
}
