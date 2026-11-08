/* =========================================================
   VIVO — Refresco en vivo de secciones ya dibujadas
   ---------------------------------------------------------
   Cuando una sección se vuelve a dibujar (después de guardar,
   eliminar, filtrar o recargar datos) el DOM se vacía y el
   navegador reinicia el desplazamiento al inicio, se pierde el
   foco del buscador y los estados visuales (grupos abiertos,
   posición del plano). Este módulo conserva y restituye todo
   eso para que el resultado se sienta como una actualización
   en vivo y no como una recarga de página.

   Uso:
     Vivo.enVivo(contenedor, () => dibujarTabla());
     Vivo.reemplazar(tbody, html);   // no toca el DOM si nada cambió
   ========================================================= */
(function () {
    'use strict';

    if (window.Vivo) return;

    const OVERFLOW_DESPLAZABLE = /(auto|scroll|overlay)/;

    function nodoDe(raiz) {
        if (typeof raiz === 'string') return document.querySelector(raiz);
        return raiz instanceof HTMLElement ? raiz : null;
    }

    function scrollerVentana() {
        return document.scrollingElement || document.documentElement;
    }

    /* ¿El elemento tiene desplazamiento propio y realmente está desplazado? */
    function desplazado(el) {
        if (!(el instanceof HTMLElement)) return false;
        if (!el.scrollTop && !el.scrollLeft) return false;
        const estilo = window.getComputedStyle(el);
        const puedeY = OVERFLOW_DESPLAZABLE.test(estilo.overflowY) && el.scrollHeight > el.clientHeight;
        const puedeX = OVERFLOW_DESPLAZABLE.test(estilo.overflowX) && el.scrollWidth > el.clientWidth;
        return Boolean(puedeY || puedeX);
    }

    /* Recorre el árbol de ancestros y guarda la posición de cada
       contenedor con scroll (paneles, wrappers, main, etc.). */
    function capturar(raiz) {
        const anclas = [];
        let el = raiz;
        while (el) {
            if (desplazado(el)) {
                anclas.push({ el, top: el.scrollTop, left: el.scrollLeft });
            }
            el = el.parentElement;
        }
        const scroller = scrollerVentana();
        const activo = document.activeElement;
        const foco = (raiz && activo && activo !== document.body && raiz.contains(activo))
            ? {
                el: activo,
                inicio: typeof activo.selectionStart === 'number' ? activo.selectionStart : null,
                fin: typeof activo.selectionEnd === 'number' ? activo.selectionEnd : null
            }
            : null;

        return { anclas, ventana: { top: scroller.scrollTop, left: scroller.scrollLeft }, foco };
    }

    function restaurar(estado) {
        if (!estado) return;

        const aplicar = () => {
            estado.anclas.forEach(ancla => {
                if (!ancla.el.isConnected) return;
                if (ancla.top) ancla.el.scrollTop = ancla.top;
                if (ancla.left) ancla.el.scrollLeft = ancla.left;
            });

            const scroller = scrollerVentana();
            if (estado.ventana.top) scroller.scrollTop = estado.ventana.top;
            if (estado.ventana.left) scroller.scrollLeft = estado.ventana.left;

            const foco = estado.foco;
            if (foco && foco.el.isConnected && document.activeElement !== foco.el) {
                try {
                    foco.el.focus({ preventScroll: true });
                    if (foco.inicio !== null && typeof foco.el.setSelectionRange === 'function') {
                        foco.el.setSelectionRange(foco.inicio, foco.fin);
                    }
                } catch (_) {
                    /* el campo no admite selección de texto */
                }
            }
        };

        // Se aplica de inmediato y otra vez tras el primer pintado, porque
        // el navegador recalcula la altura desplazable al añadir el contenido.
        aplicar();
        window.requestAnimationFrame(aplicar);
    }

    /* Ejecuta el dibujado conservando desplazamiento y foco.
       Acepta funciones síncronas o que devuelvan una promesa. */
    function enVivo(raiz, dibujar) {
        let contenedor = raiz;
        let tarea = dibujar;

        if (typeof raiz === 'function' && dibujar === undefined) {
            tarea = raiz;
            contenedor = null;
        }

        const estado = capturar(nodoDe(contenedor));
        const resultado = typeof tarea === 'function' ? tarea() : undefined;

        if (resultado && typeof resultado.then === 'function') {
            return resultado.then(
                valor => { restaurar(estado); return valor; },
                error => { restaurar(estado); throw error; }
            );
        }

        restaurar(estado);
        return resultado;
    }

    /* Sustituye el contenido sólo si realmente cambió.
       Evita reinicializar tablas cuando el refresco trae lo mismo. */
    function reemplazar(contenedor, html) {
        const nodo = nodoDe(contenedor);
        if (!nodo) return false;
        if (nodo.innerHTML === html) return false;
        return enVivo(nodo, () => {
            nodo.innerHTML = html;
            return true;
        });
    }

    /* Igual que reemplazar() pero para nodos construidos a mano:
       dibujar(nodo) sólo se ejecuta si el contenido no es idéntico. */
    function reemplazarSiCambio(contenedor, huella, dibujar) {
        const nodo = nodoDe(contenedor);
        if (!nodo) return false;
        if (nodo.dataset.vivoHuella === String(huella)) return false;
        nodo.dataset.vivoHuella = String(huella);
        enVivo(nodo, () => nodo.replaceChildren());
        dibujar(nodo);
        return true;
    }

    window.Vivo = { capturar, restaurar, enVivo, reemplazar, reemplazarSiCambio };
})();
