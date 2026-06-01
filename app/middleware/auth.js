const jwt = require('jsonwebtoken');

const SECRET = process.env.JWT_SECRET;

function auth(req, res, next) {
  const token = req.cookies?.token;
  if (!token) return res.status(401).json({ error: 'Kimlik doğrulama gerekli' });

  try {
    req.user = jwt.verify(token, SECRET);
    next();
  } catch {
    res.clearCookie('token');
    res.status(401).json({ error: 'Oturum süresi doldu, yeniden giriş yapın' });
  }
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!roles.includes(req.user?.role)) {
      return res.status(403).json({ error: 'Bu işlem için yetkiniz yok' });
    }
    next();
  };
}

module.exports = { auth, requireRole };
