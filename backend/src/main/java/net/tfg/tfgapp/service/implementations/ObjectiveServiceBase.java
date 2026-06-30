package net.tfg.tfgapp.service.implementations;

import net.tfg.tfgapp.domains.Objective;
import net.tfg.tfgapp.service.interfaces.IObjectiveService;
import org.springframework.data.jpa.repository.JpaRepository;

public abstract class ObjectiveServiceBase<T extends Objective, R extends JpaRepository<T, Integer>>
        implements IObjectiveService<T> {

    protected final R repository;

    protected ObjectiveServiceBase(R repository) {
        this.repository = repository;
    }

    @Override
    public T findById(Integer id) {
        return repository.findById(id).orElse(null);
    }

    @Override
    public void deleteById(Integer id) {
        repository.deleteById(id);
    }
}