// FILE: server/scripts/test-focus-feature.mjs
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import express from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../src/config/env.js';
import { pool } from '../src/config/db.js';
import {
  adjustForQuietHours,
  dateKeyAndMinutesToUtcMs,
  getZonedParts,
  toUtcMs,
  toUtcMysqlDatetime,
} from '../src/utils/timezone.js';
import {
  createVapidAuthHeader,
  encryptWebPushPayload,
  generateVapidKeys,
  sendWebPushNotification,
} from '../src/utils/webPushClient.js';
import { computeSessionTiming, validateTimerTransition } from '../src/services/focusTimerLogic.js';
import {
  computeAutoPlanSessions,
  detectScheduleConflictsAndLoad,
  suggestRescheduleSlot,
} from '../src/services/autoPlanner.service.js';
import {
  buildScheduleSessionReminders,
  buildTaskDeadlineReminders,
} from '../src/services/reminder.service.js';
import { computeFocusStatsFromData } from '../src/services/focus.service.js';
import { computeClientRemainingSeconds } from '../../client/src/utils/focusTimerMath.js';
import focusRoutes from '../src/routes/focus.routes.js';
import { errorHandler } from '../src/middlewares/error.middleware.js';

// ============================================================================
// 1. TIMEZONE & QUIET HOURS
// ============================================================================
{
  const utcStr = '2026-11-16T15:30:00.000Z'; // 22:30 WIB (di dalam jam tenang 22:00 - 07:00)
  const mysqlDt = toUtcMysqlDatetime(utcStr);
  assert.equal(mysqlDt, '2026-11-16 15:30:00');
  assert.equal(toUtcMs(mysqlDt), Date.parse(utcStr));

  const wibSettings = {
    zona_waktu: 'Asia/Jakarta',
    jam_tenang_aktif: true,
    jam_tenang_mulai: '22:00',
    jam_tenang_selesai: '07:00',
  };

  // 22:30 WIB -> digeser ke 07:00 WIB keesokan harinya (17 Nov 00:00 UTC)
  const shiftedNight = adjustForQuietHours(Date.parse(utcStr), wibSettings);
  const shiftedParts = getZonedParts(shiftedNight, 'Asia/Jakarta');
  assert.equal(shiftedParts.dateKey, '2026-11-17');
  assert.equal(shiftedParts.hour, 7);
  assert.equal(shiftedParts.minute, 0);

  // 05:15 WIB -> digeser ke 07:00 WIB pada hari yang sama
  const morningQuiet = dateKeyAndMinutesToUtcMs('2026-11-17', 5 * 60 + 15, 'Asia/Jakarta');
  const shiftedMorning = adjustForQuietHours(morningQuiet, wibSettings);
  const morningParts = getZonedParts(shiftedMorning, 'Asia/Jakarta');
  assert.equal(morningParts.dateKey, '2026-11-17');
  assert.equal(morningParts.hour, 7);

  // 14:00 WITA tetap 14:00 WITA
  const witaSettings = { ...wibSettings, zona_waktu: 'Asia/Makassar' };
  const witaAfternoon = dateKeyAndMinutesToUtcMs('2026-11-17', 14 * 60, 'Asia/Makassar');
  assert.equal(adjustForQuietHours(witaAfternoon, witaSettings), witaAfternoon);

  console.log('PASS 1: Timezone UTC conversion & Quiet Hours (Asia/Jakarta & Asia/Makassar)');
}

