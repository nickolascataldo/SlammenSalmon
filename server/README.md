# Booking backend

Zero-dependency Node 18+ server for booking, notifications and reminders.

1. Copy `.env.example` to `.env` and fill it in. The owner's SMS number goes in `NOTIFICATION_PHONE_NUMBER`; it is never in client code.
2. Run `node server.js`, then open http://localhost:3000

Endpoints: `POST /api/book`, `/api/alert` (email list for when booking opens each July 1), `/api/subscribe` (newsletter).

- **Booking:** saved to `bookings.json`; the owner gets a text with the booking details; the guest gets an email saying no payment is taken online and the $500 is due in person.
- **Reminder:** every 15 minutes, any booking within 24 hours of its 8:00 AM start gets one email and SMS reminder.
- **Hosting:** GitHub Pages and similar only host the static site. For bookings to work, run this server somewhere (Render, Railway, Fly, a VPS) and serve the site from it, or change `API_BASE` in `js/main.js` to its URL.
- Without Twilio/Resend keys a booking is still saved and the API reports `notified: false`.
- **Texting-only contact:** use a Google Voice or Twilio business number to keep personal calls separate and filter spam.
