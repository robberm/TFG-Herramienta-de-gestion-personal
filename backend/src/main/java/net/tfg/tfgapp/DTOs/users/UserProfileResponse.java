package net.tfg.tfgapp.DTOs.users;



import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class UserProfileResponse {

    private Long id;
    private String username;
    private String role;
    private String profileImagePath;
    private Long organizationId;
    private String organizationName;
    private boolean hasAdminView;
}
