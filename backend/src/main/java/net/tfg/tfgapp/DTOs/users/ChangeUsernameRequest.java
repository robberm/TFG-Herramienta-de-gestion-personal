package net.tfg.tfgapp.DTOs.users;

import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class ChangeUsernameRequest {

    private String newUsername;
    private String currentPassword;
}
