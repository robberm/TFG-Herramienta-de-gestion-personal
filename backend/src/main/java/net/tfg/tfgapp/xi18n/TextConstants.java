package net.tfg.tfgapp.xi18n;

import java.util.Map;

public final class TextConstants {

    private TextConstants() {
    }

    public static final Map<String, String> EN = Map.ofEntries(
            Map.entry("auth.login.invalidCredentials", "Invalid username or password."),
            Map.entry("auth.login.success", "Log-in successful!"),
            Map.entry("auth.register.success", "User registered successfully."),
            Map.entry("account.password.changed", "Password updated successfully."),
            Map.entry("account.username.changed", "Username updated successfully."),
            Map.entry("account.deleted", "User deleted successfully."),
            Map.entry("profile.image.updated", "Profile image updated successfully."),
            Map.entry("profile.image.deleted", "Profile image removed successfully."),
            Map.entry("goal.notFound", "Goal not found."),
            Map.entry("goal.noAccess", "You do not have permission for this goal."),
            Map.entry("goal.deleted", "Goal deleted successfully."),
            Map.entry("habit.notFound", "Habit not found."),
            Map.entry("habit.noAccess", "You do not have permission for this habit."),
            Map.entry("habit.deleted", "Habit deleted successfully."),
            Map.entry("event.notFound", "Event not found."),
            Map.entry("event.noAccess", "You do not have permission for this event."),
            Map.entry("user.notFound", "User not found."),
            Map.entry("apps.blocked.added", "Application added successfully."),
            Map.entry("apps.blocked.removed", "Application removed successfully."),
            Map.entry("apps.blocked.reset", "Blocked apps configuration reset to default."),
            Map.entry("errors.validation.invalidData", "Please review the submitted data."),
            Map.entry("errors.internal", "An internal error occurred."),
            Map.entry("errors.auth.tokenMissing", "Authentication token missing or invalid format."),
            Map.entry("errors.auth.tokenInvalid", "Invalid or expired authentication token."),
            Map.entry("errors.auth.userNotFound", "User associated with token was not found."),
            Map.entry("errors.auth.tokenRevoked", "Revoked or invalid token."),
            Map.entry("errors.profile.load", "Unable to load profile."),
            Map.entry("errors.profile.update", "Unable to update profile image."),
            Map.entry("errors.profile.delete", "Unable to delete profile image."),
            Map.entry("errors.username.update", "Unable to update username."),
            Map.entry("errors.password.update", "Unable to update password."));

    public static final Map<String, String> ES = Map.ofEntries(
            Map.entry("auth.login.invalidCredentials", "Usuario o contraseña inválida."),
            Map.entry("auth.login.success", "Log-in correcto!"),
            Map.entry("auth.register.success", "Usuario registrado correctamente."),
            Map.entry("account.password.changed", "Contraseña actualizada correctamente."),
            Map.entry("account.username.changed", "Username actualizado correctamente."),
            Map.entry("account.deleted", "Usuario eliminado correctamente."),
            Map.entry("profile.image.updated", "Imagen de perfil actualizada correctamente."),
            Map.entry("profile.image.deleted", "Imagen de perfil eliminada correctamente."),
            Map.entry("goal.notFound", "Objetivo no encontrado."),
            Map.entry("goal.noAccess", "No tienes permiso para acceder o modificar este objetivo."),
            Map.entry("goal.deleted", "Objetivo eliminado correctamente."),
            Map.entry("habit.notFound", "Hábito no encontrado."),
            Map.entry("habit.noAccess", "No tienes permiso para acceder o modificar este hábito."),
            Map.entry("habit.deleted", "Hábito eliminado correctamente."),
            Map.entry("event.notFound", "Evento no encontrado."),
            Map.entry("event.noAccess", "No tienes permiso para acceder o modificar este evento."),
            Map.entry("user.notFound", "Usuario no encontrado."),
            Map.entry("apps.blocked.added", "Aplicación añadida correctamente."),
            Map.entry("apps.blocked.removed", "Aplicación borrada correctamente."),
            Map.entry("apps.blocked.reset", "Configuración completamente reseteada a valores por defecto."),
            Map.entry("errors.validation.invalidData", "Revisa los datos enviados."),
            Map.entry("errors.internal", "Ha ocurrido un error interno."),
            Map.entry("errors.auth.tokenMissing", "Token de autenticación no proporcionado o formato incorrecto."),
            Map.entry("errors.auth.tokenInvalid", "Token de autenticación inválido o expirado."),
            Map.entry("errors.auth.userNotFound", "Usuario asociado al token no encontrado."),
            Map.entry("errors.auth.tokenRevoked", "Token revocado o no válido."),
            Map.entry("errors.profile.load", "No se pudo cargar el perfil."),
            Map.entry("errors.profile.update", "No se pudo actualizar la foto de perfil."),
            Map.entry("errors.profile.delete", "No se pudo eliminar la foto."),
            Map.entry("errors.username.update", "No se pudo actualizar el username."),
            Map.entry("errors.password.update", "No se pudo actualizar la contraseña."));
}
