import { useEffect, useRef } from 'react';

/** Donne le focus à l'élément (titre de l'écran) une fois au montage : lecteurs d'écran et clavier suivent la navigation. */
export function useFocusOnMount<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  useEffect(() => {
    ref.current?.focus();
  }, []);
  return ref;
}
