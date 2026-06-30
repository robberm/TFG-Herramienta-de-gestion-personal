
import React from "react";
const ErrorContext = React.createContext();  

/** Clase para manejar los errores de pop up**/

export function ErrorMessageGenerator({ children }) {
  const [errorMessage, setErrorMessage] = React.useState("");

  return (
    <ErrorContext.Provider value={{ errorMessage, setErrorMessage }}>
      {children}
    </ErrorContext.Provider>
  );
}


  export function useError(){
    return React.useContext(ErrorContext); /**En React, el contexto, o Context API es una forma de compartir datos entre */
  }
