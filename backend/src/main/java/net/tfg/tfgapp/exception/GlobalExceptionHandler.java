package net.tfg.tfgapp.exception;

import jakarta.servlet.http.HttpServletRequest;
import net.tfg.tfgapp.DTOs.errors.ApiErrorResponse;
import net.tfg.tfgapp.xi18n.LanguageResolver;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.FieldError;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

import java.time.DateTimeException;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Map;

/**
 * Manejador global de excepciones de toda la API.
 * <p>
 * Spring entra aquí cuando un controlador lanza una excepción.
 * Según el tipo de excepción, construimos el status HTTP adecuado.
 * Por ejemplo: {@link SecurityException} se traduce a 403 FORBIDDEN.
 */
@RestControllerAdvice
public class GlobalExceptionHandler {
    private final LanguageResolver languageResolver;

    public GlobalExceptionHandler(LanguageResolver languageResolver) {
        this.languageResolver = languageResolver;
    }

    /**
     * Excepciones explícitas de negocio que ya indican el status HTTP final.
     */
    @ExceptionHandler(ApiException.class)
    public ResponseEntity<ApiErrorResponse> handleApiException(ApiException ex, HttpServletRequest request) {
        return buildResponse(ex.getStatus(), ex.getMessage(), request, null);
    }

    /**
     * Errores de validación automáticos de Spring (DTOs anotados con @Valid).
     */
    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<ApiErrorResponse> handleValidation(MethodArgumentNotValidException ex,
                                                             HttpServletRequest request) {
        Map<String, String> details = new LinkedHashMap<>();
        for (FieldError error : ex.getBindingResult().getFieldErrors()) {
            details.put(error.getField(), error.getDefaultMessage());
        }

        return buildResponse(HttpStatus.BAD_REQUEST, "errors.validation.invalidData", request, details);
    }

    @ExceptionHandler(IllegalArgumentException.class)
    public ResponseEntity<ApiErrorResponse> handleIllegalArgument(IllegalArgumentException ex,
                                                                   HttpServletRequest request) {
        return buildResponse(HttpStatus.BAD_REQUEST, ex.getMessage(), request, null);
    }

    @ExceptionHandler(IllegalStateException.class)
    public ResponseEntity<ApiErrorResponse> handleIllegalState(IllegalStateException ex,
                                                                HttpServletRequest request) {
        return buildResponse(HttpStatus.CONFLICT, ex.getMessage(), request, null);
    }

    /**
     * Cualquier problema de permisos/autorización funcional.
     * Se responde como 403 para que frontend sepa que es acceso denegado.
     */
    @ExceptionHandler(SecurityException.class)
    public ResponseEntity<ApiErrorResponse> handleSecurity(SecurityException ex,
                                                           HttpServletRequest request) {
        return buildResponse(HttpStatus.FORBIDDEN, ex.getMessage(), request, null);
    }

    @ExceptionHandler(DateTimeException.class)
    public ResponseEntity<ApiErrorResponse> handleDateTime(DateTimeException ex,
                                                           HttpServletRequest request) {
        return buildResponse(HttpStatus.BAD_REQUEST, ex.getMessage(), request, null);
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<ApiErrorResponse> handleGeneric(Exception ex,
                                                          HttpServletRequest request) {
        return buildResponse(HttpStatus.INTERNAL_SERVER_ERROR, "errors.internal", request, null);
    }

    private ResponseEntity<ApiErrorResponse> buildResponse(HttpStatus status,
                                                           String message,
                                                           HttpServletRequest request,
                                                           Map<String, String> details) {
        ApiErrorResponse response = new ApiErrorResponse();
        String acceptLanguage = request.getHeader("Accept-Language");
        String localizedMessage = languageResolver.textOrKey(acceptLanguage, message);
        response.setTimestamp(Instant.now());
        response.setStatus(status.value());
        response.setError(status.name());
        response.setMessage(localizedMessage);
        response.setPath(request.getRequestURI());
        response.setDetails(details);

        return ResponseEntity.status(status).body(response);
    }
}
