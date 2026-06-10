// services/emailService.js
// Nodemailer service for Khareedlo notifications
// Sender: khareedlo26@gmail.com
// Admin notifications: khareedlo@gmail.com

const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_FROM,           // khareedlo26@gmail.com
    pass: process.env.EMAIL_APP_PASSWORD,   // 16-digit app password
  },
});

// ── Email 1: Notify admin when a new brand registers ──────────
async function sendAdminNewBrandNotification(brandName, brandEmail) {
  try {
    await transporter.sendMail({
      from: `"Khareedlo Platform" <${process.env.EMAIL_FROM}>`,
      to: "khareedlo@gmail.com",
      subject: `New Brand Registration: ${brandName}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #f97316, #ef4444); padding: 30px; border-radius: 12px 12px 0 0; text-align: center;">
            <h1 style="color: white; margin: 0; font-size: 24px;">Khareedlo Admin</h1>
            <p style="color: rgba(255,255,255,0.85); margin: 8px 0 0;">New Brand Registration Request</p>
          </div>
          <div style="background: #ffffff; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px;">
            <h2 style="color: #1f2937; margin-top: 0;">A new brand has registered!</h2>
            <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
              <tr style="background: #f9fafb;">
                <td style="padding: 12px 16px; font-weight: bold; color: #374151; border: 1px solid #e5e7eb; width: 35%;">Brand Name</td>
                <td style="padding: 12px 16px; color: #111827; border: 1px solid #e5e7eb;">${brandName}</td>
              </tr>
              <tr>
                <td style="padding: 12px 16px; font-weight: bold; color: #374151; border: 1px solid #e5e7eb;">Email</td>
                <td style="padding: 12px 16px; color: #111827; border: 1px solid #e5e7eb;">${brandEmail}</td>
              </tr>
              <tr style="background: #f9fafb;">
                <td style="padding: 12px 16px; font-weight: bold; color: #374151; border: 1px solid #e5e7eb;">Status</td>
                <td style="padding: 12px 16px; border: 1px solid #e5e7eb;">
                  <span style="background: #fef3c7; color: #92400e; padding: 4px 12px; border-radius: 20px; font-size: 13px; font-weight: bold;">PENDING APPROVAL</span>
                </td>
              </tr>
              <tr>
                <td style="padding: 12px 16px; font-weight: bold; color: #374151; border: 1px solid #e5e7eb;">Registered At</td>
                <td style="padding: 12px 16px; color: #111827; border: 1px solid #e5e7eb;">${new Date().toLocaleString("en-PK", { timeZone: "Asia/Karachi" })} (PKT)</td>
              </tr>
            </table>
            <div style="background: #fff7ed; border: 1px solid #fed7aa; border-radius: 8px; padding: 16px; margin: 20px 0;">
              <p style="margin: 0; color: #9a3412; font-size: 14px;">
                <strong>Action Required:</strong> Please log in to the Khareedlo Admin Dashboard to review and approve or reject this registration.
              </p>
            </div>
            <div style="text-align: center; margin-top: 24px;">
              <a href="https://khareedlo.store/auth" 
                style="background: linear-gradient(135deg, #f97316, #ef4444); color: white; padding: 12px 28px; border-radius: 8px; text-decoration: none; font-weight: bold; font-size: 15px; display: inline-block;">
                Go to Admin Dashboard
              </a>
            </div>
          </div>
          <p style="text-align: center; color: #9ca3af; font-size: 12px; margin-top: 16px;">
            © ${new Date().getFullYear()} Khareedlo — Pakistan's Fashion Platform
          </p>
        </div>
      `,
    });
    console.log(`[Email] Admin notified: new brand "${brandName}" registered`);
  } catch (err) {
    console.error("[Email] Failed to notify admin:", err.message);
  }
}

