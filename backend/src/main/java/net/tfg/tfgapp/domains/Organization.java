package net.tfg.tfgapp.domains;

import com.fasterxml.jackson.annotation.JsonIgnore;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.util.ArrayList;
import java.util.List;

@Getter
@Setter
@Entity
@Table(name = "organizations")
@JsonIgnoreProperties({"hibernateLazyInitializer", "handler"})
public class Organization {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true)
    private String name;

    /**
     * Admin principal y propietario de la organización.
     */
    @OneToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "admin_id", nullable = false, unique = true)
    private AdminUser admin;

    /**
     * Usuarios pertenecientes a la organización.
     */
    @JsonIgnore
    @OneToMany(mappedBy = "organization")
    private List<PersonalUser> users = new ArrayList<>();

    public Organization() {
    }

    public Organization(String name, AdminUser admin) {
        this.name = name;
        this.admin = admin;
    }
}
