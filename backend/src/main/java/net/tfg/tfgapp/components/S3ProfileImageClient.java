package net.tfg.tfgapp.components;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Acceso a las fotos de perfil guardadas en un bucket S3 privado.
 *
 * El backend corre en el PC del usuario, así que no lleva claves de AWS: pide a una
 * Lambda (infra/aws/profile-image-signer) URLs firmadas de corta duración para un
 * único fichero, y sube o descarga la imagen directamente contra S3 con ellas.
 * La Lambda solo firma claves del tipo profile-images/user_<id>_<ts>.<ext>.
 */
@Component
public class S3ProfileImageClient {

    private static final Duration HTTP_TIMEOUT = Duration.ofSeconds(15);
    /** Las URLs de descarga duran 15 min en la Lambda; se reutilizan 10 min para no pedir una por cada render. */
    private static final long DOWNLOAD_URL_CACHE_MS = 10 * 60 * 1000L;

    private final boolean enabled;
    private final String signerUrl;
    private final String signerKey;
    private final ObjectMapper objectMapper;
    private final HttpClient httpClient = HttpClient.newBuilder().connectTimeout(HTTP_TIMEOUT).build();
    private final Map<String, CachedUrl> downloadUrls = new ConcurrentHashMap<>();

    public S3ProfileImageClient(@Value("${storage.profile-images.mode:local}") String mode,
                                @Value("${storage.profile-images.signer-url:}") String signerUrl,
                                @Value("${storage.profile-images.signer-key:}") String signerKey,
                                ObjectMapper objectMapper) {
        this.enabled = "s3".equalsIgnoreCase(mode == null ? "" : mode.trim());
        this.signerUrl = signerUrl;
        this.signerKey = signerKey;
        this.objectMapper = objectMapper;

        if (enabled && (signerUrl == null || signerUrl.isBlank() || signerKey == null || signerKey.isBlank())) {
            throw new IllegalStateException(
                    "PROFILE_IMAGES_MODE=s3 requiere PROFILE_IMAGES_SIGNER_URL y PROFILE_IMAGES_SIGNER_KEY.");
        }
    }

    public boolean isEnabled() {
        return enabled;
    }

    public void upload(String key, byte[] content, String contentType) {
        Map<String, Object> request = new LinkedHashMap<>();
        request.put("action", "upload");
        request.put("key", key);
        request.put("contentType", contentType);
        request.put("contentLength", content.length);
        String uploadUrl = requestSignedUrl(request);

        HttpRequest put = HttpRequest.newBuilder(URI.create(uploadUrl))
                .timeout(HTTP_TIMEOUT)
                .header("Content-Type", contentType)
                .PUT(HttpRequest.BodyPublishers.ofByteArray(content))
                .build();
        HttpResponse<String> response = send(put);
        if (response.statusCode() / 100 != 2) {
            throw new IllegalStateException("S3 rechazó la subida de la imagen (HTTP " + response.statusCode() + ").");
        }
    }

    public String downloadUrl(String key) {
        CachedUrl cached = downloadUrls.get(key);
        if (cached != null && cached.expiresAtMs() > System.currentTimeMillis()) {
            return cached.url();
        }

        String url = requestSignedUrl(Map.of("action", "download", "key", key));
        downloadUrls.put(key, new CachedUrl(url, System.currentTimeMillis() + DOWNLOAD_URL_CACHE_MS));
        return url;
    }

    public void delete(String key) {
        downloadUrls.remove(key);
        callSigner(Map.of("action", "delete", "key", key));
    }

    private String requestSignedUrl(Map<String, Object> request) {
        JsonNode body = callSigner(request);
        JsonNode url = body == null ? null : body.get("url");
        if (url == null || url.asText().isBlank()) {
            throw new IllegalStateException("La Lambda de firmado no devolvió ninguna URL.");
        }
        return url.asText();
    }

    private JsonNode callSigner(Map<String, Object> request) {
        try {
            HttpRequest httpRequest = HttpRequest.newBuilder(URI.create(signerUrl))
                    .timeout(HTTP_TIMEOUT)
                    .header("Content-Type", "application/json")
                    .header("x-gmo-signer-key", signerKey)
                    .POST(HttpRequest.BodyPublishers.ofString(objectMapper.writeValueAsString(request)))
                    .build();
            HttpResponse<String> response = send(httpRequest);
            if (response.statusCode() / 100 != 2) {
                throw new IllegalStateException("La Lambda de firmado respondió HTTP " + response.statusCode() + ".");
            }
            String responseBody = response.body();
            return responseBody == null || responseBody.isBlank() ? null : objectMapper.readTree(responseBody);
        } catch (IOException e) {
            throw new IllegalStateException("Respuesta no válida de la Lambda de firmado.", e);
        }
    }

    private HttpResponse<String> send(HttpRequest request) {
        try {
            return httpClient.send(request, HttpResponse.BodyHandlers.ofString());
        } catch (IOException e) {
            throw new IllegalStateException("No se pudo conectar con el almacenamiento de imágenes.", e);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new IllegalStateException("Operación con el almacenamiento de imágenes interrumpida.", e);
        }
    }

    private record CachedUrl(String url, long expiresAtMs) {
    }
}
