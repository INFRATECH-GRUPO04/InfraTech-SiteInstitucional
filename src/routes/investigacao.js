const express = require('express');
const autorizacao = require('../seguranca/autorizacao');
const controller = require('../controllers/investigacaoController');

const router = express.Router();
const paginaInvestigacao = '/dashboard/especifica-servidor/investigacao-servidor.html';

router.use((req, res, next) => {
    if (!autorizacao.podeVerDashboard(req.usuario && req.usuario.cargo, paginaInvestigacao)) {
        return res.status(403).json({ erro: 'Seu cargo não pode acessar a investigação de servidores.' });
    }
    next();
});

router.get('/metadados', controller.metadados);
router.post('/analisar', controller.analisar);

module.exports = router;
