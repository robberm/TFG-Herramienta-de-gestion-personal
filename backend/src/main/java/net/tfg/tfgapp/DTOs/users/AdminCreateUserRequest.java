package net.tfg.tfgapp.DTOs.users;

import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class AdminCreateUserRequest {

    private String username;
    private String password;
}