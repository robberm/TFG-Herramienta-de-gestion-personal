package net.tfg.tfgapp.service;

import net.tfg.tfgapp.DTOs.notes.NoteRequest;
import net.tfg.tfgapp.domains.Note;
import net.tfg.tfgapp.domains.User;
import net.tfg.tfgapp.exception.ApiException;
import net.tfg.tfgapp.repos.NoteRepo;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Set;

@Service
public class NoteService {
    private static final Set<String> COLORS = Set.of("sand", "coral", "sky", "mint", "lilac");
    private final NoteRepo noteRepo;

    public NoteService(NoteRepo noteRepo) {
        this.noteRepo = noteRepo;
    }

    public List<Note> findAll(User owner) {
        return noteRepo.findByOwnerIdOrderByPinnedDescUpdatedAtDesc(owner.getId());
    }

    public Note create(User owner, NoteRequest request) {
        Note note = new Note();
        note.setOwner(owner);
        apply(note, request);
        return noteRepo.save(note);
    }

    public Note update(User owner, Long id, NoteRequest request) {
        Note note = ownedNote(owner, id);
        apply(note, request);
        return noteRepo.save(note);
    }

    public void delete(User owner, Long id) {
        noteRepo.delete(ownedNote(owner, id));
    }

    private Note ownedNote(User owner, Long id) {
        return noteRepo.findByIdAndOwnerId(id, owner.getId())
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Nota no encontrada."));
    }

    private void apply(Note note, NoteRequest request) {
        String title = request.getTitle() == null ? "" : request.getTitle().trim();
        String content = request.getContent() == null ? "" : request.getContent();
        if (title.length() > 180 || content.length() > 50_000) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "La nota supera el tamaño permitido.");
        }
        note.setTitle(title);
        note.setContent(content);
        note.setColor(COLORS.contains(request.getColor()) ? request.getColor() : "sand");
        note.setPinned(Boolean.TRUE.equals(request.getPinned()));
    }
}
