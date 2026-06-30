package net.tfg.tfgapp.service.interfaces;

import net.tfg.tfgapp.domains.Objective;

import java.util.List;

public interface IObjectiveService<T extends Objective> {

    /**
     * Obtiene todos los elementos del tipo concreto pertenecientes a un usuario.
     */
    List<T> getByUsername(String username);

    /**
     * Busca una entidad por identificador.
     */
    T findById(Integer id);

    /**
     * Elimina una entidad por identificador.
     */
    void deleteById(Integer id);
}