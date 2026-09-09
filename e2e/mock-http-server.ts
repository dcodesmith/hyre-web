import type { Server } from "node:http";

const LISTEN_ATTEMPTS = 30;
const LISTEN_RETRY_MS = 200;

function isAddressInUse(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error && error.code === "EADDRINUSE";
}

function listenOnce(server: Server, port: number) {
  return new Promise<void>((resolve, reject) => {
    const onError = (error: Error) => {
      server.off("listening", onListening);
      reject(error);
    };
    const onListening = () => {
      server.off("error", onError);
      resolve();
    };

    server.once("error", onError);
    server.once("listening", onListening);
    server.listen(port, "127.0.0.1");
  });
}

function wait(ms: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

export async function listenOnMockApiPort(server: Server, port = 3100) {
  for (let attempt = 0; attempt < LISTEN_ATTEMPTS; attempt += 1) {
    try {
      await listenOnce(server, port);
      return;
    } catch (error) {
      if (!isAddressInUse(error) || attempt === LISTEN_ATTEMPTS - 1) {
        throw error;
      }

      await wait(LISTEN_RETRY_MS);
    }
  }
}

export function closeMockApiServer(server: Server) {
  return new Promise<void>((resolve, reject) => {
    if (!server.listening) {
      resolve();
      return;
    }

    server.closeAllConnections();
    server.close((error) => {
      if (error && "code" in error && error.code === "ERR_SERVER_NOT_RUNNING") {
        resolve();
        return;
      }

      if (error) {
        reject(error);
        return;
      }

      resolve();
    });
  });
}
