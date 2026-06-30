package net.tfg.tfgapp.validation;

public interface PasswordPolicy {

    void validateOrThrow(String rawPassword);
}