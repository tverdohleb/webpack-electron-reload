import { spawn } from 'cross-spawn';
import { ChildProcess, SpawnOptions } from 'child_process';

interface IOptions {
  electron: string;
  path: string;
  spawnOpt: { stdio: ['inherit', 'inherit', 'inherit', 'ipc'] };
  useGlobalElectron?: boolean;
  killOnClose?: boolean;
}

class ProcessManager {
  protected electronProc?: ChildProcess;
  protected opt: IOptions;

  constructor(options: Partial<IOptions>) {
    let electron;
    if (options && options.useGlobalElectron) {
      electron = 'electron';
    } else {
      try {
        electron = require('electron');
      } catch (e) {
        if (e.code === 'MODULE_NOT_FOUND') {
          electron = 'electron';
        }
      }
    }

    this.opt = {
      ...{
        electron,
        path: process.cwd(),
        spawnOpt: { stdio: ['inherit', 'inherit', 'inherit', 'ipc'] },
      },
      ...(options || {}),
    };
  }

  protected spawn(spawnOpt: SpawnOptions) {
    const args = ['-r process'];
    this.electronProc = spawn(this.opt.electron, args.concat([this.opt.path]), spawnOpt);
    this.opt.killOnClose && this.killWatcher();
    this.info(`started electron process: ${this.electronProc!.pid}`);
  }

  protected info(msg: string) {
    console.log(`[${new Date().toISOString()}] [webpack-electron-reload] [server] ${msg}`);
  }

  protected verbose(msg: string) {
    console.log(`[${new Date().toISOString()}] [webpack-electron-reload] [server] ${msg}`);
  }

  start() {
    this.spawn(this.opt.spawnOpt);
  }
  restart() {
    if (this.electronProc) {
      this.info(`killing electron process: ${this.electronProc.pid}`);
      try {
        process.kill(this.electronProc.pid);
      } catch (error) {
        console.error(error);
      }
      this.info('respawning electron process..');
      this.spawn(this.opt.spawnOpt);
    }
  }
  killWatcher() {
    if (this.electronProc) {
      this.electronProc.on('message', ({ msg }) => {
        if (msg === 'close') {
          process.kill(process.pid);
        }
      });
    }
  }
}

function createWebpackElectronReloadPlugin(options) {
  let server: ProcessManager;

  return function() {
    return {
      apply: function apply(compiler) {
        compiler.hooks.done.tap('WebpackElectronReload', () => {
          if (!server) {
            server = new ProcessManager(options || {});
            server.start();
          } else {
            server.restart();
          }
        });
      },
    };
  };
}

module.exports = createWebpackElectronReloadPlugin;
