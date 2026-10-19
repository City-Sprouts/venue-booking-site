# Venue booking page (static site for Netlify)

Your own copy of a "pick a room, pick times, send a request" page. No server, database or paid service: requests go to you by email or an online form link. It starts blank.

## Put it online (free)
1. Sign up at netlify.com (the Free plan needs no card).
2. Go to app.netlify.com/drop and drag this whole **folder** onto the page. You get a web address.
3. Open that address followed by `#admin` (for example `https://your-site.netlify.app/#admin`). Fill in **Settings**: venue name, the email requests go to, hours, locations, rooms, rates.
4. Click **Download settings.json**. Replace the `settings.json` in this folder with it, then drag the folder onto your site's **Deploys** page. Visitors now see your settings.

Anyone can open `#admin`, but changes only live in that person's browser. The public page changes only when you upload a new `settings.json`.

## Good to know
- **Booked times are not live.** Add them by hand in Settings, or paste lines from Notion ("room, date, from, to"), then upload again.
- **Nothing is stored.** A visitor prepares a request, then sends it with their own email app or your form link. A booking is confirmed when you reply.
- **Free plan:** 300 credits a month as a hard cap. Each successful upload costs 15 credits (about 20 a month); when credits run out the site pauses until next month and is not billed. Check Netlify's terms if this is for a business.
- **Not included:** per-room opening hours, live Notion sync (your Google Apps Script app does that).
