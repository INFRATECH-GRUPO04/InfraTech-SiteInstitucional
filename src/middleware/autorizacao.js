const crypto = require('crypto');

// O segredo vale apenas neste processo, salvo quando AUTH_TOKEN_SECRET é configurado.
// Assim, o desenvolvimento funciona localmente e a implantação pode usar um segredo estável.
const segredo = process.env.AUTH_TOKEN_SECRET || crypto.randomBytes(32).toString('hex');
const COOKIE = 'infratech_session';
const politica = require('../../public/compartilhado/js/permissoes');

function assinar(payload) {
  const corpo = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const assinatura = crypto.createHmac('sha256', segredo).update(corpo).digest('base64url');
  return `${corpo}.${assinatura}`;
}

function lerCookie(req, nome) {
  const item = (req.headers.cookie || '').split(';').map(v => v.trim()).find(v => v.startsWith(`${nome}=`));
  try { return item ? decodeURIComponent(item.slice(nome.length + 1)) : ''; } catch (_) { return ''; }
}

function verificarToken(token) {
  if (!token) return null;
  const [corpo, assinatura] = token.split('.');
  if (!corpo || !assinatura) return null;
  const esperada = crypto.createHmac('sha256', segredo).update(corpo).digest();
  let recebida;
  try { recebida = Buffer.from(assinatura, 'base64url'); } catch (_) { return null; }
  if (recebida.length !== esperada.length || !crypto.timingSafeEqual(recebida, esperada)) return null;
  try {
    const sessao = JSON.parse(Buffer.from(corpo, 'base64url').toString());
    if (!sessao.exp || sessao.exp < Date.now() || !sessao.id || !sessao.empresa || !sessao.cargo) return null;
    return sessao;
  } catch (_) { return null; }
}

function criarSessao(funcionario) {
  const sessao = {
    id: Number(funcionario.idFuncionario),
    empresa: Number(funcionario.fkEmpresa),
    nome: funcionario.nome,
    email: funcionario.email,
    cargo: String(funcionario.tipoAcesso || '').toUpperCase(),
    exp: Date.now() + 12 * 60 * 60 * 1000
  };
  return { sessao, token: assinar(sessao) };
}

function permissoesDoCargo(cargo) { return politica.obter(cargo); }

function exigirPermissao(permissao) {
  return function (req, res, next) {
    if (!req.usuario || !politica.obter(req.usuario.cargo)[permissao]) return res.status(403).json({ erro: 'Seu cargo não permite esta ação.' });
    next();
  };
}

function autenticar(req, res, next) {
  const sessao = verificarToken(lerCookie(req, COOKIE));
  if (!sessao) return res.status(401).json({ erro: 'Sessão inválida ou expirada.' });
  req.usuario = sessao;
  next();
}

function permitirCargos(...cargos) {
  return function (req, res, next) {
    if (!req.usuario || !cargos.includes(req.usuario.cargo)) return res.status(403).json({ erro: 'Seu cargo não permite esta ação.' });
    next();
  };
}

function bloquearPagina(req, res, next) {
  if (!politica.protegida(req.path)) return next();
  res.set('Cache-Control', 'no-store');
  const sessao = verificarToken(lerCookie(req, COOKIE));
  if (!sessao) return res.redirect('/paginas/autenticacao/login/login.html');
  if (politica.podeAcessar(sessao.cargo, req.path)) return next();
  return res.redirect(politica.destino(sessao.cargo));
}

module.exports = { COOKIE, criarSessao, permissoesDoCargo, autenticar, exigirPermissao, permitirCargos, bloquearPagina, podeVerDashboard: politica.podeAcessar, destinoInicial: politica.destino };
