package net.tfg.tfgapp.components.ai;

/**
 * Fallo al hablar con el proveedor de IA. El tipo permite a la UI distinguir una clave
 * mal configurada (el usuario debe corregirla) de una caída temporal.
 */
public class AiProviderException extends RuntimeException {
    public enum Kind {
        /** Clave rechazada (401/403) o modelo inexistente (404). */
        INVALID_CONFIGURATION,
        /** Sin red, timeout, 429 o error 5xx del proveedor. */
        UNAVAILABLE,
        /** El proveedor respondió, pero no con lo que se le pidió (JSON roto, rechazo). */
        BAD_RESPONSE
    }

    private final Kind kind;

    public AiProviderException(Kind kind, String message) {
        super(message);
        this.kind = kind;
    }

    public AiProviderException(Kind kind, String message, Throwable cause) {
        super(message, cause);
        this.kind = kind;
    }

    public Kind getKind() {
        return kind;
    }
}
