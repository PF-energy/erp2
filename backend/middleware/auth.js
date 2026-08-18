const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  console.error(
    '\nJWT_SECRET is not set. Set it to a long random string, e.g.\n' +
    '  JWT_SECRET=$(openssl rand -hex 32) npm start\n' +
    'See DEPLOY.md.\n'
  );
  process.exit(1);
}

const COOKIE_NAME = 'pf_session';
const TOKEN_TTL = '30d';

function signToken(user) {
  return jwt.sign(
    { sub: user.id, orgId: user.org_id, email: user.email, role: user.role },
    JWT_SECRET,
    { expiresIn: TOKEN_TTL }
  );
}

function setSessionCookie(res, token) {
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 30 * 24 * 60 * 60 * 1000,
    path: '/',
  });
}

function clearSessionCookie(res) {
  res.clearCookie(COOKIE_NAME, { path: '/' });
}

// Every protected route sees req.user = { id, orgId, email, role }. All
// data queries in the app filter by req.user.orgId — that's the entire
// tenant-isolation boundary, so this middleware is what everything else
// relies on being correct.
function requireAuth(req, res, next) {
  const token = req.cookies && req.cookies[COOKIE_NAME];
  if (!token) return res.status(401).json({ error: 'not authenticated' });
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.user = { id: payload.sub, orgId: payload.orgId, email: payload.email, role: payload.role };
    next();
  } catch (err) {
    return res.status(401).json({ error: 'session expired or invalid' });
  }
}

function requireAdmin(req, res, next) {
  if (req.user?.role !== 'admin') return res.status(403).json({ error: 'admin role required' });
  next();
}

module.exports = { signToken, setSessionCookie, clearSessionCookie, requireAuth, requireAdmin, COOKIE_NAME };
