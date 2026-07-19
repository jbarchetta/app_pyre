import { useRef, type MouseEvent } from "react";

// Todos los modales de esta app cierran al hacer click en el fondo. El
// problema: si el usuario arrastra el mouse para seleccionar texto dentro de
// un campo y el mouseup termina fuera del modal, el navegador resuelve el
// evento "click" sobre el ancestro común de mousedown y mouseup -- que es el
// propio fondo -- cerrando el modal aunque la intención era solo seleccionar
// texto. Este hook solo cierra si el mousedown TAMBIÉN empezó directamente
// sobre el fondo, no alcanza con que el click resuelto termine ahí.
export function useCerrarAlClickFuera(onClose: () => void) {
  const mouseDownEnFondoRef = useRef(false);

  function onMouseDown(e: MouseEvent<HTMLElement>) {
    mouseDownEnFondoRef.current = e.target === e.currentTarget;
  }

  function onClick(e: MouseEvent<HTMLElement>) {
    if (mouseDownEnFondoRef.current && e.target === e.currentTarget) {
      onClose();
    }
  }

  return { onMouseDown, onClick };
}
