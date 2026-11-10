import AsyncStorage from '@react-native-async-storage/async-storage';
import type { User } from '@react-native-google-signin/google-signin';
import * as Crypto from 'expo-crypto';
import React, { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { AppState, Linking } from 'react-native';
import config from '../../app.json';
import { packWorkspaceBackup } from '../backupFiles';
import { formatDate, riyadhNow } from '../domain/dates';
import { unpackBackup } from '../domain/backup';
import type { Workspace } from '../domain/types';
import { useStore } from '../store';
import { Button, Card, Checkbox, Row, SectionTitle, Spread, Sub, T } from '../ui/kit';
import { downloadDriveBackup, DRIVE_SCOPE, listDriveBackups, uploadDriveBackup, type DriveFile } from './api';
import type { DriveBackupCardProps } from './DriveBackup';

const CLIENT_ID = config.expo.extra.googleIosClientId;
const CONFIGURED = /^[0-9]+-[A-Za-z0-9_-]+\.apps\.googleusercontent\.com$/.test(CLIENT_ID);
const DEVICE_KEY = 'maydan-drive-device-v1';
const SETTINGS_PREFIX = 'maydan-drive-account-v1-';
const MIN_INTERVAL = 10 * 60_000;

let sdkPromise: Promise<typeof import('@react-native-google-signin/google-signin')> | undefined;
function getSdk() {
  sdkPromise ??= import('@react-native-google-signin/google-signin').then((sdk) => {
    sdk.GoogleSignin.configure({ iosClientId: CLIENT_ID, scopes: [DRIVE_SCOPE] });
    return sdk;
  });
  return sdkPromise;
}

type BackupSettings = { automatic: boolean; lastSaved: number; digest: string };
type Session = { user: User['user']; device: string; settings: BackupSettings };
const DEFAULT: BackupSettings = { automatic: false, lastSaved: 0, digest: '' };

async function openSession(user: User['user']): Promise<Session> {
  let device = await AsyncStorage.getItem(DEVICE_KEY);
  if (!device) {
    device = Crypto.randomUUID();
    await AsyncStorage.setItem(DEVICE_KEY, device);
  }
  const raw = await AsyncStorage.getItem(SETTINGS_PREFIX + user.id);
  let settings = DEFAULT;
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as Partial<BackupSettings>;
      if (typeof parsed.automatic === 'boolean' && typeof parsed.lastSaved === 'number' && typeof parsed.digest === 'string') settings = { automatic: parsed.automatic, lastSaved: parsed.lastSaved, digest: parsed.digest };
    } catch {
      // A corrupt preference never enables automatic uploads.
    }
  }
  return { user, device, settings };
}

type Controller = {
  session: Session | null;
  busy: boolean;
  status: string | null;
  files: DriveFile[] | null;
  connect: () => void;
  disconnect: () => void;
  toggle: (automatic: boolean) => void;
  save: () => void;
  refresh: () => void;
  restore: (file: DriveFile, done: DriveBackupCardProps['onRestore']) => void;
};
const DriveContext = createContext<Controller | null>(null);

