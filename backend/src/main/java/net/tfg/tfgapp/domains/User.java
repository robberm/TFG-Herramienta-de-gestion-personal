package net.tfg.tfgapp.domains;

import com.fasterxml.jackson.annotation.JsonIgnore;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;
import net.tfg.tfgapp.enumerates.UserRole;

@Getter
@Setter
@Entity
@Table(name = "users")
@Inheritance(strategy = InheritanceType.JOINED)
@JsonIgnoreProperties({"hibernateLazyInitializer", "handler"})
public abstract class User {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(unique = true, nullable = false)
    private String username;

    @JsonProperty(access = JsonProperty.Access.WRITE_ONLY)
    @Column(nullable = false)
    private String password;

    @JsonIgnore
    @Column(nullable = false)
    private Integer tokenVersion = 0;

    @Column(nullable = true)
    private String profileImagePath;

    @Transient
    public abstract UserRole getRole();

    public boolean isAdmin() {
        return getRole() == UserRole.ADMIN;
    }

    public boolean isPersonal() {
        return getRole() == UserRole.PERSONAL;
    }

    protected User() {
        this.tokenVersion = 0;
    }

    protected User(String username, String password) {
        this.username = username;
        this.password = password;
        this.tokenVersion = 0;
    }
}
