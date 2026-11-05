const SHEETS = {
  USERS: 'users',
  JOURNALS: 'journals'
};

const HEADERS = {
  users: ['nama', 'pin', 'peran'],
  journals: ['id', 'tgl', 'guru', 'jam', 'kelas', 'mapel', 'materi', 'total', 'sakit', 'izin', 'alpa', 'hadir', 'ket']
};

/** Serves the application UI from Apps Script. Add the app's HTML as index.html. */
function doGet() {
  return HtmlService.createHtmlOutputFromFile('index')
    .setTitle('Jurnal Harian Mengajar Guru')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.DEFAULT);
}

/**
 * Run once from the Apps Script editor to create the required tabs and headers.
 * Add user accounts (including at least one admin) to the users tab manually.
 */
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
  return 'Sheet users dan journals siap. Tambahkan akun guru/admin di tab users.';
}

/**
 * Server API called by the Apps Script-hosted UI using google.script.run.
 * Requests include aksi and, except for login, the authenticated nama and PIN.
 */
function api(request) {
  request = request || {};
  const action = String(request.aksi || '');
  if (action === 'masuk') return login_(request);

  const user = authenticate_(request.nama, request.pin);
  if (!user) return { ok: false, pesan: 'Sesi tidak valid. Silakan masuk kembali.' };

  if (action === 'daftar') {
    let journals = readObjects_(SHEETS.JOURNALS);
    if (user.peran !== 'admin') {
      journals = journals.filter(function (row) { return row.guru === user.nama; });
    }
    journals.sort(function (a, b) { return String(a.tgl).localeCompare(String(b.tgl)); });
    return { ok: true, data: journals };
  }

  if (action === 'simpan') return saveJournal_(user, request.jurnal || {});
  if (action === 'hapus') return deleteJournal_(user, request.id);
  if (action === 'users') {
    if (user.peran !== 'admin') return { ok: false, pesan: 'Akses admin diperlukan.' };
    return { ok: true, data: readObjects_(SHEETS.USERS) };
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
  const normalizedName = String(name || '').trim();
  return readObjects_(SHEETS.USERS).find(function (user) {
    return user.nama === normalizedName;
  }) || null;
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

  const sheet = getSheet_(SHEETS.JOURNALS);
  const values = sheet.getDataRange().getValues();
  const idColumn = HEADERS.journals.indexOf('id');
  const existingIndex = values.slice(1).findIndex(function (valuesRow) {
    return String(valuesRow[idColumn]) === row.id;
  });
  if (existingIndex >= 0) {
    const existing = objectFromRow_(HEADERS.journals, values[existingIndex + 1]);
    if (user.peran !== 'admin' && existing.guru !== user.nama) {
      return { ok: false, pesan: 'Anda hanya dapat mengubah jurnal milik sendiri.' };
    }
    sheet.getRange(existingIndex + 2, 1, 1, HEADERS.journals.length)
      .setValues([HEADERS.journals.map(function (key) { return row[key] == null ? '' : row[key]; })]);
  } else {
    sheet.appendRow(HEADERS.journals.map(function (key) { return row[key] == null ? '' : row[key]; }));
  }
  return { ok: true, id: row.id };
}

function deleteJournal_(user, id) {
  const sheet = getSheet_(SHEETS.JOURNALS);
  const values = sheet.getDataRange().getValues();
  const idColumn = HEADERS.journals.indexOf('id');
  const guruColumn = HEADERS.journals.indexOf('guru');
  const index = values.slice(1).findIndex(function (row) { return String(row[idColumn]) === String(id); });
  if (index < 0) return { ok: false, pesan: 'Jurnal tidak ditemukan.' };
  const existingRow = values[index + 1];
  if (user.peran !== 'admin' && String(existingRow[guruColumn]) !== user.nama) {
    return { ok: false, pesan: 'Anda hanya dapat menghapus jurnal milik sendiri.' };
  }
  sheet.deleteRow(index + 2);
  return { ok: true };
}

function replaceUsers_(users) {
  if (!Array.isArray(users)) return { ok: false, pesan: 'Format daftar pengguna tidak valid.' };
  const cleaned = users.map(function (user) {
    return {
      nama: String(user && user.nama || '').trim(),
      pin: String(user && user.pin || '').trim(),
      peran: String(user && user.peran || 'guru').trim() === 'admin' ? 'admin' : 'guru'
    };
  }).filter(function (user) { return user.nama && user.pin; });
  if (!cleaned.some(function (user) { return user.peran === 'admin'; })) {
    return { ok: false, pesan: 'Daftar harus memiliki minimal satu admin.' };
  }
  const sheet = getSheet_(SHEETS.USERS);
  sheet.clearContents();
  sheet.getRange(1, 1, 1, HEADERS.users.length).setValues([HEADERS.users]);
  if (cleaned.length) {
    sheet.getRange(2, 1, cleaned.length, HEADERS.users.length)
      .setValues(cleaned.map(function (user) { return HEADERS.users.map(function (key) { return user[key]; }); }));
  }
  sheet.setFrozenRows(1);
  return { ok: true };
}

function readObjects_(sheetName) {
  const sheet = getSheet_(sheetName);
  const values = sheet.getDataRange().getValues();
  if (values.length < 2) return [];
  const headers = values[0].map(String);
  return values.slice(1).filter(function (row) { return row.some(function (value) { return value !== ''; }); })
    .map(function (row) { return objectFromRow_(headers, row); });
}

function objectFromRow_(headers, row) {
  const result = {};
  headers.forEach(function (header, index) {
    result[header] = row[index] instanceof Date
      ? Utilities.formatDate(row[index], Session.getScriptTimeZone(), 'yyyy-MM-dd')
      : row[index];
  });
  return result;
}

function getSheet_(sheetName) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetName);
  if (!sheet) throw new Error('Sheet "' + sheetName + '" belum ada. Jalankan setupSheets() terlebih dahulu.');
  return sheet;
}
