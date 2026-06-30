package net.tfg.tfgapp.repos;

import net.tfg.tfgapp.domains.PersonalUser;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface PersonalUserRepo extends JpaRepository<PersonalUser, Long> {

    List<PersonalUser> findByAudAdmin_Id(Long adminId);

    Optional<PersonalUser> findByIdAndAudAdmin_Id(Long userId, Long adminId);

    List<PersonalUser> findByOrganization_Id(Long organizationId);
}