// ── Email 2: Notify brand when admin approves them ────────────
async function sendBrandApprovalEmail(brandName, brandEmail) {
  try {
    await transporter.sendMail({
      from: `"Khareedlo Platform" <${process.env.EMAIL_FROM}>`,
      to: brandEmail,
      subject: `Your Brand Has Been Approved — Welcome to Khareedlo!`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #f97316, #ef4444); padding: 30px; border-radius: 12px 12px 0 0; text-align: center;">
            <div style="font-size: 48px; margin-bottom: 10px;">🎉</div>
            <h1 style="color: white; margin: 0; font-size: 26px;">Congratulations!</h1>
            <p style="color: rgba(255,255,255,0.9); margin: 8px 0 0; font-size: 15px;">Your brand has been approved on Khareedlo</p>
          </div>
          <div style="background: #ffffff; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px;">
            <p style="color: #374151; font-size: 16px; line-height: 1.6;">
              Dear <strong>${brandName}</strong>,
            </p>
            <p style="color: #374151; font-size: 15px; line-height: 1.6;">
              We're excited to inform you that your brand registration on <strong>Khareedlo</strong> has been <span style="color: #16a34a; font-weight: bold;">approved</span>! 
              You can now log in to your Brand Dashboard and start showcasing your products to thousands of shoppers across Pakistan.
            </p>
            <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 20px; margin: 24px 0;">
              <h3 style="color: #166534; margin: 0 0 12px;">What you can do now:</h3>
              <ul style="color: #15803d; margin: 0; padding-left: 20px; line-height: 2;">
                <li>Add and manage your products</li>
                <li>Track orders from Khareedlo customers</li>
                <li>View sales analytics and insights</li>
                <li>Manage your brand profile and outlets</li>
              </ul>
            </div>
            <div style="text-align: center; margin-top: 24px;">
              <a href="https://khareedlo.store/auth" 
                style="background: linear-gradient(135deg, #f97316, #ef4444); color: white; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: bold; font-size: 16px; display: inline-block;">
                Login to Your Dashboard
              </a>
            </div>
            <p style="color: #6b7280; font-size: 13px; margin-top: 24px; line-height: 1.6;">
              If you have any questions or need help getting started, feel free to contact us at 
              <a href="mailto:khareedlo@gmail.com" style="color: #f97316;">khareedlo@gmail.com</a>.
            </p>
          </div>
          <p style="text-align: center; color: #9ca3af; font-size: 12px; margin-top: 16px;">
            © ${new Date().getFullYear()} Khareedlo — Pakistan's Fashion Platform
          </p>
        </div>
      `,
    });
    console.log(`[Email] Approval email sent to brand: ${brandEmail}`);
  } catch (err) {
    console.error("[Email] Failed to send approval email:", err.message);
  }
}

// ── Email 3: Notify brand when admin rejects them ─────────────
async function sendBrandRejectionEmail(brandName, brandEmail) {
  try {
    await transporter.sendMail({
      from: `"Khareedlo Platform" <${process.env.EMAIL_FROM}>`,
      to: brandEmail,
      subject: `Update on Your Khareedlo Brand Registration`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #6b7280, #374151); padding: 30px; border-radius: 12px 12px 0 0; text-align: center;">
            <h1 style="color: white; margin: 0; font-size: 24px;">Khareedlo</h1>
            <p style="color: rgba(255,255,255,0.85); margin: 8px 0 0;">Registration Status Update</p>
          </div>
          <div style="background: #ffffff; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px;">
            <p style="color: #374151; font-size: 16px; line-height: 1.6;">Dear <strong>${brandName}</strong>,</p>
            <p style="color: #374151; font-size: 15px; line-height: 1.6;">
              Thank you for your interest in joining Khareedlo. After reviewing your registration, 
              we were unable to approve your brand at this time.
            </p>
            <p style="color: #374151; font-size: 15px; line-height: 1.6;">
              If you believe this is a mistake or would like more information, please contact us at 
              <a href="mailto:khareedlo@gmail.com" style="color: #f97316;">khareedlo@gmail.com</a> and we'll be happy to assist you.
            </p>
          </div>
          <p style="text-align: center; color: #9ca3af; font-size: 12px; margin-top: 16px;">
            © ${new Date().getFullYear()} Khareedlo — Pakistan's Fashion Platform
          </p>
        </div>
      `,
    });
    console.log(`[Email] Rejection email sent to brand: ${brandEmail}`);
  } catch (err) {
    console.error("[Email] Failed to send rejection email:", err.message);
  }
}

module.exports = {
  sendAdminNewBrandNotification,
  sendBrandApprovalEmail,
  sendBrandRejectionEmail,
};