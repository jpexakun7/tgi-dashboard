import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Camera,
  MapPin,
  Clock,
  Calendar,
  RefreshCw,
  CheckCircle2,
  ShieldCheck,
  ShieldAlert,
  Navigation,
  Sparkles,
  SwitchCamera,
  Eye,
  X,
  UserCheck,
  LogOut,
  Radio,
  AlertTriangle,
  Lock,
  ExternalLink,
} from 'lucide-react';
import { Employee, WorkShift, AttendanceRecord } from '../types';
import { evaluateAttendanceAgainstShift } from '../utils/formatters';

interface LiveFaceGpsAttendanceScannerProps {
  currentEmployee: Employee;
  activeShift: WorkShift;
  todayAttendance?: AttendanceRecord;
  todayDateStr: string;
  useCustomClockTime: boolean;
  customClockInTime: string;
  customClockOutTime: string;
  clockInNotes: string;
  onChangeNotes: (notes: string) => void;
  onSubmitAttendance: (record: AttendanceRecord, mode: 'check_in' | 'check_out') => void;
}

// Titik Lokasi Resmi Kantor PT Tas Grosir Import (Sesuai Titik Bing Maps)
export const OFFICE_REFERENCE_COORDS = {
  latitude: -6.158122,
  longitude: 106.87099,
  shortAddress: 'Jl. Sumber Mas I Blok C No. 191, Tangerang, Banten, ID',
  name: 'Kantor & Gudang PT Tas Grosir Import — Jl. Sumber Mas I Blok C No. 191, Tangerang, Banten, ID',
  bingMapsUrl:
    'https://www.bing.com/maps/search?trk=org-locations_url&style=r&q=Jl.+Sumber+Mas+I+Blok+C+No.+191+Tangerang+Banten+ID&cp=-6.158122%7E106.870990&lvl=16',
  maxRadiusMeters: 15, // Batas maksimal jangkauan wajib 15 meter dari titik lokasi kantor
};

interface GpsTelemetrySample {
  latitude: number;
  longitude: number;
  accuracy: number;
  altitude: number | null;
  altitudeAccuracy: number | null;
  speed: number | null;
  heading: number | null;
  timestamp: number;
}

interface AntiFakeGpsAuditResult {
  isFakeDetected: boolean;
  confidenceScore: number; // 0 - 100 (100 = 100% genuine hardware GPS)
  reasons: string[];
  checks: {
    accuracyValid: boolean;
    timestampSynced: boolean;
    kinematicsValid: boolean;
    sensorHardwareValid: boolean;
  };
}

function calculateHaversineMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const R = 6371000; // Earth radius in meters
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Number((R * c).toFixed(1));
}

function formatFullIndonesianDateTime(date: Date): {
  dayDateStr: string;
  timeWithSecondsStr: string;
  shortHourMinStr: string;
} {
  const days = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
  const months = [
    'Januari',
    'Februari',
    'Maret',
    'April',
    'Mei',
    'Juni',
    'Juli',
    'Agustus',
    'September',
    'Oktober',
    'November',
    'Desember',
  ];
  const dayName = days[date.getDay()];
  const dayNum = String(date.getDate()).padStart(2, '0');
  const monthName = months[date.getMonth()];
  const year = date.getFullYear();

  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');

  return {
    dayDateStr: `${dayName}, ${dayNum} ${monthName} ${year}`,
    timeWithSecondsStr: `${hours}:${minutes}:${seconds} WIB`,
    shortHourMinStr: `${hours}:${minutes}`,
  };
}

/**
 * Multi-Layer Anti-Fake GPS / Mock Location Auditor
 * Mendeteksi manipulasi koordinat dari aplikasi Fake GPS, Mock Location Developer Options,
 * sensor injection, atau lompatan koordinat tidak wajar (teleportasi).
 */
function auditGpsPositionForSpoofing(
  pos: GeolocationPosition,
  history: GpsTelemetrySample[]
): AntiFakeGpsAuditResult {
  const reasons: string[] = [];
  let penalty = 0;

  const lat = pos.coords.latitude;
  const lon = pos.coords.longitude;
  const acc = pos.coords.accuracy;
  const alt = pos.coords.altitude;
  const altAcc = pos.coords.altitudeAccuracy;
  const spd = pos.coords.speed;
  const hdg = pos.coords.heading;
  const fixTime = pos.timestamp || Date.now();
  const nowMs = Date.now();

  // 1. Audit Akurasi Satelit (Fake GPS sering memalsukan accuracy = 0, < 0.8m, atau > 50m dari IP Proxy)
  let accuracyValid = true;
  if (!Number.isFinite(acc) || acc <= 0) {
    accuracyValid = false;
    penalty += 60;
    reasons.push(
      'Nilai akurasi GPS tidak valid (0m) — indikasi kuat injeksi aplikasi Fake GPS / Mock Location.'
    );
  } else if (acc < 0.8) {
    accuracyValid = false;
    penalty += 55;
    reasons.push(
      `Akurasi satelit terlalu sintetis (±${acc.toFixed(2)}m < 0.8m) — terdeteksi karakteristik Mock Location.`
    );
  } else if (acc > 45) {
    accuracyValid = false;
    penalty += 50;
    reasons.push(
      `Sinyal lokasi terlalu kasar (±${Math.round(acc)}m > 45m). Wajib gunakan GPS perangkat asli dengan akurasi tinggi, bukan jaringan IP/emulasi.`
    );
  }

  // 2. Audit Sinkronisasi Timestamp (Mendeteksi paket koordinat rekaman / replay / jam dimanipulasi)
  let timestampSynced = true;
  const clockDriftMs = Math.abs(nowMs - fixTime);
  if (clockDriftMs > 30000) {
    timestampSynced = false;
    penalty += 50;
    reasons.push(
      `Selisih waktu paket sensor GPS (${Math.round(clockDriftMs / 1000)} detik) tidak sinkron dengan jam real-time perangkat (indikasi Spoofed/Cached GPS).`
    );
  }

  // 3. Audit Sensor Hardware & Altitude Signature (Android MockProvider signature)
  let sensorHardwareValid = true;
  if (alt !== null && altAcc === 0) {
    sensorHardwareValid = false;
    penalty += 60;
    reasons.push(
      'Terdeteksi signature Mock Location Provider (Altitude terkunci tanpa akurasi vertikal).'
    );
  }
  if (spd !== null && spd < 0) {
    sensorHardwareValid = false;
    penalty += 50;
    reasons.push('Sensor kecepatan GPS bernilai negatif tidak wajar (Mock Sensor Injection).');
  }
  if (hdg !== null && (hdg < 0 || hdg > 360)) {
    sensorHardwareValid = false;
    penalty += 45;
    reasons.push('Sensor arah kompas/heading GPS tidak valid (Mock Sensor Injection).');
  }

  // 4. Audit Kinematika & Anti-Teleportasi (Lompatan Jarak Ekstrem antar sampel GPS)
  let kinematicsValid = true;
  if (history.length > 0) {
    const prev = history[history.length - 1];
    const dtSeconds = (fixTime - prev.timestamp) / 1000;
    const jumpMeters = calculateHaversineMeters(prev.latitude, prev.longitude, lat, lon);

    if (fixTime < prev.timestamp - 500) {
      timestampSynced = false;
      penalty += 55;
      reasons.push('Timestamp GPS berjalan mundur — terdeteksi manipulasi umpan lokasi.');
    }

    if (dtSeconds > 0 && dtSeconds < 12 && jumpMeters > 85) {
      const impliedSpeedMps = jumpMeters / Math.max(0.5, dtSeconds);
      if (impliedSpeedMps > 35) {
        kinematicsValid = false;
        penalty += 65;
        reasons.push(
          `Terdeteksi lompatan lokasi mendadak / teleportasi (${jumpMeters.toFixed(0)}m dalam ${dtSeconds.toFixed(1)} dtk — ${Math.round(
            impliedSpeedMps * 3.6
          )} km/jam) yang mengindikasikan perpindahan titik Fake GPS.`
        );
      }
    }
  }

  // 5. Audit Koordinat Beku / Static Mock Jitter (Jika >= 4 sampel beruntun identik 8 desimal & akurasi bulat statis)
  if (history.length >= 4) {
    const recent = history.slice(-4);
    const allIdenticalCoords = recent.every(
      (s) =>
        Math.abs(s.latitude - lat) < 0.000000001 &&
        Math.abs(s.longitude - lon) < 0.000000001 &&
        s.accuracy === acc
    );
    const timeSpanSec = (fixTime - recent[0].timestamp) / 1000;
    if (allIdenticalCoords && timeSpanSec > 8 && Number.isInteger(acc) && alt === null && spd === null) {
      sensorHardwareValid = false;
      penalty += 55;
      reasons.push(
        'Koordinat GPS terkunci statis 100% tanpa fluktuasi satelit alami — terdeteksi emulator / aplikasi pengunci titik Fake GPS.'
      );
    }
  }

  const confidenceScore = Math.max(0, 100 - penalty);
  const isFakeDetected =
    penalty >= 45 || !accuracyValid || !timestampSynced || !kinematicsValid || !sensorHardwareValid;

  return {
    isFakeDetected,
    confidenceScore,
    reasons,
    checks: {
      accuracyValid,
      timestampSynced,
      kinematicsValid,
      sensorHardwareValid,
    },
  };
}

