package net.tfg.tfgapp.domains;

import com.fasterxml.jackson.annotation.JsonIgnore;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.OneToMany;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;
import net.tfg.tfgapp.enumerates.UserRole;

import java.util.ArrayList;
import java.util.List;

@Getter
@Setter
@Entity
@Table(name = "personal_users")
@JsonIgnoreProperties({"hibernateLazyInitializer", "handler", "organization", "audAdmin"})
public class PersonalUser extends User {

    /**
     * Un usuario personal puede no pertenecer a ninguna organización.
     * Los usuarios creados por un admin sí quedan asociados a la suya.
     */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "organization_id")
    private Organization organization;

    /**
     * Referencia audit al admin que ha dado de alta a este usuario.
     * Para usuarios personales registrados por su cuenta será null.
     */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "aud_admin_id")
    private AdminUser audAdmin;

    @JsonIgnore
    @OneToMany(mappedBy = "user")
    private List<Objective> objetivos = new ArrayList<>();

    @JsonIgnore
    @OneToMany(mappedBy = "personalUser")
    private List<EventAssignment> eventAssignments = new ArrayList<>();

    @JsonIgnore
    @OneToMany(mappedBy = "personalUser")
    private List<ObjectiveAssignment> objectiveAssignments = new ArrayList<>();

    public PersonalUser() {
    }

    public PersonalUser(String username, String password) {
        super(username, password);
    }

    @Override
    public UserRole getRole() {
        return UserRole.PERSONAL;
    }
}
