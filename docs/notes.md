## Registration

Every registration goes through four phases.

1. Participant (student) is joined to an Activity (class). As soon as user enters
   the participant name and birthdate that participant is "registered" in the database.
2. Participant (student) is joined to contact info. When user submits contact info,
   that is connected to both the registration and the student. (Registration can be put into cart at this point.)
3. On the payment page, registration is marked as pending payment. This reserves the slot for 15 minutes until payment is completed.
4. When payment is completed, Payment is joined to registration. Whether class is free, paid by check, or PayPal there will always be a payment associated with a successful registration.

### Preventing failed registrations

We need to prevent any way to complete CC/paypal Payment and then not get registered. To this when the user gets to the payment page we tag the registration with a payment_pending_at timestamp. Any class with this field set will be
unavailble for 15 minute past the timestamp.

On load of Payment page we'd need to check in real time if the classes are available. (no cache). Remove any classes that are no longer available.

We should also flag the registrations as payment_pending_at.

## Images

These are specs on images used on the site

| Context    | Dimensions        | Naming convention        |
| ---------- | ----------------- | ------------------------ |
| Hero       | 900x1200          | \*                       |
| Secondary  | 900x1200, 960x720 | \*                       |
| Activities | 960x420           | match activity id prefix |
| Instructor | 320x320           | lastname-first.jpg       |

## Instructor PII

The instructor contact information is maintained in an encrypted file. This file is decrypted at build time.
If you change it you need to re-encrypt with `npm run lock`.

## Activity File Naming and organization

Each activity that is a class is in a folder like `yyyy/mm` where yyyy is the year (2026) and mm is the two digit month in which event was originally scheduled.

| Filename                            | Description                          |
| ----------------------------------- | ------------------------------------ |
| /activities/2026/03/piano1a.mdx     | class piano1a starting in March      |
| /activities/2026/09/11-tailgate.mdx | Tailgate on 9/11                     |
| /activities/2026/06/jazz.mdx        | Community Jazz band starting in June |

If an event is rescheduled to another month we can leave the file in its original location. The actual start date
comes from within the file itself.

The Build can use this naming convention to ignore activities more than 18 months old.
