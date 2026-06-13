// services/emailService.js
// Brevo HTTP API — works on Railway (no SMTP ports needed)

const FROM_EMAIL = process.env.BREVO_SENDER_EMAIL || "khareedlo26@gmail.com";
const ADMIN_EMAIL = "khareedlo26@gmail.com";

async function sendBrevoEmail(to, subject, html) {
  const response = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "api-key": process.env.BREVO_API_KEY,
    },
    body: JSON.stringify({
      sender: { name: "Khareedlo Platform", email: FROM_EMAIL },
      to: [{ email: to }],
      subject,
      htmlContent: html,
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Brevo API error: ${err}`);
  }
}

// ── Email 1: Notify admin when a new brand registers ──────────
async function sendAdminNewBrandNotification(brandName, brandEmail) {
  try {
    await sendBrevoEmail(
      ADMIN_EMAIL,
      `New Brand Registration: ${brandName}`,
      `
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
      `
    );
    console.log(`[Email] Admin notified: new brand "${brandName}" registered`);
  } catch (err) {
    console.error("[Email] Failed to notify admin:", err.message);
  }
}

// ── Email 2: Notify brand when admin approves them ────────────
async function sendBrandApprovalEmail(brandName, brandEmail) {
  try {
    await sendBrevoEmail(
      brandEmail,
      `Your Brand Has Been Approved — Welcome to Khareedlo!`,
      `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #f97316, #ef4444); padding: 30px; border-radius: 12px 12px 0 0; text-align: center;">
            <div style="font-size: 48px; margin-bottom: 10px;">🎉</div>
            <h1 style="color: white; margin: 0; font-size: 26px;">Congratulations!</h1>
            <p style="color: rgba(255,255,255,0.9); margin: 8px 0 0; font-size: 15px;">Your brand has been approved on Khareedlo</p>
          </div>
          <div style="background: #ffffff; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px;">
            <p style="color: #374151; font-size: 16px; line-height: 1.6;">Dear <strong>${brandName}</strong>,</p>
            <p style="color: #374151; font-size: 15px; line-height: 1.6;">
              We're excited to inform you that your brand registration on <strong>Khareedlo</strong> has been
              <span style="color: #16a34a; font-weight: bold;">approved</span>!
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
              If you have any questions, contact us at
              <a href="mailto:khareedlo26@gmail.com" style="color: #f97316;">khareedlo26@gmail.com</a>.
            </p>
          </div>
          <p style="text-align: center; color: #9ca3af; font-size: 12px; margin-top: 16px;">
            © ${new Date().getFullYear()} Khareedlo — Pakistan's Fashion Platform
          </p>
        </div>
      `
    );
    console.log(`[Email] Approval email sent to brand: ${brandEmail}`);
  } catch (err) {
    console.error("[Email] Failed to send approval email:", err.message);
  }
}

// ── Email 3: Notify brand when admin rejects them ─────────────
async function sendBrandRejectionEmail(brandName, brandEmail) {
  try {
    await sendBrevoEmail(
      brandEmail,
      `Update on Your Khareedlo Brand Registration`,
      `
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
              If you believe this is a mistake or need clarification, please contact us at
              <a href="mailto:khareedlo26@gmail.com" style="color: #f97316;">khareedlo26@gmail.com</a>.
            </p>
          </div>
          <p style="text-align: center; color: #9ca3af; font-size: 12px; margin-top: 16px;">
            © ${new Date().getFullYear()} Khareedlo — Pakistan's Fashion Platform
          </p>
        </div>
      `
    );
    console.log(`[Email] Rejection email sent to brand: ${brandEmail}`);
  } catch (err) {
    console.error("[Email] Failed to send rejection email:", err.message);
  }
}

// ── Email 4: Notify admin when brand submits a product ────────
async function sendAdminNewProductNotification(brandName, productName) {
  try {
    await sendBrevoEmail(
      ADMIN_EMAIL,
      `New Product Pending Approval — ${brandName}`,
      `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #7c3aed, #4f46e5); padding: 30px; border-radius: 12px 12px 0 0; text-align: center;">
            <h1 style="color: white; margin: 0; font-size: 24px;">Khareedlo Admin</h1>
            <p style="color: rgba(255,255,255,0.85); margin: 8px 0 0;">New Product Awaiting Approval</p>
          </div>
          <div style="background: #ffffff; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px;">
            <h2 style="color: #1f2937; margin-top: 0;">A brand has submitted a product for review</h2>
            <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
              <tr style="background: #f9fafb;">
                <td style="padding: 12px 16px; font-weight: bold; color: #374151; border: 1px solid #e5e7eb; width: 35%;">Brand</td>
                <td style="padding: 12px 16px; color: #111827; border: 1px solid #e5e7eb;">${brandName}</td>
              </tr>
              <tr>
                <td style="padding: 12px 16px; font-weight: bold; color: #374151; border: 1px solid #e5e7eb;">Product Name</td>
                <td style="padding: 12px 16px; color: #111827; border: 1px solid #e5e7eb;">${productName}</td>
              </tr>
              <tr style="background: #f9fafb;">
                <td style="padding: 12px 16px; font-weight: bold; color: #374151; border: 1px solid #e5e7eb;">Status</td>
                <td style="padding: 12px 16px; border: 1px solid #e5e7eb;">
                  <span style="background: #fef3c7; color: #92400e; padding: 4px 12px; border-radius: 20px; font-size: 13px; font-weight: bold;">PENDING APPROVAL</span>
                </td>
              </tr>
              <tr>
                <td style="padding: 12px 16px; font-weight: bold; color: #374151; border: 1px solid #e5e7eb;">Submitted At</td>
                <td style="padding: 12px 16px; color: #111827; border: 1px solid #e5e7eb;">${new Date().toLocaleString("en-PK", { timeZone: "Asia/Karachi" })} (PKT)</td>
              </tr>
            </table>
            <div style="text-align: center; margin-top: 24px;">
              <a href="https://khareedlo-frontend.vercel.app/admin/pending-products"
                style="background: linear-gradient(135deg, #7c3aed, #4f46e5); color: white; padding: 12px 28px; border-radius: 8px; text-decoration: none; font-weight: bold; font-size: 15px;">
                Review Product
              </a>
            </div>
          </div>
          <p style="text-align: center; color: #9ca3af; font-size: 12px; margin-top: 16px;">
            © ${new Date().getFullYear()} Khareedlo — Pakistan's Fashion Platform
          </p>
        </div>
      `
    );
    console.log(`[Email] Admin notified of new product: ${productName} by ${brandName}`);
  } catch (err) {
    console.error("[Email] Failed to send admin product notification:", err.message);
  }
}

// ── Email 5: Notify brand when product is approved ────────────
async function sendProductApprovalEmail(brandName, brandEmail, productName) {
  try {
    await sendBrevoEmail(
      brandEmail,
      `✅ Your Product is Now Live — ${productName}`,
      `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #059669, #10b981); padding: 30px; border-radius: 12px 12px 0 0; text-align: center;">
            <h1 style="color: white; margin: 0; font-size: 24px;">Khareedlo</h1>
            <p style="color: rgba(255,255,255,0.85); margin: 8px 0 0;">Product Approved & Live</p>
          </div>
          <div style="background: #ffffff; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px;">
            <h2 style="color: #1f2937; margin-top: 0;">Great news, ${brandName}! 🎉</h2>
            <p style="color: #6b7280;">Your product has been reviewed and approved by the Khareedlo team. It is now live on the platform and visible to customers.</p>
            <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
              <tr style="background: #f9fafb;">
                <td style="padding: 12px 16px; font-weight: bold; color: #374151; border: 1px solid #e5e7eb; width: 35%;">Product</td>
                <td style="padding: 12px 16px; color: #111827; border: 1px solid #e5e7eb;">${productName}</td>
              </tr>
              <tr>
                <td style="padding: 12px 16px; font-weight: bold; color: #374151; border: 1px solid #e5e7eb;">Status</td>
                <td style="padding: 12px 16px; border: 1px solid #e5e7eb;">
                  <span style="background: #d1fae5; color: #065f46; padding: 4px 12px; border-radius: 20px; font-size: 13px; font-weight: bold;">✅ APPROVED — LIVE</span>
                </td>
              </tr>
            </table>
            <p style="color: #6b7280; font-size: 14px;">You can view and manage your products from your brand dashboard.</p>
          </div>
          <p style="text-align: center; color: #9ca3af; font-size: 12px; margin-top: 16px;">
            © ${new Date().getFullYear()} Khareedlo — Pakistan's Fashion Platform
          </p>
        </div>
      `
    );
    console.log(`[Email] Approval email sent to brand: ${brandEmail}`);
  } catch (err) {
    console.error("[Email] Failed to send product approval email:", err.message);
  }
}

// ── Email 6: Notify brand when product is rejected ────────────
async function sendProductRejectionEmail(brandName, brandEmail, productName) {
  try {
    await sendBrevoEmail(
      brandEmail,
      `❌ Product Not Approved — ${productName}`,
      `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #dc2626, #ef4444); padding: 30px; border-radius: 12px 12px 0 0; text-align: center;">
            <h1 style="color: white; margin: 0; font-size: 24px;">Khareedlo</h1>
            <p style="color: rgba(255,255,255,0.85); margin: 8px 0 0;">Product Review Update</p>
          </div>
          <div style="background: #ffffff; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px;">
            <h2 style="color: #1f2937; margin-top: 0;">Hi ${brandName},</h2>
            <p style="color: #6b7280;">Unfortunately, your product could not be approved at this time. Please review it and resubmit after making necessary changes.</p>
            <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
              <tr style="background: #f9fafb;">
                <td style="padding: 12px 16px; font-weight: bold; color: #374151; border: 1px solid #e5e7eb; width: 35%;">Product</td>
                <td style="padding: 12px 16px; color: #111827; border: 1px solid #e5e7eb;">${productName}</td>
              </tr>
              <tr>
                <td style="padding: 12px 16px; font-weight: bold; color: #374151; border: 1px solid #e5e7eb;">Status</td>
                <td style="padding: 12px 16px; border: 1px solid #e5e7eb;">
                  <span style="background: #fee2e2; color: #991b1b; padding: 4px 12px; border-radius: 20px; font-size: 13px; font-weight: bold;">❌ REJECTED</span>
                </td>
              </tr>
            </table>
            <p style="color: #6b7280; font-size: 14px;">Please edit the product from your dashboard and resubmit for approval. For queries contact <a href="mailto:khareedlo26@gmail.com" style="color: #f97316;">khareedlo26@gmail.com</a>.</p>
          </div>
          <p style="text-align: center; color: #9ca3af; font-size: 12px; margin-top: 16px;">
            © ${new Date().getFullYear()} Khareedlo — Pakistan's Fashion Platform
          </p>
        </div>
      `
    );
    console.log(`[Email] Rejection email sent to brand: ${brandEmail}`);
  } catch (err) {
    console.error("[Email] Failed to send product rejection email:", err.message);
  }
}

module.exports = {
  sendAdminNewBrandNotification,
  sendBrandApprovalEmail,
  sendBrandRejectionEmail,
  sendAdminNewProductNotification,
  sendProductApprovalEmail,
  sendProductRejectionEmail,
};