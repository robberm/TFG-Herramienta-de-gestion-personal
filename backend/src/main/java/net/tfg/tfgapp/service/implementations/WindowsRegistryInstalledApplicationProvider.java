package net.tfg.tfgapp.service.implementations;


import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import net.tfg.tfgapp.DTOs.apprestrict.InstalledApplicationRegistryEntry;
import net.tfg.tfgapp.service.interfaces.InstalledApplicationProvider;
import org.springframework.stereotype.Service;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;

@Service
public class WindowsRegistryInstalledApplicationProvider implements InstalledApplicationProvider {

    private final ObjectMapper objectMapper = new ObjectMapper();

    @Override
    public List<InstalledApplicationRegistryEntry> getInstalledApplications() {
        try {
            ProcessBuilder processBuilder = new ProcessBuilder(
                    "powershell",
                    "-NoProfile",
                    "-ExecutionPolicy", "Bypass",
                    "-Command",
                    buildRegistryCommand()
            );

            processBuilder.redirectErrorStream(true);
            Process process = processBuilder.start();

            StringBuilder output = new StringBuilder();
            try (BufferedReader reader = new BufferedReader(
                    new InputStreamReader(process.getInputStream(), StandardCharsets.UTF_8))) {

                String line;
                while ((line = reader.readLine()) != null) {
                    output.append(line);
                }
            }

            process.waitFor();

            return parseRegistryEntries(output.toString());
        } catch (Exception e) {
            throw new RuntimeException("No se pudieron obtener las aplicaciones instaladas desde el registro de Windows", e);
        }
    }

    /**
     * Construye el script de PowerShell que consulta las claves más habituales
     * donde Windows registra programas instalados para el usuario y para la máquina.
     *
     * @return script PowerShell en una sola cadena.
     */
    private String buildRegistryCommand() {
        return "$paths = @(" +
                "'HKLM:\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*'," +
                "'HKLM:\\Software\\WOW6432Node\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*'," +
                "'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*'" +
                ");" +
                "$items = Get-ItemProperty $paths -ErrorAction SilentlyContinue | " +
                "Where-Object { $_.DisplayName -and $_.DisplayName.Trim() -ne '' } | " +
                "Select-Object DisplayName, DisplayIcon, InstallLocation, UninstallString;" +
                "$items | ConvertTo-Json -Compress -Depth 3";
    }

    /**
     * Convierte la salida JSON de PowerShell en objetos Java.
     * PowerShell puede devolver un array o un único objeto cuando solo hay un resultado.
     *
     * @param json salida JSON generada por ConvertTo-Json.
     * @return lista normalizada de entradas del registro.
     */
    private List<InstalledApplicationRegistryEntry> parseRegistryEntries(String json) {
        List<InstalledApplicationRegistryEntry> entries = new ArrayList<>();

        if (json == null || json.isBlank()) {
            return entries;
        }

        try {
            JsonNode root = objectMapper.readTree(json);

            if (root.isArray()) {
                for (JsonNode node : root) {
                    InstalledApplicationRegistryEntry entry = mapNode(node);
                    if (entry != null) {
                        entries.add(entry);
                    }
                }
            } else if (root.isObject()) {
                InstalledApplicationRegistryEntry entry = mapNode(root);
                if (entry != null) {
                    entries.add(entry);
                }
            }

            return entries;
        } catch (Exception e) {
            throw new RuntimeException("No se pudo parsear la salida JSON de aplicaciones instaladas", e);
        }
    }

    /**
     * Mapea un nodo JSON devuelto por PowerShell a una entrada de aplicación instalada.
     *
     * @param node nodo JSON individual.
     * @return entrada mapeada o null si no tiene nombre visible.
     */
    private InstalledApplicationRegistryEntry mapNode(JsonNode node) {
        String displayName = getNullableText(node, "DisplayName");

        if (displayName == null || displayName.isBlank()) {
            return null;
        }

        return new InstalledApplicationRegistryEntry(
                displayName.trim(),
                getNullableText(node, "DisplayIcon"),
                getNullableText(node, "InstallLocation"),
                getNullableText(node, "UninstallString")
        );
    }

    /**
     * Obtiene el valor textual de una propiedad JSON, devolviendo null si no existe
     * o si es una cadena vacía tras limpiarla.
     *
     * @param node nodo origen.
     * @param fieldName nombre del campo a leer.
     * @return texto limpio o null.
     */
    private String getNullableText(JsonNode node, String fieldName) {
        JsonNode value = node.get(fieldName);
        if (value == null || value.isNull()) {
            return null;
        }

        String text = value.asText();
        if (text == null) {
            return null;
        }

        text = text.trim();
        return text.isEmpty() ? null : text;
    }
}
