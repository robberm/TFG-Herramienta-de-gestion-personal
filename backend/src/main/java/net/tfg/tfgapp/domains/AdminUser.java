package net.tfg.tfgapp.domains;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.Entity;
import jakarta.persistence.OneToMany;
import jakarta.persistence.OneToOne;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;
import net.tfg.tfgapp.enumerates.UserRole;

import java.util.ArrayList;
import java.util.List;

@Getter
@Setter
@Entity
@Table(name = "admin_users")
public class AdminUser extends User {

    @JsonIgnore
    @OneToMany(mappedBy = "audAdmin")
    private List<PersonalUser> managedUsers = new ArrayList<>();

    @JsonIgnore
    @OneToOne(mappedBy = "admin")
    private Organization administeredOrganization;

    public AdminUser() {
    }

    public AdminUser(String username, String password) {
        super(username, password);
    }

    @Override
    public UserRole getRole() {
        return UserRole.ADMIN;
    }
}
