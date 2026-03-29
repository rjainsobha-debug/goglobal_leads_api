import express from "express";
import cors from "cors";

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors({
  origin: [
    "https://goglobal.forex",
    "http://localhost:3000",
    "http://127.0.0.1:5500"
  ],
  methods: ["GET", "POST", "OPTIONS"],
  allowedHeaders: ["Content-Type"]
}));

app.use(express.urlencoded({ extended: true }));
app.use(express.json());

app.get("/", (req, res) => {
  res.send("GoGlobal lead system is running");
});

app.get("/api/lead", (req, res) => {
  res.status(405).json({
    success: false,
    message: "Use POST for this endpoint."
  });
});

async function sendTelegram(text) {
  const response = await fetch(
    `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        chat_id: process.env.TELEGRAM_CHAT_ID,
        text
      })
    }
  );

  const result = await response.json();

  if (!response.ok || !result.ok) {
    throw new Error(`Telegram error: ${JSON.stringify(result)}`);
  }

  return result;
}

async function logToGoogleSheet(payload) {
  if (!process.env.GOOGLE_SCRIPT_URL) {
    return "Skipped: no GOOGLE_SCRIPT_URL";
  }

  const response = await fetch(process.env.GOOGLE_SCRIPT_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  const text = await response.text();
  console.log("Google Script raw response:", text);

  if (!response.ok) {
    throw new Error(`Google Sheet logging failed: ${response.status} ${text}`);
  }

  return text;
}

async function sendWhatsAppTemplate({ name, phone, service }) {
  if (
    !process.env.WHATSAPP_ACCESS_TOKEN ||
    !process.env.WHATSAPP_PHONE_NUMBER_ID ||
    !process.env.WHATSAPP_TEMPLATE_NAME
  ) {
    return { skipped: true, reason: "WhatsApp env vars not set" };
  }

  let cleanPhone = String(phone || "").replace(/\D/g, "");

  if (cleanPhone.length === 10) {
    cleanPhone = `91${cleanPhone}`;
  }

  if (!cleanPhone) {
    return { skipped: true, reason: "Invalid phone" };
  }

  const response = await fetch(
    `https://graph.facebook.com/v23.0/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`,
    {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: cleanPhone,
        type: "template",
        template: {
          name: process.env.WHATSAPP_TEMPLATE_NAME,
          language: {
            code: process.env.WHATSAPP_TEMPLATE_LANG || "en"
          },
          components: [
            {
              type: "body",
              parameters: [
                { type: "text", text: name || "Customer" },
                { type: "text", text: service || "travel enquiry" }
              ]
            }
          ]
        }
      })
    }
  );

  const result = await response.json();

  if (!response.ok) {
    throw new Error(`WhatsApp API error: ${JSON.stringify(result)}`);
  }

  return result;
}

app.post("/api/lead", async (req, res) => {
  try {
    const {
      name = "",
      phone = "",
      email = "",
      service = "",
      destination = "",
      travel_date = "",
      travel_month = "",
      travellers = "",
      callback_time = "",
      message = "",
      source = "website",
      landing_page = "",
      campaign = "",
      timestamp = "",
      referrer = "",
      user_agent = ""
    } = req.body;

    if (!name || !phone) {
      return res.status(400).json({
        success: false,
        message: "Name and phone are required."
      });
    }

    const finalTravelDate = travel_date || travel_month || "";

    const telegramText = `
🚀 New GoGlobal Lead

Name: ${name}
Mobile: ${phone}
Email: ${email}
Service: ${service}
Destination: ${destination}
Travel Date/Month: ${finalTravelDate}
Travellers: ${travellers}
Preferred Callback: ${callback_time}
Message: ${message}
Source: ${source}
Landing Page: ${landing_page}
Campaign: ${campaign}
Timestamp: ${timestamp}
Referrer: ${referrer}
    `.trim();

    await sendTelegram(telegramText);

    try {
      const sheetResult = await logToGoogleSheet({
        name,
        phone,
        email,
        service,
        destination,
        travel_date: finalTravelDate,
        travellers,
        callback_time,
        message,
        source,
        landing_page,
        campaign,
        timestamp,
        referrer,
        user_agent
      });
      console.log("Google Sheet logging success:", sheetResult);
    } catch (sheetError) {
      console.error("Google Sheet logging error:", sheetError);
    }

    try {
      const waResult = await sendWhatsAppTemplate({ name, phone, service });
      console.log("WhatsApp follow-up result:", waResult);
    } catch (waError) {
      console.error("WhatsApp follow-up error:", waError);
    }

    return res.status(200).json({
      success: true,
      message: "Lead submitted successfully"
    });

  } catch (err) {
    console.error("Lead API error:", err);
    return res.status(500).json({
      success: false,
      message: "Server error while submitting lead."
    });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
