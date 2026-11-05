# Petunjuk mudah: Google Sheets + Apps Script

Dengan cara ini, data guru dan admin disimpan bersama di Google Sheets. Aplikasi harus dibuka lewat URL **Web app Apps Script**, bukan URL GitHub Pages lama.

## A. Buat sheet dan pasang aplikasi

1. Masuk ke akun Google sekolah dan buat Google Spreadsheet, misalnya `Jurnal Mengajar SMPN 4 SATU ATAP SUSUKAN`.
2. Di spreadsheet, pilih **Ekstensi → Apps Script**.
3. Di editor Apps Script, buka `Code.gs`, hapus isi lama, lalu salin semua isi file [`Code.gs`](Code.gs) dari repositori ini dan tempelkan. Simpan.
4. Klik tombol **+** di samping Files → pilih **HTML**. Beri nama tepat `index` (tanpa `.html`).
5. Buka file [`index.html`](index.html) di repositori ini, salin seluruh isinya, dan tempel ke file `index` di Apps Script. Simpan.
6. Dari dropdown pilihan fungsi di toolbar, pilih `setupSheets`, lalu klik **Run/Jalankan**. Berikan izin yang diminta. Kembali ke spreadsheet dan pastikan tab `users` dan `journals` sudah muncul.

## B. Tambahkan akun

Pada tab `users`, gunakan baris pertama sebagai judul kolom dan isi data mulai baris kedua:

| nama | pin | peran |
|---|---|---|
| Admin Sekolah | PIN-ADMIN-BARU | admin |
| Nama Guru 1 | PIN-GURU-BARU | guru |

Nama guru harus unik dan sama dengan yang dipakai untuk login. Buat PIN yang berbeda untuk setiap pengguna. Jangan pakai PIN contoh atau PIN yang pernah dibagikan. Batasi izin editor spreadsheet hanya untuk admin tepercaya karena tab ini menyimpan PIN.

## C. Deploy untuk dipakai guru

1. Di Apps Script, klik **Deploy → New deployment**.
2. Pilih jenis **Web app**.
3. Pilih **Execute as: Me** agar script menulis ke spreadsheet milik sekolah.
4. Pada **Who has access**, pilih akses paling terbatas yang bisa digunakan semua pengguna sekolah (idealnya akun dalam organisasi sekolah). Jangan pilih akses publik kecuali sekolah memang menyetujui risikonya.
5. Klik **Deploy**, selesaikan otorisasi, lalu salin URL web app.
6. Buka URL itu dan coba login sebagai guru. Input satu jurnal. Lalu login sebagai admin dan pastikan jurnal terlihat. Bagikan URL web app itu kepada guru. GitHub Pages lama tidak tersambung dengan sheet.

Saat mengubah kode setelah deploy, gunakan **Deploy → Manage deployments → Edit → New version → Deploy** agar URL web app menjalankan versi terbaru.

## Cara penggunaan

- Guru masuk menggunakan nama dan PIN yang ada di tab `users`, lalu mengisi jurnal. Guru hanya dapat melihat, mengubah, dan menghapus jurnal miliknya.
- Admin masuk dengan akun berperan `admin`, dapat melihat jurnal semua guru dan memfilter berdasarkan guru.
- Tombol **Muat ulang** mengambil perubahan terbaru dari spreadsheet.
- Unduhan CSV dapat dibuka dengan Excel atau Google Sheets.
- Jika daftar nama tidak muncul, periksa apakah `setupSheets()` sudah dijalankan dan tab `users` memiliki header `nama`, `pin`, `peran` serta akun yang valid.

## Catatan keamanan dan migrasi

PIN pada tab `users` disimpan sebagai teks biasa. Batasi akses spreadsheet, gunakan PIN unik, dan jangan bagikan kredensial. Sistem ini cocok untuk penggunaan internal sederhana; untuk autentikasi yang lebih kuat gunakan akun Google dan backend dengan pengelolaan identitas yang sesuai.

Jurnal lama yang tersimpan di `localStorage` browser tidak otomatis pindah ke sheet. Ekspor/catat data lama secara terpisah jika perlu. Jangan gunakan GitHub Pages untuk input baru setelah guru mulai memakai URL Apps Script, agar tidak membuat dua sumber data berbeda.
