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
      timestamp = ""
    } = req.body;

    if (!name || !phone) {
      return res.status(400).json({
        success: false,
        message: "Name and phone are required."
      });
    }

    const finalTravelDate = travel_date || travel_month || "";

    const text = `
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
`.trim();

    const telegramResponse = await fetch(
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

    const telegramResult = await telegramResponse.json();

    if (!telegramResponse.ok || !telegramResult.ok) {
      console.error("Telegram API error:", telegramResult);
      return res.status(500).json({
        success: false,
        message: "Telegram notification failed."
      });
    }

    if (process.env.GOOGLE_SCRIPT_URL) {
      try {
        await fetch(process.env.GOOGLE_SCRIPT_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
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
            timestamp
          })
        });
      } catch (sheetError) {
        console.error("Google Sheet webhook error:", sheetError);
      }
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
