package net.tfg.tfgapp.controller;

import net.tfg.tfgapp.DTOs.users.AdminCreateOrganizationRequest;
import net.tfg.tfgapp.DTOs.users.AdminCreateUserRequest;
import net.tfg.tfgapp.DTOs.users.UserSummaryResponse;
import net.tfg.tfgapp.domains.Goal;
import net.tfg.tfgapp.domains.Organization;
import net.tfg.tfgapp.domains.User;
import net.tfg.tfgapp.exception.ApiException;
import net.tfg.tfgapp.xi18n.LanguageResolver;
import net.tfg.tfgapp.security.TokenService;
import net.tfg.tfgapp.service.interfaces.IAdminService;
import net.tfg.tfgapp.service.interfaces.IUserService;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

@RequestMapping("/admin")
@RestController
public class AdminController {

    private final IAdminService organizationAdminService;
    private final IUserService userService;
    private final TokenService tokenService;
    private final LanguageResolver languageResolver;

    public AdminController(IAdminService organizationAdminService,
                           IUserService userService,
                           TokenService tokenService,
                           LanguageResolver languageResolver) {
        this.organizationAdminService = organizationAdminService;
        this.userService = userService;
        this.tokenService = tokenService;
        this.languageResolver = languageResolver;
    }

    @GetMapping("/users")
    public ResponseEntity<List<UserSummaryResponse>> getManagedUsers(@RequestHeader("Authorization") String authHeader,
                                             @RequestHeader(value = "Accept-Language", required = false) String acceptLanguage) {
        String token = extractAndVerifyToken(authHeader, acceptLanguage);
        String adminUsername = tokenService.extractUsername(token);

        List<UserSummaryResponse> users = organizationAdminService.getManagedUsers(adminUsername);
        return ResponseEntity.ok(users);
    }

    @PostMapping("/users")
    public ResponseEntity<UserSummaryResponse> createManagedUser(@RequestHeader("Authorization") String authHeader,
                                               @RequestHeader(value = "Accept-Language", required = false) String acceptLanguage,
                                               @RequestBody AdminCreateUserRequest request) {
        String token = extractAndVerifyToken(authHeader, acceptLanguage);
        String adminUsername = tokenService.extractUsername(token);

        UserSummaryResponse createdUser = organizationAdminService.createManagedUser(adminUsername, request);
        return ResponseEntity.status(HttpStatus.CREATED).body(createdUser);
    }

    @DeleteMapping("/users/{userId}")
    public ResponseEntity<Void> deleteManagedUser(@RequestHeader("Authorization") String authHeader,
                                               @RequestHeader(value = "Accept-Language", required = false) String acceptLanguage,
                                               @PathVariable Long userId) {
        String token = extractAndVerifyToken(authHeader, acceptLanguage);
        String adminUsername = tokenService.extractUsername(token);

        organizationAdminService.deleteManagedUser(adminUsername, userId);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/organization")
    public ResponseEntity<Map<String, Object>> createOrganization(@RequestHeader("Authorization") String authHeader,
                                                @RequestHeader(value = "Accept-Language", required = false) String acceptLanguage,
                                                @RequestBody AdminCreateOrganizationRequest request) {
        String token = extractAndVerifyToken(authHeader, acceptLanguage);
        String adminUsername = tokenService.extractUsername(token);

        Organization organization = organizationAdminService.createOrganizationForAdmin(adminUsername, request);

        Map<String, Object> response = new HashMap<>();
        response.put("organizationId", organization.getId());
        response.put("organizationName", organization.getName());
        response.put("message", languageResolver.text(acceptLanguage, "organization.created"));

        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    @GetMapping("/users/{userId}/goals")
    public ResponseEntity<List<Goal>> getManagedUserGoals(@RequestHeader("Authorization") String authHeader,
                                                 @RequestHeader(value = "Accept-Language", required = false) String acceptLanguage,
                                                 @PathVariable Long userId) {
        String token = extractAndVerifyToken(authHeader, acceptLanguage);
        String adminUsername = tokenService.extractUsername(token);

        List<Goal> goals = organizationAdminService.getManagedUserGoals(adminUsername, userId);
        return ResponseEntity.ok(goals);
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
