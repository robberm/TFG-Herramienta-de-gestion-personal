package net.tfg.tfgapp.DTOs.ai;

import lombok.Getter;
import lombok.Setter;

/**
 * Cuerpo de las peticiones con un único texto: un mensaje de chat o la respuesta a la pregunta diaria.
 */
@Getter
@Setter
public class AiTextRequest {
    private String text;
}
