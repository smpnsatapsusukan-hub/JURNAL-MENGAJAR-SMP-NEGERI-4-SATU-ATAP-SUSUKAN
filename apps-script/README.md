# Google Sheets backend setup

This folder contains the shared-data backend for the journal application. The backend is intended to run in Google Apps Script, with the app UI hosted by the same Apps Script project. It is not a drop-in API for the current GitHub Pages URL: browser security prevents the existing static page from directly calling Apps Script in a reliable, readable way. The UI must be hosted as an Apps Script HTML file and use `google.script.run` for server calls.

## 1. Create the spreadsheet

1. Create a Google Spreadsheet named `Jurnal Mengajar SMPN 4 SATU ATAP SUSUKAN`.
2. Open **Extensions → Apps Script**.
3. Replace the contents of `Code.gs` with `apps-script/Code.gs` from this repository.
4. Add an Apps Script HTML file named `index` and copy the app UI into it. The current UI still uses browser `localStorage`; before deployment, its `api()` function and user-list operations must be switched to calls to the server `api()` function via `google.script.run`. The callback-based API can be wrapped in a Promise, for example:

   ```js
   function callServer(payload) {
     payload.nama = me && me.nama;
     payload.pin = me && me.pin;
     return new Promise((resolve, reject) => {
       google.script.run.withSuccessHandler(resolve).withFailureHandler(reject).api(payload);
     });
   }
   ```

   Login calls should pass the selected name and PIN directly and call `api()` with `{ aksi: 'masuk', nama, pin }`. For user administration, load `api({ aksi: 'users' })` and save changes with `api({ aksi: 'saveUsers', users })`; add the current admin name and PIN to those requests as with other authenticated calls.
5. In Apps Script, select `setupSheets` and click **Run**. Approve access to the spreadsheet. This creates `users` and `journals` tabs with headers.
6. In the spreadsheet's `users` tab, add an admin account and each teacher account. Use columns `nama`, `pin`, `peran`; `peran` must be `admin` or `guru`. Use new, private PINs; do not reuse the sample PINs from the existing static app.
7. Deploy through **Deploy → New deployment → Web app**. Choose **Execute as: Me**. Restrict access to your school's Google accounts where possible. If the deployment must be available to people without school accounts, understand that the app's PIN login is not equivalent to Google identity authentication.
8. The `doGet()` handler serves the Apps Script HTML file named `index`. The deployed web app URL is the app URL to share with staff, not the GitHub Pages URL.

## API behavior

- `masuk`: checks the account and returns its role.
- `daftar`: admins receive all journals; teachers receive only their own.
- `simpan`: creates or updates a journal. The server assigns a teacher's identity from the authenticated account and calculates attendance.
- `hapus`: admins can delete any journal; teachers can delete only their own.
- `users` / `saveUsers`: admin-only account listing and update.

The `users` tab contains PINs, so limit spreadsheet editor access to trusted administrators. Apps Script calls must always send the signed-in user's name and PIN; role restrictions are enforced on the server as well as in the UI.

## Important

This commit adds the backend and setup instructions, but the currently deployed GitHub Pages app is not yet connected to it. Do not expect data to sync between devices until the HTML UI has been moved into the Apps Script project and its local-storage API calls have been replaced with `google.script.run` calls. Once the spreadsheet is created and you provide/confirm the deployment approach, the UI integration can be completed and tested.
