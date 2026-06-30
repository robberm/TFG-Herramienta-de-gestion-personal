package net.tfg.tfgapp.DTOs.apprestrict;

import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class InstalledApplicationDTO {

    private String displayName;
    private String executableName;
    private String executablePath;
    private String installLocation;
    private String iconBase64;
    private boolean blockable;

    public InstalledApplicationDTO() {
    }

    public InstalledApplicationDTO(String displayName,
                                   String executableName,
                                   String executablePath,
                                   String installLocation,
                                   String iconBase64,
                                   boolean blockable) {
        this.displayName = displayName;
        this.executableName = executableName;
        this.executablePath = executablePath;
        this.installLocation = installLocation;
        this.iconBase64 = iconBase64;
        this.blockable = blockable;
    }
}