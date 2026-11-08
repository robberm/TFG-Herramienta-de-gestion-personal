package net.tfg.tfgapp.DTOs.ai;

import net.tfg.tfgapp.domains.AiChatMessage;
import net.tfg.tfgapp.domains.AiMemory;

import java.util.List;

/**
 * Respuesta del asistente más los recuerdos nuevos que ha guardado con este mensaje
 * (la UI los muestra para que el usuario sepa qué se ha memorizado).
 */
public record ChatReply(AiChatMessage message, List<AiMemory> remembered) {
}
