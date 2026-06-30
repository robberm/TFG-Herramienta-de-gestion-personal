package net.tfg.tfgapp.xi18n;

import org.springframework.stereotype.Component;

import java.util.HashMap;
import java.util.Map;

@Component
public class LanguageResolver {
    private static final String HABIT_NOT_FOUND_KEY = "habit.notFound";
    private static final String HABIT_NO_ACCESS_KEY = "habit.noAccess";
    private static final String GOAL_NOT_FOUND_KEY = "goal.notFound";
    private static final String GOAL_NO_ACCESS_KEY = "goal.noAccess";
    private static final String EVENT_NO_ACCESS_KEY = "event.noAccess";

    private static final Map<String, String> TEXT_TO_TRANSLATION_KEY = new HashMap<>();

    static {
        TEXT_TO_TRANSLATION_KEY.put("Revisa los datos enviados.", "errors.validation.invalidData");
        TEXT_TO_TRANSLATION_KEY.put("Ha ocurrido un error interno.", "errors.internal");
        TEXT_TO_TRANSLATION_KEY.put("Token de autenticación no proporcionado o formato incorrecto.", "errors.auth.tokenMissing");
        TEXT_TO_TRANSLATION_KEY.put("Token de autenticación inválido o expirado.", "errors.auth.tokenInvalid");
        TEXT_TO_TRANSLATION_KEY.put("Usuario asociado al token no encontrado.", "errors.auth.userNotFound");
        TEXT_TO_TRANSLATION_KEY.put("Token revocado o no válido.", "errors.auth.tokenRevoked");
        TEXT_TO_TRANSLATION_KEY.put("Hábito no encontrado.", HABIT_NOT_FOUND_KEY);
        TEXT_TO_TRANSLATION_KEY.put("No tienes permiso para acceder o modificar este hábito.", HABIT_NO_ACCESS_KEY);
        TEXT_TO_TRANSLATION_KEY.put("No tienes permiso para acceder a este hábito.", HABIT_NO_ACCESS_KEY);
        TEXT_TO_TRANSLATION_KEY.put("No tienes permiso para actualizar este hábito.", HABIT_NO_ACCESS_KEY);
        TEXT_TO_TRANSLATION_KEY.put("No tienes permiso para eliminar este hábito.", HABIT_NO_ACCESS_KEY);
        TEXT_TO_TRANSLATION_KEY.put("Hábito eliminado correctamente.", "habit.deleted");
        TEXT_TO_TRANSLATION_KEY.put("Objetivo no encontrado.", GOAL_NOT_FOUND_KEY);
        TEXT_TO_TRANSLATION_KEY.put("No tienes permiso para acceder o modificar este objetivo.", GOAL_NO_ACCESS_KEY);
        TEXT_TO_TRANSLATION_KEY.put("No tienes permiso para actualizar este objetivo.", GOAL_NO_ACCESS_KEY);
        TEXT_TO_TRANSLATION_KEY.put("No tienes permiso para acceder a este objetivo.", GOAL_NO_ACCESS_KEY);
        TEXT_TO_TRANSLATION_KEY.put("No tienes permiso para eliminar este objetivo.", GOAL_NO_ACCESS_KEY);
        TEXT_TO_TRANSLATION_KEY.put("Objetivo eliminado correctamente.", "goal.deleted");
        TEXT_TO_TRANSLATION_KEY.put("Evento no encontrado.", "event.notFound");
        TEXT_TO_TRANSLATION_KEY.put("No tienes permiso para acceder o modificar este evento.", EVENT_NO_ACCESS_KEY);
        TEXT_TO_TRANSLATION_KEY.put("No tienes permiso para actualizar este evento.", EVENT_NO_ACCESS_KEY);
        TEXT_TO_TRANSLATION_KEY.put("No tienes permiso para eliminar este evento.", EVENT_NO_ACCESS_KEY);
        TEXT_TO_TRANSLATION_KEY.put("Usuario no encontrado.", "user.notFound");
    }

    public String resolveLanguage(String acceptLanguageHeader) {
        if (acceptLanguageHeader == null || acceptLanguageHeader.isBlank()) {
            return "en";
        }

        String normalized = acceptLanguageHeader.toLowerCase();
        return normalized.startsWith("es") ? "es" : "en";
    }

    public String text(String acceptLanguageHeader, String key) {
        String language = resolveLanguage(acceptLanguageHeader);
        Map<String, String> dictionary = "es".equals(language) ? TextConstants.ES : TextConstants.EN;
        return dictionary.getOrDefault(key, TextConstants.EN.getOrDefault(key, key));
    }

    public String textOrKey(String acceptLanguageHeader, String messageOrKey) {
        String key = TEXT_TO_TRANSLATION_KEY.getOrDefault(messageOrKey, messageOrKey);
        return text(acceptLanguageHeader, key);
    }
}
