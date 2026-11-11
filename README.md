# Seán's Wardrobe

A private, mobile-friendly digital wardrobe: upload up to 5 photos per piece, edit categories/details, search and sort, mark items **Sold** or **No longer own**, and restore them to **In wardrobe** later. Items and photos sync across devices using Firebase.

## Important security information

- **A private GitHub repository does not make a website private.** The website's HTML, CSS and JavaScript may be publicly accessible, but the Firebase email/password login plus Firestore and Storage security rules prevent unauthenticated access to your wardrobe data.
- Firebase web API keys are *public configuration*, not secret passwords. **Never place service-account keys, private keys or an admin token in this repository.**
- Firebase Storage's `getDownloadURL` photo links contain shareable download tokens. Do not share individual photo URLs; anybody who obtains such a link may access that particular photo. If you require strict non-shareable photo access, use a different authenticated proxy-based image architecture.
- Don't upload wardrobe photos until the security rules have been published and checked.

## 1. Create a Firebase project

1. At https://console.firebase.google.com select **Add project**.
2. In **Authentication → Sign-in method**, enable **Email/Password**. Do **not** enable public self-signup in the website.
3. In **Authentication → Users**, create **your own account** using **Add user**. You can create a strong password here; don't commit it anywhere.
4. In **Firestore Database**, create a database. Choose a region nearby. Then open **Rules** and paste in the contents of `firestore.rules`, and **Publish**.
5. In **Storage**, create a default storage bucket (you might be asked to upgrade to Firebase's Blaze billing plan; review the pricing first). In **Storage → Rules**, paste `storage.rules`, and **Publish**.
6. In **Project settings → General → Your apps**, register a **Web app** and copy the `firebaseConfig` values into `firebase-config.js`.
7. In **Authentication → Settings → Authorized domains**, add your deployed website domain (such as `your-project.pages.dev`, or your GitHub Pages domain).

**Optional single-user hardening:** Once you have created your Firebase Authentication account, you can replace `request.auth.uid == userId` in both rules files with `request.auth.uid == userId && request.auth.uid == 'YOUR_FIREBASE_AUTH_UID'`. That prevents any other account added to the Firebase project from accessing its own wardrobe collection.

## 2. Put the source code in a private GitHub repository

1. Create a **Private** repository named `seans-wardrobe` in GitHub.
2. Upload all files from this folder, including `index.html`, `styles.css`, `app.js`, `firebase-config.js`, `firestore.rules`, and `storage.rules`.
3. GitHub only stores your code. Your clothing photos and inventory live in Firebase, **not in the repository**.

## 3. Make it live for free with Cloudflare Pages

This is the easiest option for a private GitHub repository on a free GitHub plan (GitHub Pages publishing from private repositories can require paid plans).

1. Sign into https://dash.cloudflare.com and choose **Workers & Pages → Create → Pages → Connect to Git** (menu names can change).
2. Authorize Cloudflare to access **only** your `seans-wardrobe` GitHub repository.
3. Pick the repository, choose **no framework**, and use an empty build command and **`/`** as output/root directory. Some Cloudflare UI versions ask for a build output directory; use the repository root or `.`.
4. Deploy and open your new `*.pages.dev` URL. Add that exact domain in Firebase **Authorized domains**.
5. Sign in using the Firebase email/password account you created. Your wardrobe will be empty until you add clothing.

Cloudflare Pages serves website assets publicly; wardrobe records remain Firebase-authenticated. If you want the login screen itself hidden from the public, configure **Cloudflare Access** in front of the website as an *additional* layer of authentication.

## Use

- **Add new item** uploads photos and saves category, type, brand, size, colour, notes and status.
- Choose a piece to **edit** it, move it to **Sold** or **No longer own**, or restore it by setting **In wardrobe**.
- The sidebar shows counts for your active collection and archives.
- To permanently remove a piece and its uploaded photos, click **Delete item** inside its editor.

## Costs and limits

Firebase Firestore and Authentication have free allowances, but Firebase Cloud Storage may require a billing-enabled Blaze project. Storage, reads and bandwidth can incur charges. Use Firebase budget alerts and check pricing before deploying. Photo uploads are reduced to JPEG, up to 1600px wide/tall, to help limit storage use.

## Local test

Run a static HTTP server from this folder, such as `python3 -m http.server 8080`, then open `http://localhost:8080`. Firebase's `localhost` domain might need to be added under Authentication → Authorized domains.
