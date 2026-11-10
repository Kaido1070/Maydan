import { fetch } from 'expo/fetch';
import { downloadDriveBackup, listDriveBackups, uploadDriveBackup } from '../../drive/api';
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
  expect(decodeURIComponent(String(url))).toContain("trashed = false and appProperties has { key='maydanFormat' and value='backup-v1' }");
  expect(options?.headers).toEqual({ Authorization: `Bearer ${token}` });
});

test('updates only the rolling backup of the current installation', async () => {
  reply({ files: [file] });
  reply(null, session);
  reply(file);
  expect(await uploadDriveBackup(token, device, bytes)).toEqual(file);
  expect(decodeURIComponent(String(mockedFetch.mock.calls[0][0]))).toContain(`value='${device}'`);
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
