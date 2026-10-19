package net.tfg.tfgapp.domains;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.Length;

import java.time.LocalDateTime;

@Getter
@Setter
@Entity
@Table(name = "notes", indexes = @Index(name = "idx_notes_owner_updated", columnList = "owner_id, updated_at"))
public class Note {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(length = 180, nullable = false)
    private String title = "";

    /**
     * LONG32 se traduce a LONGTEXT en MySQL y a TEXT en PostgreSQL. Con @Lob +
     * @Column sin longitud, Hibernate 6 generaba TINYTEXT (255 bytes) y las notas
     * largas fallaban al guardarse.
     */
    @Column(nullable = false, length = Length.LONG32)
    private String content = "";

    @Column(length = 16, nullable = false)
    private String color = "sand";

    @Column(nullable = false)
    private boolean pinned;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;

    @JsonIgnore
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "owner_id", nullable = false)
    private User owner;

    @PrePersist
    void onCreate() {
        createdAt = LocalDateTime.now();
        updatedAt = createdAt;
    }

    @PreUpdate
    void onUpdate() {
        updatedAt = LocalDateTime.now();
    }
}
