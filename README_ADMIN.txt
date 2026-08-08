HABOS LIVE-ADMIN – EINRICHTUNG

1. Diese ZIP als neuen Deploy auf deiner bestehenden Netlify-Seite verwenden.
2. In Netlify: Site configuration / Environment variables öffnen.
3. Neue Variable anlegen:
   Key: HABOS_ADMIN_PASSWORD
   Value: ein starkes Passwort, das nur du kennst.
4. Danach erneut deployen.
5. Admin öffnen:
   https://habos-burgerhaus.netlify.app/admin.html

WICHTIG:
- Das Passwort NICHT in die HTML-Datei schreiben.
- Änderungen im Admin werden serverseitig in Netlify Blobs gespeichert.
- Preise, Sichtbarkeit, Ausverkauft, Produkte, Lieferkosten und Mindestbestellwert können geändert werden.
