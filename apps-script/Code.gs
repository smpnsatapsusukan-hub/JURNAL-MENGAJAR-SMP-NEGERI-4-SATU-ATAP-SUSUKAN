const HEADERS = {
  users: ['nama', 'pin', 'peran'],
  journals: ['id', 'tgl', 'guru', 'jam', 'kelas', 'mapel', 'materi', 'total', 'sakit', 'izin', 'alpa', 'hadir', 'ket']
};

function doGet() {
  return HtmlService.createHtmlOutputFromFile('index')
    .setTitle('Jurnal Harian Mengajar Guru')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

/** Jalankan sekali dari editor Apps Script untuk membuat tab dan judul kolom. */
function setupSheets() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  Object.keys(HEADERS).forEach(function (name) {
    let sheet = ss.getSheetByName(name);
    if (!sheet) sheet = ss.insertSheet(name);
    if (sheet.getLastRow() === 0) {
      sheet.getRange(1, 1, 1, HEADERS[name].length).setValues([HEADERS[name]]);
      sheet.setFrozenRows(1);
    }
  });
  return 'Selesai. Isi akun pada tab users.';
}

/** API yang dipanggil UI melalui google.script.run. */
function api(request) {
  request = request || {};
  const action = String(request.aksi || '');

  // Hanya nama dan peran yang dibuka sebelum login; PIN tidak pernah dikirim ke UI.
  if (action === 'daftarPengguna') {
    return { ok: true, data: readObjects_('users').map(function (u) {
      return { nama: u.nama, peran: u.peran };
    }) };
  }
  if (action === 'masuk') return login_(request);

  const user = authenticate_(request.nama, request.pin);
  if (!user) return { ok: false, pesan: 'Sesi tidak valid. Silakan masuk kembali.' };

  if (action === 'daftar') {
    let journals = readObjects_('journals');
    if (user.peran !== 'admin') journals = journals.filter(function (row) { return row.guru === user.nama; });
    journals.sort(function (a, b) { return String(a.tgl).localeCompare(String(b.tgl)); });
    return { ok: true, data: journals };
  }
  if (action === 'simpan') return saveJournal_(user, request.jurnal || {});
  if (action === 'hapus') return deleteJournal_(user, request.id);
  if (action === 'users') {
    if (user.peran !== 'admin') return { ok: false, pesan: 'Akses admin diperlukan.' };
    return { ok: true, data: readObjects_('users') };
  }
  if (action === 'saveUsers') {
    if (user.peran !== 'admin') return { ok: false, pesan: 'Akses admin diperlukan.' };
    return replaceUsers_(request.users);
  }
  return { ok: false, pesan: 'Aksi tidak dikenal.' };
}

function login_(request) {
  const user = findUser_(request.nama);
  if (!user || String(user.pin) !== String(request.pin || '')) {
    return { ok: false, pesan: 'Nama atau PIN salah.' };
  }
  return { ok: true, nama: user.nama, peran: user.peran };
}

function authenticate_(name, pin) {
  if (!name || pin === undefined || pin === null || String(pin) === '') return null;
  const user = findUser_(name);
  return user && String(user.pin) === String(pin) ? user : null;
}

function findUser_(name) {
  const normalized = String(name || '').trim();
  return readObjects_('users').find(function (user) { return user.nama === normalized; }) || null;
}

