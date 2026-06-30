package net.tfg.tfgapp.security;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.JwtException;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.SignatureAlgorithm;
import io.jsonwebtoken.security.Keys;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.nio.charset.StandardCharsets;
import java.security.Key;
import java.util.Date;

@Component
public class JwtUtil {

    @Value("${jwt.secret}")
    private String secretKey;

    @Value("${jwt.expiration}")
    private long expirationMs;


    private Key getSigningKey() {
        return Keys.hmacShaKeyFor(secretKey.getBytes(StandardCharsets.UTF_8));
    }

    public String generateToken(String username, Integer tokenVersion, boolean desktopClient) {
        var builder = Jwts.builder()
                .setSubject(username)
                .claim("tokenVersion", tokenVersion)
                .claim("desktopClient", desktopClient)
                .setIssuedAt(new Date());

        if (!desktopClient) {
            builder.setExpiration(new Date(System.currentTimeMillis() + expirationMs));
        }

        return builder
                .signWith(getSigningKey(), SignatureAlgorithm.HS256)
                .compact();
    }

    public String extractUsername(String token) {
        return extractAllClaims(token).getSubject();
    }

    public String extractBearerToken(String authorizationHeader) {
        if (authorizationHeader == null) {
            throw new IllegalArgumentException("Authorization header is required.");
        }
        return authorizationHeader.replace("Bearer ", "").trim();
    }

    public String extractUsernameFromAuthorizationHeader(String authorizationHeader) {
        return extractUsername(extractBearerToken(authorizationHeader));
    }

    public Integer extractTokenVersion(String token) {
        Object claim = extractAllClaims(token).get("tokenVersion");

        if (claim instanceof Integer integerClaim) {
            return integerClaim;
        }
        if (claim instanceof Number numberClaim) {
            return numberClaim.intValue();
        }

        throw new IllegalArgumentException("Claim tokenVersion no válida.");
    }

    public boolean validateToken(String token) {
        try {
            extractAllClaims(token);
            return true;
        } catch (JwtException | IllegalArgumentException e) {
            return false;
        }
    }

    public boolean validateToken(String token, String expectedUsername, Integer expectedTokenVersion) {
        try {
            Claims claims = extractAllClaims(token);

            String username = claims.getSubject();
            Integer tokenVersion = extractTokenVersion(token);
            Date expiration = claims.getExpiration();
            boolean desktopClient = Boolean.TRUE.equals(claims.get("desktopClient", Boolean.class));
            boolean isValidByTime = desktopClient || (expiration != null && expiration.after(new Date()));

            return username.equals(expectedUsername)
                    && tokenVersion.equals(expectedTokenVersion)
                    && isValidByTime;
        } catch (JwtException | IllegalArgumentException e) {
            return false;
        }
    }

    private Claims extractAllClaims(String token) {
        return Jwts.parserBuilder()
                .setSigningKey(getSigningKey())
                .build()
                .parseClaimsJws(token)
                .getBody();
    }
}

