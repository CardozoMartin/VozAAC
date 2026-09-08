// expo-speech habla con el motor TTS nativo, que en Jest no existe: se mockea
// para poder verificar qué se mandó a decir sin depender del dispositivo.
jest.mock('expo-speech', () => ({
  speak: jest.fn(),
  stop: jest.fn(),
}));

jest.mock('@react-native-async-storage/async-storage', () =>
  // require y no import: la factory de jest.mock se evalúa antes que los
  // imports del módulo, y es la forma que documenta la propia librería.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
