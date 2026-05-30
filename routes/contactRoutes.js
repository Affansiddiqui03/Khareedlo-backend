// Khareedlo Backend/routes/contactRoutes.js
// UPDATED: Added GET /api/contact/user/:customerId
// So customers can see their own messages + admin replies in user dashboard

const express    = require("express");
const router     = express.Router();
const db         = require("../config/db");
const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS },
});

const TOPIC_LABELS = {
  general: "General Support", brand: "Brand Partnership",
  pos: "POS / Integration",   bug: "Bug Report",
  account: "Account Issue",   product: "Product Inquiry", other: "Other",
};

// ── POST /api/contact — Submit message ────────────────────────
router.post("/", async (req, res) => {
  const { name, email, phone, topic, brand_name, message, customer_id } = req.body;
  if (!name?.trim())    return res.status(400).json({ error: "Name is required." });
  if (!email?.trim())   return res.status(400).json({ error: "Email is required." });
  if (!message?.trim()) return res.status(400).json({ error: "Message is required." });

  const topicLabel = TOPIC_LABELS[topic] || "General";
  try {
    const [result] = await db.promise().execute(
      `INSERT INTO contact_messages (customer_id,name,email,phone,topic,brand_name,message) VALUES (?,?,?,?,?,?,?)`,
      [customer_id||null, name.trim(), email.trim().toLowerCase(), phone?.trim()||null, topic||"general", brand_name?.trim()||null, message.trim()]
    );

    const emailReady = process.env.EMAIL_USER && process.env.EMAIL_PASS && process.env.EMAIL_PASS !== "your-16-char-app-password";
    if (emailReady) {
      try {
        await transporter.sendMail({
          from: `"Khareedlo Contact Form" <${process.env.EMAIL_USER}>`,
          to: process.env.EMAIL_USER, replyTo: email.trim(),
          subject: `[Khareedlo] New Message — ${topicLabel}`,
          html: `<div style="font-family:Arial,sans-serif;padding:20px"><h2>New Message: ${topicLabel}</h2>
            <p><b>From:</b> ${name} &lt;${email}&gt;</p>
            ${phone ? `<p><b>Phone:</b> ${phone}</p>` : ""}
            <p><b>Topic:</b> ${topicLabel}</p>
            ${brand_name ? `<p><b>Brand:</b> ${brand_name}</p>` : ""}
            <p><b>Message:</b><br>${message}</p>
            <p style="color:#666;font-size:12px">Hit Reply to respond directly to sender. Or use Admin Dashboard → Messages.</p></div>`
        });
        await transporter.sendMail({
          from: `"Khareedlo Support" <${process.env.EMAIL_USER}>`,
          to: email.trim(),
          subject: `We received your message — Khareedlo`,
          html: `<div style="font-family:Arial,sans-serif;padding:20px"><h2>Hi ${name},</h2>
            <p>We received your message and will respond within 24–48 hours.</p>
            <p><b>Topic:</b> ${topicLabel}</p><p><b>Message:</b><br>${message.substring(0,200)}${message.length>200?"…":""}</p>
            <p>Urgent? Email us at khareedlo@gmail.com</p></div>`
        });
      } catch (emailErr) { console.error("Email failed:", emailErr.message); }
    }
    res.json({ success: true, id: result.insertId });
  } catch (err) { console.error(err); res.status(500).json({ error: "Server error." }); }
});

// ── GET /api/contact/user/:customerId — Customer sees their own messages ──
// Shows all messages submitted by this customer + admin reply for each
router.get("/user/:customerId", async (req, res) => {
  const { customerId } = req.params;
  if (!customerId || isNaN(customerId)) return res.status(400).json({ error: "Invalid customer ID" });

  try {
    const [rows] = await db.promise().execute(
      `SELECT id, name, email, topic, brand_name, message, is_read,
              replied, reply_text, replied_at, created_at
       FROM contact_messages
       WHERE customer_id = ?
       ORDER BY created_at DESC`,
      [customerId]
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error." });
  }
});

// ── GET /api/contact — Admin: all messages ────────────────────
router.get("/", async (req, res) => {
  try {
    const [rows] = await db.promise().execute(
      `SELECT cm.*, c.name AS customer_name_db
       FROM contact_messages cm
       LEFT JOIN customers c ON c.customer_id = cm.customer_id
       ORDER BY cm.created_at DESC`
    );
    res.json(rows);
  } catch (err) { console.error(err); res.status(500).json({ error: "Server error." }); }
});

// ── GET /api/contact/unread-count ─────────────────────────────
router.get("/unread-count", async (req, res) => {
  try {
    const [[row]] = await db.promise().execute("SELECT COUNT(*) AS count FROM contact_messages WHERE is_read = 0");
    res.json({ count: row.count });
  } catch (err) { res.status(500).json({ error: "Server error." }); }
});

// ── PATCH /api/contact/:id/read ───────────────────────────────
router.patch("/:id/read", async (req, res) => {
  try {
    await db.promise().execute("UPDATE contact_messages SET is_read = 1 WHERE id = ?", [req.params.id]);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: "Server error." }); }
});

// ── POST /api/contact/:id/reply ───────────────────────────────
router.post("/:id/reply", async (req, res) => {
  const { reply_text } = req.body;
  if (!reply_text?.trim()) return res.status(400).json({ error: "Reply cannot be empty." });

  try {
    const [[msg]] = await db.promise().execute("SELECT * FROM contact_messages WHERE id = ?", [req.params.id]);
    if (!msg) return res.status(404).json({ error: "Message not found." });

    // Save reply to DB first
    await db.promise().execute(
      "UPDATE contact_messages SET replied=1, reply_text=?, replied_at=NOW(), is_read=1 WHERE id=?",
      [reply_text.trim(), req.params.id]
    );

    const topicLabel = TOPIC_LABELS[msg.topic] || msg.topic;
    const emailReady = process.env.EMAIL_USER && process.env.EMAIL_PASS && process.env.EMAIL_PASS !== "your-16-char-app-password";

    if (emailReady) {
      await transporter.sendMail({
        from: `"Khareedlo Support" <${process.env.EMAIL_USER}>`,
        to: msg.email,
        subject: `Re: Your ${topicLabel} inquiry — Khareedlo`,
        html: `<div style="font-family:Arial,sans-serif;padding:20px"><h2>Hi ${msg.name},</h2>
          <div style="border-left:4px solid #DC2626;padding-left:16px;margin:16px 0">
            <p style="color:#666;font-size:12px;font-weight:bold">OUR REPLY</p>
            <p>${reply_text}</p>
          </div>
          <div style="border-top:1px solid #eee;padding-top:12px;margin-top:12px;color:#888;font-size:13px">
            <p><b>Your original message:</b></p>
            <p>"${msg.message.substring(0,300)}${msg.message.length>300?"…":""}"</p>
          </div>
          <p style="font-size:13px">Need more help? <a href="mailto:khareedlo@gmail.com">khareedlo@gmail.com</a></p></div>`
      });
      res.json({ success: true, emailSent: true });
    } else {
      res.json({ success: true, emailSent: false, note: "Reply saved. Configure EMAIL_PASS to also send email." });
    }
  } catch (err) { console.error("Reply error:", err); res.status(500).json({ error: "Failed: " + err.message }); }
});

module.exports = router;