function saveJournal_(user, input) {
  const row = Object.assign({}, input);
  row.id = String(row.id || Utilities.getUuid());
  if (user.peran !== 'admin') row.guru = user.nama;
  if (!row.tgl || !row.guru || !row.jam || !row.mapel || !row.materi) {
    return { ok: false, pesan: 'Tanggal, guru, jam, mata pelajaran, dan materi wajib diisi.' };
  }
  ['total', 'sakit', 'izin', 'alpa'].forEach(function (key) {
    row[key] = Math.max(0, parseInt(row[key], 10) || 0);
  });
  if (row.sakit + row.izin + row.alpa > row.total) {
    return { ok: false, pesan: 'Jumlah sakit, izin, dan alpa melebihi jumlah siswa.' };
  }
  row.hadir = row.total - row.sakit - row.izin - row.alpa;

  const sheet = getSheet_('journals');
  const values = sheet.getDataRange().getValues();
  const idCol = HEADERS.journals.indexOf('id');
  const index = values.slice(1).findIndex(function (r) { return String(r[idCol]) === row.id; });
  if (index >= 0) {
    const old = objectFromRow_(HEADERS.journals, values[index + 1]);
    if (user.peran !== 'admin' && old.guru !== user.nama) {
      return { ok: false, pesan: 'Anda hanya dapat mengubah jurnal milik sendiri.' };
    }
    sheet.getRange(index + 2, 1, 1, HEADERS.journals.length)
      .setValues([HEADERS.journals.map(function (key) { return row[key] == null ? '' : row[key]; })]);
  } else {
    sheet.appendRow(HEADERS.journals.map(function (key) { return row[key] == null ? '' : row[key]; }));
  }
  return { ok: true, id: row.id };
}

function deleteJournal_(user, id) {
  const sheet = getSheet_('journals');
  const values = sheet.getDataRange().getValues();
  const idCol = HEADERS.journals.indexOf('id');
  const guruCol = HEADERS.journals.indexOf('guru');
  const index = values.slice(1).findIndex(function (r) { return String(r[idCol]) === String(id); });
  if (index < 0) return { ok: false, pesan: 'Jurnal tidak ditemukan.' };
  if (user.peran !== 'admin' && String(values[index + 1][guruCol]) !== user.nama) {
    return { ok: false, pesan: 'Anda hanya dapat menghapus jurnal milik sendiri.' };
  }
  sheet.deleteRow(index + 2);
  return { ok: true };
}

function replaceUsers_(users) {
  if (!Array.isArray(users)) return { ok: false, pesan: 'Format daftar pengguna tidak valid.' };
  const cleaned = users.map(function (u) {
    return {
      nama: String(u && u.nama || '').trim(),
      pin: String(u && u.pin || '').trim(),
      peran: String(u && u.peran || 'guru').trim() === 'admin' ? 'admin' : 'guru'
    };
  }).filter(function (u) { return u.nama && u.pin; });
  const names = cleaned.map(function (u) { return u.nama.toLowerCase(); });
  if (new Set(names).size !== names.length) return { ok: false, pesan: 'Nama akun harus unik.' };
  if (!cleaned.some(function (u) { return u.peran === 'admin'; })) {
    return { ok: false, pesan: 'Harus ada minimal satu akun admin.' };
  }
  const sheet = getSheet_('users');
  sheet.clearContents();
  sheet.getRange(1, 1, 1, HEADERS.users.length).setValues([HEADERS.users]);
  if (cleaned.length) {
    sheet.getRange(2, 1, cleaned.length, HEADERS.users.length)
      .setValues(cleaned.map(function (u) { return HEADERS.users.map(function (key) { return u[key]; }); }));
  }
  sheet.setFrozenRows(1);
  return { ok: true };
}

function readObjects_(sheetName) {
  const values = getSheet_(sheetName).getDataRange().getValues();
  if (values.length < 2) return [];
  const headers = values[0].map(String);
  return values.slice(1).filter(function (r) { return r.some(function (v) { return v !== ''; }); })
    .map(function (r) { return objectFromRow_(headers, r); });
}

function objectFromRow_(headers, row) {
  const obj = {};
  headers.forEach(function (key, i) {
    obj[key] = row[i] instanceof Date
      ? Utilities.formatDate(row[i], Session.getScriptTimeZone(), 'yyyy-MM-dd')
      : row[i];
  });
  return obj;
}

function getSheet_(name) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(name);
  if (!sheet) throw new Error('Tab ' + name + ' belum ada. Jalankan setupSheets() terlebih dahulu.');
  return sheet;
}
