import { fetch } from 'expo/fetch';
import { downloadDriveBackup, listDriveArchive, listDriveBackups, saveDriveArchiveItem, uploadDriveBackup } from '../../drive/api';
import { BACKUP_LIMIT } from '../backup';

jest.mock('expo/fetch', () => ({ fetch: jest.fn() }));
const mockedFetch = jest.mocked(fetch);
const token = 'fixture-token';
const device = '4b5a0c00-6e97-4f3d-8882-000000000001';
const session = 'https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&upload_id=fixture';
const file = { id: 'fixture-id', name: 'Maydan-Backup.zip', size: '3', modifiedTime: '2026-11-10T12:00:00Z' };
const bytes = Uint8Array.of(1, 2, 3);

function reply(body: unknown, location: string | null = null) {
  mockedFetch.mockResolvedValueOnce({ ok: true, status: 200, json: async () => body, headers: { get: () => location }, arrayBuffer: async () => bytes.buffer } as unknown as Awaited<ReturnType<typeof fetch>>);
}
beforeEach(() => mockedFetch.mockReset());

test('lists only Maydan backup metadata', async () => {
  reply({ files: [file] });
  expect(await listDriveBackups(token)).toEqual([file]);
  const [url, options] = mockedFetch.mock.calls[0];
  expect(new URL(String(url)).searchParams.get('q')).toContain("trashed = false and appProperties has { key='maydanFormat' and value='backup-v1' }");
  expect(options?.headers).toEqual({ Authorization: `Bearer ${token}` });
});

test('updates only the rolling backup of the current installation', async () => {
  reply({ files: [file] });
  reply(null, session);
  reply(file);
  expect(await uploadDriveBackup(token, device, bytes)).toEqual(file);
  expect(new URL(String(mockedFetch.mock.calls[0][0])).searchParams.get('q')).toContain(`value='${device}'`);
  expect(mockedFetch).toHaveBeenNthCalledWith(2, expect.stringContaining(`/files/${file.id}?`), expect.objectContaining({ method: 'PATCH' }));
  expect(mockedFetch).toHaveBeenNthCalledWith(3, session, expect.objectContaining({ method: 'PUT', redirect: 'error', body: bytes.buffer, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/zip' } }));
});

test('does not send the archive to an unexpected session host', async () => {
  reply({ files: [] });
  reply(null, 'https://not-google.example/upload/drive/v3/files?upload_id=fixture');
  await expect(uploadDriveBackup(token, device, bytes)).rejects.toThrow();
  expect(mockedFetch).toHaveBeenCalledTimes(2);
});

test('checks download size before reading and downloads valid archives', async () => {
  await expect(downloadDriveBackup(token, { ...file, size: String(BACKUP_LIMIT + 1) })).rejects.toThrow();
  expect(mockedFetch).not.toHaveBeenCalled();
  reply(null);
  expect(await downloadDriveBackup(token, file)).toEqual(bytes);
});

test('creates a folder under its parent and moves an existing record without creating a duplicate', async () => {
  const folder = { ...file, name: '2026-11-10 - زيارة', parents: ['month-11'] };
  reply(folder);
  await saveDriveArchiveItem(token, { key: 'visit', name: folder.name, folder: 'month-11' });
  expect(JSON.parse(String(mockedFetch.mock.calls[0][1]?.body))).toMatchObject({ parents: ['month-11'], mimeType: 'application/vnd.google-apps.folder' });

  reply({ ...folder, name: '2026-12-10 - زيارة', parents: ['month-12'] });
  await saveDriveArchiveItem(token, { key: 'visit', name: '2026-12-10 - زيارة', folder: 'month-12' }, folder);
  const [url, options] = mockedFetch.mock.calls[1];
  expect(String(url)).toContain('/files/' + folder.id + '?');
  expect(new URL(String(url)).searchParams.get('addParents')).toBe('month-12');
  expect(new URL(String(url)).searchParams.get('removeParents')).toBe('month-11');
  expect(options?.method).toBe('PATCH');
});

test('reuses the saved PDF and renders again only when the contents change', async () => {
  const previous = { ...file, name: 'visit.pdf', parents: ['visit-folder'], appProperties: { maydanDigest: 'current' } };
  const read = jest.fn(async () => bytes);
  const item = { key: 'visit-pdf', name: previous.name, folder: 'visit-folder', content: { mimeType: 'application/pdf', digest: 'current', read } };
  expect(await saveDriveArchiveItem(token, item, previous)).toBe(previous);
  expect(read).not.toHaveBeenCalled();
  expect(mockedFetch).not.toHaveBeenCalled();

  reply(null, session);
  reply(previous);
  await saveDriveArchiveItem(token, { ...item, content: { ...item.content, digest: 'changed' } }, previous);
  expect(read).toHaveBeenCalledTimes(1);
  expect(mockedFetch).toHaveBeenNthCalledWith(1, expect.stringContaining('/files/' + previous.id + '?'), expect.objectContaining({ method: 'PATCH' }));
});

test('loads the next archive page and keeps the first match for each managed key', async () => {
  const first = { ...file, appProperties: { maydanKey: 'root' } };
  reply({ files: [first], nextPageToken: 'next' });
  reply({ files: [{ ...first, id: 'duplicate' }, { ...file, id: 'record', appProperties: { maydanKey: 'record' } }] });
  const catalog = await listDriveArchive(token);
  expect(catalog.get('root')).toEqual(first);
  expect(catalog.get('record')?.id).toBe('record');
  expect(new URL(String(mockedFetch.mock.calls[1][0])).searchParams.get('pageToken')).toBe('next');
});
