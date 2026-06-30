package net.tfg.tfgapp.exception;

import org.springframework.http.HttpStatus;

/**
 * Excepción de aplicación para cortar el flujo y devolver un HTTP concreto.
 * <p>
 * Se lanza desde controladores/servicios cuando queremos indicar explícitamente
 * el código HTTP y el mensaje final que verá el cliente.
 */
public class ApiException extends RuntimeException {

    private final HttpStatus status;

    public ApiException(HttpStatus status, String message) {
        super(message);
        this.status = status;
    }

    public HttpStatus getStatus() {
        return status;
    }
}