export function DriveBackupProvider({ children }: { children: ReactNode }) {
  const { ws, mode, ready } = useStore();
  const [session, setSession] = useState<Session | null>(null);
  const [files, setFiles] = useState<DriveFile[] | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(CONFIGURED);
  const [active, setActive] = useState(AppState.currentState === 'active');
  const inFlight = useRef(false);
  const lastAttempt = useRef(0);
  const backedUp = useRef<{ account: string; workspace: Workspace } | null>(null);

  const run = useCallback(async (action: () => Promise<void>) => {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setStatus(null);
    try { await action(); }
    catch (error) { setStatus(error instanceof Error && /[\u0600-\u06ff]/.test(error.message) ? error.message : 'تعذرت العملية. تأكد من اتصالك ومن إذن Google Drive.'); }
    finally { inFlight.current = false; setBusy(false); }
  }, []);

  useEffect(() => {
    if (!CONFIGURED) return;
    const listener = AppState.addEventListener('change', (state) => setActive(state === 'active'));
    let cancelled = false;
    void getSdk().then(async ({ GoogleSignin }) => {
      if (cancelled || !GoogleSignin.hasPreviousSignIn()) return;
      const previous = await GoogleSignin.signInSilently();
      if (previous.type !== 'success' || !previous.data.scopes.includes(DRIVE_SCOPE)) return;
      const restored = await openSession(previous.data.user);
      if (!cancelled) setSession(restored);
    }).catch(() => {
      if (!cancelled) setStatus('اربط حسابك مع Google Drive من جديد.');
    }).finally(() => {
      if (!cancelled) setBusy(false);
    });
    return () => { cancelled = true; listener.remove(); };
  }, []);

  const update = useCallback(async (current: Session, settings: BackupSettings) => {
    await AsyncStorage.setItem(SETTINGS_PREFIX + current.user.id, JSON.stringify(settings));
    setSession({ ...current, settings });
  }, []);

  const tokenFor = useCallback(async (current: Session) => {
    const { GoogleSignin } = await getSdk();
    const signedIn = GoogleSignin.getCurrentUser();
    if (signedIn?.user.id !== current.user.id || !signedIn.scopes.includes(DRIVE_SCOPE)) throw new Error('اربط حسابك مع Google Drive من جديد.');
    return (await GoogleSignin.getTokens()).accessToken;
  }, []);

  const saveBackup = useCallback(async (current: Session, automatic: boolean) => {
    const digest = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, JSON.stringify(ws));
    if (automatic && digest === current.settings.digest) {
      backedUp.current = { account: current.user.id, workspace: ws };
      return;
    }
    const token = await tokenFor(current);
    const archive = await packWorkspaceBackup(ws);
    const uploaded = await uploadDriveBackup(token, current.device, archive);
    await update(current, { ...current.settings, digest, lastSaved: Date.now() });
    backedUp.current = { account: current.user.id, workspace: ws };
    setFiles((old) => old ? [uploaded, ...old.filter((item) => item.id !== uploaded.id)].slice(0, 20) : null);
    setStatus('تم حفظ نسخة العمل والصور في Google Drive.');
  }, [tokenFor, update, ws]);

  useEffect(() => {
    if (!CONFIGURED || !active || !ready || mode !== 'live' || busy || !session?.settings.automatic) return;
    if (backedUp.current?.account === session.user.id && backedUp.current.workspace === ws) return;
    const delay = Math.max(5000, Math.max(lastAttempt.current, session.settings.lastSaved) + MIN_INTERVAL - Date.now());
    const timer = setTimeout(() => {
      lastAttempt.current = Date.now();
      void run(() => saveBackup(session, true));
    }, delay);
    return () => clearTimeout(timer);
  }, [active, busy, mode, ready, run, saveBackup, session, ws]);

  if (!CONFIGURED) return children;
  const actions: Controller = {
    session, files, busy, status,
    connect: () => { void run(async () => {
      const { GoogleSignin } = await getSdk();
      const result = await GoogleSignin.signIn();
      if (result.type !== 'success') return;
      if (!result.data.scopes.includes(DRIVE_SCOPE)) throw new Error('اسمح لميدان بحفظ ملفاته في Google Drive.');
      setFiles(null);
      setSession(await openSession(result.data.user));
    }); },
    disconnect: () => { if (session) void run(async () => {
      await update(session, { ...session.settings, automatic: false });
      const { GoogleSignin } = await getSdk();
      await GoogleSignin.signOut();
      backedUp.current = null;
      lastAttempt.current = 0;
      setSession(null);
      setFiles(null);
    }); },
    toggle: (automatic) => { if (session) void run(() => update(session, { ...session.settings, automatic })); },
    save: () => { if (session && ready && mode === 'live') void run(() => saveBackup(session, false)); },
    refresh: () => { if (session) void run(async () => setFiles(await listDriveBackups(await tokenFor(session)))); },
    restore: (file, done) => { if (session && ready && mode === 'live') void run(async () => {
      const archive = await downloadDriveBackup(await tokenFor(session), file);
      done(unpackBackup(archive));
    }); },
  };
  return <DriveContext.Provider value={actions}>{children}</DriveContext.Provider>;
}

export function DriveBackupCard({ onRestore }: DriveBackupCardProps) {
  const drive = useContext(DriveContext);
  if (!drive) return null;
  return (
    <>
      <SectionTitle title="Google Drive" sub="احفظ بيانات العمل والصور في حسابك، واسترجعها على جهاز آخر." />
      <Card>
        {drive.session ? (
          <>
            <T style={{ fontWeight: '700' }}>{drive.session.user.email}</T>
            <Checkbox label="حفظ تلقائي أثناء استخدام ميدان" checked={drive.session.settings.automatic} disabled={drive.busy} onChange={drive.toggle} />
            <Sub>تُحدّث نسخة هذا الجهاز عند تغير بيانات العمل. الاستعادة من جهاز آخر تكون باختيار نسخة وتأكيدها.</Sub>
            {drive.session.settings.lastSaved ? <Sub>{'آخر حفظ · ' + formatDate(riyadhNow(new Date(drive.session.settings.lastSaved)).date, { year: true })}</Sub> : null}
            <Row gap={8} style={{ marginTop: 8, flexWrap: 'wrap' }}>
              <Button small label="احفظ الآن" icon="upload" disabled={drive.busy} onPress={drive.save} />
              <Button small variant="secondary" label="عرض النسخ" icon="cloud" disabled={drive.busy} onPress={drive.refresh} />
              <Button small variant="ghost" label="فتح Drive" onPress={() => { void Linking.openURL('https://drive.google.com/drive/my-drive').catch(() => {}); }} />
            </Row>
            {drive.files?.length === 0 ? <Sub style={{ marginTop: 8 }}>ما فيه نسخ محفوظة في هذا الحساب.</Sub> : null}
            {drive.files?.map((file) => (
              <Spread key={file.id} style={{ marginTop: 8, gap: 8 }}>
                <T style={{ flex: 1 }}>{file.name === `Maydan-Backup-${drive.session?.device.slice(0, 8)}.zip` ? 'هذا الجهاز' : file.name}{'\n' + formatDate(riyadhNow(new Date(file.modifiedTime)).date, { year: true }) + ' · ' + (Number(file.size) / 1024 / 1024).toFixed(1) + ' م.ب'}</T>
                <Button small variant="secondary" label="استعادة" disabled={drive.busy} onPress={() => drive.restore(file, onRestore)} />
              </Spread>
            ))}
            <Button small variant="ghost" label="فصل الحساب" disabled={drive.busy} onPress={drive.disconnect} />
          </>
        ) : <Button label="ربط Google Drive" icon="cloud" disabled={drive.busy} onPress={drive.connect} />}
        {drive.busy ? <Sub>جاري العمل مع Google Drive…</Sub> : null}
        {drive.status ? <Sub accessibilityLiveRegion="polite">{drive.status}</Sub> : null}
      </Card>
    </>
  );
}
