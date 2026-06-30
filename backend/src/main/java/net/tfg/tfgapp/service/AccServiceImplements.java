package net.tfg.tfgapp.service;

import net.tfg.tfgapp.DTOs.users.ChangePasswordRequest;
import net.tfg.tfgapp.DTOs.users.ChangeUsernameRequest;
import net.tfg.tfgapp.DTOs.users.DeleteAccountRequest;
import net.tfg.tfgapp.DTOs.users.LoginRequest;
import net.tfg.tfgapp.DTOs.users.UserProfileResponse;
import net.tfg.tfgapp.domains.AdminUser;
import net.tfg.tfgapp.domains.Organization;
import net.tfg.tfgapp.domains.PersonalUser;
import net.tfg.tfgapp.domains.User;
import net.tfg.tfgapp.service.interfaces.AccountService;
import net.tfg.tfgapp.service.interfaces.IStorageService;
import net.tfg.tfgapp.service.interfaces.IUserService;
import net.tfg.tfgapp.validation.PasswordPolicy;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

@Service
public class AccServiceImplements implements AccountService {

    private final IUserService userService;
    private final PasswordEncoder passwordEncoder;
    private final PasswordPolicy passwordPolicy;
    private final IStorageService storageService;

    public AccServiceImplements(IUserService userService,
                                PasswordEncoder passwordEncoder,
                                PasswordPolicy passwordPolicy,
                                IStorageService storageService) {
        this.userService = userService;
        this.passwordEncoder = passwordEncoder;
        this.passwordPolicy = passwordPolicy;
        this.storageService = storageService;
    }

    @Override
    public boolean authenticate(LoginRequest loginRequest) {
        if (loginRequest == null || loginRequest.getUsername() == null || loginRequest.getPassword() == null) {
            return false;
        }

        User user = userService.getUserByUsername(loginRequest.getUsername());
        if (user == null) {
            return false;
        }

        return passwordEncoder.matches(loginRequest.getPassword(), user.getPassword());
    }

    /**
     * Registro público.
     * Todo usuario que se registre aquí nace como PERSONAL y sin organización.
     */
    @Override
    public User register(User newUser) {
        if (newUser == null) {
            throw new IllegalArgumentException("Request inválida.");
        }

        if (newUser.getUsername() == null || newUser.getUsername().isBlank()) {
            throw new IllegalArgumentException("El username es obligatorio.");
        }

        if (newUser.getPassword() == null || newUser.getPassword().isBlank()) {
            throw new IllegalArgumentException("La contraseña es obligatoria.");
        }

        String normalizedUsername = newUser.getUsername().trim();

        if (userService.existsByUsername(normalizedUsername)) {
            throw new IllegalArgumentException("El usuario ya existe");
        }

        passwordPolicy.validateOrThrow(newUser.getPassword());

        newUser.setUsername(normalizedUsername);
        newUser.setPassword(passwordEncoder.encode(newUser.getPassword()));
        newUser.setTokenVersion(0);
        PersonalUser personalUser = new PersonalUser();
        personalUser.setUsername(newUser.getUsername());
        personalUser.setPassword(newUser.getPassword());
        personalUser.setTokenVersion(newUser.getTokenVersion());
        personalUser.setProfileImagePath(newUser.getProfileImagePath());

        return userService.save(personalUser);
    }

    @Override
    public User changePassword(String tokenUsername, ChangePasswordRequest request) {
        if (tokenUsername == null) {
            throw new IllegalArgumentException("Token inválido.");
        }

        if (request == null) {
            throw new IllegalArgumentException("Request inválida.");
        }

        User user = userService.getUserByUsername(tokenUsername);
        if (user == null) {
            throw new IllegalArgumentException("Usuario no encontrado.");
        }

        if (request.getCurrentPassword() == null || request.getCurrentPassword().isBlank()) {
            throw new IllegalArgumentException("Debes introducir tu contraseña actual.");
        }

        if (request.getNewPassword() == null || request.getNewPassword().isBlank()) {
            throw new IllegalArgumentException("Debes introducir la nueva contraseña.");
        }

        if (request.getConfirmPassword() == null || request.getConfirmPassword().isBlank()) {
            throw new IllegalArgumentException("Debes confirmar la nueva contraseña.");
        }

        if (!request.getNewPassword().equals(request.getConfirmPassword())) {
            throw new IllegalArgumentException("Las contraseñas no coinciden.");
        }

        if (!passwordEncoder.matches(request.getCurrentPassword(), user.getPassword())) {
            throw new SecurityException("Contraseña incorrecta.");
        }

        passwordPolicy.validateOrThrow(request.getNewPassword());

        if (passwordEncoder.matches(request.getNewPassword(), user.getPassword())) {
            throw new IllegalArgumentException("No puedes introducir la última contraseña.");
        }

        user.setPassword(passwordEncoder.encode(request.getNewPassword()));
        user.setTokenVersion(user.getTokenVersion() + 1);

        return userService.save(user);
    }

