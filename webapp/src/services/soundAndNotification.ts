import { AlertEvent } from '../shared/gascheckCore';

class SoundAndNotificationService {
  private audioCtx: AudioContext | null = null;
  private soundEnabled = true;
  private browserNotificationsEnabled = false;
  private lastPlayedAlertId: string | null = null;

  constructor() {
    try {
      const savedSound = localStorage.getItem('gascheck_sound_enabled');
      if (savedSound !== null) {
        this.soundEnabled = savedSound === 'true';
      }
      const savedNotif = localStorage.getItem('gascheck_browser_notif_enabled');
      if (savedNotif !== null) {
        this.browserNotificationsEnabled = savedNotif === 'true';
      }
    } catch {
      // Ignore storage access errors
    }
  }

  public isSoundEnabled(): boolean {
    return this.soundEnabled;
  }

  public setSoundEnabled(enabled: boolean): void {
    this.soundEnabled = enabled;
    try {
      localStorage.setItem('gascheck_sound_enabled', String(enabled));
    } catch {
      // Ignore
    }
  }

  public isBrowserNotificationsEnabled(): boolean {
    return this.browserNotificationsEnabled;
  }

  public setBrowserNotificationsEnabled(enabled: boolean): void {
    this.browserNotificationsEnabled = enabled;
    try {
      localStorage.setItem('gascheck_browser_notif_enabled', String(enabled));
    } catch {
      // Ignore
    }
  }

  public getPermissionStatus(): NotificationPermission | 'unsupported' {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      return 'unsupported';
    }
    return Notification.permission;
  }

  public async requestBrowserPermission(): Promise<NotificationPermission | 'unsupported'> {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      return 'unsupported';
    }
    try {
      const permission = await Notification.requestPermission();
      if (permission === 'granted') {
        this.setBrowserNotificationsEnabled(true);
      }
      return permission;
    } catch {
      return Notification.permission;
    }
  }

  public playAlarmTone(type: 'CRITICAL' | 'WARNING' | 'TEST'): void {
    if (!this.soundEnabled && type !== 'TEST') return;
    if (typeof window === 'undefined') return;

    try {
      const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioContextClass) return;

      if (!this.audioCtx) {
        this.audioCtx = new AudioContextClass();
      }
      if (this.audioCtx.state === 'suspended') {
        this.audioCtx.resume();
      }

      const now = this.audioCtx.currentTime;
      const osc = this.audioCtx.createOscillator();
      const gain = this.audioCtx.createGain();

      osc.connect(gain);
      gain.connect(this.audioCtx.destination);

      if (type === 'CRITICAL') {
        // Urgent dual-pulse alarm beep (880Hz -> 1174Hz -> 880Hz)
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(880, now);
        osc.frequency.setValueAtTime(1174, now + 0.18);
        osc.frequency.setValueAtTime(880, now + 0.36);
        osc.frequency.setValueAtTime(1174, now + 0.54);

        gain.gain.setValueAtTime(0.18, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.75);
        osc.start(now);
        osc.stop(now + 0.76);
      } else if (type === 'WARNING') {
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(587.33, now);
        osc.frequency.setValueAtTime(783.99, now + 0.15);
        gain.gain.setValueAtTime(0.14, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
        osc.start(now);
        osc.stop(now + 0.42);
      } else {
        // TEST tone
        osc.type = 'sine';
        osc.frequency.setValueAtTime(523.25, now);
        osc.frequency.setValueAtTime(659.25, now + 0.12);
        osc.frequency.setValueAtTime(783.99, now + 0.24);
        gain.gain.setValueAtTime(0.15, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);
        osc.start(now);
        osc.stop(now + 0.46);
      }
    } catch {
      // Browser blocked autoplay before user gesture
    }
  }

  public notifyNewAlert(alert: AlertEvent): void {
    if (this.lastPlayedAlertId === alert.id) {
      return;
    }
    this.lastPlayedAlertId = alert.id;

    if (alert.severity === 'CRITICAL' || alert.severity === 'FAULT') {
      this.playAlarmTone('CRITICAL');
    } else if (alert.severity === 'WARNING') {
      this.playAlarmTone('WARNING');
    }

    if (
      this.browserNotificationsEnabled &&
      this.getPermissionStatus() === 'granted'
    ) {
      try {
        const prefix = alert.isSimulation ? '[SIMULATION] ' : '';
        new Notification(`${prefix}${alert.title}`, {
          body: `${alert.message} (MQ2: ${alert.gasRawAtTrigger} ADC)`,
          tag: alert.eventCode,
        });
      } catch {
        // Ignore notification constructor failure in restricted iframe
      }
    }
  }

  public sendTestNotification(): { sentBrowser: boolean; playedSound: boolean; messageVi: string } {
    this.playAlarmTone('TEST');
    const perm = this.getPermissionStatus();
    if (perm === 'granted') {
      try {
        new Notification('[GasCheck Test] Kiểm tra hệ thống thông báo', {
          body: 'Thông báo trình duyệt và âm thanh cảnh báo hoạt động bình thường.',
          tag: 'gascheck-test',
        });
        return {
          sentBrowser: true,
          playedSound: true,
          messageVi: 'Đã phát âm thanh kiểm tra và gửi Browser Notification thành công.',
        };
      } catch {
        return {
          sentBrowser: false,
          playedSound: true,
          messageVi: 'Đã phát âm thanh kiểm tra (Trình duyệt hạn chế cửa sổ thông báo nổi trong khung xem trước).',
        };
      }
    }
    return {
      sentBrowser: false,
      playedSound: true,
      messageVi: 'Đã phát âm thanh kiểm tra. Hãy cấp quyền Browser Notification nếu muốn nhận thông báo khi chuyển tab.',
    };
  }
}

export const soundAndNotificationService = new SoundAndNotificationService();
