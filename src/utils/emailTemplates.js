// Plain, inline-styled HTML so messages render consistently across mail clients.

const BRAND = 'unboxstore'

function layout(title, body) {
  return `<!doctype html>
<html><body style="margin:0;background:#f5f5f4;font-family:Helvetica,Arial,sans-serif;color:#171717">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:32px 16px">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#fff;padding:32px">
        <tr><td style="font-size:26px;letter-spacing:-1px;padding-bottom:24px">${BRAND}</td></tr>
        <tr><td style="font-size:20px;font-weight:bold;padding-bottom:12px">${title}</td></tr>
        <tr><td style="font-size:14px;line-height:1.6">${body}</td></tr>
        <tr><td style="font-size:12px;color:#737373;padding-top:32px">Questions? Just reply to this email.</td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`
}

function button(href, label) {
  return `<p style="margin:24px 0"><a href="${href}" style="background:#171717;color:#fff;padding:12px 20px;text-decoration:none;display:inline-block">${label}</a></p>`
}

function firstName(user) {
  return (user.name || '').split(' ')[0] || 'there'
}

function itemsTable(order) {
  const rows = order.items
    .map(
      (i) => `<tr>
        <td style="padding:8px 0;border-bottom:1px solid #e5e5e5">${i.name}<br><span style="color:#737373;font-size:12px">${i.color || ''} / ${i.size || ''} × ${i.quantity}</span></td>
        <td align="right" style="padding:8px 0;border-bottom:1px solid #e5e5e5">₹${i.price * i.quantity}</td>
      </tr>`
    )
    .join('')
  const line = (label, value) => `<tr><td style="padding:4px 0;color:#737373">${label}</td><td align="right">${value}</td></tr>`

  return `<table width="100%" cellpadding="0" cellspacing="0" style="font-size:14px;margin:16px 0">
    ${rows}
    ${line('Subtotal', `₹${order.subtotal}`)}
    ${order.discount ? line('Discount', `-₹${order.discount}`) : ''}
    ${line('Shipping', order.shipping ? `₹${order.shipping}` : 'Free')}
    ${line('Tax', `₹${order.tax}`)}
    ${order.codFee ? line('COD fee', `₹${order.codFee}`) : ''}
    <tr><td style="padding-top:8px;font-weight:bold">Total</td><td align="right" style="padding-top:8px;font-weight:bold">₹${order.total}</td></tr>
  </table>`
}

function orderUrl(order) {
  return `${process.env.CLIENT_URL}/account/orders/${order._id}`
}

module.exports = {
  welcome(user) {
    return {
      subject: `Welcome to ${BRAND}`,
      html: layout(
        `Welcome, ${firstName(user)}`,
        `<p>Your account is ready. Sign in any time with your mobile number — we'll text you a one-time code.</p>
         <p>Order confirmations and invoices will be sent to this email address.</p>
         ${button(`${process.env.CLIENT_URL}/shop`, 'Start shopping')}`
      ),
    }
  },

  newsletterWelcome() {
    return {
      subject: `You're on the ${BRAND} list`,
      html: layout(
        "You're on the list",
        `<p>Thanks for signing up. You'll be the first to hear about new collections and discounts.</p>
         <p>Here's 10% off your first order — use code <strong>WELCOME10</strong> at checkout.</p>
         ${button(`${process.env.CLIENT_URL}/explore`, 'Explore collections')}`
      ),
    }
  },

  passwordReset(user, resetUrl) {
    return {
      subject: `Reset your ${BRAND} password`,
      html: layout(
        'Reset your password',
        `<p>Hi ${firstName(user)}, we received a request to reset your password. This link expires in 30 minutes.</p>
         ${button(resetUrl, 'Choose a new password')}
         <p style="color:#737373">If you didn't ask for this, you can ignore this email — your password won't change.</p>`
      ),
    }
  },

  passwordChanged(user) {
    return {
      subject: `Your ${BRAND} password was changed`,
      html: layout(
        'Password changed',
        `<p>Hi ${firstName(user)}, the password for your account was just changed.</p>
         <p>If this wasn't you, reset it right away from the sign-in page and contact us.</p>`
      ),
    }
  },

  orderConfirmation(order, invoice) {
    const paymentLine =
      order.paymentMethod === 'COD'
        ? `<p>Payment: <strong>Cash on delivery</strong> — ₹${order.amountPaid} COD fee paid online. Please keep <strong>₹${order.total - order.amountPaid}</strong> ready on delivery.</p>`
        : `<p>Payment: <strong>Paid online</strong>${order.paymentOption ? ` (${{ upi: 'UPI', card: 'Card', netbanking: 'Net banking' }[order.paymentOption]})` : ''}.</p>`
    const a = order.shippingAddress
    return {
      subject: `Order ${order.orderNumber} confirmed`,
      html: layout(
        'Thanks for your order',
        `<p>Hi ${a.fullName.split(' ')[0]}, we've received order <strong>${order.orderNumber}</strong>. Your invoice ${invoice.invoiceNumber} is attached.</p>
         ${itemsTable(order)}
         ${paymentLine}
         <p>Shipping to:<br>${a.fullName}<br>${a.addressLine}<br>${a.city}, ${a.state} ${a.pincode}<br>${a.phone}</p>
         ${button(orderUrl(order), 'View your order')}`
      ),
    }
  },

  orderStatus(order) {
    const copy = {
      Shipped: ['Your order is on its way', `Order <strong>${order.orderNumber}</strong> has shipped${order.shiprocket?.courierName ? ` with ${order.shiprocket.courierName}` : ''}${order.shiprocket?.awbCode ? ` (AWB ${order.shiprocket.awbCode})` : ''}.`],
      Delivered: ['Your order was delivered', `Order <strong>${order.orderNumber}</strong> has been delivered. We hope you love it.`],
      Cancelled: ['Your order was cancelled', `Order <strong>${order.orderNumber}</strong> has been cancelled${order.cancelReason ? `: ${order.cancelReason}` : ''}.${order.paymentStatus === 'Refunded' ? ' Your refund has been initiated and should reach you in 5–7 business days.' : ''}`],
    }[order.status]
    if (!copy) return null
    return {
      subject: `Order ${order.orderNumber}: ${order.status.toLowerCase()}`,
      html: layout(copy[0], `<p>${copy[1]}</p>${button(orderUrl(order), 'View your order')}`),
    }
  },
}
