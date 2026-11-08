package net.tfg.tfgapp.DTOs.ai;

/**
 * Estado de la pregunta de hoy. La app solo se bloquea en PENDING: si la IA no está
 * configurada en este PC o el proveedor falla, el usuario nunca se queda sin acceso.
 */
public record DailyQuestionStatus(State state, DailyQuestionView question, String error) {
    public enum State {
        /** No hay clave de IA en este PC. */
        NOT_CONFIGURED,
        /** No se pudo generar la pregunta (sin red, clave rechazada...). */
        UNAVAILABLE,
        /** Hay pregunta sin contestar: la app se bloquea. */
        PENDING,
        ANSWERED
    }

    public static DailyQuestionStatus notConfigured() {
        return new DailyQuestionStatus(State.NOT_CONFIGURED, null, null);
    }

    public static DailyQuestionStatus unavailable(String error) {
        return new DailyQuestionStatus(State.UNAVAILABLE, null, error);
    }

    public static DailyQuestionStatus of(DailyQuestionView question) {
        return new DailyQuestionStatus(question.answered() ? State.ANSWERED : State.PENDING, question, null);
    }
}
