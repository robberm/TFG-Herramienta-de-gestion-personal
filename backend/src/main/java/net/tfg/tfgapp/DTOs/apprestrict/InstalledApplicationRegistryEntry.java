package net.tfg.tfgapp.DTOs.apprestrict;



import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class InstalledApplicationRegistryEntry {

    private String displayName;
    private String displayIcon;
    private String installLocation;
    private String uninstallString;

    public InstalledApplicationRegistryEntry() {
    }

    public InstalledApplicationRegistryEntry(String displayName,
                                             String displayIcon,
                                             String installLocation,
                                             String uninstallString) {
        this.displayName = displayName;
        this.displayIcon = displayIcon;
        this.installLocation = installLocation;
        this.uninstallString = uninstallString;
    }
}