// ============================================================================
// 2. KETEPATAN TIMER (ANTI-DRIFT, JEDA/LANJUT, OFFSET JAM SERVER, AUTO-EXPIRE)
// ============================================================================
{
  const startMs = Date.UTC(2026, 10, 16, 10, 0, 0);
  const session = {
    id: 1,
    status: 'berjalan',
    mulai_at: new Date(startMs).toISOString(),
    durasi_rencana_detik: 25 * 60,
    total_jeda_detik: 120,
    jeda_sejak: null,
  };

  // Setelah 10 menit berlalu dengan total jeda 2 menit => efektif kerja 8 menit, sisa 17 menit (1020 detik)
  const timing = computeSessionTiming(session, startMs + 10 * 60 * 1000);
  assert.equal(timing.elapsed_detik, 8 * 60);
  assert.equal(timing.sisa_detik, 17 * 60);
  assert.equal(timing.is_expired, false);

  // Jika jam perangkat client terlambat 30 detik (serverOffsetMs = +30000), client tetap sinkron dengan server
  const clientNowSlow = startMs + 10 * 60 * 1000 - 30 * 1000;
  const clientRem = computeClientRemainingSeconds(session, 30 * 1000, clientNowSlow);
  assert.equal(clientRem, 17 * 60);

  // Saat sesi sedang dijeda pada menit ke-10 (tanpa perubahan saat idle selama 1 jam)
  const pausedSession = {
    ...session,
    status: 'dijeda',
    total_jeda_detik: 0,
    jeda_sejak: new Date(startMs + 10 * 60 * 1000).toISOString(),
  };
  const pausedTiming = computeSessionTiming(pausedSession, startMs + 70 * 60 * 1000);
  assert.equal(pausedTiming.sisa_detik, 15 * 60);
  assert.equal(computeClientRemainingSeconds(pausedSession, 0, startMs + 70 * 60 * 1000), 15 * 60);

  // Jika perangkat tidur melewati batas waktu -> tandai expired dan clamp ke waktu berakhir seharusnya
  const expiredTiming = computeSessionTiming(session, startMs + 90 * 60 * 1000);
  assert.equal(expiredTiming.sisa_detik, 0);
  assert.equal(expiredTiming.is_expired, true);
  assert.equal(expiredTiming.expected_end_ms, startMs + (25 * 60 + 120) * 1000);

  // Transisi status timer
  assert.doesNotThrow(() => validateTimerTransition('berjalan', 'pause'));
  assert.doesNotThrow(() => validateTimerTransition('dijeda', 'resume'));
  assert.throws(() => validateTimerTransition('berjalan', 'resume'), /dijeda/);
  assert.throws(() => validateTimerTransition('dijeda', 'pause'), /berjalan/);
  assert.throws(() => validateTimerTransition('selesai', 'complete'), /sedang berjalan/);

  console.log('PASS 2: Timer timing calculation (drift-free, pause/resume, clock offset) & transitions');
}

// ============================================================================
// 3. ALGORITMA RENCANA OTOMATIS, DETEKSI BENTROK & BEBAN HARIAN
// ============================================================================
{
  const nowUtcMs = dateKeyAndMinutesToUtcMs('2026-11-16', 9 * 60, 'Asia/Jakarta');
  const deadlineUtcMs = dateKeyAndMinutesToUtcMs('2026-11-19', 20 * 60, 'Asia/Jakarta');
  const settings = {
    zona_waktu: 'Asia/Jakarta',
    jam_aktif_mulai: '08:00',
    jam_aktif_selesai: '22:00',
    batas_beban_harian_menit: 120,
  };

  // Ada sesi eksisting di hari 16 Nov jam 09:30 - 11:30 WIB (120 menit) -> hari 16 Nov sudah penuh!
  const existingSessions = [
    {
      id: 99,
      tugas_id: 500,
      judul_tugas: 'Tugas Lain',
      mulai_at: new Date(dateKeyAndMinutesToUtcMs('2026-11-16', 9 * 60 + 30, 'Asia/Jakarta')).toISOString(),
      durasi_menit: 120,
      status: 'terjadwal',
    },
  ];

  // Bagi rata 150 menit -> chunk [50, 50, 50] harus melewati hari 16 Nov (karena batas 120m sudah penuh)
  const spreadPlan = computeAutoPlanSessions({
    nowUtcMs,
    deadlineUtcMs,
    estimasiMenit: 150,
    strategy: 'bagi_rata',
    preferredSessionMinutes: 50,
    existingSessions,
    settings,
  });

  assert.equal(spreadPlan.sessions.length, 3);
  assert.equal(spreadPlan.summary.total_menit, 150);
  for (const s of spreadPlan.sessions) {
    const startParts = getZonedParts(Date.parse(s.mulai_at), 'Asia/Jakarta');
    assert.ok(startParts.minutesOfDay >= 8 * 60 && startParts.minutesOfDay <= 22 * 60);
    assert.ok(Date.parse(s.selesai_at) <= deadlineUtcMs);
  }
  assert.equal(spreadPlan.warnings.melewati_deadline, false);

  // Pastikan strategi 'dekat_deadline' menempatkan sesi di tanggal paling akhir (19 Nov / 18 Nov)
  const deadlinePacked = computeAutoPlanSessions({
    nowUtcMs,
    deadlineUtcMs,
    estimasiMenit: 100,
    strategy: 'dekat_deadline',
    preferredSessionMinutes: 50,
    existingSessions,
    settings,
  });
  const packedDate = getZonedParts(Date.parse(deadlinePacked.sessions[0].mulai_at), 'Asia/Jakarta').dateKey;
  assert.equal(packedDate, '2026-11-19');

  // Deteksi bentrok, melewati deadline, & beban harian berlebih
  const badCandidate = [
    {
      mulai_at: new Date(dateKeyAndMinutesToUtcMs('2026-11-16', 10 * 60, 'Asia/Jakarta')).toISOString(),
      durasi_menit: 60,
    },
    {
      mulai_at: new Date(deadlineUtcMs + 60 * 60 * 1000).toISOString(),
      durasi_menit: 60,
    },
  ];
  const checkWarnings = detectScheduleConflictsAndLoad({
    candidateSessions: badCandidate,
    existingSessions,
    deadlineUtcMs,
    settings,
  });
  assert.equal(checkWarnings.conflicts.length, 1);
  assert.equal(checkWarnings.pastDeadlineWarnings.length, 1);
  assert.equal(checkWarnings.dailyLoadWarnings.length, 1);

  // Saran jadwal ulang untuk sesi terlewat tidak boleh bentrok dengan existingSessions
  const resched = suggestRescheduleSlot({
    durationMenit: 50,
    nowUtcMs,
    existingSessions,
    deadlineUtcMs,
    settings,
  });
  const resStart = Date.parse(resched.mulai_at);
  const resEnd = Date.parse(resched.selesai_at);
  const exStart = Date.parse(existingSessions[0].mulai_at);
  const exEnd = exStart + 120 * 60 * 1000;
  assert.equal(resStart < exEnd && exStart < resEnd, false);

  console.log('PASS 3: Deterministic Auto-Planner, Conflict Detection & Reschedule Suggestion');
}

