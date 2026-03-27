const express = require("express");
const mercadopago = require("mercadopago");
const cors = require("cors");

const app = express();
app.use(cors({ origin: process.env.FRONTEND_URL || "*" }));
app.use(express.json());

mercadopago.configure({ access_token: process.env.MP_ACCESS_TOKEN });

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

// Notificación de MercadoPago
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
