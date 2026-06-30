package net.tfg.tfgapp.repos;

import net.tfg.tfgapp.domains.User;
import org.springframework.context.annotation.Primary;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Primary
@Repository
public interface UserRepo extends JpaRepository<User, Long> {

    User findByUsername(String username);

    boolean existsByUsername(String username);
}