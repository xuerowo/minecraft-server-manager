import { platform as osPlatform } from 'os';

export const platform = osPlatform();
export const isDev = process.env.NODE_ENV === 'development' || !process.env.NODE_ENV;
export const isWin = platform === 'win32';
export const isMac = platform === 'darwin';
export const isLinux = platform === 'linux';

export const getExecutableExtension = (): string => {
  return isWin ? '.exe' : '';
};

export const getJavaExecutable = (): string => {
  return `java${getExecutableExtension()}`;
};