// ============================================================================
// 4. IDEMPOTENSI PENGINGAT & NON-REMINDER UNTUK TUGAS SELESAI
// ============================================================================
{
  const nowUtcMs = Date.UTC(2026, 10, 16, 8, 0, 0);
  const taskActive = {
    id: 10,
    user_id: 5,
    status: 'sedang_dikerjakan',
    deadline_at: new Date(nowUtcMs + 5 * 24 * 3600 * 1000).toISOString(),
  };
  const taskDone = { ...taskActive, status: 'selesai' };

  const settings = {
    zona_waktu: 'Asia/Jakarta',
    jam_tenang_aktif: false,
    offset_sesi_menit: 10,
    ingatkan_deadline_h3: true,
    ingatkan_deadline_h1: true,
    ingatkan_deadline_3jam: true,
    ingatkan_sesi_akan_mulai: true,
    ingatkan_sesi_mulai: true,
  };

  const r1 = buildTaskDeadlineReminders({ task: taskActive, settings, nowUtcMs });
  const r2 = buildTaskDeadlineReminders({ task: taskActive, settings, nowUtcMs });
  assert.equal(r1.length, 3);
  assert.deepEqual(
    r1.map((x) => x.dedupe_key),
    r2.map((x) => x.dedupe_key)
  );
  assert.equal(buildTaskDeadlineReminders({ task: taskDone, settings, nowUtcMs }).length, 0);

  const schedActive = {
    id: 20,
    user_id: 5,
    tugas_id: 10,
    mulai_at: new Date(nowUtcMs + 2 * 3600 * 1000).toISOString(),
    durasi_menit: 50,
    status: 'terjadwal',
  };
  const sr1 = buildScheduleSessionReminders({ session: schedActive, settings, nowUtcMs });
  assert.equal(sr1.length, 2);
  assert.equal(
    buildScheduleSessionReminders({ session: { ...schedActive, status: 'selesai' }, settings, nowUtcMs }).length,
    0
  );

  console.log('PASS 4: Reminder idempotency keys & suppression on completed tasks/sessions');
}

// ============================================================================
// 5. WEB PUSH RFC 8291/8292 ENCRYPTION & EXPIRATION HANDLING (410)
// ============================================================================
{
  const vapidKeys = generateVapidKeys();
  const clientEcdh = crypto.createECDH('prime256v1');
  clientEcdh.generateKeys();
  const p256dh = clientEcdh.getPublicKey().toString('base64url');
  const auth = crypto.randomBytes(16).toString('base64url');

  const encrypted = encryptWebPushPayload({
    p256dh,
    auth,
    payload: JSON.stringify({ title: 'Test Push', body: 'Mulai belajar!' }),
  });
  assert.ok(encrypted.length > 86);

  const authHeader = createVapidAuthHeader({
    endpoint: 'https://fcm.googleapis.com/fcm/send/sample',
    publicKey: vapidKeys.publicKey,
    privateKey: vapidKeys.privateKey,
    subject: 'mailto:admin@pasim.ac.id',
  });
  assert.match(authHeader, /^vapid t=[^.]+\.[^.]+\.[^,]+, k=/);

  const mockGoneRes = await sendWebPushNotification(
    { endpoint: 'https://push.example.test/sub/1', p256dh, auth },
    { title: 'Ping' },
    { requester: async () => ({ statusCode: 410, body: 'Gone' }) }
  );
  assert.equal(mockGoneRes.delivered, false);
  assert.equal(mockGoneRes.expired, true);

  console.log('PASS 5: Web Push encryption, VAPID ES256 header & 410 expiration handling');
}

