(function (root, factory) {
    if (typeof module === 'object' && module.exports) module.exports = factory();
    else root.InfraTechPermissoes = factory();
})(typeof window !== 'undefined' ? window : globalThis, function () {
    const dashboards = [
        { id: 'geral', href: '/dashboard/dash-geral.html', label: 'Visão Geral' },
        { id: 'especifica', href: '/dashboard/especifica-servidor/dash-especifica.html', label: 'Dashboard Específica' },
        { id: 'saude', href: '/dashboard/analista/dashboardV2.html', label: 'Saúde e Capacidade' }
    ];
    const completos = ['FUNCIONARIO', 'GESTOR', 'ADMIN', 'INFRATECH'];
    function normalizar(cargo) { return String(cargo || '').trim().toUpperCase(); }
    function obter(cargo) {
        const tipo = normalizar(cargo);
        const completo = completos.includes(tipo);
        const ids = completo ? ['geral', 'especifica', 'saude'] : tipo === 'ANALISTA_DADOS' ? ['especifica'] : tipo === 'ANALISTA_NOC' ? ['saude'] : [];
        return { dashboards: ids, administrar: completo, editarLimites: completo, monitorar: ids.length > 0 };
    }
    function destino(cargo) {
        const id = obter(cargo).dashboards[0];
        return dashboards.find(item => item.id === id)?.href || '/paginas/autenticacao/login/login.html';
    }
    function protegida(caminho) {
        const rota = String(caminho).toLowerCase();
        return (rota.startsWith('/dashboard/') || rota.startsWith('/paginas/pos-login/')) && (rota.endsWith('.html') || rota.endsWith('/'));
    }
    function podeAcessar(cargo, caminho) {
        const rota = String(caminho).toLowerCase();
        const perfil = obter(cargo);
        const aliases = {
            '/dashboard/analista/dashboard.html': 'saude',
            '/paginas/pos-login/dashboards/dashboard_noc.html': 'saude',
            '/paginas/pos-login/dashboards/dashboard_dados.html': 'especifica'
        };
        const id = dashboards.find(item => item.href.toLowerCase() === rota)?.id || aliases[rota];
        if (id) return perfil.dashboards.includes(id);
        if (protegida(rota)) return perfil.administrar;
        return false;
    }
    return { dashboards, normalizar, obter, destino, protegida, podeAcessar };
});
