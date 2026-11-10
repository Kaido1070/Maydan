import type { ReactNode } from 'react';
import type { unpackBackup } from '../domain/backup';

export type DriveBackupCardProps = { onRestore: (archive: ReturnType<typeof unpackBackup>) => void };

export function DriveBackupProvider({ children }: { children: ReactNode }) { return children; }
export const DriveBackupCard: (props: DriveBackupCardProps) => null = () => null;
