package net.tfg.tfgapp.components.ai;

import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

class LocalCliProviderTest {

    @Test
    void cliProvidersDoNotNeedAKey() {
        AiCredentials credentials = AiCredentials.fromHeaders("claude_code", "", null).orElseThrow();
        assertEquals(AiCredentials.AiProvider.CLAUDE_CODE, credentials.provider());
        assertEquals("", credentials.model());
        assertEquals("", credentials.apiKey());

        assertTrue(AiCredentials.fromHeaders("CODEX", "gpt-5", "").isPresent());
    }

    @Test
    void apiProvidersStillNeedAKey() {
        assertTrue(AiCredentials.fromHeaders("OPENAI", "", "").isEmpty());
        assertTrue(AiCredentials.fromHeaders("UNKNOWN", "", "sk").isEmpty());
    }

    @Test
    void singleMessageIsSentAsIs() {
        assertEquals("hola", LocalCliClient.transcript(List.of(AiProviderClient.Message.user("hola"))));
    }

    @Test
    void historyIsTranscribedInOrder() {
        String transcript = LocalCliClient.transcript(List.of(
                AiProviderClient.Message.user("uno"),
                AiProviderClient.Message.assistant("dos"),
                AiProviderClient.Message.user("tres")));
        assertTrue(transcript.indexOf("<user>\nuno") < transcript.indexOf("<assistant>\ndos"));
        assertTrue(transcript.indexOf("<assistant>\ndos") < transcript.indexOf("<user>\ntres"));
        assertTrue(transcript.endsWith("following the instructions."));
    }
}
