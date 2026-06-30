package net.tfg.tfgapp.controller;

import net.tfg.tfgapp.DTOs.users.ChangePasswordRequest;
import net.tfg.tfgapp.DTOs.users.ChangeUsernameRequest;
import net.tfg.tfgapp.DTOs.users.DeleteAccountRequest;
import net.tfg.tfgapp.DTOs.users.LoginRequest;
import net.tfg.tfgapp.DTOs.users.UserProfileResponse;
import net.tfg.tfgapp.domains.AdminUser;
import net.tfg.tfgapp.domains.Organization;
import net.tfg.tfgapp.domains.PersonalUser;
import net.tfg.tfgapp.domains.User;
import net.tfg.tfgapp.exception.ApiException;
import net.tfg.tfgapp.xi18n.LanguageResolver;
import net.tfg.tfgapp.security.TokenService;
import net.tfg.tfgapp.service.interfaces.AccountService;
import net.tfg.tfgapp.service.interfaces.IUserService;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import java.util.HashMap;
import java.util.Map;

@RequestMapping("/users")
@RestController
public class UserController {

    private static final String TOKEN_KEY = "token";
    private static final String USERNAME_KEY = "username";
    private static final String ROLE_KEY = "role";
    private static final String ORGANIZATION_ID_KEY = "organizationId";
    private static final String ORGANIZATION_NAME_KEY = "organizationName";
    private static final String MESSAGE_KEY = "message";
    private static final String PROFILE_IMAGE_PATH_KEY = "profileImagePath";

    private final IUserService userService;
    private final TokenService tokenService;
    private final AccountService accountService;
    private final LanguageResolver languageResolver;

    public UserController(IUserService userService,
                          TokenService tokenService,
                          AccountService accountService,
                          LanguageResolver languageResolver) {
        this.userService = userService;
        this.tokenService = tokenService;
        this.accountService = accountService;
        this.languageResolver = languageResolver;
    }

    @PostMapping("/login")
    public ResponseEntity<Map<String, Object>> loginUser(@RequestBody LoginRequest request,
                                       @RequestHeader(value = "Accept-Language", required = false) String acceptLanguage,
                                       @RequestHeader(value = "X-Client-Platform", required = false) String clientPlatform) {
        boolean authenticated = accountService.authenticate(request);

        if (!authenticated) {
            throw new ApiException(
                    HttpStatus.UNAUTHORIZED,
                    languageResolver.text(acceptLanguage, "auth.login.invalidCredentials")
            );
        }

        User user = userService.getUserByUsername(request.getUsername());
        String token = tokenService.generateToken(user.getUsername(), user.getTokenVersion(), isDesktopClient(clientPlatform));

        return ResponseEntity.ok(buildAccountResponse(
                user,
                token,
                languageResolver.text(acceptLanguage, "auth.login.success")
        ));
    }

    /**
     * Registro público para usuarios personales.
     */
    @PostMapping("/register")
    public ResponseEntity<Map<String, Object>> registerUser(@RequestBody PersonalUser newUser,
                                          @RequestHeader(value = "Accept-Language", required = false) String acceptLanguage,
                                          @RequestHeader(value = "X-Client-Platform", required = false) String clientPlatform) {
        User user = accountService.register(newUser);

        String token = tokenService.generateToken(user.getUsername(), user.getTokenVersion(), isDesktopClient(clientPlatform));

        return ResponseEntity.ok(buildAccountResponse(
                user,
                token,
                languageResolver.text(acceptLanguage, "auth.register.success")
        ));
    }

    @PostMapping("change/password")
    public ResponseEntity<Map<String, Object>> changePassword(@RequestBody ChangePasswordRequest request,
                                            @RequestHeader("Authorization") String authHeader,
                                            @RequestHeader(value = "Accept-Language", required = false) String acceptLanguage,
                                            @RequestHeader(value = "X-Client-Platform", required = false) String clientPlatform) {
        String token = extractAndVerifyToken(authHeader, acceptLanguage);
        String usernameFromToken = tokenService.extractUsername(token);

        User updatedUser = accountService.changePassword(usernameFromToken, request);
        String newToken = tokenService.generateToken(updatedUser.getUsername(), updatedUser.getTokenVersion(), isDesktopClient(clientPlatform));

        return ResponseEntity.ok(buildAccountResponse(
                updatedUser,
                newToken,
                languageResolver.text(acceptLanguage, "account.password.changed")
        ));
    }

    @PostMapping("change/username")
    public ResponseEntity<Map<String, Object>> changeUsername(@RequestBody ChangeUsernameRequest request,
                                            @RequestHeader("Authorization") String authHeader,
                                            @RequestHeader(value = "Accept-Language", required = false) String acceptLanguage,
                                            @RequestHeader(value = "X-Client-Platform", required = false) String clientPlatform) {
        String token = extractAndVerifyToken(authHeader, acceptLanguage);
        String usernameFromToken = tokenService.extractUsername(token);

        User updatedUser = accountService.changeUsername(usernameFromToken, request);
        String newToken = tokenService.generateToken(updatedUser.getUsername(), updatedUser.getTokenVersion(), isDesktopClient(clientPlatform));

        return ResponseEntity.ok(buildAccountResponse(
                updatedUser,
                newToken,
                languageResolver.text(acceptLanguage, "account.username.changed")
        ));
    }

