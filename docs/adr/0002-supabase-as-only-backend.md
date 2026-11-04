# Supabase as the only backend

The app must cost nothing and we have no server, so it is a static PWA talking directly to Supabase's free tier for data, auth (one email + password account per Flatmate, created by hand, signup disabled), live Room Occupancy and Recipe photos. One vendor covers all four with no server code of our own. The free project pauses after 7 days without activity, which daily use avoids. Leaving Supabase would mean replacing all four at once.
