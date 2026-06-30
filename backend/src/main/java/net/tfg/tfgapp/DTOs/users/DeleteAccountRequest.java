package net.tfg.tfgapp.DTOs.users;

import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class DeleteAccountRequest {

    private String currentPassword;
}
