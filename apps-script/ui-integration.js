(function () {
  const gasReady = typeof google !== 'undefined' && google.script && google.script.run;

  function callGasApi(payload) {
    if (!gasReady) return Promise.resolve(null);
    const next = Object.assign({}, payload || {});
    if (!next.nama && window.me && window.me.nama) next.nama = window.me.nama;
    if (!next.pin && window.me && window.me.pin) next.pin = window.me.pin;

    return new Promise(function (resolve) {
      google.script.run
        .withSuccessHandler(function (result) {
          resolve(result || { ok: false, pesan: 'Server tidak memberikan respons.' });
        })
        .withFailureHandler(function (err) {
          const message = err && err.message ? err.message : 'Koneksi server gagal.';
          resolve({ ok: false, pesan: message });
        })
        .api(next);
    });
  }

  const originalApi = window.api;
  window.api = async function (body) {
    const remote = await callGasApi(body);
    if (remote && typeof remote.ok !== 'undefined') {
      if (body && body.aksi === 'users' && Array.isArray(remote.data)) {
        try {
          localStorage.setItem('jurnalUserAccounts', JSON.stringify(remote.data));
          const guru = remote.data.map(function (u) {
            return { nama: String(u && u.nama || '').trim(), peran: String(u && u.peran || 'guru').trim() };
          }).filter(function (g) { return g.nama; });
          localStorage.setItem('jurnalGuruList', JSON.stringify(guru));
          if (window.guruList !== undefined) window.guruList = guru;
        } catch (e) {
          console.warn('Gagal menyimpan data user dari server:', e);
        }
      }

      return remote;
    }

    if (typeof originalApi === 'function') {
      return originalApi.call(this, body);
    }

    return { ok: false, pesan: 'Aksi tidak didukung.' };
  };

  window.syncUsersFromServer = async function () {
    if (!gasReady || !window.me || window.me.peran !== 'admin') return;
    const resp = await window.api({ aksi: 'users' });
    if (resp && resp.ok && Array.isArray(resp.data)) {
      try {
        localStorage.setItem('jurnalUserAccounts', JSON.stringify(resp.data));
      } catch (e) {}
    }
  };

  const originalStart = window.start;
  window.start = async function () {
    if (typeof originalStart === 'function') {
      const result = await originalStart.call(this);
      if (window.me && window.me.peran === 'admin') {
        await window.syncUsersFromServer();
      }
      return result;
    }
  };
})();
