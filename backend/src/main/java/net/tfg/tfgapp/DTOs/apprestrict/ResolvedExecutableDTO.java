package net.tfg.tfgapp.DTOs.apprestrict;



import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class ResolvedExecutableDTO {

    private String executableName;
    private String executablePath;
    private boolean resolved;

    public ResolvedExecutableDTO() {
    }

    public ResolvedExecutableDTO(String executableName, String executablePath, boolean resolved) {
        this.executableName = executableName;
        this.executablePath = executablePath;
        this.resolved = resolved;
    }
}
