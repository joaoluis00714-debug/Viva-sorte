// ⚡ server.js corrigido para Railway + Mercado Pago

const express = require("express");
const fetch = require("node-fetch");
const bodyParser = require("body-parser");
const cors = require("cors");
const path = require("path");

const app = express();
app.use(cors());
app.use(bodyParser.json());

// 🔵 Servir arquivos estáticos
app.use(express.static(__dirname));

// TOKEN MERCADO PAGO
const TOKEN = "APP_USR-5555886528536836-120817-65519b58bbfe00e9d566f1e1c795ac69-749376790";

// Google Planilha
const PLANILHA_URL =
  "https://script.google.com/macros/s/AKfycbzoY1EQg1_94KDH_iV03i0j04ICjxmHK-bks2AuxTE2ujJA8ygp8JKbnvHTOhQ9IaQolQ/exec";

// ===============================
// 🏠 HOME
// ===============================
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

// ===============================
// 🧾 CHECKOUT
// ===============================
app.get("/checkout", (req, res) => {
  res.sendFile(path.join(__dirname, "checkout.html"));
});

// ===============================
// ✅ SUCESSO
// ===============================
app.get("/sucesso", (req, res) => {
  res.sendFile(path.join(__dirname, "sucesso.html"));
});

// ===============================
// ❌ CANCELADO
// ===============================
app.get("/cancelado", (req, res) => {
  res.sendFile(path.join(__dirname, "cancelado.html"));
});

// ===============================
// 💳 CRIAR PAGAMENTO PIX
// ===============================
app.post("/criar-pagamento", async (req, res) => {
  const data = req.body;

  // Salva como pendente na planilha
  await fetch(PLANILHA_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      ...data,
      status: "pending",
      payment_id: "aguardando"
    })
  });

  // Cria pagamento PIX
  const pagamento = await fetch("https://api.mercadopago.com/v1/payments", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      "Content-Type": "application/json",
      "X-Idempotency-Key": `${Date.now()}-${Math.random()}`
    },
    body: JSON.stringify({
      transaction_amount: Number(data.valor),
      description: "Rifa Viva Sorte",
      payment_method_id: "pix",
      notification_url:
        "https://checkout-kaik-production-4bce.up.railway.app/notificacao",
      payer: {
        email: data.email,
        first_name: data.nome
      }
    })
  });

  const r = await pagamento.json();

  if (r.error) {
    console.log("ERRO MERCADO PAGO:", r);
    return res.json({ erro: r });
  }

  res.json({
    id: r.id,
    qr: r.point_of_interaction.transaction_data.qr_code_base64,
    code: r.point_of_interaction.transaction_data.qr_code
  });
});

// ===============================
// 🔍 VERIFICAR PAGAMENTO
// ===============================
app.get("/verificar/:id", async (req, res) => {
  const id = req.params.id;

  const r = await fetch(
    `https://api.mercadopago.com/v1/payments/${id}`,
    {
      headers: { Authorization: `Bearer ${TOKEN}` }
    }
  );

  const pag = await r.json();
  res.json({ status: pag.status });
});

// ===============================
// 🔔 WEBHOOK
// ===============================
app.post("/notificacao", async (req, res) => {
  try {
    const id = req.body.data?.id;
    if (!id) return res.sendStatus(200);

    const mp = await fetch(
      `https://api.mercadopago.com/v1/payments/${id}`,
      { headers: { Authorization: `Bearer ${TOKEN}` } }
    );

    const pag = await mp.json();

    if (pag.status === "approved") {
      await fetch(PLANILHA_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nome: pag.payer.first_name,
          email: pag.payer.email,
          valor: pag.transaction_amount,
          status: "approved",
          payment_id: id
        })
      });
    }
  } catch (e) {
    console.log("Erro webhook:", e);
  }

  res.sendStatus(200);
});

// ===============================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () =>
  console.log("🚀 Servidor rodando na porta " + PORT)
);

