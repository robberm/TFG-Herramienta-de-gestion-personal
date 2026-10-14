package net.tfg.tfgapp.controller;

import net.tfg.tfgapp.components.S3ProfileImageClient;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RestController;

import java.util.regex.Pattern;

/**
 * En modo s3 las fotos ya no están en ./uploads: esta ruta (la misma que usa el frontend)
 * redirige a una URL firmada temporal del bucket. Tiene prioridad sobre el resource
 * handler de /uploads/** definido en WebConfig, que sigue sirviendo el modo local.
 */
@RestController
@ConditionalOnProperty(name = "storage.profile-images.mode", havingValue = "s3")
public class ProfileImageRedirectController {

    private static final Pattern FILENAME = Pattern.compile("^user_\\d+_\\d+\\.(png|jpg|jpeg|webp|gif)$");

    private final S3ProfileImageClient s3ProfileImageClient;

    public ProfileImageRedirectController(S3ProfileImageClient s3ProfileImageClient) {
        this.s3ProfileImageClient = s3ProfileImageClient;
    }

    @GetMapping("/uploads/profile-images/{filename:.+}")
    public ResponseEntity<Void> redirectToSignedUrl(@PathVariable String filename) {
        if (!FILENAME.matcher(filename).matches()) {
            return ResponseEntity.notFound().build();
        }

        String url = s3ProfileImageClient.downloadUrl("profile-images/" + filename);
        return ResponseEntity.status(HttpStatus.FOUND)
                .header(HttpHeaders.LOCATION, url)
                .header(HttpHeaders.CACHE_CONTROL, "private, max-age=300")
                .build();
    }
}
