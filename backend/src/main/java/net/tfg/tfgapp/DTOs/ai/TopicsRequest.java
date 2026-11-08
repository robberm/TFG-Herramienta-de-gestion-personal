package net.tfg.tfgapp.DTOs.ai;

import lombok.Getter;
import lombok.Setter;

import java.util.List;

@Getter
@Setter
public class TopicsRequest {
    private List<String> topics;
}
