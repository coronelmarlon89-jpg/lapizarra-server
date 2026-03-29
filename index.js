const express = require("express");
const cors = require("cors");
const sgMail = require("@sendgrid/mail");
const twilio = require("twilio");
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
const { createClient } = require("@supabase/supabase-js");

const app = express();
app.use(cors({ origin: "*" }));
app.use(express.json());

sgMail.setApiKey(process.env.SENDGRID_API_KEY);
const twilioClient = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SECRET);

// ── COMPRADORES ──────────────────────────────────────────────────
app.get("/compradores/:tel", async (req, res) => {
  const { data } = await supabase.from("compradores").select("*").eq("tel", req.params.tel).single();
  res.json(data || null);
});
app.post("/compradores", async (req, res) => {
  const { data, error } = await supabase.from("compradores").upsert(req.body).select().single();
  res.json(data || { error });
});
app.patch("/compradores/:tel", async (req, res) => {
  const { data } = await supabase.from("compradores").update(req.body).eq("tel", req.params.tel).select().single();
  res.json(data || null);
});
app.delete("/compradores/:tel", async (req, res) => {
  await supabase.from("compradores").delete().eq("tel", req.params.tel);
  res.json({ ok: true });
});
app.get("/compradores", async (req, res) => {
  const { data } = await supabase.from("compradores").select("*");
  res.json(data || []);
});

// ── VENDEDORES ───────────────────────────────────────────────────
app.get("/vendedores/:id", async (req, res) => {
  const { data } = await supabase.from("vendedores").select("*").eq("id", req.params.id).single();
  res.json(data || null);
});
app.post("/vendedores", async (req, res) => {
  const { data, error } = await supabase.from("vendedores").upsert(req.body).select().single();
  res.json(data || { error });
});
app.patch("/vendedores/:id", async (req, res) => {
  const { data } = await supabase.from("vendedores").update(req.body).eq("id", req.params.id).select().single();
  res.json(data || null);
});
app.delete("/vendedores/:id", async (req, res) => {
  await supabase.from("vendedores").delete().eq("id", req.params.id);
  res.json({ ok: true });
});
app.get("/vendedores", async (req, res) => {
  const { data } = await supabase.from("vendedores").select("*");
  res.json(data || []);
});

// ── PRECIOS ──────────────────────────────────────────────────────
app.get("/precios", async (req, res) => {
  const { data } = await supabase.from("precios").select("*");
  res.json(data || []);
});
app.post("/precios", async (req, res) => {
  const { data, error } = await supabase.from("precios").upsert(req.body).select().single();
  res.json(data || { error });
});
app.delete("/precios/:key", async (req, res) => {
  await supabase.from("precios").delete().eq("key", req.params.key);
  res.json({ ok: true });
});

// ── CONTACTOS ────────────────────────────────────────────────────
app.get("/contactos/:vendedor_id", async (req, res) => {
  const { data } = await supabase.from("contactos").select("*").eq("vendedor_id", req.params.vendedor_id);
  res.json(data || []);
});
app.post("/contactos", async (req, res) => {
  const { data } = await supabase.from("contactos").insert(req.body).select().single();
  res.json(data || null);
});

// ── CORREO ───────────────────────────────────────────────────────
app.post("/enviar-codigo", async (req, res) => {
  const { email, nombre, codigo } = req.body;
  try {
    await sgMail.send({
      to: email,
      from: "noreply@lapizarra.com.mx",
      subject: "Tu código de verificación — La Pizarra",
      html: `<div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;padding:20px"><div style="background:linear-gradient(135deg,#14532d,#16a34a);border-radius:16px;padding:24px;text-align:center;margin-bottom:24px"><h1 style="color:#fff;font-size:28px;margin:0">🪧 La Pizarra</h1></div><p style="font-size:16px;color:#111">Hola <b>${nombre}</b>, tu código es:</p><div style="background:#f0fdf4;border:2px solid #16a34a;border-radius:12px;padding:20px;text-align:center;margin:20px 0"><span style="font-size:36px;font-weight:900;color:#14532d;letter-spacing:8px">${codigo}</span></div><p style="font-size:13px;color:#9ca3af">Expira en 10 minutos.</p></div>`,
    });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── SMS ──────────────────────────────────────────────────────────
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
    res.status(500).json({ error: err.message });
  }
});

// ── STRIPE ───────────────────────────────────────────────────────
app.post("/crear-pago", async (req, res) => {
  const { nombre, email, tipo, userId, userTipo } = req.body;
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
          unit_amount: 20000,
        },
        quantity: 1,
      }],
      mode: "payment",
      customer_email: email,
      success_url: `${process.env.FRONTEND_URL}?pago=exitoso&uid=${userId}&tipo=${userTipo}`,
      cancel_url: `${process.env.FRONTEND_URL}?pago=cancelado`,
      metadata: { nombre, email, tipo, userId, userTipo },
    });
    res.json({ url: session.url });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/", (req, res) => res.json({ ok: true, app: "La Pizarra Server" }));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Servidor en puerto ${PORT}`));
