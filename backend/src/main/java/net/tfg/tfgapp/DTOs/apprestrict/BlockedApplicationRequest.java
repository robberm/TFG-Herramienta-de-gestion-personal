package net.tfg.tfgapp.DTOs.apprestrict;



import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class BlockedApplicationRequest {

    private String executableName;

    public BlockedApplicationRequest() {
    }

    public BlockedApplicationRequest(String executableName) {
        this.executableName = executableName;
    }
}