    @GetMapping("/me")
    public ResponseEntity<UserProfileResponse> getCurrentUserProfile(@RequestHeader("Authorization") String authHeader) {
        String token = extractAndVerifyToken(authHeader, null);
        String usernameFromToken = tokenService.extractUsername(token);

        UserProfileResponse response = accountService.getProfileData(usernameFromToken);
        return ResponseEntity.ok(response);
    }

    @PutMapping(value = "/profile-image", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<Map<String, Object>> updateProfileImage(@RequestParam("file") MultipartFile file,
                                                @RequestHeader("Authorization") String authHeader,
                                                @RequestHeader(value = "Accept-Language", required = false) String acceptLanguage) {
        String token = extractAndVerifyToken(authHeader, acceptLanguage);
        String usernameFromToken = tokenService.extractUsername(token);

        User updatedUser = accountService.updateProfileImage(usernameFromToken, file);

        return ResponseEntity.ok(buildProfileImageResponse(
                languageResolver.text(acceptLanguage, "profile.image.updated"),
                updatedUser.getProfileImagePath()
        ));
    }

    @DeleteMapping("/profile-image")
    public ResponseEntity<Map<String, Object>> deleteProfileImage(@RequestHeader("Authorization") String authHeader,
                                                @RequestHeader(value = "Accept-Language", required = false) String acceptLanguage) {
        String token = extractAndVerifyToken(authHeader, acceptLanguage);
        String usernameFromToken = tokenService.extractUsername(token);

        accountService.removeProfileImage(usernameFromToken);

        return ResponseEntity.ok(buildProfileImageResponse(
                languageResolver.text(acceptLanguage, "profile.image.deleted"),
                null
        ));
    }

    @DeleteMapping("/me")
    public ResponseEntity<Map<String, Object>> deleteCurrentUser(@RequestHeader("Authorization") String authHeader,
                                               @RequestHeader(value = "Accept-Language", required = false) String acceptLanguage,
                                               @RequestBody(required = false) DeleteAccountRequest request) {
        String token = extractAndVerifyToken(authHeader, acceptLanguage);
        String usernameFromToken = tokenService.extractUsername(token);

        accountService.deleteCurrentUser(usernameFromToken, request);

        return ResponseEntity.ok(buildMessageResponse(languageResolver.text(acceptLanguage, "account.deleted")));
    }

    private Map<String, Object> buildAccountResponse(User user, String token, String message) {
        Map<String, Object> response = new HashMap<>();
        response.put(TOKEN_KEY, token);
        response.put(USERNAME_KEY, user.getUsername());
        response.put(ROLE_KEY, user.getRole().name());
        response.put(ORGANIZATION_ID_KEY, organizationId(user));
        response.put(ORGANIZATION_NAME_KEY, organizationName(user));
        response.put(MESSAGE_KEY, message);
        return response;
    }

    private Map<String, Object> buildProfileImageResponse(String message, String profileImagePath) {
        Map<String, Object> response = buildMessageResponse(message);
        response.put(PROFILE_IMAGE_PATH_KEY, profileImagePath);
        return response;
    }

    private Map<String, Object> buildMessageResponse(String message) {
        Map<String, Object> response = new HashMap<>();
        response.put(MESSAGE_KEY, message);
        return response;
    }

    private Long organizationId(User user) {
        Organization organization = organizationFor(user);
        return organization != null ? organization.getId() : null;
    }

    private String organizationName(User user) {
        Organization organization = organizationFor(user);
        return organization != null ? organization.getName() : null;
    }

    private Organization organizationFor(User user) {
        if (user instanceof PersonalUser personalUser) {
            return personalUser.getOrganization();
        }

        if (user instanceof AdminUser adminUser) {
            return adminUser.getAdministeredOrganization();
        }

        return null;
    }

    private boolean isDesktopClient(String clientPlatform) {
        return clientPlatform != null && clientPlatform.equalsIgnoreCase("desktop");
    }

    private String extractAndVerifyToken(String authHeader, String acceptLanguage) {
        if (authHeader == null || !authHeader.startsWith("Bearer ")) {
            throw new ApiException(HttpStatus.UNAUTHORIZED, languageResolver.text(acceptLanguage, "errors.auth.tokenMissing"));
        }

        String token = tokenService.extractBearerToken(authHeader);

        if (!tokenService.validateToken(token)) {
            throw new ApiException(HttpStatus.UNAUTHORIZED, languageResolver.text(acceptLanguage, "errors.auth.tokenInvalid"));
        }

        String username = tokenService.extractUsername(token);
        User user = userService.getUserByUsername(username);

        if (user == null) {
            throw new ApiException(HttpStatus.UNAUTHORIZED, languageResolver.text(acceptLanguage, "errors.auth.userNotFound"));
        }

        if (!tokenService.validateToken(token, user.getUsername(), user.getTokenVersion())) {
            throw new ApiException(HttpStatus.UNAUTHORIZED, languageResolver.text(acceptLanguage, "errors.auth.tokenRevoked"));
        }

        return token;
    }
}