// ============================================================================
// 6. STATISTIK FOKUS & STREAK HARIAN
// ============================================================================
{
  const nowUtcMs = dateKeyAndMinutesToUtcMs('2026-11-16', 15 * 60, 'Asia/Jakarta');
  const makeFocus = (dateKey, durMin) => {
    const start = dateKeyAndMinutesToUtcMs(dateKey, 10 * 60, 'Asia/Jakarta');
    return {
      id: Math.random(),
      tugas_id: 1,
      kategori: 'Proyek Coding',
      durasi_rencana_detik: durMin * 60,
      total_jeda_detik: 0,
      mulai_at: new Date(start).toISOString(),
      selesai_at: new Date(start + durMin * 60 * 1000).toISOString(),
    };
  };

  const stats = computeFocusStatsFromData(
    [makeFocus('2026-11-16', 25), makeFocus('2026-11-15', 50), makeFocus('2026-11-14', 25)],
    [{ id: 1, judul: 'Stack', kategori: 'Proyek Coding', status: 'sedang_dikerjakan', estimasi_menit: 150, total_fokus_detik: 6000, jumlah_sesi_fokus: 3 }],
    { zona_waktu: 'Asia/Jakarta' },
    nowUtcMs
  );
  assert.equal(stats.hari_ini_menit, 25);
  assert.equal(stats.tujuh_hari_menit, 100);
  assert.equal(stats.streak_hari, 3);
  assert.equal(stats.per_kategori[0].kategori, 'Proyek Coding');
  assert.equal(stats.per_kategori[0].total_menit, 100);

  console.log('PASS 6: Focus stats aggregation (today, 7d, per-category, 3-day streak)');
}

// ============================================================================
// 7. RBAC & ISOLASI KEPEMILIKAN ENDPOINT EXPRESS
// ============================================================================
{
  // Stub pool.execute & pool.query sementara di memori untuk menguji auth + RBAC + ownership tanpa MySQL live
  const origExecute = pool.execute.bind(pool);
  const origQuery = pool.query.bind(pool);

  const fakeUsers = {
    10: { id: 10, nim: '2022001', full_name: 'Alumni User', role: 'alumni', status: 'active' },
    20: { id: 20, nim: '2024001', full_name: 'Mahasiswa A', role: 'mahasiswa', status: 'active' },
  };

  pool.execute = async (sql, params = []) => {
    if (sql.includes('FROM users WHERE id = ?')) {
      const u = fakeUsers[params[0]];
      return [u ? [u] : []];
    }
    return [[]];
  };
  pool.query = async (sql, params = []) => {
    // Ownership test: tugas id 999 dimiliki user_id 21, sehingga query WHERE tp.id = 999 AND tp.user_id = 20 mengembalikan kosong
    if (sql.includes('FROM tugas_pribadi tp') && sql.includes('tp.id = ? AND tp.user_id = ?')) {
      return [[]];
    }
    return [[]];
  };

  const app = express();
  app.use(express.json());
  app.use('/api/v1/focus', focusRoutes);
  app.use(errorHandler);

  const srv = app.listen(0, '127.0.0.1');
  await new Promise((r) => srv.once('listening', r));
  const baseUrl = `http://127.0.0.1:${srv.address().port}/api/v1/focus`;

  try {
    // a. Tanpa token -> 401
    const rUnauth = await fetch(`${baseUrl}/tasks`);
    assert.equal(rUnauth.status, 401);

    // b. Role alumni -> 403 Diblokir (sesuai Assignment Hub)
    const alumniToken = jwt.sign({ id: 10 }, env.jwt.accessSecret, { expiresIn: '5m' });
    const rAlumni = await fetch(`${baseUrl}/tasks`, {
      headers: { Authorization: `Bearer ${alumniToken}` },
    });
    assert.equal(rAlumni.status, 403);

    // c. Mahasiswa A (id=20) mencoba mengubah tugas milik user lain (id=999) -> 404 ditolak
    const mhsToken = jwt.sign({ id: 20 }, env.jwt.accessSecret, { expiresIn: '5m' });
    const rIdor = await fetch(`${baseUrl}/tasks/999`, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${mhsToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ judul: 'Ubah Paksa' }),
    });
    assert.equal(rIdor.status, 404);

    console.log('PASS 7: Route auth (401), Alumni RBAC rejection (403), and ownership isolation (404)');
  } finally {
    srv.close();
    pool.execute = origExecute;
    pool.query = origQuery;
  }
}

console.log('\nALL FOCUS PLANNER & TIMER TESTS PASSED!');
