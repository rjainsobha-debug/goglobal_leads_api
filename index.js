import express from "express";

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.urlencoded({ extended: true }));
app.use(express.json());

app.get("/", (req, res) => {
  res.send("GoGlobal lead system is running");
});

app.post("/lead", async (req, res) => {
  try {
    const {
      full_name = "",
      mobile = "",
      email = "",
      service = "",
      destination = "",
      travel_date = "",
      message = "",
      source_page = "website"
    } = req.body;

    const text = `
🚀 New Lead

Name: ${full_name}
Mobile: ${mobile}
Email: ${email}
Service: ${service}
Destination: ${destination}
Travel Date: ${travel_date}
Message: ${message}
Source: ${source_page}
`;

    await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        chat_id: process.env.TELEGRAM_CHAT_ID,
        text
      })
    });

    if (process.env.GOOGLE_SCRIPT_URL) {
      await fetch(process.env.GOOGLE_SCRIPT_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          full_name,
          mobile,
          email,
          service,
          destination,
          travel_date,
          message,
          source_page
        })
      });
    }

    res.redirect(process.env.THANK_YOU_URL || "https://goglobal.forex/thank-you.html");

  } catch (err) {
    console.error(err);
    res.status(500).send("Error");
  }
});

app.listen(PORT, () => {
  console.log("Server running");
});
