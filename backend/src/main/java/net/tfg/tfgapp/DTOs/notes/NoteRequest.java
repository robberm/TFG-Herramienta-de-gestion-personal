package net.tfg.tfgapp.DTOs.notes;

import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class NoteRequest {
    private String title;
    private String content;
    private String color;
    private Boolean pinned;
}
