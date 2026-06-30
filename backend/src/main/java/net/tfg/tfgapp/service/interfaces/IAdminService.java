package net.tfg.tfgapp.service.interfaces;

import net.tfg.tfgapp.DTOs.users.AdminCreateOrganizationRequest;
import net.tfg.tfgapp.DTOs.users.AdminCreateUserRequest;
import net.tfg.tfgapp.DTOs.users.UserSummaryResponse;
import net.tfg.tfgapp.domains.Goal;
import net.tfg.tfgapp.domains.Organization;

import java.util.List;

public interface IAdminService {

    UserSummaryResponse createManagedUser(String adminUsername, AdminCreateUserRequest request);

    void deleteManagedUser(String adminUsername, Long userId);

    List<UserSummaryResponse> getManagedUsers(String adminUsername);

    Organization createOrganizationForAdmin(String adminUsername, AdminCreateOrganizationRequest request);

    List<Goal> getManagedUserGoals(String adminUsername, Long managedUserId);
}
