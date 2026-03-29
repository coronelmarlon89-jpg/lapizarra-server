const express = require("express");
const cors = require("cors");
const sgMail = require("@sendgrid/mail");
const twilio = require("twilio");
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);

const app = express();
app.use(cors({ origin: "*" }));
app.use(express.json());

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
    console.error("Error SendGrid:", err);
    res.status(500).json({ error: err.message });
  }
});

// Enviar código por SMS
app.post("/enviar-codigo-sms", async (req, res) => {
  const { tel, nombre, codigo } = req.body;
  try {
    await twilioClient.messages.create({
      from: process.env.TWILIO_SMS_FROM,
      to: `+52${tel}`,
      body: `La Pizarra: Hola ${nombre}, tu codigo es: ${codigo}. Expira en 10 minutos.`,
    });
    res.json({ ok: true });
  } catch (err) {
    console.error("Error Twilio:", err);
    res.status(500).json({ error: err.message });
  }
});

// Crear sesión de pago con Stripe
app.post("/crear-pago", async (req, res) => {
  const { nombre, email, tipo } = req.body;
  try {
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      line_items: [{
        price_data: {
          currency: "mxn",
          product_data: {
            name: `La Pizarra — Membresía ${tipo === "vendedor" ? "Vendedor" : "Comprador"}`,
            description: "30 días de acceso completo",
          },
          unit_amount: 20000, // $200 MXN en centavos
        },
        quantity: 1,
      }],
      mode: "payment",
      customer_email: email,
      success_url: `${process.env.FRONTEND_URL}?pago=exitoso`,
      cancel_url: `${process.env.FRONTEND_URL}?pago=cancelado`,
      metadata: { nombre, email, tipo },
    });
    res.json({ url: session.url });
  } catch (err) {
    console.error("Error Stripe:", err);
    res.status(500).json({ error: err.message });
  }
});

// Webhook de Stripe
app.post("/webhook-stripe", express.raw({type: "application/json"}), (req, res) => {
  const sig = req.headers["stripe-signature"];
  try {
    const event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET || "");
    if(event.type === "checkout.session.completed"){
      const session = event.data.object;
      console.log("Pago exitoso:", session.customer_email, session.metadata);
    }
    res.json({ received: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get("/", (req, res) => res.json({ ok: true, app: "La Pizarra Server" }));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Servidor corriendo en puerto ${PORT}`));
