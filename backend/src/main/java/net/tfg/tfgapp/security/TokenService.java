package net.tfg.tfgapp.security;

public interface TokenService {

    String generateToken(String username, Integer tokenVersion, boolean desktopClient);

    String extractUsername(String token);

    String extractBearerToken(String authorizationHeader);

    String extractUsernameFromAuthorizationHeader(String authorizationHeader);

    Integer extractTokenVersion(String token);

    boolean validateToken(String token);

    boolean validateToken(String token, String expectedUsername, Integer expectedTokenVersion);
}