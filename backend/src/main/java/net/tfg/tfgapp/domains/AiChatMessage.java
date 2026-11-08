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
@Table(name = "ai_chat_messages",
        indexes = @Index(name = "idx_ai_chat_messages_owner_created", columnList = "owner_id, created_at"))
public class AiChatMessage {
    public enum Role { user, assistant }

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Enumerated(EnumType.STRING)
    @Column(length = 16, nullable = false)
    private Role role;

    @Column(nullable = false, length = Length.LONG32)
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
