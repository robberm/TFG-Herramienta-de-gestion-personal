package net.tfg.tfgapp.domains;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.time.LocalDateTime;

/**
 * Dato que el asistente ha aprendido sobre el usuario ("prefiere estudiar por la mañana").
 * Pertenece a la cuenta, no a la clave de API, así que sobrevive a cambios de PC o de proveedor.
 */
@Getter
@Setter
@Entity
@Table(name = "ai_memories", indexes = @Index(name = "idx_ai_memories_owner", columnList = "owner_id"))
public class AiMemory {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(length = 500, nullable = false)
    private String content;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @JsonIgnore
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "owner_id", nullable = false)
    private User owner;

    @PrePersist
    void onCreate() {
        createdAt = LocalDateTime.now();
    }
}
