const functions = require("firebase-functions/v1");
const { onDocumentCreated } = require("firebase-functions/v2/firestore");
const admin = require("firebase-admin");
const nodemailer = require("nodemailer");

admin.initializeApp();

// =====================================================
// 1. EXISTING: BROADCAST NOTIFICATION
// =====================================================
exports.sendBroadcastNotification = functions.region('asia-south1').firestore
  .document("broadcasts/{docId}")
  .onCreate(async (snap, context) => {
    const broadcastData = snap.data();

    const targetCollection = broadcastData.target; // 'users' ya 'partners'
    const title = broadcastData.title;
    const message = broadcastData.message;
    const imageUrl = broadcastData.imageUrl || null;

    console.log(`Sending broadcast to ${targetCollection}...`);

    try {
      const snapshot = await admin.firestore().collection(targetCollection).get();

      let rawTokens = [];
      snapshot.forEach(doc => {
        const data = doc.data();
        if (data.fcmToken) {
          rawTokens.push(data.fcmToken);
        }
      });

      const tokens = [...new Set(rawTokens)];

      if (tokens.length === 0) {
        console.log("Koi FCM token nahi mila.");
        return null;
      }

      console.log(`Total active devices found: ${tokens.length} (Removed ${rawTokens.length - tokens.length} duplicate tokens)`);

      const payload = {
        notification: {
          title: title,
          body: message,
        }
      };

      if (imageUrl) {
        payload.notification.imageUrl = imageUrl;
      }

      const chunkSize = 500;
      for (let i = 0; i < tokens.length; i += chunkSize) {
        const tokenChunk = tokens.slice(i, i + chunkSize);

        const messagePayload = {
          notification: payload.notification,
          tokens: tokenChunk,
        };

        const response = await admin.messaging().sendEachForMulticast(messagePayload);
        console.log(`Batch ${Math.floor(i / chunkSize) + 1} sent. Success: ${response.successCount}, Failed: ${response.failureCount}`);
      }

      return snap.ref.update({ status: 'Delivered', deliveredCount: tokens.length });

    } catch (error) {
      console.error("Broadcast bhejne mein error aayi:", error);
      return snap.ref.update({ status: 'Failed', error: error.message });
    }
  });

// =====================================================
// 2. NEW: GMAIL + TELEGRAM ALERT ON NEW APP BOOKING
// =====================================================
const toSalonSlug = (name = "", fallbackId = "") => {
  const slug = String(name)
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || fallbackId;
};

const esc = (str = "") =>
  String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

