document.getElementById('btn-clientes').addEventListener('click',  () => window.api.abrirClientes());
document.getElementById('btn-roles').addEventListener('click',     () => window.api.abrirRoles());
document.getElementById('btn-lugares').addEventListener('click',   () => window.api.abrirLugares());
document.getElementById('btn-rangos').addEventListener('click',    () => window.api.abrirRangos());
document.getElementById('btn-equipos').addEventListener('click',   () => window.api.abrirEquipos());
document.getElementById('btn-plano').addEventListener('click',     () => window.api.abrirPlano());
document.getElementById('btn-usuarios').addEventListener('click',  () => window.api.abrirUsuarios());
document.getElementById('btn-dominios').addEventListener('click',  () => window.api.abrirDominios());
document.getElementById('btn-configred').addEventListener('click', () => window.api.abrirConfigRed());
document.getElementById('btn-historico').addEventListener('click', () => window.api.abrirHistorico());

document.getElementById('btn-salir').addEventListener('click', async () => {
    await window.api.logout();
    window.close();
});

(async () => {
    const u = await window.api.usuarioActual();
    if (u) {
        document.getElementById('bienvenida').textContent =
            `Bienvenido, ${u.Nombres} ${u.Apellidos} (${u.NombreUsuario})`;
    }
})();