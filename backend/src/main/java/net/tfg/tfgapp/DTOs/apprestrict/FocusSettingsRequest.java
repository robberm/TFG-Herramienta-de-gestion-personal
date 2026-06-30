package net.tfg.tfgapp.DTOs.apprestrict;

import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class FocusSettingsRequest {
    private boolean focusModeEnabled;
    private Integer workDurationSeconds;
    private Integer breakDurationSeconds;
    private String focusAction;
}