    @Override
    public User changeUsername(String tokenUsername, ChangeUsernameRequest request) {
        if (tokenUsername == null) {
            throw new IllegalArgumentException("Token inválido.");
        }

        if (request == null) {
            throw new IllegalArgumentException("Request inválida.");
        }

        User user = userService.getUserByUsername(tokenUsername);
        if (user == null) {
            throw new IllegalArgumentException("Usuario no encontrado.");
        }

        if (request.getNewUsername() == null || request.getNewUsername().isBlank()) {
            throw new IllegalArgumentException("El nuevo username no puede estar vacío.");
        }

        if (user.getUsername().equals(request.getNewUsername())) {
            throw new IllegalArgumentException("No puedes introducir el mismo username.");
        }

        if (request.getCurrentPassword() == null || request.getCurrentPassword().isBlank()) {
            throw new IllegalArgumentException("Debes introducir tu contraseña para cambiar el username.");
        }

        if (!passwordEncoder.matches(request.getCurrentPassword(), user.getPassword())) {
            throw new SecurityException("Contraseña incorrecta.");
        }

        if (userService.existsByUsername(request.getNewUsername())) {
            throw new IllegalArgumentException("El username ya existe.");
        }

        user.setUsername(request.getNewUsername().trim());
        user.setTokenVersion(user.getTokenVersion() + 1);

        return userService.save(user);
    }

    @Override
    public User updateProfileImage(String tokenUsername, MultipartFile file) {
        if (tokenUsername == null || tokenUsername.isBlank()) {
            throw new IllegalArgumentException("Token inválido.");
        }

        User user = userService.getUserByUsername(tokenUsername);
        if (user == null) {
            throw new IllegalArgumentException("Usuario no encontrado.");
        }

        String newProfileImagePath = storageService.saveProfileImage(
                file,
                user.getId(),
                user.getProfileImagePath()
        );

        user.setProfileImagePath(newProfileImagePath);
        return userService.save(user);
    }

    @Override
    public User removeProfileImage(String tokenUsername) {
        if (tokenUsername == null || tokenUsername.isBlank()) {
            throw new IllegalArgumentException("Token inválido.");
        }

        User user = userService.getUserByUsername(tokenUsername);
        if (user == null) {
            throw new IllegalArgumentException("Usuario no encontrado.");
        }

        if (user.getProfileImagePath() != null && !user.getProfileImagePath().isBlank()) {
            storageService.deleteProfileImage(user.getProfileImagePath());
            user.setProfileImagePath(null);
            return userService.save(user);
        }

        return user;
    }

    @Override
    public UserProfileResponse getProfileData(String tokenUsername) {
        if (tokenUsername == null || tokenUsername.isBlank()) {
            throw new IllegalArgumentException("Token inválido.");
        }

        User user = userService.getUserByUsername(tokenUsername);
        if (user == null) {
            throw new IllegalArgumentException("Usuario no encontrado.");
        }

        UserProfileResponse response = new UserProfileResponse();
        response.setId(user.getId());
        response.setUsername(user.getUsername());
        response.setRole(user.getRole().name());
        response.setProfileImagePath(user.getProfileImagePath());
        response.setHasAdminView(user.isAdmin());

        Organization organization = null;
        if (user instanceof PersonalUser personalUser) {
            organization = personalUser.getOrganization();
        } else if (user instanceof AdminUser adminUser) {
            organization = adminUser.getAdministeredOrganization();
        }

        if (organization != null) {
            response.setOrganizationId(organization.getId());
            response.setOrganizationName(organization.getName());
        }

        return response;
    }

    @Override
    public void deleteCurrentUser(String tokenUsername, DeleteAccountRequest request) {
        if (tokenUsername == null || tokenUsername.isBlank()) {
            throw new IllegalArgumentException("Token inválido.");
        }

        if (request == null || request.getCurrentPassword() == null || request.getCurrentPassword().isBlank()) {
            throw new IllegalArgumentException("Debes introducir tu contraseña actual.");
        }

        User user = userService.getUserByUsername(tokenUsername);
        if (user == null) {
            throw new IllegalArgumentException("Usuario no encontrado.");
        }

        if (!passwordEncoder.matches(request.getCurrentPassword(), user.getPassword())) {
            throw new SecurityException("Contraseña incorrecta.");
        }

        if (user.getProfileImagePath() != null && !user.getProfileImagePath().isBlank()) {
            storageService.deleteProfileImage(user.getProfileImagePath());
        }

        userService.delete(user);
    }
}
