import { describe, expect, it, jest } from '@jest/globals';

import { collectSampledSnapshot, collectSnapshot } from '../../src/collector.js';

const connection = {
  host: 'server.example.com',
  port: 22,
  username: 'ops'
};

describe('collectSnapshot', () => {
  it('parses Linux metric output into a snapshot', async () => {
    const snapshot = await collectSnapshot(connection, {
      run: async () => ({
        cpu: '83\n4.20 3.80 2.20 123/456 789\n8',
        memory: '8192 4096 2048\n128 1024',
        disk: '/dev/sda1 / 100 60 60\n/dev/sdb1 /data 200 100 50',
        network: 'eth0 12345 67890\nens5 222 333',
        processes: '100 nginx 15.5 3.2 nginx: worker\n200 node 75.0 12.1 node api.js',
        os: '6.8.0\nserver.example.com\nUbuntu 24.04.1 LTS\n86400'
      })
    });

    expect(snapshot.host).toBe('server.example.com');
    expect(snapshot.cpu.usage_percent).toBe(83);
    expect(snapshot.cpu.core_count).toBe(8);
    expect(snapshot.memory.usage_percent).toBe(50);
    expect(snapshot.disk).toHaveLength(2);
    expect(snapshot.network[0]).toEqual({ interface: 'eth0', rx_bytes: 12345, tx_bytes: 67890 });
    expect(snapshot.processes[1]?.command).toBe('node api.js');
    expect(snapshot.os.distro).toBe('Ubuntu 24.04.1 LTS');
  });

  it('falls back safely when optional lines are missing', async () => {
    const snapshot = await collectSnapshot(connection, {
      run: async () => ({
        cpu: '0\n0.00 0.00 0.00 0/0 0\n4',
        memory: '',
        disk: '',
        network: '',
        processes: '',
        os: '\n\n\n'
      })
    });

    expect(snapshot.memory.total_mb).toBe(0);
    expect(snapshot.disk).toEqual([]);
    expect(snapshot.network).toEqual([]);
    expect(snapshot.processes).toEqual([]);
    expect(snapshot.os.hostname).toBe('server.example.com');
  });

  it('parses tab-delimited process output from the collector command', async () => {
    const snapshot = await collectSnapshot(connection, {
      run: async () => ({
        cpu: '50\n1.00 0.80 0.60 0/0 0\n4',
        memory: '4096 2048 2048\n0 0',
        disk: '/dev/sda1 / 50 20 40',
        network: 'eth0 100 200',
        processes: '300\tjava\t44.1\t8.2\tjava -jar service.jar',
        os: '6.8.0\nserver.example.com\nUbuntu 24.04.1 LTS\n86400'
      })
    });

    expect(snapshot.processes[0]).toEqual({
      pid: 300,
      name: 'java',
      cpu_percent: 44.1,
      mem_percent: 8.2,
      command: 'java -jar service.jar'
    });
  });

  it('surfaces collection errors from the SSH layer', async () => {
    await expect(
      collectSnapshot(connection, {
        run: async () => {
          throw new Error('command timed out');
        }
      })
    ).rejects.toThrow('command timed out');
  });

  it('averages sampled metrics across the requested collection window', async () => {
    jest.useFakeTimers();

    let sampleIndex = 0;
    const sampledPromise = collectSampledSnapshot(connection, 1, 30, {
      run: async () => {
        sampleIndex += 1;

        if (sampleIndex === 1) {
          return {
            cpu: '20\n1.00 0.90 0.80 0/0 0\n4',
            memory: '8192 2048 6144\n0 1024',
            disk: '/dev/sda1 / 100 20 20',
            network: 'eth0 100 200',
            processes: '100 nginx 10.0 2.0 nginx',
            os: '6.8.0\nserver.example.com\nUbuntu 24.04.1 LTS\n86400'
          };
        }

        return {
          cpu: '80\n3.00 2.50 2.00 0/0 0\n4',
          memory: '8192 6144 2048\n128 1024',
          disk: '/dev/sda1 / 100 60 60',
          network: 'eth0 300 400',
          processes: '200 node 70.0 12.0 node api.js',
          os: '6.8.0\nserver.example.com\nUbuntu 24.04.1 LTS\n86500'
        };
      }
    });

    await jest.advanceTimersByTimeAsync(30_000);
    const snapshot = await sampledPromise;
    jest.useRealTimers();

    expect(sampleIndex).toBe(2);
    expect(snapshot.cpu.usage_percent).toBe(50);
    expect(snapshot.cpu.load_1).toBe(2);
    expect(snapshot.memory.used_mb).toBe(4096);
    expect(snapshot.memory.usage_percent).toBe(50);
    expect(snapshot.disk[0]?.usage_percent).toBe(60);
    expect(snapshot.processes[0]?.command).toBe('node api.js');
  });
});