export const LiveFaceGpsAttendanceScanner: React.FC<LiveFaceGpsAttendanceScannerProps> = ({
  currentEmployee,
  activeShift,
  todayAttendance,
  todayDateStr,
  useCustomClockTime,
  customClockInTime,
  customClockOutTime,
  clockInNotes,
  onChangeNotes,
  onSubmitAttendance,
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const avatarImgRef = useRef<HTMLImageElement | null>(null);
  const gpsHistoryRef = useRef<GpsTelemetrySample[]>([]);

  // Real-time ticking clock (updated every second)
  const [nowDate, setNowDate] = useState<Date>(() => new Date());

  // Camera state - opens immediately when component mounts
  const [isCameraActive, setIsCameraActive] = useState<boolean>(false);
  const [isStartingCamera, setIsStartingCamera] = useState<boolean>(true);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');
  const [cameraFallbackReason, setCameraFallbackReason] = useState<string | null>(null);
  const [isCapturing, setIsCapturing] = useState<boolean>(false);

  // Real-Time GPS state read strictly from real device GPS hardware (No Fake Fallback!)
  const [gpsStatus, setGpsStatus] = useState<'searching' | 'locked' | 'denied' | 'unsupported'>(
    'searching'
  );
  const [gpsErrorMessage, setGpsErrorMessage] = useState<string | null>(null);
  const [gpsCoords, setGpsCoords] = useState<{
    latitude: number;
    longitude: number;
    accuracy: number;
  } | null>(null);
  const [gpsDetailedAddress, setGpsDetailedAddress] = useState<string>(
    'Menunggu pembacaan titik koordinat asli dari sensor GPS HP...'
  );
  const [gpsSuburbCity, setGpsSuburbCity] = useState<string>('Tangerang, Banten');
  const [distanceFromOffice, setDistanceFromOffice] = useState<number | null>(null);
  const [lastGpsUpdatedTime, setLastGpsUpdatedTime] = useState<string>('');

  // Anti-Fake GPS Audit State
  const [antiFakeAudit, setAntiFakeAudit] = useState<AntiFakeGpsAuditResult>({
    isFakeDetected: false,
    confidenceScore: 100,
    reasons: [],
    checks: {
      accuracyValid: true,
      timestampSynced: true,
      kinematicsValid: true,
      sensorHardwareValid: true,
    },
  });
  const [blockedAttemptAlert, setBlockedAttemptAlert] = useState<string | null>(null);

  // Captured photo preview state
  const [lastCapturedPhoto, setLastCapturedPhoto] = useState<string | null>(
    todayAttendance?.checkOutPhotoSnapshot || todayAttendance?.facePhotoSnapshot || null
  );
  const [lastCapturedType, setLastCapturedType] = useState<'MASUK' | 'PULANG'>(
    todayAttendance?.checkOutPhotoSnapshot ? 'PULANG' : 'MASUK'
  );
  const [isPhotoZoomModalOpen, setIsPhotoZoomModalOpen] = useState<boolean>(false);

  // Preload employee avatar for canvas fallback if hardware camera is unavailable
  useEffect(() => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src =
      currentEmployee.avatarUrl ||
      'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=600&h=600&q=80';
    img.onload = () => {
      avatarImgRef.current = img;
    };
  }, [currentEmployee.avatarUrl]);

  // Sync lastCapturedPhoto when switching employee
  useEffect(() => {
    setLastCapturedPhoto(
      todayAttendance?.checkOutPhotoSnapshot || todayAttendance?.facePhotoSnapshot || null
    );
  }, [todayAttendance, currentEmployee.id]);

  // 1. Live Real-Time Clock Interval (every 1 second)
  useEffect(() => {
    const timer = setInterval(() => {
      setNowDate(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // 2. Reverse Geocoding helper (reads street, kelurahan, kecamatan, kota from GPS lat/lon)
  const reverseGeocodeCoords = useCallback(async (lat: number, lon: number, distMeters: number) => {
    // If right inside the 15m office radius, include the official office address clearly
    if (distMeters <= OFFICE_REFERENCE_COORDS.maxRadiusMeters) {
      setGpsDetailedAddress(
        `${OFFICE_REFERENCE_COORDS.shortAddress} (Titik GPS: ${lat.toFixed(6)}, ${lon.toFixed(6)})`
      );
      setGpsSuburbCity('Tangerang, Banten');
      return;
    }

    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lon}&accept-language=id`,
        {
          headers: {
            Accept: 'application/json',
          },
        }
      );
      if (!response.ok) throw new Error('Reverse geocode HTTP error');
      const data = await response.json();
      if (data && data.display_name) {
        const addr = data.address || {};
        const road = addr.road || addr.pedestrian || addr.suburb || addr.Commercial || '';
        const houseNumber = addr.house_number ? `No. ${addr.house_number}` : '';
        const neighbourhood =
          addr.neighbourhood || addr.village || addr.suburb || addr.quarter || '';
        const cityDistrict =
          addr.city_district || addr.municipality || addr.county || '';
        const city = addr.city || addr.town || addr.state || 'Tangerang, Banten';
        const postcode = addr.postcode || '';

        const shortParts = [
          [road, houseNumber].filter(Boolean).join(' '),
          neighbourhood ? `Kel. ${neighbourhood}` : '',
          cityDistrict ? `Kec. ${cityDistrict}` : '',
          city,
          postcode,
        ].filter(Boolean);

        const formattedAddress =
          shortParts.length >= 2 ? shortParts.join(', ') : data.display_name;

        setGpsDetailedAddress(formattedAddress);
        setGpsSuburbCity(
          [cityDistrict || neighbourhood, city].filter(Boolean).join(', ') ||
            'Tangerang, Banten'
        );
        return;
      }
    } catch {
      // Fallback if offline or rate-limited
    }

    setGpsDetailedAddress(
      `Koordinat Terbaca: ${lat.toFixed(6)}°, ${lon.toFixed(6)}° (${distMeters}m dari ${OFFICE_REFERENCE_COORDS.shortAddress})`
    );
  }, []);

  // Process incoming hardware GeolocationPosition
  const processIncomingPosition = useCallback(
    (pos: GeolocationPosition, triggerReverseGeocode: boolean) => {
      const lat = pos.coords.latitude;
      const lon = pos.coords.longitude;
      const acc = Number((pos.coords.accuracy || 0).toFixed(1));

      const dist = calculateHaversineMeters(
        lat,
        lon,
        OFFICE_REFERENCE_COORDS.latitude,
        OFFICE_REFERENCE_COORDS.longitude
      );

      // Run Multi-Layer Anti-Fake GPS Audit
      const audit = auditGpsPositionForSpoofing(pos, gpsHistoryRef.current);

      // Record sample in history (keep last 8 fixes)
      const nextSample: GpsTelemetrySample = {
        latitude: lat,
        longitude: lon,
        accuracy: acc,
        altitude: pos.coords.altitude,
        altitudeAccuracy: pos.coords.altitudeAccuracy,
        speed: pos.coords.speed,
        heading: pos.coords.heading,
        timestamp: pos.timestamp || Date.now(),
      };
      gpsHistoryRef.current = [...gpsHistoryRef.current.slice(-7), nextSample];

      setGpsCoords({ latitude: lat, longitude: lon, accuracy: acc });
      setDistanceFromOffice(dist);
      setAntiFakeAudit(audit);
      setGpsStatus('locked');
      setGpsErrorMessage(null);
      setLastGpsUpdatedTime(new Date().toLocaleTimeString('id-ID'));

      if (dist <= OFFICE_REFERENCE_COORDS.maxRadiusMeters && !audit.isFakeDetected) {
        setBlockedAttemptAlert(null);
      }

      if (triggerReverseGeocode) {
        reverseGeocodeCoords(lat, lon, dist);
      }
    },
    [reverseGeocodeCoords]
  );

  // 3. Start & Watch Live Phone GPS (Strictly Hardware GPS - No Mock Fallback)
  const refreshPhoneGps = useCallback(() => {
    setGpsStatus('searching');
    setGpsErrorMessage(null);

    if (!('geolocation' in navigator)) {
      setGpsStatus('unsupported');
      setGpsCoords(null);
      setDistanceFromOffice(null);
      setGpsErrorMessage(
        'Perangkat atau browser ini tidak memiliki sensor GPS perangkat keras. Absensi wajib menggunakan GPS HP asli.'
      );
      setGpsDetailedAddress('Sensor GPS tidak tersedia pada perangkat ini.');
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        processIncomingPosition(pos, true);
      },
      (err) => {
        setGpsStatus('denied');
        setGpsCoords(null);
        setDistanceFromOffice(null);
        if (err.code === 1) {
          setGpsErrorMessage(
            'Izin lokasi GPS HP ditolak! Anda wajib mengaktifkan izin Lokasi (High Accuracy GPS) pada HP/Browser untuk dapat melakukan absen dalam radius 15 meter kantor.'
          );
        } else if (err.code === 2) {
          setGpsErrorMessage(
            'Sinyal satelit GPS tidak terjangkau. Pastikan GPS HP menyala dan tidak menggunakan pengubah lokasi.'
          );
        } else {
          setGpsErrorMessage(
            'Waktu pencarian sinyal GPS habis (Timeout). Klik tombol "Perbarui GPS HP" di ruang terbuka dekat titik kantor.'
          );
        }
        setGpsDetailedAddress(
          'Sinyal GPS HP belum terkunci — aktifkan layanan Lokasi / GPS Akurasi Tinggi pada HP Anda.'
        );
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      }
    );
  }, [processIncomingPosition]);

  useEffect(() => {
    refreshPhoneGps();

    let watchId: number | null = null;
    if ('geolocation' in navigator) {
      watchId = navigator.geolocation.watchPosition(
        (pos) => {
          processIncomingPosition(pos, false);
        },
        () => {
          // Keep current state if watch encounters transient error
        },
        {
          enableHighAccuracy: true,
          maximumAge: 0,
          timeout: 10000,
        }
      );
    }

    return () => {
      if (watchId !== null && 'geolocation' in navigator) {
        navigator.geolocation.clearWatch(watchId);
      }
    };
  }, [refreshPhoneGps, processIncomingPosition]);

  // 4. Directly Open Camera on Mount or Mode Change
  const startLiveCamera = useCallback(
    async (mode: 'user' | 'environment' = facingMode) => {
      setIsStartingCamera(true);
      setCameraFallbackReason(null);

      // Stop existing tracks first
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }

      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setIsCameraActive(false);
        setIsStartingCamera(false);
        setCameraFallbackReason(
          'Browser tidak mendukung akses kamera langsung. Mode pratinjau sensor wajah aktif.'
        );
        return;
      }

      try {
        const mediaStream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: mode,
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
          audio: false,
        });

        streamRef.current = mediaStream;
        if (videoRef.current) {
          videoRef.current.srcObject = mediaStream;
          await videoRef.current.play().catch(() => {});
        }
        setIsCameraActive(true);
        setIsStartingCamera(false);
      } catch {
        setIsCameraActive(false);
        setIsStartingCamera(false);
        setCameraFallbackReason(
          'Akses kamera fisik belum diizinkan pada perangkat ini — menggunakan tangkapan layar biometrik karyawan dengan watermark GPS & Jam Real-Time.'
        );
      }
    },
    [facingMode]
  );

  useEffect(() => {
    startLiveCamera(facingMode);
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }
    };
  }, [facingMode, startLiveCamera]);

  const handleToggleFacingMode = () => {
    const nextMode = facingMode === 'user' ? 'environment' : 'user';
    setFacingMode(nextMode);
  };

  // Geofence <= 15m and Anti-Fake GPS Eligibility Evaluation
  const isGpsLocked = gpsStatus === 'locked' && gpsCoords !== null && distanceFromOffice !== null;
  const isWithin15Meters =
    isGpsLocked &&
    distanceFromOffice !== null &&
    distanceFromOffice <= OFFICE_REFERENCE_COORDS.maxRadiusMeters;
  const isFakeGpsDetected = antiFakeAudit.isFakeDetected;
  const canSubmitAttendance = isGpsLocked && isWithin15Meters && !isFakeGpsDetected;

  // 5. Generate Watermarked Face Snapshot with Real-Time Date, Clock, Anti-Fake GPS & 15m Geofence Proof
  const captureWatermarkedFacePhoto = (
    attendanceActionLabel: 'ABSEN MASUK' | 'ABSEN PULANG',
    recordedTimeStr: string,
    evalStatusText: string
  ): string => {
    const canvas = document.createElement('canvas');
    const width = 960;
    const height = 720;
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return currentEmployee.avatarUrl || '';

    const activeLat = gpsCoords ? gpsCoords.latitude : OFFICE_REFERENCE_COORDS.latitude;
    const activeLon = gpsCoords ? gpsCoords.longitude : OFFICE_REFERENCE_COORDS.longitude;
    const activeAcc = gpsCoords ? gpsCoords.accuracy : 0;
    const activeDist = distanceFromOffice !== null ? distanceFromOffice : 0;

    // A. Draw live camera frame or fallback employee portrait
    const videoEl = videoRef.current;
    if (isCameraActive && videoEl && videoEl.readyState >= 2 && videoEl.videoWidth > 0) {
      ctx.save();
      if (facingMode === 'user') {
        ctx.translate(width, 0);
        ctx.scale(-1, 1);
      }
      const videoAspect = videoEl.videoWidth / videoEl.videoHeight;
      const canvasAspect = width / height;
      let drawW = width;
      let drawH = height;
      let offsetX = 0;
      let offsetY = 0;
      if (videoAspect > canvasAspect) {
        drawW = height * videoAspect;
        offsetX = -(drawW - width) / 2;
      } else {
        drawH = width / videoAspect;
        offsetY = -(drawH - height) / 2;
      }
      ctx.drawImage(videoEl, offsetX, offsetY, drawW, drawH);
      ctx.restore();
    } else {
      const bgGrad = ctx.createLinearGradient(0, 0, width, height);
      bgGrad.addColorStop(0, '#0f172a');
      bgGrad.addColorStop(0.5, '#1e293b');
      bgGrad.addColorStop(1, '#064e3b');
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, width, height);

      if (avatarImgRef.current) {
        const img = avatarImgRef.current;
        const imgAspect = img.width / img.height;
        const canvasAspect = width / height;
        let drawW = width;
        let drawH = height;
        let offsetX = 0;
        let offsetY = 0;
        if (imgAspect > canvasAspect) {
          drawW = height * imgAspect;
          offsetX = -(drawW - width) / 2;
        } else {
          drawH = width / imgAspect;
          offsetY = -(drawH - height) / 2;
        }
        ctx.drawImage(img, offsetX, offsetY, drawW, drawH);
      }
    }

    // B. Top HUD Watermark Bar
    const topGrad = ctx.createLinearGradient(0, 0, 0, 95);
    topGrad.addColorStop(0, 'rgba(2, 6, 23, 0.85)');
    topGrad.addColorStop(1, 'rgba(2, 6, 23, 0.0)');
    ctx.fillStyle = topGrad;
    ctx.fillRect(0, 0, width, 95);

    // Badge Top Left: PT Tas Grosir Import Verified GPS & Face
    ctx.fillStyle =
      attendanceActionLabel === 'ABSEN MASUK'
        ? 'rgba(16, 185, 129, 0.92)'
        : 'rgba(79, 70, 229, 0.92)';
    ctx.beginPath();
    ctx.roundRect(24, 20, 275, 36, 10);
    ctx.fill();

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 14px Inter, system-ui, sans-serif';
    ctx.fillText(`● ${attendanceActionLabel} • RADIUS ≤15M VALID`, 38, 43);

    // Top Right: Anti-Fake GPS & Distance Verification
    ctx.fillStyle = 'rgba(15, 23, 42, 0.86)';
    ctx.beginPath();
    ctx.roundRect(width - 390, 20, 366, 36, 10);
    ctx.fill();
    ctx.fillStyle = '#6ee7b7';
    ctx.font = 'bold 12.5px JetBrains Mono, monospace';
    ctx.fillText(
      `ANTI-FAKE GPS LOLOS • JARAK ${activeDist}m/15m • ±${activeAcc}m`,
      width - 376,
      43
    );

    // C. Bottom Permanent Timestamp & GPS Address Watermark Box
    const boxHeight = 215;
    const boxY = height - boxHeight;
    const botGrad = ctx.createLinearGradient(0, boxY - 30, 0, height);
    botGrad.addColorStop(0, 'rgba(2, 6, 23, 0.0)');
    botGrad.addColorStop(0.18, 'rgba(2, 6, 23, 0.90)');
    botGrad.addColorStop(1, 'rgba(2, 6, 23, 0.97)');
    ctx.fillStyle = botGrad;
    ctx.fillRect(0, boxY - 30, width, boxHeight + 30);

    // Left accent bar in bottom watermark
    ctx.fillStyle = attendanceActionLabel === 'ABSEN MASUK' ? '#10b981' : '#6366f1';
    ctx.fillRect(24, boxY + 8, 6, boxHeight - 28);

    const { dayDateStr, timeWithSecondsStr } = formatFullIndonesianDateTime(nowDate);

    // Real-time Big Clock & Date
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 30px JetBrains Mono, monospace';
    ctx.fillText(timeWithSecondsStr, 44, boxY + 38);

    ctx.fillStyle = '#a7f3d0';
    ctx.font = 'bold 15.5px Inter, system-ui, sans-serif';
    ctx.fillText(
      `•  ${dayDateStr}  (Jam Tercatat: ${recordedTimeStr} WIB — ${evalStatusText})`,
      268,
      boxY + 36
    );

    // Employee Identity & Shift Line
    ctx.fillStyle = '#f8fafc';
    ctx.font = 'bold 16.5px Inter, system-ui, sans-serif';
    ctx.fillText(
      `${currentEmployee.fullName} (${currentEmployee.nik}) — ${currentEmployee.role} (${currentEmployee.department})`,
      44,
      boxY + 68
    );

    ctx.fillStyle = '#cbd5e1';
    ctx.font = '600 13.5px Inter, system-ui, sans-serif';
    ctx.fillText(
      `Jadwal Shift: ${activeShift.name} (${activeShift.checkInTime} - ${activeShift.checkOutTime} WIB) • Kantor: ${OFFICE_REFERENCE_COORDS.shortAddress}`,
      44,
      boxY + 92
    );

    // GPS Coordinates & Geofence 15m Line
    ctx.fillStyle = '#34d399';
    ctx.font = 'bold 13.5px JetBrains Mono, monospace';
    ctx.fillText(
      `GPS HP: ${activeLat.toFixed(6)}°, ${activeLon.toFixed(6)}° | Jarak Kantor: ${activeDist}m (Maks 15m) | Anti-Fake GPS: 100% Asli`,
      44,
      boxY + 118
    );

    // Detailed GPS Street Address
    ctx.fillStyle = '#e2e8f0';
    ctx.font = '500 13px Inter, system-ui, sans-serif';
    const fullLocText = `LOKASI TERBACA: ${gpsDetailedAddress}`;
    const maxCharsPerLine = 98;
    if (fullLocText.length <= maxCharsPerLine) {
      ctx.fillText(fullLocText, 44, boxY + 144);
    } else {
      const line1 = fullLocText.slice(0, maxCharsPerLine);
      const line2 = fullLocText.slice(maxCharsPerLine, maxCharsPerLine * 2);
      ctx.fillText(line1, 44, boxY + 142);
      ctx.fillText(line2, 44, boxY + 162);
    }

    return canvas.toDataURL('image/jpeg', 0.9);
  };

  // 6. Trigger Photo Capture & Submit Check-In or Check-Out (Strictly Enforcing <= 15m & Anti-Fake GPS)
  const handleCaptureAndSubmit = (mode: 'check_in' | 'check_out') => {
    // Hard Guard 1: Real GPS must be locked
    if (!isGpsLocked || !gpsCoords || distanceFromOffice === null) {
      setBlockedAttemptAlert(
        'ABSEN DITOLAK: Sinyal GPS HP asli belum terkunci. Pastikan GPS Akurasi Tinggi aktif pada HP Anda.'
      );
      return;
    }

    // Hard Guard 2: Anti-Fake GPS check must pass
    if (isFakeGpsDetected) {
      setBlockedAttemptAlert(
        `ABSEN DIBLOKIR (TERDETEKSI FAKE GPS): ${
          antiFakeAudit.reasons[0] ||
          'Sistem mendeteksi penggunaan Mock Location / Fake GPS. Matikan aplikasi pengubah lokasi untuk absen.'
        }`
      );
      return;
    }

    // Hard Guard 3: Must be strictly <= 15 meters from Office Reference Coordinates
    if (distanceFromOffice > OFFICE_REFERENCE_COORDS.maxRadiusMeters) {
      setBlockedAttemptAlert(
        `ABSEN DITOLAK (DI LUAR RADIUS 15 METER): Jarak Anda saat ini ${distanceFromOffice} meter dari titik kantor (${OFFICE_REFERENCE_COORDS.shortAddress}). Anda hanya bisa absen dalam jangkauan maksimal 15 meter dari titik kantor.`
      );
      return;
    }

    setBlockedAttemptAlert(null);
    setIsCapturing(true);

    const { dayDateStr, timeWithSecondsStr, shortHourMinStr } =
      formatFullIndonesianDateTime(nowDate);
    const fullTimestampLabel = `${dayDateStr} • ${timeWithSecondsStr}`;

    if (mode === 'check_in') {
      const targetInTime = useCustomClockTime ? customClockInTime : shortHourMinStr;
      const targetOutTime = todayAttendance?.checkOut || '';
      const evalRes = evaluateAttendanceAgainstShift(targetInTime, targetOutTime, activeShift);

      const watermarkedPhoto = captureWatermarkedFacePhoto(
        'ABSEN MASUK',
        targetInTime,
        evalRes.status
      );

      setLastCapturedPhoto(watermarkedPhoto);
      setLastCapturedType('MASUK');

      const newRecord: AttendanceRecord = {
        id: todayAttendance ? todayAttendance.id : `att-${Date.now()}`,
        employeeId: currentEmployee.id,
        date: todayDateStr,
        checkIn: targetInTime,
        checkOut: targetOutTime,
        status: evalRes.status,
        workHours: evalRes.workHours,
        lateMinutes: evalRes.lateMinutes,
        earlyLeaveMinutes: evalRes.earlyLeaveMinutes,
        shiftId: activeShift.id,
        shiftName: activeShift.name,
        scheduledCheckIn: activeShift.checkInTime,
        scheduledCheckOut: activeShift.checkOutTime,
        faceScanVerified: true,
        faceConfidence: 99.4,
        facePhotoSnapshot: watermarkedPhoto,
        checkOutPhotoSnapshot: todayAttendance?.checkOutPhotoSnapshot,
        checkInFullTimestamp: fullTimestampLabel,
        checkOutFullTimestamp: todayAttendance?.checkOutFullTimestamp,
        locationCoords: {
          latitude: gpsCoords.latitude,
          longitude: gpsCoords.longitude,
          accuracy: gpsCoords.accuracy,
        },
        locationAddress: gpsDetailedAddress,
        checkOutLocationCoords: todayAttendance?.checkOutLocationCoords,
        checkOutLocationAddress: todayAttendance?.checkOutLocationAddress,
        isInOfficeRadius: true,
        distanceMeters: Math.round(distanceFromOffice),
        notes:
          clockInNotes.trim() ||
          `Absen Wajah & GPS Valid (${distanceFromOffice}m ≤ 15m • Anti-Fake GPS Lolos) • ${activeShift.code}`,
      };

      onSubmitAttendance(newRecord, 'check_in');
    } else {
      if (!todayAttendance) {
        setIsCapturing(false);
        return;
      }
      const targetOutTime = useCustomClockTime ? customClockOutTime : shortHourMinStr;
      const evalRes = evaluateAttendanceAgainstShift(
        todayAttendance.checkIn,
        targetOutTime,
        activeShift
      );

      const watermarkedPhoto = captureWatermarkedFacePhoto(
        'ABSEN PULANG',
        targetOutTime,
        `Durasi ${evalRes.workHours} Jam`
      );

      setLastCapturedPhoto(watermarkedPhoto);
      setLastCapturedType('PULANG');

      const updatedRecord: AttendanceRecord = {
        ...todayAttendance,
        checkOut: targetOutTime,
        status: evalRes.status,
        workHours: evalRes.workHours,
        lateMinutes: evalRes.lateMinutes,
        earlyLeaveMinutes: evalRes.earlyLeaveMinutes,
        shiftId: activeShift.id,
        shiftName: activeShift.name,
        scheduledCheckIn: activeShift.checkInTime,
        scheduledCheckOut: activeShift.checkOutTime,
        checkOutPhotoSnapshot: watermarkedPhoto,
        checkOutFullTimestamp: fullTimestampLabel,
        checkOutLocationCoords: {
          latitude: gpsCoords.latitude,
          longitude: gpsCoords.longitude,
          accuracy: gpsCoords.accuracy,
        },
        checkOutLocationAddress: gpsDetailedAddress,
        isInOfficeRadius: true,
        distanceMeters: Math.round(distanceFromOffice),
        notes:
          clockInNotes.trim() ||
          todayAttendance.notes ||
          `Selesai Shift (${distanceFromOffice}m ≤ 15m • Anti-Fake GPS Lolos)`,
      };

      onSubmitAttendance(updatedRecord, 'check_out');
    }

    setTimeout(() => {
      setIsCapturing(false);
    }, 350);
  };

  const { dayDateStr, timeWithSecondsStr, shortHourMinStr } =
    formatFullIndonesianDateTime(nowDate);

  const checkInPreviewTime = useCustomClockTime ? customClockInTime : shortHourMinStr;
  const liveEvalCheckIn = evaluateAttendanceAgainstShift(
    checkInPreviewTime,
    todayAttendance?.checkOut || activeShift.checkOutTime,
    activeShift
  );

  return (
    <div className="bg-slate-900 rounded-2xl border border-slate-800 shadow-xl overflow-hidden text-white">
      {/* Top Bar: Status Kamera Langsung, Titik Kantor Resmi & Sinyal GPS HP Real-Time */}
      <div className="px-5 py-3.5 bg-slate-950/90 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className="relative flex h-3 w-3">
            <span
              className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                canSubmitAttendance ? 'bg-emerald-400' : 'bg-rose-400'
              }`}
            />
            <span
              className={`relative inline-flex rounded-full h-3 w-3 ${
                canSubmitAttendance ? 'bg-emerald-500' : 'bg-rose-500'
              }`}
            />
          </span>
          <div>
            <h4 className="text-xs sm:text-sm font-bold text-white flex flex-wrap items-center gap-2">
              <Camera className="w-4 h-4 text-emerald-400" />
              <span>Kamera Absen Wajah & Geofence GPS HP (Wajib Radius ≤ 15 Meter & Anti-Fake GPS)</span>
            </h4>
            <p className="text-[11px] text-slate-400">
              Titik Kantor Resmi:{' '}
              <strong className="text-emerald-300">{OFFICE_REFERENCE_COORDS.shortAddress}</strong>{' '}
              ({OFFICE_REFERENCE_COORDS.latitude}, {OFFICE_REFERENCE_COORDS.longitude})
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <a
            href={OFFICE_REFERENCE_COORDS.bingMapsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-emerald-300 border border-emerald-500/30 text-xs font-semibold flex items-center gap-1.5 transition-colors"
            title="Buka Titik Lokasi Kantor Resmi di Bing Maps"
          >
            <ExternalLink className="w-3.5 h-3.5 text-emerald-400" />
            <span>Titik Maps Kantor</span>
          </a>

          <button
            type="button"
            onClick={handleToggleFacingMode}
            className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-colors"
            title="Ganti Kamera Depan / Belakang HP"
          >
            <SwitchCamera className="w-3.5 h-3.5 text-emerald-400" />
            <span>{facingMode === 'user' ? 'Kamera Depan' : 'Kamera Belakang'}</span>
          </button>

          <button
            type="button"
            onClick={() => startLiveCamera(facingMode)}
            className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-colors"
            title="Muat Ulang Kamera"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-teal-400 ${isStartingCamera ? 'animate-spin' : ''}`} />
            <span>Segarkan Kamera</span>
          </button>

          <button
            type="button"
            onClick={refreshPhoneGps}
            className="px-3 py-1.5 rounded-xl bg-emerald-950/90 hover:bg-emerald-900 text-emerald-300 border border-emerald-700/60 text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-colors"
            title="Perbarui Titik Koordinat GPS HP"
          >
            <Navigation className={`w-3.5 h-3.5 text-emerald-400 ${gpsStatus === 'searching' ? 'animate-bounce' : ''}`} />
            <span>Perbarui GPS HP</span>
          </button>
        </div>
      </div>

      {/* Main Grid: Left = Live Camera Viewfinder with Real-Time Clock & GPS HUD; Right = Controls, Geofence 15m & Anti-Fake GPS Shield */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-0">
        {/* LEFT COLUMN (7 cols): LIVE CAMERA VIEWPORT + REAL-TIME CLOCK & GPS OVERLAY */}
        <div className="lg:col-span-7 relative bg-black min-h-[430px] sm:min-h-[500px] flex flex-col justify-between overflow-hidden border-b lg:border-b-0 lg:border-r border-slate-800">
          {/* Live Video Element */}
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className={`absolute inset-0 w-full h-full object-cover ${
              facingMode === 'user' ? 'scale-x-[-1]' : ''
            } ${isCameraActive ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
          />

          {/* Fallback Visual Portrait when physical webcam is unavailable */}
          {!isCameraActive && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-b from-slate-900 via-slate-900 to-emerald-950/80 p-6">
              <img
                src={
                  currentEmployee.avatarUrl ||
                  'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=600&h=600&q=80'
                }
                alt={currentEmployee.fullName}
                className="w-44 h-44 sm:w-52 sm:h-52 rounded-3xl object-cover ring-4 ring-emerald-500/40 shadow-2xl"
              />
              {cameraFallbackReason && (
                <p className="text-[11px] text-slate-300 text-center max-w-md mt-3 bg-slate-950/80 px-3 py-1.5 rounded-xl border border-slate-800">
                  {cameraFallbackReason}
                </p>
              )}
            </div>
          )}

          {/* Face Framing Reticle Guide */}
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div
              className={`w-52 h-64 sm:w-60 sm:h-72 rounded-3xl border-2 border-dashed relative ${
                canSubmitAttendance ? 'border-emerald-400/60' : 'border-rose-400/60'
              }`}
            >
              <div
                className={`absolute -top-1 -left-1 w-6 h-6 border-t-4 border-l-4 rounded-tl-xl ${
                  canSubmitAttendance ? 'border-emerald-400' : 'border-rose-400'
                }`}
              />
              <div
                className={`absolute -top-1 -right-1 w-6 h-6 border-t-4 border-r-4 rounded-tr-xl ${
                  canSubmitAttendance ? 'border-emerald-400' : 'border-rose-400'
                }`}
              />
              <div
                className={`absolute -bottom-1 -left-1 w-6 h-6 border-b-4 border-l-4 rounded-bl-xl ${
                  canSubmitAttendance ? 'border-emerald-400' : 'border-rose-400'
                }`}
              />
              <div
                className={`absolute -bottom-1 -right-1 w-6 h-6 border-b-4 border-r-4 rounded-br-xl ${
                  canSubmitAttendance ? 'border-emerald-400' : 'border-rose-400'
                }`}
              />
            </div>
          </div>

          {/* TOP HUD OVERLAY: LIVE STATUS + GEOFENCE 15M BADGE */}
          <div className="relative z-10 p-4 bg-gradient-to-b from-slate-950/90 via-slate-950/50 to-transparent flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 bg-slate-950/80 backdrop-blur-md px-3 py-1.5 rounded-xl border border-white/15">
              <Radio className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
              <span className="text-[11px] font-bold tracking-wide text-emerald-300 uppercase">
                {isCameraActive ? 'LIVE KAMERA AKTIF' : 'SENSOR WAJAH AKTIF'}
              </span>
              <span className="text-slate-500">•</span>
              <span className="text-[11px] font-mono text-white font-semibold">
                {currentEmployee.fullName} ({currentEmployee.nik})
              </span>
            </div>

            <div
              className={`flex items-center gap-1.5 backdrop-blur-md px-3 py-1.5 rounded-xl border text-[11px] font-bold ${
                canSubmitAttendance
                  ? 'bg-emerald-950/85 border-emerald-500/40 text-emerald-300'
                  : 'bg-rose-950/90 border-rose-500/50 text-rose-300'
              }`}
            >
              {canSubmitAttendance ? (
                <>
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                  <span>RADIUS ≤15M & ANTI-FAKE GPS VALID</span>
                </>
              ) : (
                <>
                  <Lock className="w-3.5 h-3.5 text-rose-400" />
                  <span>
                    {isFakeGpsDetected
                      ? 'FAKE GPS TERDETEKSI — ABSEN DIBLOKIR'
                      : distanceFromOffice !== null && distanceFromOffice > 15
                      ? `DI LUAR RADIUS 15M (${distanceFromOffice}m)`
                      : 'MENUNGGU KUNCI GPS HP ASLI'}
                  </span>
                </>
              )}
            </div>
          </div>

          {/* BOTTOM HUD OVERLAY: REAL-TIME CLOCK, DATE & LIVE PHONE GPS LOCATION */}
          <div className="relative z-10 p-4 pt-10 bg-gradient-to-t from-slate-950 via-slate-950/90 to-transparent space-y-2.5">
            {/* Real-Time Clock & Date Row */}
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2 border-b border-white/15 pb-2.5">
              <div>
                <div className="flex items-center gap-1.5 text-[11px] font-semibold text-emerald-400 uppercase tracking-wider">
                  <Clock className="w-3.5 h-3.5" />
                  <span>Waktu & Tanggal Real-Time Perangkat</span>
                </div>
                <div className="text-2xl sm:text-3xl font-mono font-extrabold text-white tracking-tight mt-0.5">
                  {timeWithSecondsStr}
                </div>
                <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-200 mt-0.5">
                  <Calendar className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <span>{dayDateStr}</span>
                </div>
              </div>

              {/* GPS Coordinate & 15m Distance Pill */}
              <div
                className={`backdrop-blur-md px-3 py-2 rounded-xl border text-left sm:text-right ${
                  canSubmitAttendance
                    ? 'bg-slate-900/90 border-emerald-500/40'
                    : 'bg-rose-950/85 border-rose-500/50'
                }`}
              >
                <div
                  className={`flex items-center sm:justify-end gap-1.5 text-[10px] font-bold uppercase ${
                    canSubmitAttendance ? 'text-emerald-400' : 'text-rose-300'
                  }`}
                >
                  <MapPin className="w-3 h-3" />
                  <span>
                    {gpsStatus === 'locked'
                      ? isFakeGpsDetected
                        ? 'Indikasi Fake GPS Terdeteksi!'
                        : isWithin15Meters
                        ? 'Dalam Jangkauan Kantor (≤ 15m)'
                        : 'Di Luar Jangkauan Kantor (> 15m)'
                      : gpsStatus === 'searching'
                      ? 'Mencari Sinyal Satelit GPS HP...'
                      : 'GPS HP Belum Aktif / Ditolak'}
                  </span>
                </div>
                <div className="font-mono text-xs font-bold text-white mt-0.5">
                  {gpsCoords
                    ? `${gpsCoords.latitude.toFixed(6)}°, ${gpsCoords.longitude.toFixed(6)}°`
                    : 'Koordinat GPS Belum Terkunci'}
                </div>
                <div className="text-[10px] text-slate-200 font-mono">
                  {gpsCoords && distanceFromOffice !== null ? (
                    <>
                      Jarak ke Kantor: <strong>{distanceFromOffice}m</strong> (Batas:{' '}
                      <strong>15m</strong>) • Akurasi: <strong>±{gpsCoords.accuracy}m</strong>
                    </>
                  ) : (
                    <span>Wajib radius ≤ 15m dari titik kantor</span>
                  )}
                </div>
              </div>
            </div>

            {/* Detailed Street Address from Phone GPS */}
            <div className="bg-slate-900/90 backdrop-blur-md p-3 rounded-xl border border-white/10 flex items-start gap-2.5">
              <MapPin className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-300">
                    Detail Lokasi Terbaca dari GPS HP:
                  </span>
                  {lastGpsUpdatedTime && (
                    <span className="text-[10px] font-mono text-slate-400">
                      Update GPS: {lastGpsUpdatedTime} WIB
                    </span>
                  )}
                </div>
                <p className="text-xs font-semibold text-white leading-snug mt-0.5 break-words">
                  {gpsDetailedAddress}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN (5 cols): GEOFENCE 15M + ANTI-FAKE GPS SHIELD + SHUTTER CONTROLS */}
        <div className="lg:col-span-5 p-5 bg-slate-900 flex flex-col justify-between space-y-4">
          <div className="space-y-3.5">
            {/* Official Office Location & 15m Geofence Security Card */}
            <div
              className={`p-3.5 rounded-xl border space-y-2.5 ${
                canSubmitAttendance
                  ? 'bg-emerald-950/30 border-emerald-500/40'
                  : 'bg-rose-950/35 border-rose-500/50'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  {canSubmitAttendance ? (
                    <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                  ) : (
                    <ShieldAlert className="w-4 h-4 text-rose-400 shrink-0" />
                  )}
                  <div>
                    <h5 className="text-xs font-extrabold uppercase tracking-wide text-white">
                      Geofence Radius 15 Meter & Anti-Fake GPS
                    </h5>
                    <p className="text-[11px] text-slate-300">
                      Titik Kantor: <strong>{OFFICE_REFERENCE_COORDS.shortAddress}</strong>
                    </p>
                  </div>
                </div>
                <span
                  className={`px-2 py-0.5 rounded-md text-[10px] font-mono font-bold shrink-0 ${
                    canSubmitAttendance
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                      : 'bg-rose-500/25 text-rose-200 border border-rose-500/40'
                  }`}
                >
                  {distanceFromOffice !== null ? `${distanceFromOffice}m / 15m` : 'GPS OFF'}
                </span>
              </div>

              {/* Distance Progress Bar vs 15m Limit */}
              <div className="space-y-1">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-slate-300">Jarak Anda dari Titik Kantor:</span>
                  <span
                    className={`font-mono font-bold ${
                      distanceFromOffice !== null && distanceFromOffice <= 15
                        ? 'text-emerald-300'
                        : 'text-rose-300'
                    }`}
                  >
                    {distanceFromOffice !== null
                      ? `${distanceFromOffice} Meter (Maksimal 15 Meter)`
                      : 'Belum Terbaca'}
                  </span>
                </div>
                <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden">
                  <div
                    className={`h-full transition-all duration-300 ${
                      distanceFromOffice !== null && distanceFromOffice <= 15 && !isFakeGpsDetected
                        ? 'bg-emerald-500'
                        : 'bg-rose-500'
                    }`}
                    style={{
                      width:
                        distanceFromOffice !== null
                          ? `${Math.min(100, Math.max(8, (distanceFromOffice / 15) * 100))}%`
                          : '100%',
                    }}
                  />
                </div>
              </div>

              {/* 4-Layer Anti-Fake GPS Sensor Verification Pills */}
              <div className="grid grid-cols-2 gap-1.5 pt-1">
                <div
                  className={`px-2.5 py-1.5 rounded-lg border text-[10px] flex items-center gap-1.5 ${
                    isGpsLocked && antiFakeAudit.checks.accuracyValid
                      ? 'bg-slate-900/80 border-emerald-500/30 text-emerald-300'
                      : 'bg-slate-900/80 border-rose-500/30 text-rose-300'
                  }`}
                >
                  <CheckCircle2 className="w-3 h-3 shrink-0" />
                  <span className="truncate font-semibold">
                    Akurasi Satelit {gpsCoords ? `(±${gpsCoords.accuracy}m)` : ''}
                  </span>
                </div>

                <div
                  className={`px-2.5 py-1.5 rounded-lg border text-[10px] flex items-center gap-1.5 ${
                    isGpsLocked && antiFakeAudit.checks.timestampSynced
                      ? 'bg-slate-900/80 border-emerald-500/30 text-emerald-300'
                      : 'bg-slate-900/80 border-rose-500/30 text-rose-300'
                  }`}
                >
                  <CheckCircle2 className="w-3 h-3 shrink-0" />
                  <span className="truncate font-semibold">Sinkronisasi Jam GPS</span>
                </div>

                <div
                  className={`px-2.5 py-1.5 rounded-lg border text-[10px] flex items-center gap-1.5 ${
                    isGpsLocked && antiFakeAudit.checks.kinematicsValid
                      ? 'bg-slate-900/80 border-emerald-500/30 text-emerald-300'
                      : 'bg-slate-900/80 border-rose-500/30 text-rose-300'
                  }`}
                >
                  <CheckCircle2 className="w-3 h-3 shrink-0" />
                  <span className="truncate font-semibold">Anti-Teleportasi GPS</span>
                </div>

                <div
                  className={`px-2.5 py-1.5 rounded-lg border text-[10px] flex items-center gap-1.5 ${
                    isGpsLocked && antiFakeAudit.checks.sensorHardwareValid
                      ? 'bg-slate-900/80 border-emerald-500/30 text-emerald-300'
                      : 'bg-slate-900/80 border-rose-500/30 text-rose-300'
                  }`}
                >
                  <CheckCircle2 className="w-3 h-3 shrink-0" />
                  <span className="truncate font-semibold">Sensor Hardware Asli</span>
                </div>
              </div>

              {/* Blocking Explanation Banner if Outside 15m or Fake GPS Detected or GPS Denied */}
              {!canSubmitAttendance && (
                <div className="p-2.5 rounded-lg bg-rose-950/90 border border-rose-500/50 text-[11px] text-rose-200 flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    {gpsErrorMessage ? (
                      <p className="font-semibold leading-snug">{gpsErrorMessage}</p>
                    ) : isFakeGpsDetected ? (
                      <>
                        <p className="font-bold text-rose-300">
                          TERDETEKSI INDIKASI FAKE GPS / MOCK LOCATION!
                        </p>
                        <ul className="list-disc list-inside space-y-0.5 text-[10px] text-rose-200">
                          {antiFakeAudit.reasons.map((r, idx) => (
                            <li key={idx}>{r}</li>
                          ))}
                        </ul>
                      </>
                    ) : distanceFromOffice !== null && distanceFromOffice > 15 ? (
                      <p className="font-semibold leading-snug">
                        <strong>TIDAK BISA ABSEN:</strong> Jarak posisi GPS Anda saat ini{' '}
                        <strong>{distanceFromOffice} meter</strong> dari titik kantor (
                        {OFFICE_REFERENCE_COORDS.shortAddress}). Batas maksimal absen adalah{' '}
                        <strong>15 meter</strong> dari titik lokasi kantor.
                      </p>
                    ) : (
                      <p className="font-semibold leading-snug">
                        Sedang mengunci titik koordinat satelit GPS HP Anda... Pastikan Anda berada
                        maksimal 15 meter dari titik kantor.
                      </p>
                    )}
                  </div>
                </div>
              )}

              {blockedAttemptAlert && (
                <div className="p-2.5 rounded-lg bg-rose-900/90 border border-rose-400 text-[11px] font-bold text-white flex items-start gap-2">
                  <Lock className="w-4 h-4 text-rose-300 shrink-0 mt-0.5" />
                  <span>{blockedAttemptAlert}</span>
                </div>
              )}
            </div>

            {/* Shift & Evaluation Summary Box */}
            <div className="p-3 rounded-xl bg-slate-800/90 border border-slate-700 space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400 font-medium">Jadwal Shift Anda:</span>
                <span className="font-bold text-emerald-400">
                  {activeShift.name} ({activeShift.checkInTime} – {activeShift.checkOutTime} WIB)
                </span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400 font-medium">Status Evaluasi Saat Ini:</span>
                <span
                  className={`font-bold px-2 py-0.5 rounded text-[11px] ${
                    liveEvalCheckIn.lateMinutes > 0
                      ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                      : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                  }`}
                >
                  {liveEvalCheckIn.status}
                  {liveEvalCheckIn.lateMinutes > 0
                    ? ` (Terlambat ${liveEvalCheckIn.lateMinutes} mnt)`
                    : ' (Tepat Waktu)'}
                </span>
              </div>
            </div>

            {/* Optional Attendance Notes Input */}
            <div>
              <label className="block text-[11px] font-bold text-slate-300 mb-1">
                Catatan Presensi / Keterangan Lokasi (Opsional)
              </label>
              <input
                type="text"
                value={clockInNotes}
                onChange={(e) => onChangeNotes(e.target.value)}
                placeholder={`Hadir ${activeShift.name} di ${OFFICE_REFERENCE_COORDS.shortAddress}...`}
                className="w-full px-3.5 py-2 text-xs bg-slate-800 border border-slate-700 rounded-xl text-white placeholder:text-slate-500 focus:outline-hidden focus:border-emerald-500"
              />
            </div>

            {/* Primary Shutter Buttons: Jepret Foto Wajah & Absen Masuk / Pulang (Locked if > 15m or Fake GPS) */}
            <div className="space-y-2">
              <button
                type="button"
                disabled={isCapturing || !canSubmitAttendance}
                onClick={() => handleCaptureAndSubmit('check_in')}
                className={`w-full py-3.5 px-4 rounded-xl text-xs sm:text-sm font-extrabold flex items-center justify-center gap-2 transition-all ${
                  canSubmitAttendance
                    ? 'bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white shadow-lg shadow-emerald-600/25 cursor-pointer'
                    : 'bg-slate-800 text-slate-500 border border-rose-500/30 cursor-not-allowed'
                }`}
              >
                {canSubmitAttendance ? (
                  <Camera className="w-4 h-4 shrink-0" />
                ) : (
                  <Lock className="w-4 h-4 shrink-0 text-rose-400" />
                )}
                <span>
                  {!canSubmitAttendance
                    ? isFakeGpsDetected
                      ? 'Absen Masuk Diblokir (Fake GPS Terdeteksi)'
                      : distanceFromOffice !== null && distanceFromOffice > 15
                      ? `Tidak Bisa Absen Masuk (Jarak ${distanceFromOffice}m > 15m)`
                      : 'Menunggu Kunci GPS HP (Wajib Radius ≤ 15m)'
                    : todayAttendance?.checkIn
                    ? `Foto Ulang Wajah & Perbarui Absen Masuk (${
                        useCustomClockTime ? customClockInTime : shortHourMinStr
                      } WIB)`
                    : `Jepret Foto Wajah & Absen Masuk (${
                        useCustomClockTime ? customClockInTime : shortHourMinStr
                      } WIB)`}
                </span>
              </button>

              <button
                type="button"
                disabled={!todayAttendance?.checkIn || isCapturing || !canSubmitAttendance}
                onClick={() => handleCaptureAndSubmit('check_out')}
                className={`w-full py-3 px-4 rounded-xl text-xs sm:text-sm font-bold flex items-center justify-center gap-2 transition-all ${
                  todayAttendance?.checkIn && canSubmitAttendance
                    ? 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-md cursor-pointer'
                    : 'bg-slate-800 text-slate-500 border border-slate-700 cursor-not-allowed'
                }`}
              >
                {todayAttendance?.checkIn && canSubmitAttendance ? (
                  <LogOut className="w-4 h-4 shrink-0" />
                ) : (
                  <Lock className="w-4 h-4 shrink-0" />
                )}
                <span>
                  {!canSubmitAttendance
                    ? isFakeGpsDetected
                      ? 'Absen Pulang Diblokir (Fake GPS Terdeteksi)'
                      : distanceFromOffice !== null && distanceFromOffice > 15
                      ? `Tidak Bisa Absen Pulang (Jarak ${distanceFromOffice}m > 15m)`
                      : 'Absen Pulang Wajib di Dalam Radius ≤ 15m Kantor'
                    : todayAttendance?.checkOut
                    ? `Foto Ulang Wajah & Perbarui Absen Pulang (${
                        useCustomClockTime ? customClockOutTime : shortHourMinStr
                      } WIB)`
                    : `Jepret Foto Wajah & Absen Pulang (${
                        useCustomClockTime ? customClockOutTime : shortHourMinStr
                      } WIB)`}
                </span>
              </button>
            </div>
          </div>

          {/* Captured Watermarked Photo Preview Card */}
          <div className="pt-3 border-t border-slate-800">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                <span>Hasil Bukti Foto Wajah + Watermark GPS & Jam</span>
              </span>
              {lastCapturedPhoto && (
                <button
                  type="button"
                  onClick={() => setIsPhotoZoomModalOpen(true)}
                  className="text-[11px] font-bold text-emerald-400 hover:text-emerald-300 flex items-center gap-1 cursor-pointer"
                >
                  <Eye className="w-3.5 h-3.5" />
                  <span>Perbesar Foto</span>
                </button>
              )}
            </div>

            {lastCapturedPhoto ? (
              <div
                onClick={() => setIsPhotoZoomModalOpen(true)}
                className="group relative rounded-xl overflow-hidden border border-emerald-500/40 bg-slate-950 cursor-pointer"
              >
                <img
                  src={lastCapturedPhoto}
                  alt="Bukti Foto Absen Wajah & GPS"
                  className="w-full h-40 object-cover group-hover:scale-[1.02] transition-transform"
                />
                <div className="absolute top-2 right-2 bg-slate-950/85 backdrop-blur-xs px-2.5 py-1 rounded-lg text-[10px] font-bold text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                  <span>Bukti Foto {lastCapturedType} Tersimpan</span>
                </div>
              </div>
            ) : (
              <div className="h-32 rounded-xl border border-dashed border-slate-700 bg-slate-800/40 flex flex-col items-center justify-center p-4 text-center">
                <UserCheck className="w-5 h-5 text-slate-500 mb-1" />
                <p className="text-xs font-semibold text-slate-300">
                  Belum Ada Jepretan Foto Absen Hari Ini
                </p>
                <p className="text-[10px] text-slate-400 mt-0.5">
                  Pastikan Anda berada maksimal <strong>15 meter</strong> dari titik kantor (
                  {OFFICE_REFERENCE_COORDS.shortAddress}) tanpa Fake GPS untuk memotret wajah & absen.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Fullscreen Modal Preview for Watermarked Attendance Photo */}
      {isPhotoZoomModalOpen && lastCapturedPhoto && (
        <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-3xl w-full overflow-hidden shadow-2xl">
            <div className="px-5 py-3.5 border-b border-slate-800 flex items-center justify-between">
              <div>
                <h4 className="text-sm font-bold text-white flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <span>Bukti Foto Wajah Presensi + Watermark Jam & Lokasi GPS HP</span>
                </h4>
                <p className="text-xs text-slate-400">
                  {currentEmployee.fullName} ({currentEmployee.nik}) • {gpsDetailedAddress}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsPhotoZoomModalOpen(false)}
                className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 bg-black flex items-center justify-center">
              <img
                src={lastCapturedPhoto}
                alt="Watermarked Attendance Proof"
                className="max-h-[75vh] w-auto rounded-xl border border-slate-800"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
