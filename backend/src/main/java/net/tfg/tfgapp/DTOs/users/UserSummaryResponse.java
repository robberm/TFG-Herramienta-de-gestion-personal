package net.tfg.tfgapp.DTOs.users;



import lombok.Getter;
import lombok.Setter;
import net.tfg.tfgapp.domains.AdminUser;
import net.tfg.tfgapp.domains.Organization;
import net.tfg.tfgapp.domains.PersonalUser;
import net.tfg.tfgapp.domains.User;

@Getter
@Setter
public class UserSummaryResponse {

    private Long id;
    private String username;
    private String role;
    private Long organizationId;
    private String organizationName;
    private String profileImagePath;

    public static UserSummaryResponse fromUser(User user) {
        UserSummaryResponse response = new UserSummaryResponse();
        response.setId(user.getId());
        response.setUsername(user.getUsername());
        response.setRole(user.getRole().name());
        response.setProfileImagePath(user.getProfileImagePath());

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
}