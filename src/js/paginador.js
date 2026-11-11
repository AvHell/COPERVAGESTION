/* =========================================================
   PAGINADOR — Paginación reutilizable de tablas
   ---------------------------------------------------------
   Las tablas del sistema se dibujan a mano a partir de un
   arreglo en memoria. Sin paginar, un catálogo grande (o el
   inventario completo) vuelca cientos de filas al DOM y la
   página se vuelve pesada. Este módulo corta ese arreglo en
   páginas y dibuja los controles: filas por página, resumen
   («1–25 de 340») y botones anterior/siguiente.

   Uso:
     const pag = Paginador.crear(document.getElementById('paginacion-activos'), {
         alCambiar: () => renderTabla()   // se repinta al navegar
     });

     function pintarTabla() {
         const visibles = pag.recortar(listaFiltrada);
         for (const fila of visibles) { ... }
     }

     pag.reiniciar();   // al cambiar la búsqueda o el filtro

   Si el contenedor no existe, recortar() devuelve la lista
   completa: la página sigue funcionando aunque se olvide el
   marcado de la paginación.
   ========================================================= */
(function () {
    'use strict';

    if (window.Paginador) return;

    const TAMANOS = [25, 50, 100, 250];
    const TAMANO_POR_DEFECTO = 25;

    function nodoDe(raiz) {
        if (typeof raiz === 'string') return document.querySelector(raiz);
        return raiz instanceof HTMLElement ? raiz : null;
    }

    function crear(contenedor, opciones = {}) {
        const raiz = nodoDe(contenedor);
        /* Clase propia del contenedor: permite ocultarlo (mostrar(false))
           sin depender de que la hoja de la página defina `.oculto`. */
        if (raiz) raiz.classList.add('paginador-contenedor');
        const tamanos = (Array.isArray(opciones.tamanos) && opciones.tamanos.length)
            ? opciones.tamanos.map(Number).filter(n => n > 0)
            : TAMANOS;
        const alCambiar = typeof opciones.alCambiar === 'function' ? opciones.alCambiar : null;

        let tamano = normalizarTamano(opciones.tamano);
        let pagina = 1;
        let total = 0;
        let construido = false;

        let selTamano = null;
        let resumen = null;
        let btnAnterior = null;
        let btnSiguiente = null;

        function normalizarTamano(valor) {
            const n = Number(valor);
            return tamanos.includes(n) ? n : tamanos[0];
        }

        function totalPaginas() {
            return Math.max(1, Math.ceil(total / tamano));
        }

        function inicioActual() {
            return (pagina - 1) * tamano;
        }

        function pintarResumen() {
            if (!construido) return;
            const inicio = inicioActual();
            const fin = Math.min(inicio + tamano, total);
            resumen.textContent = total
                ? `${inicio + 1}–${fin} de ${total}`
                : '0 registros';
            btnAnterior.disabled = pagina <= 1;
            btnSiguiente.disabled = pagina >= totalPaginas();
        }

        function emitir() {
            pintarResumen();
            if (alCambiar) alCambiar();
        }

        function irANueva(nueva) {
            const limite = totalPaginas();
            const destino = Math.min(Math.max(1, nueva), limite);
            if (destino === pagina) return;
            pagina = destino;
            emitir();
        }

        function boton(texto, etiqueta) {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.textContent = texto;
            btn.setAttribute('aria-label', etiqueta);
            return btn;
        }

        function construir() {
            if (construido || !raiz) return;

            const nav = document.createElement('nav');
            nav.className = 'paginacion';
            nav.setAttribute('aria-label', 'Paginación de la tabla');

            const label = document.createElement('label');
            label.append('Filas ');
            selTamano = document.createElement('select');
            selTamano.className = 'paginador-tamano';
            for (const valor of tamanos) selTamano.append(new Option(String(valor), String(valor)));
            selTamano.value = String(tamano);
            selTamano.addEventListener('change', () => {
                tamano = normalizarTamano(selTamano.value);
                pagina = 1;
                emitir();
            });
            label.append(selTamano);

            resumen = document.createElement('span');
            resumen.className = 'paginador-resumen';
            resumen.setAttribute('aria-live', 'polite');

            const acciones = document.createElement('div');
            acciones.className = 'paginador-acciones';
            btnAnterior = boton('Anterior', 'Página anterior');
            btnSiguiente = boton('Siguiente', 'Página siguiente');
            btnAnterior.addEventListener('click', () => irANueva(pagina - 1));
            btnSiguiente.addEventListener('click', () => irANueva(pagina + 1));
            acciones.append(btnAnterior, btnSiguiente);

            nav.append(label, resumen, acciones);
            raiz.replaceChildren(nav);
            construido = true;
        }

        /* Devuelve sólo las filas de la página vigente y refresca los
           controles. El llamador recorre ese arreglo. */
        function recortar(lista) {
            const elementos = Array.isArray(lista) ? lista : [];
            total = elementos.length;

            if (!raiz) return elementos;

            const limite = totalPaginas();
            if (pagina > limite) pagina = limite;
            if (pagina < 1) pagina = 1;

            const inicio = inicioActual();
            const visibles = elementos.slice(inicio, inicio + tamano);

            construir();
            pintarResumen();
            return visibles;
        }

        /* Volver a la primera página: al buscar, filtrar o cambiar de
           pestaña el resultado es otro y la página anterior no aplica. */
        function reiniciar() {
            if (pagina === 1) return;
            pagina = 1;
            pintarResumen();
        }

        /* Muestra u oculta los controles junto con la tabla (estado vacío). */
        function mostrar(visible) {
            if (!raiz) return;
            raiz.classList.toggle('oculto', !visible);
        }

        construir();

        return {
            contenedor: raiz,
            recortar,
            reiniciar,
            mostrar,
            get pagina() { return pagina; },
            set pagina(valor) { irANueva(Number(valor) || 1); },
            get tamano() { return tamano; },
            get total() { return total; },
            get totalPaginas() { return totalPaginas(); }
        };
    }

    window.Paginador = { crear, TAMANOS, TAMANO_POR_DEFECTO };
})();