exports.notifyAdminOnNewBooking = onDocumentCreated(
  {
    document: "partners/{salonId}/bookings/{bookingId}",
    region: "asia-south1",
  },
  async (event) => {
    const snap = event.data;
    if (!snap) return null;

    const b = snap.data() || {};
    const { salonId, bookingId } = event.params;

    // Walk-in bookings par alert skip karo (sirf App bookings)
    if (b.isWalkIn === true) {
      console.log(`Walk-in booking ${bookingId} skipped for alerts.`);
      return null;
    }

    // Agar booking doc mein salonName missing ho toh partners collection se nikal lo
    let salonName = b.salonName || "";
    if (!salonName) {
      try {
        const salonDoc = await admin.firestore().collection("partners").doc(salonId).get();
        const sData = salonDoc.data() || {};
        salonName = sData.salonName || sData.basicInfo?.salonName || "Unknown Salon";
      } catch (err) {
        salonName = "Unknown Salon";
      }
    }

    const customerName = b.userName || b.customerName || b.name || "Customer";
    const customerPhone = b.userPhone || b.phone || "N/A";
    const cleanPhone = String(customerPhone).replace(/\D/g, "");
    const amount = Number(b.totalAmount || b.price || 0);
    const advancePaid = Number(b.advancePaid || 49);
    const bookingType = b.isLive === true ? "Live Queue" : "Scheduled";
    const tokenText = b.tokenNumber ? `#${b.tokenNumber}` : "Processing";

    let servicesText = "Salon Service";
    if (Array.isArray(b.services) && b.services.length > 0) {
      servicesText = b.services
        .map((s) => (typeof s === "object" ? (s.name || s.serviceName) : s))
        .filter(Boolean)
        .join(", ");
    } else if (typeof b.serviceName === "string" && b.serviceName) {
      servicesText = b.serviceName;
    } else if (typeof b.service === "string" && b.service) {
      servicesText = b.service;
    }

    const salonSlug = toSalonSlug(salonName, salonId);
    const adminLink = `https://admin.digisaloon.in/bookings/${salonSlug}`;

    // -----------------------------------------------------
    // A) GMAIL ALERT
    // -----------------------------------------------------
    const gmailUser = (process.env.GMAIL_USER || "").trim();
    const gmailPass = (process.env.GMAIL_PASS || "").replace(/\s+/g, "");
    const adminEmails = (process.env.ADMIN_EMAILS || gmailUser).trim();

    if (gmailUser && gmailPass) {
      const transporter = nodemailer.createTransport({
        service: "gmail",
        auth: {
          user: gmailUser,
          pass: gmailPass,
        },
      });

      const htmlBody = `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif; max-width: 540px; margin: 0 auto; border: 1px solid #e5e7eb; border-radius: 14px; overflow: hidden; background: #ffffff;">
          <div style="background: #991b1b; padding: 18px 22px; color: #ffffff;">
            <div style="font-size: 12px; text-transform: uppercase; letter-spacing: 1px; opacity: 0.85;">DigiSaloon Alert</div>
            <h2 style="margin: 4px 0 0; font-size: 20px;">New App Booking Received</h2>
          </div>

          <div style="padding: 20px 22px; color: #1f2937; font-size: 14px; line-height: 1.6;">
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 7px 0; color: #6b7280; width: 125px;">Salon</td>
                <td style="padding: 7px 0; font-weight: 700; color: #111827;">${esc(salonName)}</td>
              </tr>
              <tr>
                <td style="padding: 7px 0; color: #6b7280;">Customer</td>
                <td style="padding: 7px 0; font-weight: 600;">${esc(customerName)}</td>
              </tr>
              <tr>
                <td style="padding: 7px 0; color: #6b7280;">Phone</td>
                <td style="padding: 7px 0;">
                  ${esc(customerPhone)}
                  ${cleanPhone.length >= 10 ? `&nbsp;(<a href="https://wa.me/${cleanPhone}" style="color: #16a34a; font-weight: 700; text-decoration: none;">WhatsApp</a>)` : ""}
                </td>
              </tr>
              <tr>
                <td style="padding: 7px 0; color: #6b7280;">Services</td>
                <td style="padding: 7px 0;">${esc(servicesText)}</td>
              </tr>
              <tr>
                <td style="padding: 7px 0; color: #6b7280;">Slot & Type</td>
                <td style="padding: 7px 0;">${esc(b.date || "-")} • ${esc(b.time || "-")} <b>(${bookingType})</b></td>
              </tr>
              <tr>
                <td style="padding: 7px 0; color: #6b7280;">Token</td>
                <td style="padding: 7px 0; font-weight: 700;">${esc(tokenText)}</td>
              </tr>
              <tr>
                <td style="padding: 7px 0; color: #6b7280;">Total Amount</td>
                <td style="padding: 7px 0; font-weight: 800; font-size: 16px; color: #059669;">₹${amount.toLocaleString("en-IN")} <span style="font-size: 12px; font-weight: 500; color: #6b7280;">(Advance: ₹${advancePaid})</span></td>
              </tr>
            </table>

            <div style="margin-top: 20px; text-align: center;">
              <a href="${adminLink}" style="display: inline-block; background: #111827; color: #ffffff; padding: 12px 22px; border-radius: 10px; text-decoration: none; font-weight: 700; font-size: 14px;">
                Open Salon Bookings →
              </a>
            </div>

            <p style="margin: 18px 0 0; font-size: 11px; color: #9ca3af; text-align: center;">
              Booking ID: ${esc(bookingId)} • Salon ID: ${esc(salonId)}
            </p>
          </div>
        </div>
      `;

      try {
        await transporter.sendMail({
          from: `"DigiSaloon Alerts" <${gmailUser}>`,
          to: adminEmails,
          subject: `🔔 New Booking: ₹${amount} at ${salonName} (${customerName})`,
          html: htmlBody,
        });
        console.log(`Admin Gmail alert sent for booking ${bookingId}`);
      } catch (error) {
        console.error("Admin Gmail alert bhejne mein error:", error);
      }
    } else {
      console.error("GMAIL_USER ya GMAIL_PASS .env mein missing hai!");
    }

    // -----------------------------------------------------
    // B) TELEGRAM INSTANT POPUP ALERT
    // -----------------------------------------------------
    const tgToken = (process.env.TELEGRAM_BOT_TOKEN || "").trim();
    const tgChatId = (process.env.TELEGRAM_CHAT_ID || "").trim();

    if (tgToken && tgChatId) {
      const waPhone = cleanPhone.length === 10 ? `91${cleanPhone}` : cleanPhone;

      const tgMessage = [
        `🔔 <b>New App Booking!</b>`,
        ``,
        `🏪 <b>Salon:</b> ${esc(salonName)}`,
        `👤 <b>Customer:</b> ${esc(customerName)}`,
        `📞 <b>Phone:</b> <code>${esc(customerPhone)}</code>`,
        `✂️ <b>Services:</b> ${esc(servicesText)}`,
        `📅 <b>Slot:</b> ${esc(b.date || "-")} • ${esc(b.time || "-")} (${bookingType})`,
        `🎟️ <b>Token:</b> ${esc(tokenText)}`,
        `💰 <b>Amount:</b> ₹${amount.toLocaleString("en-IN")} <i>(Advance: ₹${advancePaid})</i>`,
      ].join("\n");

      const buttons = [
        { text: "📋 Open in Admin Panel", url: adminLink },
      ];
      if (waPhone.length >= 10) {
        buttons.push({ text: "💬 WhatsApp", url: `https://wa.me/${waPhone}` });
      }

      try {
        const tgRes = await fetch(`https://api.telegram.org/bot${tgToken}/sendMessage`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: tgChatId,
            text: tgMessage,
            parse_mode: "HTML",
            reply_markup: {
              inline_keyboard: [buttons],
            },
          }),
        });

        const tgData = await tgRes.json();
        if (!tgData.ok) {
          console.error("Telegram API error:", tgData);
        } else {
          console.log(`Telegram alert sent for booking ${bookingId}`);
        }
      } catch (tgErr) {
        console.error("Telegram alert bhejne mein error:", tgErr);
      }
    }

    return null;
  }
);