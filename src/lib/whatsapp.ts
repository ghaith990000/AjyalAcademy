/**
 * The number a `wa.me` link needs: digits only, with the country code. A local Bahrain number has 8 digits and gets
 * 973 in front; `+973 …` and `00973 …` are accepted as typed. `null` when it cannot be a phone number.
 */
export function whatsappNumber(phone: string): string | null {
  let digits = phone.trim().replace(/[\s()-]/g, '')
  digits = digits.replace(/^\+/, '').replace(/^00/, '')
  if (!/^\d+$/.test(digits)) return null
  if (digits.length === 8) digits = `973${digits}`
  return digits.length >= 9 && digits.length <= 15 ? digits : null
}

/** A link that opens WhatsApp with `message` ready to send to `phone` (the sender can still edit it), or `null`. */
export function whatsappUrl(phone: string, message: string): string | null {
  const number = whatsappNumber(phone)
  return number === null ? null : `https://wa.me/${number}?text=${encodeURIComponent(message)}`
}
