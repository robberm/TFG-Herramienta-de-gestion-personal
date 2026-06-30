package net.tfg.tfgapp.DTOs.objectives;

import lombok.Getter;
import lombok.Setter;

import java.time.LocalDate;

@Getter
@Setter
public class HabitCompletionRequest {

    private LocalDate date;
    private Boolean completed;
}
