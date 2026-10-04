package net.tfg.tfgapp.DTOs.todos;

import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class TodoRequest {
    private String title;
    private Boolean done;
}
