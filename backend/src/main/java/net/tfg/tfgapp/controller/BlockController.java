package net.tfg.tfgapp.controller;


import net.tfg.tfgapp.DTOs.apprestrict.FocusSettingsRequest;
import net.tfg.tfgapp.service.BlockingService;
import net.tfg.tfgapp.utils.WindowsUtils;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;



@RestController
@RequestMapping("/api/block")
public class BlockController {

    private final BlockingService blockingService;

    @Autowired
    public BlockController(BlockingService blockingService) {
        this.blockingService = blockingService;
    }

    @GetMapping("/status")
    public Map<String, Boolean> getBlockStatus() {
        return Map.of(
                "isBlocking", blockingService.isBlockingActive(),
                "isPaused", blockingService.isPaused()
        );
    }

    @PostMapping("/pause")
    public void pauseBlocking(@RequestParam boolean pause) {
        blockingService.pauseScheduledBlocks(pause);
    }

    @PostMapping("/force")
    public void forceBlock(@RequestParam(required = false, defaultValue = "20") int duration) {
        blockingService.forceBlockNow(duration);
    }

    @PostMapping("/cancel")
    public void cancelBlock() {
        blockingService.cancelCurrentBlock();
    }


    @GetMapping("/focus-state")
    public Map<String, Object> getFocusState() {
        return blockingService.getFocusState();
    }

    @PutMapping("/focus-settings")
    public void updateFocusSettings(@RequestBody FocusSettingsRequest request) {
        blockingService.updateFocusSettings(
                request.isFocusModeEnabled(),
                request.getWorkDurationSeconds(),
                request.getBreakDurationSeconds(),
                request.getFocusAction()
        );
    }

    /**
     * Obtiene la lista de procesos en ejecución con información detallada.
     * Cada proceso incluye: executableName, displayName, category, iconBase64
     */
    @GetMapping("/running-processes")
    public List<Map<String, String>> getRunningProcesses() {
        return WindowsUtils.getRunningProcessesDetailed();
    }

    /**
     * Obtiene solo los nombres de los procesos en ejecución (versión simple)
     */
    @GetMapping("/running-processes/simple")
    public List<String> getRunningProcessesSimple() {
        return WindowsUtils.getRunningProcesses();
    }
}
