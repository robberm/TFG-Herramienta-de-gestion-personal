package net.tfg.tfgapp.repos;

import net.tfg.tfgapp.domains.Organization;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface OrganizationRepo extends JpaRepository<Organization, Long> {

    boolean existsByNameIgnoreCase(String name);

    Organization findByAdmin_Id(Long adminId);
}