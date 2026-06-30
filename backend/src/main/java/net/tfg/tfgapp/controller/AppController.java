package net.tfg.tfgapp.controller;

import net.tfg.tfgapp.DTOs.apprestrict.BlockedApplicationRequest;
import net.tfg.tfgapp.DTOs.apprestrict.InstalledApplicationDTO;
import net.tfg.tfgapp.xi18n.LanguageResolver;
import net.tfg.tfgapp.service.AppRestrictionService;
import net.tfg.tfgapp.service.BlockingService;
import net.tfg.tfgapp.service.InstalledApplicationService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Set;

@RestController
@RequestMapping("/api")
public class AppController {

    private final AppRestrictionService restrictionService;
    private final BlockingService blockingService;
    private final InstalledApplicationService installedApplicationService;
    private final LanguageResolver languageResolver;

    public AppController(AppRestrictionService restrictionService,
                         BlockingService blockingService,
                         InstalledApplicationService installedApplicationService,
                         LanguageResolver languageResolver) {
        this.restrictionService = restrictionService;
        this.blockingService = blockingService;
        this.installedApplicationService = installedApplicationService;
        this.languageResolver = languageResolver;
    }

    @GetMapping("/installed-apps")
    public List<InstalledApplicationDTO> getInstalledApplications() {
        return installedApplicationService.getInstalledApplicationsDetailed();
    }

    @GetMapping("/blocked-apps")
    public Set<String> getBlockedApps() {
        return restrictionService.getBlockedApps();
    }

    @PostMapping("/blocked-apps")
    public ResponseEntity<String> addBlockedApp(@RequestBody BlockedApplicationRequest request,
                                                @RequestHeader(value = "Accept-Language", required = false) String language) {
        restrictionService.addBlockedApp(request.getExecutableName());
        return ResponseEntity.ok(languageResolver.text(language, "apps.blocked.added"));
    }

    @DeleteMapping("/blocked-apps/{appName}")
    public ResponseEntity<String> removeBlockedApp(@PathVariable String appName,
                                                   @RequestHeader(value = "Accept-Language", required = false) String language) {
        restrictionService.removeBlockedApp(appName);
        return ResponseEntity.ok(languageResolver.text(language, "apps.blocked.removed"));
    }

    @GetMapping("/game-mode")
    public boolean isGameModeActive() {
        return restrictionService.isGameModeActive();
    }

    @GetMapping("/block-status")
    public boolean isBlockingActive() {
        return blockingService.isBlockingActive();
    }

    @DeleteMapping("/blocked-apps/reset")
    public ResponseEntity<String> resetBlockedApps(@RequestHeader(value = "Accept-Language", required = false) String language) {
        restrictionService.resetBlockedApps();
        return ResponseEntity.ok(languageResolver.text(language, "apps.blocked.reset"));
    }
}
