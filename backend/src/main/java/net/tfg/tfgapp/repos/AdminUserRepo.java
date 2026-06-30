package net.tfg.tfgapp.repos;

import net.tfg.tfgapp.domains.AdminUser;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface AdminUserRepo extends JpaRepository<AdminUser, Long> {
}
