import { SerialPort } from 'serialport';

const PORT = 'COM5';
const BAUD = 9600;

const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
const send = (port: SerialPort, cmd: string) => new Promise<void>((resolve) => port.write(cmd + '\n', () => wait(300).then(resolve)));

const port = new SerialPort({ path: PORT, baudRate: BAUD, autoOpen: false });
port.on('error', (e) => console.error('SERIAL ERROR:', e.message));

port.open(async () => {
  await wait(2500);

  console.log('=== PHASE 1 (6s): NORMAL_TRAFFIC - both GREEN should be ON ===');
  await send(port, 'NORMAL_TRAFFIC');
  await wait(6000);

  console.log('=== PHASE 2 (6s): COUNTDOWN:CARS:8 - CARS display "8" ===');
  await send(port, 'COUNTDOWN:CARS:8');
  await wait(6000);

  console.log('=== PHASE 3 (6s): COUNTDOWN:PEDS:8 - PEDS display "8" ===');
  await send(port, 'COUNTDOWN:PEDS:8');
  await wait(6000);

  console.log('=== PHASE 4 (6s): back to NORMAL (green, displays clear) ===');
  await send(port, 'NORMAL_TRAFFIC');
  await wait(6000);

  console.log('=== DONE ===');
  await new Promise<void>((r) => port.close(() => r()));
  process.exit(0);
});