// payments/emailService.js
// Transactional emails for plan events: purchase, renewal, cancellation, expiry.
// Sent from support@smallpdf.us via SMTP configured in .env

const nodemailer = require('nodemailer')

const FROM    = '"SmallPDF.us" <support@smallpdf.us>'
const SITE    = 'https://smallpdf.us'
const SUPPORT = 'support@smallpdf.us'

// Plan display names
const PLAN_LABELS = {
  starter: 'Starter',
  pro:     'Pro',
  agency:  'Agency',
}

function createTransporter() {
  return nodemailer.createTransport({
    host:   process.env.SMTP_HOST || 'smtp.gmail.com',
    port:   parseInt(process.env.SMTP_PORT || '587'),
    secure: false,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  })
}

async function sendEmail({ to, subject, html }) {
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
    console.warn('⚠️  SMTP not configured — skipping email to', to)
    return
  }
  try {
    const transporter = createTransporter()
    await transporter.sendMail({ from: FROM, to, subject, html })
    console.log(`📧 Email sent: "${subject}" → ${to}`)
  } catch (err) {
    // Never let email failure break the payment flow
    console.error(`❌ Email send failed (${to}):`, err.message)
  }
}

// ── Shared HTML wrapper ───────────────────────────────────────────────────────
function wrap(bodyHtml) {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>SmallPDF.us</title>
</head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;padding:32px 16px;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.08);">

        <!-- Header -->
        <tr>
          <td style="background:linear-gradient(135deg,#dc2626,#f97316);padding:28px 32px;text-align:center;">
            <a href="${SITE}" style="text-decoration:none;">
              <span style="color:#ffffff;font-size:22px;font-weight:800;letter-spacing:-0.5px;">
                Small<span style="opacity:0.85;">PDF</span><span style="font-weight:400;font-size:14px;opacity:0.7;">.us</span>
              </span>
            </a>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="padding:32px 32px 24px;">
            ${bodyHtml}
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="padding:20px 32px 28px;border-top:1px solid #f1f5f9;text-align:center;">
            <p style="margin:0;font-size:12px;color:#94a3b8;line-height:1.6;">
              Questions? Reply to this email or contact
              <a href="mailto:${SUPPORT}" style="color:#dc2626;text-decoration:none;">${SUPPORT}</a>
              <br/>
              <a href="${SITE}" style="color:#94a3b8;">smallpdf.us</a>
              &nbsp;·&nbsp;
              <a href="${SITE}/privacy" style="color:#94a3b8;text-decoration:none;">Privacy Policy</a>
              &nbsp;·&nbsp;
              <a href="${SITE}/account/subscription" style="color:#94a3b8;text-decoration:none;">Manage Subscription</a>
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`
}

function h1(text) {
  return `<h1 style="margin:0 0 8px;font-size:22px;font-weight:800;color:#0f172a;line-height:1.3;">${text}</h1>`
}
function p(text, style = '') {
  return `<p style="margin:0 0 16px;font-size:15px;color:#475569;line-height:1.6;${style}">${text}</p>`
}
function badge(text, color = '#dc2626') {
  return `<span style="display:inline-block;background:${color}15;color:${color};font-size:12px;font-weight:700;padding:3px 10px;border-radius:20px;text-transform:uppercase;letter-spacing:0.5px;">${text}</span>`
}
function infoBox(rows) {
  const cells = rows.map(([label, value]) => `
    <tr>
      <td style="padding:10px 16px;font-size:13px;color:#64748b;border-bottom:1px solid #f1f5f9;width:45%;">${label}</td>
      <td style="padding:10px 16px;font-size:13px;color:#0f172a;font-weight:600;border-bottom:1px solid #f1f5f9;">${value}</td>
    </tr>`).join('')
  return `<table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;border-radius:8px;overflow:hidden;margin:20px 0;">
    <tbody>${cells}</tbody>
  </table>`
}
function btn(text, url) {
  return `<a href="${url}" style="display:inline-block;background:linear-gradient(135deg,#dc2626,#f97316);color:#ffffff;font-size:14px;font-weight:700;padding:12px 28px;border-radius:8px;text-decoration:none;margin:4px 0;">${text}</a>`
}

// ── Email Templates ───────────────────────────────────────────────────────────

/**
 * Sent when a user first activates a paid plan (purchase or first charge).
 */
async function sendPlanActivatedEmail({ name, email, plan, interval, expiresAt, gateway }) {
  const label    = PLAN_LABELS[plan] || plan
  const interval_label = interval === 'yearly' ? 'Annual' : 'Monthly'
  const expiryStr = expiresAt
    ? new Date(expiresAt).toLocaleDateString('en-US', { year:'numeric', month:'long', day:'numeric' })
    : 'Until cancelled'

  await sendEmail({
    to:      email,
    subject: `✅ Your SmallPDF.us ${label} plan is active!`,
    html: wrap(`
      ${h1(`Welcome to ${label}! 🎉`)}
      ${p(`Hi ${name || 'there'},`)}
      ${p(`Your <strong>${label}</strong> plan is now active. You have full access to all premium features.`)}
      ${infoBox([
        ['Plan',       `${label} (${interval_label})`],
        ['Status',     '✅ Active'],
        ['Next renewal', expiryStr],
        ['Payment',    gateway === 'paddle' ? 'Card / PayPal (Paddle)' : 'Razorpay (UPI / Card)'],
      ])}
      ${p('You can now enjoy:')}
      <ul style="margin:0 0 20px;padding-left:20px;color:#475569;font-size:14px;line-height:2;">
        <li>Larger file sizes (up to ${plan === 'starter' ? '100 MB' : 'Unlimited'})</li>
        <li>Batch processing (up to ${plan === 'starter' ? '10' : plan === 'pro' ? '20' : '50'} files)</li>
        <li>Zero ads</li>
        <li>Files retained for ${plan === 'starter' ? '24 hours' : plan === 'pro' ? '48 hours' : '72 hours'}</li>
      </ul>
      <div style="text-align:center;margin:24px 0;">
        ${btn('Start Using SmallPDF.us →', SITE)}
      </div>
      ${p('To manage or cancel your subscription, visit your <a href="${SITE}/account/subscription" style="color:#dc2626;">account page</a>.', 'font-size:13px;color:#94a3b8;')}
    `),
  })
}

/**
 * Sent on every successful recurring renewal charge.
 */
async function sendPlanRenewedEmail({ name, email, plan, expiresAt, gateway }) {
  const label     = PLAN_LABELS[plan] || plan
  const expiryStr = expiresAt
    ? new Date(expiresAt).toLocaleDateString('en-US', { year:'numeric', month:'long', day:'numeric' })
    : '-'

  await sendEmail({
    to:      email,
    subject: `💳 Your SmallPDF.us ${label} plan has been renewed`,
    html: wrap(`
      ${h1('Plan renewed successfully')}
      ${p(`Hi ${name || 'there'},`)}
      ${p(`Your <strong>${label}</strong> plan has been automatically renewed. No action needed.`)}
      ${infoBox([
        ['Plan',           label],
        ['Status',         '✅ Active'],
        ['Next renewal',   expiryStr],
        ['Payment',        gateway === 'paddle' ? 'Card / PayPal (Paddle)' : 'Razorpay (UPI / Card)'],
      ])}
      <div style="text-align:center;margin:24px 0;">
        ${btn('Go to SmallPDF.us →', SITE)}
      </div>
      ${p('To cancel future renewals, visit your <a href="${SITE}/account/subscription" style="color:#dc2626;">account page</a>.', 'font-size:13px;color:#94a3b8;')}
    `),
  })
}

/**
 * Sent when a user requests cancellation (plan stays active until period end).
 */
async function sendCancellationScheduledEmail({ name, email, plan, expiresAt }) {
  const label     = PLAN_LABELS[plan] || plan
  const expiryStr = expiresAt
    ? new Date(expiresAt).toLocaleDateString('en-US', { year:'numeric', month:'long', day:'numeric' })
    : 'end of current billing period'

  await sendEmail({
    to:      email,
    subject: `Your SmallPDF.us ${label} plan will be cancelled`,
    html: wrap(`
      ${h1('Cancellation confirmed')}
      ${p(`Hi ${name || 'there'},`)}
      ${p(`We've received your cancellation request. Your <strong>${label}</strong> plan will remain active until <strong>${expiryStr}</strong>, after which your account will revert to the free plan.`)}
      ${infoBox([
        ['Plan',           label],
        ['Active until',   expiryStr],
        ['After expiry',   'Free plan'],
      ])}
      ${p('Changed your mind? You can reactivate at any time from your <a href="${SITE}/pricing" style="color:#dc2626;">pricing page</a>.')}
      <div style="text-align:center;margin:24px 0;">
        ${btn('Reactivate Plan →', `${SITE}/pricing`)}
      </div>
      ${p('We\'re sorry to see you go. If you had any issues, please let us know at <a href="mailto:${SUPPORT}" style="color:#dc2626;">${SUPPORT}</a> — we\'d love to help.', 'font-size:13px;color:#94a3b8;')}
    `),
  })
}

/**
 * Sent when a plan is fully cancelled and user is downgraded to free.
 */
async function sendPlanExpiredEmail({ name, email, plan }) {
  const label = PLAN_LABELS[plan] || plan

  await sendEmail({
    to:      email,
    subject: `Your SmallPDF.us ${label} plan has ended`,
    html: wrap(`
      ${h1('Your plan has ended')}
      ${p(`Hi ${name || 'there'},`)}
      ${p(`Your <strong>${label}</strong> plan has ended and your account is now on the free plan.`)}
      ${infoBox([
        ['Previous plan', label],
        ['Current plan',  'Free'],
      ])}
      ${p('You can still use all our core tools for free. To restore premium features, upgrade again at any time.')}
      <div style="text-align:center;margin:24px 0;">
        ${btn('Upgrade Again →', `${SITE}/pricing`)}
      </div>
      ${p('Thank you for being a SmallPDF.us subscriber. We hope to see you back! 🙏', 'font-size:13px;color:#94a3b8;')}
    `),
  })
}

/**
 * Sent when a payment fails (Razorpay or Paddle is retrying).
 */
async function sendPaymentFailedEmail({ name, email, plan, gateway }) {
  const label = PLAN_LABELS[plan] || plan

  await sendEmail({
    to:      email,
    subject: `⚠️ Payment failed for your SmallPDF.us ${label} plan`,
    html: wrap(`
      ${h1('Payment failed')}
      ${p(`Hi ${name || 'there'},`)}
      ${p(`We were unable to process your payment for the <strong>${label}</strong> plan. Your plan is still active while we retry.`)}
      ${infoBox([
        ['Plan',    label],
        ['Status',  '⚠️ Payment pending retry'],
        ['Gateway', gateway === 'paddle' ? 'Paddle' : 'Razorpay'],
      ])}
      ${p('What to do:')}
      <ul style="margin:0 0 20px;padding-left:20px;color:#475569;font-size:14px;line-height:2;">
        <li>Check that your card / UPI / PayPal details are up to date</li>
        <li>Ensure sufficient balance or credit limit</li>
        <li>Your payment provider will retry automatically</li>
      </ul>
      <div style="text-align:center;margin:24px 0;">
        ${btn('Update Payment Method →', `${SITE}/account/subscription`)}
      </div>
      ${p('If you continue to have issues, contact us at <a href="mailto:${SUPPORT}" style="color:#dc2626;">${SUPPORT}</a>.', 'font-size:13px;color:#94a3b8;')}
    `),
  })
}

module.exports = {
  sendPlanActivatedEmail,
  sendPlanRenewedEmail,
  sendCancellationScheduledEmail,
  sendPlanExpiredEmail,
  sendPaymentFailedEmail,
}
