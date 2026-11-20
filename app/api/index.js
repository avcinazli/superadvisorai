// Vercel serverless giriş noktası: tüm dinamik istekler (vercel.json rewrite) buraya gelir.
const { app, init } = require('../server');

let ready = null;

module.exports = async (req, res) => {
  if (!ready) {
    ready = init().catch((err) => {
      console.error('Başlatma hatası:', err.message);
      ready = null; // bir sonraki istekte tekrar dene
    });
  }
  await ready;
  return app(req, res);
};
