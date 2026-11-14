// FILE: client/src/hooks/useCountdown.js
import { useState, useEffect } from 'react';

/**
 * Singleton Global Ticker untuk sinkronisasi waktu seluruh kartu tugas
 * Mencegah pemborosan interval per komponen dan menghindari drift antar kartu.
 */
let globalNow = Date.now();
const listeners = new Set();
let timerId = null;

function startGlobalTicker() {
  if (timerId === null && typeof window !== 'undefined') {
    timerId = setInterval(() => {
      globalNow = Date.now();
      listeners.forEach((callback) => callback(globalNow));
    }, 1000);
  }
}

function stopGlobalTicker() {
  if (listeners.size === 0 && timerId !== null) {
    clearInterval(timerId);
    timerId = null;
  }
}

/**
 * Menghitung waktu mundur deadline dan menentukan kategori urgensi warna
 * @param {string|Date} deadlineTimestamp - Deadline dalam format ISO string / UTC
 * @returns {{
 *   formatted: string,
 *   urgency: 'normal'|'warning'|'danger'|'overdue',
 *   isOverdue: boolean,
 *   formattedWib: string,
 *   hoursLeft: number
 * }}
 */
export function useCountdown(deadlineTimestamp) {
  const [currentNow, setCurrentNow] = useState(globalNow);

  useEffect(() => {
    const handleTick = (now) => setCurrentNow(now);
    listeners.add(handleTick);
    startGlobalTicker();

    return () => {
      listeners.delete(handleTick);
      stopGlobalTicker();
    };
  }, []);

  if (!deadlineTimestamp) {
    return {
      formatted: '-',
      urgency: 'normal',
      isOverdue: false,
      formattedWib: '-',
      hoursLeft: 0,
    };
  }

  const deadlineDate = new Date(deadlineTimestamp);
  const diffMs = deadlineDate.getTime() - currentNow;
  const isOverdue = diffMs <= 0;

  // Format tanggal dalam zona waktu Indonesia Barat (WIB / UTC+7)
  const formattedWib = new Intl.DateTimeFormat('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Asia/Jakarta',
  }).format(deadlineDate) + ' WIB';

  if (isOverdue) {
    const overdueMs = Math.abs(diffMs);
    const overdueDays = Math.floor(overdueMs / (1000 * 60 * 60 * 24));
    const overdueHours = Math.floor((overdueMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const overdueMins = Math.floor((overdueMs % (1000 * 60 * 60)) / (1000 * 60));

    let overdueText = 'Terlambat ';
    if (overdueDays > 0) overdueText += `${overdueDays} hari ${overdueHours} jam`;
    else if (overdueHours > 0) overdueText += `${overdueHours} jam ${overdueMins} mnt`;
    else overdueText += `${overdueMins} menit`;

    return {
      formatted: overdueText,
      urgency: 'overdue',
      isOverdue: true,
      formattedWib,
      hoursLeft: 0,
    };
  }

  const totalHours = diffMs / (1000 * 60 * 60);
  const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((diffMs % (1000 * 60)) / 1000);

  let formatted = '';
  if (days > 0) {
    formatted = `${days} hari ${hours} jam lagi`;
  } else if (hours > 0) {
    formatted = `${hours} jam ${minutes} mnt lagi`;
  } else {
    formatted = `${minutes} mnt ${seconds} dtk lagi`;
  }

  // Tentukan urgensi warna:
  // > 3 hari (72 jam) => 'normal'
  // 1 sampai 3 hari (24 - 72 jam) => 'warning'
  // < 24 jam => 'danger'
  let urgency = 'normal';
  if (totalHours <= 24) {
    urgency = 'danger';
  } else if (totalHours <= 72) {
    urgency = 'warning';
  }

  return {
    formatted,
    urgency,
    isOverdue: false,
    formattedWib,
    hoursLeft: Math.round(totalHours),
  };
}

export default useCountdown;
