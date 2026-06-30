package net.tfg.tfgapp.service.interfaces;

import net.tfg.tfgapp.domains.User;

import java.util.List;

public interface IUserService {

    <S extends User> S save(S entity);

    List<User> findAll();

    User getUserByUsername(String username);

    User getUserById(Long id);

    boolean existsByUsername(String username);

    List<User> getManagedUsers(Long adminId);

    User getManagedUser(Long adminId, Long userId);

    List<User> getUsersInAdminScope(User admin);

    void delete(User user);
}