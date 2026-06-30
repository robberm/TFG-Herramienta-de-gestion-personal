package net.tfg.tfgapp.validation;

import org.springframework.stereotype.Component;

@Component
public class RegexPasswordPolicy implements PasswordPolicy {

    private static final String REGEX = "^(?=.*[A-Za-z])(?=.*\\d)(?=.*[@$!%*?&])[A-Za-z\\d@$!%*?&]{10,}$";

    @Override
    public void validateOrThrow(String rawPassword) {
        if (rawPassword == null || rawPassword.isBlank()) {
            throw new IllegalArgumentException("La contraseña no puede estar vacía.");
        }
        if (!rawPassword.matches(REGEX)) {
            throw new IllegalArgumentException("La contraseña debe tener al menos 10 caracteres, incluir letras, números y un símbolo.");
        }
    }
}