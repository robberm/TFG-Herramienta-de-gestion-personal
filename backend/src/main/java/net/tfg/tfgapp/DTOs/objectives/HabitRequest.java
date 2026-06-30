package net.tfg.tfgapp.DTOs.objectives;

import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class HabitRequest {

    private String titulo;
    private String description;
    private Boolean active;
}