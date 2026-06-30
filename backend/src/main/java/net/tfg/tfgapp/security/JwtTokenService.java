package net.tfg.tfgapp.security;

import org.springframework.stereotype.Service;

@Service
public class JwtTokenService implements TokenService {

    private final JwtUtil jwtUtil;

    public JwtTokenService(JwtUtil jwtUtil) {
        this.jwtUtil = jwtUtil;
    }

    @Override
    public String generateToken(String username, Integer tokenVersion, boolean desktopClient) {
        return jwtUtil.generateToken(username, tokenVersion, desktopClient);
    }

    @Override
    public String extractUsername(String token) {
        return jwtUtil.extractUsername(token);
    }

    @Override
    public String extractBearerToken(String authorizationHeader) {
        return jwtUtil.extractBearerToken(authorizationHeader);
    }

    @Override
    public String extractUsernameFromAuthorizationHeader(String authorizationHeader) {
        return jwtUtil.extractUsernameFromAuthorizationHeader(authorizationHeader);
    }

    @Override
    public Integer extractTokenVersion(String token) {
        return jwtUtil.extractTokenVersion(token);
    }

    @Override
    public boolean validateToken(String token) {
        return jwtUtil.validateToken(token);
    }

    @Override
    public boolean validateToken(String token, String expectedUsername, Integer expectedTokenVersion) {
        return jwtUtil.validateToken(token, expectedUsername, expectedTokenVersion);
    }
}