const express = require("express");
const mercadopago = require("mercadopago");
const cors = require("cors");
const sgMail = require("@sendgrid/mail");
const twilio = require("twilio");

const app = express();
app.use(cors({ origin: "*" }));
app.use(express.json());

mercadopago.configure({ access_token: process.env.MP_ACCESS_TOKEN });
sgMail.setApiKey(process.env.SENDGRID_API_KEY);
const twilioClient = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);

// Enviar código por correo
app.post("/enviar-codigo", async (req, res) => {
  const { email, nombre, codigo } = req.body;
  try {
    await sgMail.send({
      to: email,
      from: "noreply@lapizarra.com.mx",
      subject: "Tu código de verificación — La Pizarra",
      html: `
        <div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;padding:20px">
          <div style="background:linear-gradient(135deg,#14532d,#16a34a);border-radius:16px;padding:24px;text-align:center;margin-bottom:24px">
            <h1 style="color:#fff;font-size:28px;margin:0">🪧 La Pizarra</h1>
            <p style="color:#86efac;margin:4px 0 0;font-size:13px">CENTRAL DE ABASTO · CDMX</p>
          </div>
          <p style="font-size:16px;color:#111">Hola <b>${nombre}</b>,</p>
          <p style="font-size:15px;color:#374151">Tu código de verificación es:</p>
          <div style="background:#f0fdf4;border:2px solid #16a34a;border-radius:12px;padding:20px;text-align:center;margin:20px 0">
            <span style="font-size:36px;font-weight:900;color:#14532d;letter-spacing:8px">${codigo}</span>
          </div>
          <p style="font-size:13px;color:#9ca3af">Este código expira en 10 minutos.</p>
        </div>
      `,
    });
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// Enviar código por WhatsApp
app.post("/enviar-codigo-whatsapp", async (req, res) => {
  const { tel, nombre, codigo } = req.body;
  try {
    await twilioClient.messages.create({
      from: process.env.TWILIO_WHATSAPP_FROM,
      to: `whatsapp:+52${tel}`,
      body: `🪧 *La Pizarra*\n\nHola ${nombre}, tu código de verificación es:\n\n*${codigo}*\n\nEste código expira en 10 minutos.`,
    });
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// Crear preferencia de pago
app.post("/crear-pago", async (req, res) => {
  const { nombre, email, tipo } = req.body;
  try {
    const preferencia = {
      items: [{
        title: `La Pizarra - Membresía ${tipo === "vendedor" ? "Vendedor" : "Comprador"}`,
        quantity: 1,
        unit_price: 200,
        currency_id: "MXN",
      }],
      payer: { name: nombre, email: email },
      back_urls: {
        success: `${process.env.FRONTEND_URL}?pago=exitoso`,
        failure: `${process.env.FRONTEND_URL}?pago=fallido`,
        pending: `${process.env.FRONTEND_URL}?pago=pendiente`,
      },
      auto_return: "approved",
      notification_url: `https://nurturing-joy-production-cae2.up.railway.app/notificacion`,
    };
    const respuesta = await mercadopago.preferences.create(preferencia);
    res.json({ url: respuesta.body.init_point });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Notificación MercadoPago
app.post("/notificacion", async (req, res) => {
  const { type, data } = req.body;
  if (type === "payment") {
    try {
      const pago = await mercadopago.payment.findById(data.id);
      console.log("Pago recibido:", pago.body.status, pago.body.payer.email);
    } catch (err) {
      console.error(err);
    }
  }
  res.sendStatus(200);
});

app.get("/", (req, res) => res.json({ ok: true, app: "La Pizarra Server" }));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Servidor corriendo en puerto ${PORT}`));
